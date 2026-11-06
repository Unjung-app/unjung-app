-- 11-06 호원 결정: 소통홍보부(9명)가 학교 행사 사진을 올리는 '행사 사진' 탭 + 공지는 검토 없이 바로 게시
--  · 사진은 앱에 직접(공개 버킷, 폰에서 1600px·600KB 이하로 줄여 올림), 영상은 유튜브 링크(일부 공개)로
--  · 소통홍보부 명단은 학번으로 관리(가입 전이어도 미리 지정)

insert into public.app_config values ('comm_members', '20504,10606,20215,20524,20613,20213,10323,10415,10805')
on conflict (key) do update set value = excluded.value;

-- 명단의 소통홍보부원인가(관리자 제외)
create or replace function public._is_comm_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments e
                  where e.user_id = auth.uid() and e.school_year = public.current_school_year()
                    and e.student_no = any (string_to_array((select value from public.app_config where key = 'comm_members'), ',')))
$$;

-- 행사 사진을 올릴 수 있는가(소통홍보부 + 관리자)
create or replace function public.is_comm()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.role = 'admin'
           or exists (select 1 from public.enrollments e
                       where e.user_id = p.id and e.school_year = public.current_school_year()
                         and e.student_no = any (string_to_array((select value from public.app_config where key = 'comm_members'), ',')))
      from public.profiles p where p.id = auth.uid()), false)
$$;
grant execute on function public.is_comm() to authenticated;

create table if not exists public.gallery_posts (
  id          bigint generated always as identity primary key,
  author      uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 2 and 40),
  body        text not null default '' check (char_length(body) <= 500),
  event_date  date not null,
  photos      text[] not null default '{}' check (cardinality(photos) <= 30),
  youtube     text check (youtube ~ '^[A-Za-z0-9_-]{11}$'),
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  check (cardinality(photos) > 0 or youtube is not null)
);
create index if not exists gallery_posts_recent on public.gallery_posts (event_date desc, id desc) where not hidden;
alter table public.gallery_posts enable row level security;
-- 학교 계정이면 누구나 보기(숨긴 글 제외). 쓰기는 함수로만
drop policy if exists gallery_read on public.gallery_posts;
create policy gallery_read on public.gallery_posts for select to authenticated using (not hidden and public.is_school_user());

-- 유튜브 주소 → 영상 id (youtu.be/ID, watch?v=ID, shorts/ID, embed/ID)
create or replace function public._youtube_id(p_url text)
returns text language sql immutable as $$
  select (regexp_match(coalesce(p_url, ''), '(?:youtu\.be/|[?&]v=|/shorts/|/embed/|/live/)([A-Za-z0-9_-]{11})'))[1]
$$;

create or replace function public.post_gallery(p_title text, p_body text, p_event_date date, p_photos text[], p_youtube text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  t text := btrim(coalesce(p_title, ''));
  yid text := nullif(btrim(coalesce(p_youtube, '')), '');
  rid bigint;
  ph text;
begin
  if not public.is_comm() then raise exception '소통홍보부만 올릴 수 있어요' using errcode = '42501'; end if;
  if char_length(t) < 2 or char_length(t) > 40 then raise exception '제목은 2~40자예요' using errcode = 'P0001'; end if;
  if yid is not null then
    yid := coalesce(public._youtube_id(yid), case when yid ~ '^[A-Za-z0-9_-]{11}$' then yid end);
    if yid is null then raise exception '유튜브 주소를 다시 확인해 주세요' using errcode = 'P0001'; end if;
  end if;
  foreach ph in array coalesce(p_photos, '{}') loop
    if split_part(ph, '/', 1) <> me::text then raise exception '사진 경로가 올바르지 않아요' using errcode = 'P0001'; end if;
  end loop;
  if coalesce(cardinality(p_photos), 0) = 0 and yid is null then raise exception '사진이나 영상 링크를 하나 이상 넣어 주세요' using errcode = 'P0001'; end if;
  if public.has_banned_word(t || ' ' || coalesce(p_body, '')) then raise exception '부적절한 표현이 들어 있어요' using errcode = 'P0001'; end if;
  insert into public.gallery_posts (author, title, body, event_date, photos, youtube)
  values (me, t, btrim(coalesce(p_body, '')), coalesce(p_event_date, public.seoul_today()), coalesce(p_photos, '{}'), yid)
  returning id into rid;
  return rid;
end $$;

create or replace function public.delete_gallery(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.gallery_posts set hidden = true where id = p_id and (author = auth.uid() or public.is_admin());
  if not found then raise exception '내가 올린 글만 지울 수 있어요' using errcode = '42501'; end if;
end $$;

revoke all on function public.post_gallery(text, text, date, text[], text) from public, anon;
revoke all on function public.delete_gallery(bigint) from public, anon;
grant execute on function public.post_gallery(text, text, date, text[], text) to authenticated;
grant execute on function public.delete_gallery(bigint) to authenticated;
revoke all on public.gallery_posts from anon;
grant select on public.gallery_posts to authenticated;

-- 사진 저장소: 공개 읽기(주소를 아는 사람만 볼 수 있는 긴 경로), 올리기는 소통홍보부만 자기 폴더에
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('gallery', 'gallery', true, 1048576, array['image/jpeg'])
    on conflict (id) do nothing;
    if not exists (select 1 from pg_policies where policyname = 'gallery_insert') then
      execute $p$create policy gallery_insert on storage.objects for insert to authenticated
        with check (bucket_id = 'gallery' and public.is_comm() and (storage.foldername(name))[1] = auth.uid()::text)$p$;
      execute $p$create policy gallery_delete on storage.objects for delete to authenticated
        using (bucket_id = 'gallery' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    end if;
  end if;
end $$;

-- 소통홍보부 공지는 검토 없이 바로 게시
create or replace function public._notice_auto_approve()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public._is_comm_member() then
    new.status := 'approved';
    new.reviewer := new.author;
    new.reviewed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists notices_comm_auto on public.notices;
create trigger notices_comm_auto before insert on public.notices for each row execute function public._notice_auto_approve();
revoke all on function public._notice_auto_approve() from public, anon, authenticated;
