-- 11-09 호원 요청: 권한이 있는 학생에게 '처리할 일' 알림(업무 알림)
--  · 앱 기능 의견 → 관리자 / 게임 의견 → 그 게임을 만든 개발자(app_config 'game_owners', 없으면 개발자 전체)
--  · 익명 건의 → 기획행정부 / 공지 검토 대기 · 신고 · 분실물 사진 확인 → 검토위원(관리자 포함)
--  · 학번 정정 요청 → 관리자
--  · 몰려와도 시끄럽지 않게: 같은 종류는 30분에 한 번만 울린다(그 사이 들어온 것은 화면에서 확인)
--  · 수업 시간에는 원래 규칙대로 쉬는 시간에 보낸다. 알림 설정의 '업무 알림'으로 끌 수 있다.

-- ───────── 종류·설정 ─────────
alter table public.push_outbox drop constraint if exists push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check check (kind in ('mine', 'deadline', 'morning', 'survey', 'test', 'staff'));
alter table public.push_prefs add column if not exists staff boolean not null default true;

-- 게임별 담당 개발자(학번). 새 게임을 넣을 때 함께 적는다
insert into public.app_config values ('game_owners',
  '{"patrol":"20513","disaster":"20612","runner":"20505","unjungil":"20818","defense":"20702","tower":"20516","campus_walk":"10718"}')
on conflict (key) do update set value = excluded.value;

create or replace function public.push_wants(p_user uuid, p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.push_subscriptions s where s.user_id = p_user)
     and case p_kind
           when 'test' then true
           when 'mine' then coalesce((select mine from public.push_prefs where user_id = p_user), true)
           when 'deadline' then coalesce((select deadline from public.push_prefs where user_id = p_user), true)
           when 'morning' then coalesce((select morning from public.push_prefs where user_id = p_user), true)
           when 'survey' then coalesce((select survey from public.push_prefs where user_id = p_user), false)
           when 'staff' then coalesce((select staff from public.push_prefs where user_id = p_user), true)
           else false end
$$;

-- 권한별 받는 사람
create or replace function public._staff_users(p_group text, p_game text default null)
returns setof uuid language plpgsql stable security definer set search_path = public as $$
declare
  owners text;
begin
  if p_group = 'admin' then
    return query select id from public.profiles where role = 'admin';
  elsif p_group = 'reviewer' then
    return query select id from public.profiles where role in ('reviewer', 'admin');
  elsif p_group = 'planner' then
    return query select id from public.profiles where is_planner;
  elsif p_group = 'game' then
    begin
      owners := (select value::jsonb ->> p_game from public.app_config where key = 'game_owners');
    exception when others then owners := null;
    end;
    if owners is null or owners = '' then
      return query select public._dev_user_ids();
    else
      return query select e.user_id from public.enrollments e
        where e.school_year = public.current_school_year() and e.user_id is not null
          and e.student_no = any (string_to_array(owners, ','));
    end if;
  end if;
end $$;
revoke all on function public._staff_users(text, text) from public, anon, authenticated;

-- 한 무리에 업무 알림 보내기(30분 묶음: 같은 event는 30분에 한 번)
create or replace function public._push_staff(p_group text, p_event text, p_title text, p_body text, p_url text, p_game text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  bucket text := to_char(date_trunc('hour', now()) + floor(extract(minute from now()) / 30) * interval '30 minutes', 'YYYYMMDDHH24MI');
  u uuid;
begin
  for u in select distinct x from public._staff_users(p_group, p_game) x loop
    perform public.push_to(u, 'staff', p_event || ':' || bucket, p_title, p_body, p_url);
  end loop;
exception when others then
  raise notice '업무 알림 실패: %', sqlerrm; -- 알림이 실패해도 글쓰기는 그대로
end $$;
revoke all on function public._push_staff(text, text, text, text, text, text) from public, anon, authenticated;

-- ───────── 사건별 트리거 ─────────

create or replace function public.push_staff_feedback()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  g text := case when new.screen like 'game:%' then substr(new.screen, 6) end;
begin
  if g is not null then
    perform public._push_staff('game', 'fb-game-' || g, '🎮 내 게임에 새 의견이 왔어요', left(new.body, 80), '/admin/feedback', g);
  else
    perform public._push_staff('admin', 'fb-app', '🛠️ 새 앱 의견이 들어왔어요', left(new.body, 80), '/admin/feedback');
  end if;
  return null;
end $$;
drop trigger if exists feedback_staff_push on public.feedback;
create trigger feedback_staff_push after insert on public.feedback for each row execute function public.push_staff_feedback();

create or replace function public.push_staff_suggestion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._push_staff('planner', 'sugg', '📢 새 익명 건의가 올라왔어요', left(new.title, 80), '/voice?tab=suggest');
  return null;
end $$;
drop trigger if exists suggestions_staff_push on public.suggestions;
create trigger suggestions_staff_push after insert on public.suggestions for each row execute function public.push_staff_suggestion();

create or replace function public.push_staff_notice()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    perform public._push_staff('reviewer', 'notice-review', '📋 검토할 공지가 있어요', left(new.title, 80), '/review');
  end if;
  return null;
end $$;
drop trigger if exists notices_staff_push on public.notices;
create trigger notices_staff_push after insert on public.notices for each row execute function public.push_staff_notice();

create or replace function public.push_staff_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._push_staff('reviewer', 'report', '🚩 새 신고가 들어왔어요', '검토하기에서 확인해 주세요', '/review');
  return null;
end $$;
drop trigger if exists notice_reports_staff_push on public.notice_reports;
create trigger notice_reports_staff_push after insert on public.notice_reports for each row execute function public.push_staff_report();
drop trigger if exists meal_review_reports_staff_push on public.meal_review_reports;
create trigger meal_review_reports_staff_push after insert on public.meal_review_reports for each row execute function public.push_staff_report();
drop trigger if exists suggestion_reports_staff_push on public.suggestion_reports;
create trigger suggestion_reports_staff_push after insert on public.suggestion_reports for each row execute function public.push_staff_report();

create or replace function public.push_staff_lost_photo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.photo_status = 'pending' and (tg_op = 'INSERT' or old.photo_status is distinct from 'pending') then
    perform public._push_staff('reviewer', 'lost-photo', '🔎 확인할 분실물 사진이 있어요', left(new.item, 80), '/review');
  end if;
  return null;
end $$;
drop trigger if exists lost_items_staff_push on public.lost_items;
create trigger lost_items_staff_push after insert or update of photo_status on public.lost_items for each row execute function public.push_staff_lost_photo();

do $$
begin
  if to_regclass('public.enrollment_requests') is not null then
    execute $f$
      create or replace function public.push_staff_enrollment()
      returns trigger language plpgsql security definer set search_path = public as $b$
      begin
        if new.status = 'pending' then
          perform public._push_staff('admin', 'enroll-req', '🪪 학번 정정 요청이 있어요', '학생 관리에서 확인해 주세요', '/admin/staff');
        end if;
        return null;
      end $b$;
    $f$;
    execute 'drop trigger if exists enrollment_requests_staff_push on public.enrollment_requests';
    execute 'create trigger enrollment_requests_staff_push after insert on public.enrollment_requests for each row execute function public.push_staff_enrollment()';
  end if;
end $$;

-- 트리거 함수는 직접 부를 수 없게
do $$
declare f record;
begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prorettype = 'trigger'::regtype and p.proname like 'push_staff_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- ───────── 설정 화면 ─────────

-- 내가 받는 업무 알림 종류(설정 화면에 보여 준다)
create or replace function public._my_staff_roles()
returns text[] language sql stable security definer set search_path = public as $$
  select array_remove(array[
    case when p.role = 'admin' then '관리자: 앱 의견 · 학번 정정 요청' end,
    case when p.role in ('reviewer', 'admin') then '검토: 공지 검토 · 신고 · 분실물 사진' end,
    case when p.is_planner then '기획행정부: 익명 건의' end,
    case when auth.uid() in (select public._dev_user_ids()) then '개발자: 내 게임 의견' end
  ], null)
  from public.profiles p where p.id = auth.uid()
$$;
revoke all on function public._my_staff_roles() from public, anon, authenticated;

create or replace function public.my_push_prefs()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'mine', coalesce(p.mine, true), 'deadline', coalesce(p.deadline, true), 'morning', coalesce(p.morning, true), 'survey', coalesce(p.survey, false),
    'staff', coalesce(p.staff, true), 'staff_roles', to_jsonb(coalesce(public._my_staff_roles(), '{}')),
    'devices', (select count(*) from public.push_subscriptions s where s.user_id = auth.uid()))
  from (select 1) one left join public.push_prefs p on p.user_id = auth.uid()
  where public.is_school_user()
$$;

drop function if exists public.set_push_prefs(boolean, boolean, boolean, boolean);
create or replace function public.set_push_prefs(p_mine boolean, p_deadline boolean, p_morning boolean, p_survey boolean, p_staff boolean default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  insert into public.push_prefs (user_id, mine, deadline, morning, survey, staff, updated_at)
  values (auth.uid(), coalesce(p_mine, true), coalesce(p_deadline, true), coalesce(p_morning, true), coalesce(p_survey, false), coalesce(p_staff, true), now())
  on conflict (user_id) do update set mine = excluded.mine, deadline = excluded.deadline, morning = excluded.morning, survey = excluded.survey,
    staff = coalesce(p_staff, public.push_prefs.staff), updated_at = now();
  return public.my_push_prefs();
end $$;
revoke all on function public.set_push_prefs(boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.set_push_prefs(boolean, boolean, boolean, boolean, boolean) to authenticated;
revoke all on function public.my_push_prefs() from public, anon;
grant execute on function public.my_push_prefs() to authenticated;
