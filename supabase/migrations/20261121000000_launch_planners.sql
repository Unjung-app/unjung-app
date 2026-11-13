-- 11-06 호원 결정
--  · 기획행정부(8명)는 학번으로 자동 지정 → 설문·안건 투표를 바로 만들 수 있고, 학생 공지도 검토 없이 바로 게시
--  · 출시 기념 이벤트: 11/8(일) 22:00 ~ 11/22(일) 23:59 토큰 보상 2배 + 웰컴 토큰 50(한 번)
--    기간·배수·선물은 app_config 'launch_event'만 바꾸면 된다(앱 화면도 이 값을 읽는다)

-- ───────── 기획행정부 명단 ─────────
insert into public.app_config values ('planners', '20218,10811,20206,20209,20308,20703,10223,10505')
on conflict (key) do update set value = excluded.value;

update public.profiles p set is_planner = true
  from public.enrollments e
 where e.user_id = p.id and e.school_year = public.current_school_year()
   and e.student_no = any (string_to_array((select value from public.app_config where key = 'planners'), ','))
   and not p.is_planner;

create or replace function public._grant_listed_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.student_no = any (string_to_array((select value from public.app_config where key = 'planners'), ',')) then
    update public.profiles set is_planner = true where id = new.user_id and not is_planner;
  end if;
  return new;
end $$;
drop trigger if exists enrollments_grant_roles on public.enrollments;
create trigger enrollments_grant_roles after insert or update of student_no, user_id on public.enrollments
  for each row execute function public._grant_listed_roles();
revoke all on function public._grant_listed_roles() from public, anon, authenticated;

-- 학생 공지 바로 게시: 소통홍보부 + 기획행정부(관리자는 기존처럼 검토)
create or replace function public._notice_auto_approve()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public._is_comm_member() or coalesce((select is_planner from public.profiles where id = new.author), false) then
    new.status := 'approved';
    new.reviewer := new.author;
    new.reviewed_at := now();
  end if;
  return new;
end $$;

-- ───────── 출시 기념 이벤트 ─────────
insert into public.app_config values ('launch_event', '{"from":"2026-11-08T22:00:00+09:00","until":"2026-11-22T23:59:59+09:00","mult":2,"gift":50}')
on conflict (key) do update set value = excluded.value;

create or replace function public._launch_mult(p_reason text)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  ev jsonb;
begin
  if p_reason not in ('check_in', 'meal_review', 'study', 'survey', 'game_score', 'game_best', 'done', 'notice_approved', 'lost_found') then return 1; end if;
  select value::jsonb into ev from public.app_config where key = 'launch_event';
  if ev is null or now() < (ev->>'from')::timestamptz or now() > (ev->>'until')::timestamptz then return 1; end if;
  return greatest(1, least(5, coalesce((ev->>'mult')::int, 1)));
exception when others then
  return 1;
end $$;
revoke all on function public._launch_mult(text) from public, anon, authenticated;

-- 모든 보상이 지나가는 곳에서 배수를 곱한다(차감·관리자 보정은 그대로)
create or replace function public.award_tokens(p_user uuid, p_delta int, p_reason text, p_ref text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.token_ledger (user_id, delta, reason, ref_id)
  values (p_user, case when p_delta > 0 then p_delta * public._launch_mult(p_reason) else p_delta end, p_reason, coalesce(p_ref, ''))
  on conflict (user_id, reason, ref_id) do nothing;
  return found;
end $$;
revoke all on function public.award_tokens(uuid, int, text, text) from public, anon, authenticated;

create or replace function public.launch_event()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  ev jsonb := (select value::jsonb from public.app_config where key = 'launch_event');
begin
  if ev is null then return jsonb_build_object('active', false); end if;
  return ev || jsonb_build_object(
    'active', now() between (ev->>'from')::timestamptz and (ev->>'until')::timestamptz,
    'started', now() >= (ev->>'from')::timestamptz,
    'gift_claimed', exists (select 1 from public.token_ledger where user_id = auth.uid() and reason = 'launch_gift'));
end $$;

create or replace function public.claim_launch_gift()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ev jsonb := (select value::jsonb from public.app_config where key = 'launch_event');
  n int := coalesce((ev->>'gift')::int, 0);
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if public.enrollment_of(auth.uid()) is null or (public.enrollment_of(auth.uid())).user_id is null then raise exception '학번을 먼저 등록해 주세요' using errcode = 'P0001'; end if;
  if ev is null or now() not between (ev->>'from')::timestamptz and (ev->>'until')::timestamptz or n <= 0 then
    raise exception '출시 기념 선물은 이벤트 기간에만 받을 수 있어요' using errcode = 'P0001';
  end if;
  insert into public.token_ledger (user_id, delta, reason, ref_id) values (auth.uid(), n, 'launch_gift', 'launch2026')
  on conflict (user_id, reason, ref_id) do nothing;
  return jsonb_build_object('got', case when found then n else 0 end);
end $$;
revoke all on function public.launch_event() from public, anon;
revoke all on function public.claim_launch_gift() from public, anon;
grant execute on function public.launch_event() to authenticated;
grant execute on function public.claim_launch_gift() to authenticated;
