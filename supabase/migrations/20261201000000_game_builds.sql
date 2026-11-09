-- 11-09 호원 결정: 개발자가 앱에서 게임 HTML 전체를 붙여 넣어 제출 → 관리자가 미리 플레이하고 승인하면 바로 반영.
-- 앱 연결 코드는 앱이 열 때 자동으로 넣는다(개발자는 점수 한 줄만). 이전 버전 5개를 보관해 되돌릴 수 있다.

create table if not exists public.game_builds (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game ~ '^[a-z][a-z0-9_]{1,29}$'),
  html text not null check (length(html) between 50 and 3000000),
  meta jsonb not null default '{}'::jsonb,   -- 새 게임 정보: title, emoji, desc, tag, how, by
  note text check (note is null or length(note) <= 300),
  author uuid not null references auth.users (id) on delete cascade,
  author_name text,
  status text not null default 'pending' check (status in ('pending', 'live', 'old', 'rejected')),
  reject_reason text check (reject_reason is null or length(reject_reason) <= 200),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);
create unique index if not exists game_builds_one_live on public.game_builds (game) where status = 'live';
create index if not exists game_builds_game_idx on public.game_builds (game, created_at desc);
create index if not exists game_builds_author_idx on public.game_builds (author, created_at desc);
alter table public.game_builds enable row level security;  -- 정책 없음: 아래 함수로만 읽고 쓴다

create or replace function public._clean_game_meta(p jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'title', left(nullif(trim(p->>'title'), ''), 20), 'emoji', left(nullif(trim(p->>'emoji'), ''), 8),
    'desc', left(nullif(trim(p->>'desc'), ''), 60), 'tag', left(nullif(trim(p->>'tag'), ''), 12),
    'how', left(nullif(trim(p->>'how'), ''), 120), 'by', left(nullif(trim(p->>'by'), ''), 30)))
$$;

-- 제출: 개발자·관리자. 한 사람 대기 중 3개, 하루 10번까지
create or replace function public.submit_game_build(p_game text, p_html text, p_meta jsonb, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  e public.enrollments := public.enrollment_of(me);
  rid uuid;
begin
  if not (public.is_admin() or public.is_developer()) then raise exception '개발자만 게임을 올릴 수 있어요' using errcode = '42501'; end if;
  if p_game is null or p_game !~ '^[a-z][a-z0-9_]{1,29}$' then raise exception '게임 id는 영문 소문자·숫자·_ 2~30자예요' using errcode = 'P0001'; end if;
  if p_html is null or length(p_html) < 50 then raise exception '게임 코드가 비어 있어요' using errcode = 'P0001'; end if;
  if length(p_html) > 3000000 then raise exception '게임 파일이 너무 커요(3MB까지)' using errcode = 'P0001'; end if;
  if (select count(*) from public.game_builds where author = me and status = 'pending') >= 3 then
    raise exception '검토를 기다리는 게임이 3개예요. 승인된 뒤에 올려 주세요' using errcode = 'P0001'; end if;
  if (select count(*) from public.game_builds where author = me and created_at > now() - interval '1 day') >= 10 then
    raise exception '하루에 10번까지 올릴 수 있어요' using errcode = 'P0001'; end if;
  -- 같은 게임의 내 대기 중 제출은 새 것으로 바꾼다
  delete from public.game_builds where author = me and game = p_game and status = 'pending';
  insert into public.game_builds (game, html, meta, note, author, author_name)
  values (p_game, p_html, public._clean_game_meta(coalesce(p_meta, '{}'::jsonb)), left(nullif(trim(p_note), ''), 300), me, e.name)
  returning id into rid;
  return rid;
end $$;

-- 목록(코드 제외): 관리자는 전부, 개발자는 자기 것 + 지금 반영된 것
create or replace function public.game_builds_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare admin boolean := public.is_admin();
begin
  if not (admin or public.is_developer()) then raise exception '관리자·개발자만 볼 수 있어요' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', b.id, 'game', b.game, 'status', b.status, 'meta', b.meta, 'note', b.note, 'author_name', b.author_name,
      'mine', b.author = auth.uid(), 'size', length(b.html), 'reject_reason', b.reject_reason,
      'created_at', b.created_at, 'reviewed_at', b.reviewed_at) order by b.created_at desc)
    from (select * from public.game_builds b
           where admin or b.author = auth.uid() or b.status = 'live'
           order by b.created_at desc limit 100) b), '[]'::jsonb);
end $$;

-- 코드: 반영된 것은 학교 계정 누구나(게임 실행), 나머지는 작성자·관리자
create or replace function public.game_build_html(p_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare b public.game_builds;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  select * into b from public.game_builds where id = p_id;
  if b.id is null then return null; end if;
  if b.status <> 'live' and not (public.is_admin() or b.author = auth.uid()) then raise exception '볼 수 없는 게임이에요' using errcode = '42501'; end if;
  return b.html;
end $$;

-- 지금 반영된 게임(앱 게임 목록에 섞는다)
create or replace function public.live_game_builds()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'game', game, 'meta', meta, 'author_name', author_name, 'updated_at', reviewed_at)), '[]'::jsonb)
    from public.game_builds where status = 'live' and public.is_school_user()
$$;

-- 승인(반영)·반려·되돌리기(예전 버전 승인): 관리자만
create or replace function public.review_game_build(p_id uuid, p_ok boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare b public.game_builds;
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  select * into b from public.game_builds where id = p_id for update;
  if b.id is null then raise exception '없는 제출이에요' using errcode = 'P0001'; end if;
  if p_ok then
    if b.status not in ('pending', 'old') then raise exception '대기 중이거나 예전 버전만 반영할 수 있어요' using errcode = 'P0001'; end if;
    update public.game_builds set status = 'old' where game = b.game and status = 'live';
    update public.game_builds set status = 'live', reviewed_at = now(), reviewed_by = auth.uid(), reject_reason = null where id = b.id;
    -- 예전 버전은 5개만 보관
    delete from public.game_builds where id in (
      select id from public.game_builds where game = b.game and status = 'old' order by coalesce(reviewed_at, created_at) desc offset 5);
  else
    if b.status <> 'pending' then raise exception '대기 중인 제출만 반려할 수 있어요' using errcode = 'P0001'; end if;
    update public.game_builds set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid(),
           reject_reason = left(coalesce(nullif(trim(p_reason), ''), '다시 확인해 주세요'), 200) where id = b.id;
  end if;
end $$;

-- 반영 중인 게임을 내린다(문제가 생겼을 때): 관리자만. 앱에 원래 들어 있던 판으로 돌아간다
create or replace function public.unpublish_game_build(p_game text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  update public.game_builds set status = 'old' where game = p_game and status = 'live';
end $$;

revoke all on function public._clean_game_meta(jsonb) from public, anon, authenticated;
revoke all on function public.submit_game_build(text, text, jsonb, text) from public, anon;
revoke all on function public.game_builds_list() from public, anon;
revoke all on function public.game_build_html(uuid) from public, anon;
revoke all on function public.live_game_builds() from public, anon;
revoke all on function public.review_game_build(uuid, boolean, text) from public, anon;
revoke all on function public.unpublish_game_build(text) from public, anon;
grant execute on function public.submit_game_build(text, text, jsonb, text) to authenticated;
grant execute on function public.game_builds_list() to authenticated;
grant execute on function public.game_build_html(uuid) to authenticated;
grant execute on function public.live_game_builds() to authenticated;
grant execute on function public.review_game_build(uuid, boolean, text) to authenticated;
grant execute on function public.unpublish_game_build(text) to authenticated;
