-- 11-09 호원 결정(학생 의견 #29 #30)
--  · 수행평가·숙제 글에 사진 1장(앱에서 긴 변 1280px·300KB 이하로 줄여 올림, 위치정보 제거)
--  · 같은 수업을 듣는 다른 반(같은 학년)에도 한 번에 공유: 공유받은 반도 보고·확인하고·마감 알림을 받는다
-- 여러 번 실행해도 안전

alter table public.class_tasks add column if not exists photo_path text;
alter table public.class_tasks add column if not exists share_classes smallint[] not null default '{}';

-- 공유할 반 정리: 1~8반, 내 반·중복 제외
create or replace function public._task_share(p_share int[], p_own int)
returns smallint[] language sql immutable as $$
  select coalesce(array_agg(distinct x::smallint order by x::smallint), '{}')
    from unnest(coalesce(p_share, '{}')) x where x between 1 and 8 and x <> p_own
$$;

create or replace function public._task_photo_ok(p_path text)
returns boolean language sql stable as $$
  select p_path is null or (split_part(p_path, '/', 1) = auth.uid()::text and p_path ~ '^[0-9a-f-]{36}/[a-z0-9]{6,30}\.jpg$')
$$;

drop function if exists public.create_class_task(text, text, date, text);
create or replace function public.create_class_task(p_subject text, p_kind text, p_due date, p_body text, p_photo_path text default null, p_share int[] default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  e public.enrollments := public.enrollment_of(auth.uid());
  s text := btrim(coalesce(p_subject, ''));
  b text := btrim(coalesce(p_body, ''));
  today date := public.seoul_today();
  rid bigint;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if e.user_id is null then raise exception '학번을 먼저 등록해 주세요' using errcode = 'P0001'; end if;
  if char_length(s) < 1 or char_length(s) > 20 then raise exception '과목을 골라 주세요' using errcode = 'P0001'; end if;
  if char_length(b) > 200 then raise exception '내용은 200자까지 쓸 수 있어요' using errcode = 'P0001'; end if;
  if p_due < today or p_due > today + 180 then raise exception '마감일은 오늘부터 180일 안으로 골라 주세요' using errcode = 'P0001'; end if;
  if public.has_banned_word(s || ' ' || b) then raise exception '부적절한 표현이 들어 있어요' using errcode = 'P0001'; end if;
  if not public._task_photo_ok(p_photo_path) then raise exception '사진을 다시 올려 주세요' using errcode = 'P0001'; end if;
  if (select count(*) from public.class_tasks where author = me and (created_at at time zone 'Asia/Seoul')::date = today) >= 10 then
    raise exception '하루에 10개까지 올릴 수 있어요' using errcode = 'P0001';
  end if;
  insert into public.class_tasks (school_year, grade, class_no, author, subject, kind, due, body, photo_path, share_classes)
  values (e.school_year, e.grade, e.class_no, me, s, p_kind, p_due, b, p_photo_path, public._task_share(p_share, e.class_no))
  returning id into rid;
  return rid;
end $$;
revoke all on function public.create_class_task(text, text, date, text, text, int[]) from public, anon;
grant execute on function public.create_class_task(text, text, date, text, text, int[]) to authenticated;

-- 수정: 작성자만. 과목·종류·마감일·내용·사진이 바뀌면 '확인'을 처음부터(공유 반만 바꾸면 그대로)
drop function if exists public.update_class_task(bigint, text, text, date, text);
create or replace function public.update_class_task(p_id bigint, p_subject text, p_kind text, p_due date, p_body text,
  p_photo_path text default null, p_photo_change boolean default false, p_share int[] default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  t public.class_tasks;
  s text := btrim(coalesce(p_subject, ''));
  b text := btrim(coalesce(p_body, ''));
  ph text;
begin
  select * into t from public.class_tasks where id = p_id and author = auth.uid() and not deleted for update;
  if not found then raise exception '내가 올린 글만 고칠 수 있어요' using errcode = 'P0001'; end if;
  if char_length(s) < 1 or char_length(s) > 20 or char_length(b) > 200 then
    raise exception '과목은 1~20자, 내용은 200자까지예요' using errcode = 'P0001';
  end if;
  if p_due < public.seoul_today() - 1 or p_due > public.seoul_today() + 180 then
    raise exception '마감일을 다시 골라 주세요' using errcode = 'P0001';
  end if;
  if public.has_banned_word(s || ' ' || b) then raise exception '부적절한 표현이 들어 있어요' using errcode = 'P0001'; end if;
  ph := case when coalesce(p_photo_change, false) then p_photo_path else t.photo_path end;
  if coalesce(p_photo_change, false) and not public._task_photo_ok(p_photo_path) then raise exception '사진을 다시 올려 주세요' using errcode = 'P0001'; end if;
  if (t.subject, t.kind, t.due, t.body, t.photo_path) is distinct from (s, p_kind, p_due, b, ph) then
    delete from public.task_confirms where task_id = p_id;
    update public.class_tasks
       set subject = s, kind = p_kind, due = p_due, body = b, photo_path = ph, confirm_count = 0, confirmed_at = null, updated_at = now()
     where id = p_id;
  end if;
  if p_share is not null then
    update public.class_tasks set share_classes = public._task_share(p_share, t.class_no) where id = p_id;
  end if;
end $$;
revoke all on function public.update_class_task(bigint, text, text, date, text, text, boolean, int[]) from public, anon;
grant execute on function public.update_class_task(bigint, text, text, date, text, text, boolean, int[]) to authenticated;

-- 우리 반 글 = 우리 반에서 올렸거나 우리 반에 공유한 글
create or replace function public.task_in_my_class(p_task bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_tasks t
      join public.enrollments e on e.user_id = auth.uid() and e.school_year = t.school_year
                               and e.grade = t.grade and (e.class_no = t.class_no or e.class_no = any (t.share_classes))
     where t.id = p_task and not t.deleted)
  and public.is_school_user()
$$;

create or replace view public.class_task_feed as
  select t.id, t.subject, t.kind, t.due, t.body, t.confirm_count,
         (t.confirmed_at is not null) as confirmed,
         t.created_at, t.updated_at,
         (t.author = auth.uid()) as mine,
         exists (select 1 from public.task_confirms c where c.task_id = t.id and c.user_id = auth.uid()) as i_confirmed,
         p.nickname as author_nickname,
         (select count(*)::int from public.task_suggestions s where s.task_id = t.id and not s.resolved) as open_suggestions,
         t.photo_path,
         t.share_classes,
         t.class_no as from_class
    from public.class_tasks t
    join public.enrollments e on e.user_id = auth.uid() and e.school_year = t.school_year
                             and e.grade = t.grade and (e.class_no = t.class_no or e.class_no = any (t.share_classes))
    left join public.profiles p on p.id = t.author
   where not t.deleted and public.is_school_user();

-- 사진 저장소: 비공개. 올리기는 내 폴더에, 보기는 그 글을 볼 수 있는 학생만
do $$
begin
  if to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('task-photos', 'task-photos', false, 512000, array['image/jpeg'])
    on conflict (id) do nothing;
    execute 'drop policy if exists task_photos_insert on storage.objects';
    execute 'drop policy if exists task_photos_select on storage.objects';
    execute 'drop policy if exists task_photos_delete on storage.objects';
    execute $p$create policy task_photos_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'task-photos' and public.is_school_user() and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy task_photos_select on storage.objects for select to authenticated
      using (bucket_id = 'task-photos' and public.is_school_user() and (
        (storage.foldername(name))[1] = auth.uid()::text
        or exists (select 1 from public.class_task_feed f where f.photo_path = storage.objects.name)))$p$;
    execute $p$create policy task_photos_delete on storage.objects for delete to authenticated
      using (bucket_id = 'task-photos' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end $$;

-- 마감 알림·아침 알림에 공유받은 반 포함
create or replace function public.push_enqueue_morning(p_day date)
returns int language plpgsql security definer set search_path = public as $$
declare
  lunch text := (select array_to_string(dishes[1:3], ', ') from public.meals_cache where day = p_day and code = 2);
  n int := 0;
  r record;
  first text;
  due int;
  b text;
begin
  if not public.is_school_day(p_day) then return 0; end if;
  for r in
    select e.user_id, e.grade, e.class_no from public.enrollments e
     where e.school_year = public.current_school_year() and public.push_wants(e.user_id, 'morning')
  loop
    first := (select l.subject from public.class_lessons l where l.grade = r.grade and l.class_no = r.class_no and l.day = p_day order by l.period limit 1);
    due := (select count(*) from public.class_tasks t where t.grade = r.grade and (t.class_no = r.class_no or r.class_no = any (t.share_classes)) and t.due = p_day and not t.deleted);
    b := concat_ws(' · ',
           case when first is not null then '1교시 ' || first end,
           case when lunch is not null then '점심 ' || lunch end,
           case when due > 0 then '오늘 마감 ' || due || '개' end);
    if public.push_to(r.user_id, 'morning', 'morning:' || p_day,
         '오늘 ' || extract(month from p_day)::int || '/' || extract(day from p_day)::int || ' (' || (array['월','화','수','목','금','토','일'])[extract(isodow from p_day)::int] || ')',
         coalesce(nullif(b, ''), '오늘 시간표와 급식을 확인해 보세요'), '/') then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ── 저녁 19:00: 내일 마감인 우리 반 과제 ──
create or replace function public.push_enqueue_deadlines(p_day date)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  c record;
begin
  for c in
    select t.grade, c2.class_no, count(*) as cnt,
           string_agg(t.subject || ' ' || case t.kind when 'assessment' then '수행평가' when 'homework' then '숙제' when 'supplies' then '준비물' else '시험' end,
                      ' · ' order by t.kind, t.subject) as list
      from public.class_tasks t
      cross join lateral unnest(array[t.class_no] || t.share_classes) as c2(class_no)  -- 같은 수업을 듣는 반에 공유한 글 포함
     where t.due = p_day + 1 and not t.deleted and t.school_year = public.current_school_year()
     group by t.grade, c2.class_no
  loop
    n := n + (select count(*) from (
      select public.push_to(e.user_id, 'deadline', 'deadline:' || (p_day + 1), '내일 마감 ' || c.cnt || '개', c.list, '/tasks') ok
        from public.enrollments e
       where e.school_year = public.current_school_year() and e.grade = c.grade and e.class_no = c.class_no) x where x.ok);
  end loop;
  return n;
end $$;
