-- 운중고 앱 v3 — 학교 데이터 동기화 · 시간표 기반 수업 시간 · 의견 보내기
--  · Vercel Cron(api/cron/sync-school)이 매일 새벽 NEIS 시간표·급식·학사일정을 sync_school_data 로 넣는다.
--    이 함수는 서버 비밀키(service_role)만 부를 수 있다.
--  · 수업 시간 판정을 '우리 반 그날 실제 시간표' 기준으로 바꾼다(7교시 없는 날 15:30~16:20은 수업 아님).
--    시간표 자료가 없는 날은 예전처럼 1~7교시 전부를 수업으로 본다.
--  · 의견 보내기: 버그·개선 요청. 관리자가 '반영 완료'로 바꾸면 작성자에게 +5.

-- ───────────────────────── 학교 데이터 ─────────────────────────

create table public.class_lessons (
  school_year  int not null,
  grade        smallint not null,
  class_no     smallint not null,
  day          date not null,
  period       smallint not null,
  subject      text not null,
  primary key (grade, class_no, day, period)
);

create table public.meals_cache (
  day     date not null,
  code    smallint not null,
  dishes  text[] not null,
  primary key (day, code)
);

create table public.school_events (
  day      date not null,
  name     text not null,
  holiday  boolean not null default false,
  primary key (day, name)
);

create table public.sync_log (
  id       bigint generated always as identity primary key,
  ran_at   timestamptz not null default now(),
  summary  jsonb not null
);

-- 서버 전용: 기간 안의 자료를 지우고 새로 넣는다 (시간표 변경·보강 반영). 쉬는 날은 추가만 한다(관리자가 넣은 것 보존).
create or replace function public.sync_school_data(
  p_school_year int, p_from date, p_to date, p_lessons jsonb, p_meals jsonb,
  p_events_from date, p_events_to date, p_events jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n_l int; n_m int; n_e int; n_off int;
begin
  delete from public.class_lessons where day between p_from and p_to;
  insert into public.class_lessons (school_year, grade, class_no, day, period, subject)
  select p_school_year, (x->>'grade')::int, (x->>'class_no')::int, (x->>'day')::date, (x->>'period')::int, left(x->>'subject', 30)
    from jsonb_array_elements(coalesce(p_lessons, '[]')) x
  on conflict do nothing;
  get diagnostics n_l = row_count;

  delete from public.meals_cache where day between p_from and p_to;
  insert into public.meals_cache (day, code, dishes)
  select (x->>'day')::date, (x->>'code')::int, array(select jsonb_array_elements_text(x->'dishes'))
    from jsonb_array_elements(coalesce(p_meals, '[]')) x
  on conflict do nothing;
  get diagnostics n_m = row_count;

  delete from public.school_events where day between p_events_from and p_events_to;
  insert into public.school_events (day, name, holiday)
  select (x->>'day')::date, left(x->>'name', 40), coalesce((x->>'holiday')::boolean, false)
    from jsonb_array_elements(coalesce(p_events, '[]')) x
  on conflict do nothing;
  get diagnostics n_e = row_count;

  insert into public.days_off (day, label)
  select day, min(name) from public.school_events
   where holiday and day between p_events_from and p_events_to and extract(isodow from day) < 6
   group by day
  on conflict (day) do nothing;
  get diagnostics n_off = row_count;

  insert into public.sync_log (summary) values (jsonb_build_object('lessons', n_l, 'meals', n_m, 'events', n_e, 'days_off_added', n_off));
  return jsonb_build_object('lessons', n_l, 'meals', n_m, 'events', n_e, 'days_off_added', n_off);
end $$;
revoke all on function public.sync_school_data(int, date, date, jsonb, jsonb, date, date, jsonb) from public, anon, authenticated;
grant execute on function public.sync_school_data(int, date, date, jsonb, jsonb, date, date, jsonb) to service_role;

-- ───────────────────────── 수업 시간 (반·실제 시간표 기준) ─────────────────────────

create or replace function public.period_at(p_grade int, p_at timestamptz)
returns int language sql immutable as $$
  select v.p from (values (1, 520, 570), (2, 580, 630), (3, 640, 690),
                          (4, case when p_grade = 3 then 750 else 700 end, case when p_grade = 3 then 800 else 750 end),
                          (5, 810, 860), (6, 870, 920), (7, 930, 980)) as v(p, s, e)
   where public.seoul_minutes(p_at) >= v.s and public.seoul_minutes(p_at) < v.e
$$;

create or replace function public.is_class_time(p_grade int, p_class int, p_at timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  with t as (select (p_at at time zone 'Asia/Seoul')::date as d, public.period_at(p_grade, p_at) as p)
  select coalesce(public.is_school_day(t.d) and t.p is not null and (
           case when exists (select 1 from public.class_lessons l where l.grade = p_grade and l.class_no = p_class and l.day = t.d)
                then exists (select 1 from public.class_lessons l where l.grade = p_grade and l.class_no = p_class and l.day = t.d and l.period = t.p)
                else true end), false)
    from t
$$;

-- 공부 세션이 반 시간표 기준 판정을 쓰도록 다시 정의 (본문은 3주차와 같고 is_class_time 호출만 다름)
create or replace function public._start_study(p_user uuid, p_subject text, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e public.enrollments := public.enrollment_of(p_user);
  s text := nullif(btrim(coalesce(p_subject, '')), '');
  sid uuid;
begin
  if e.user_id is null then raise exception '학번을 먼저 등록해 주세요' using errcode = 'P0001'; end if;
  if s is not null and (char_length(s) > 20 or public.has_banned_word(s)) then
    raise exception '과목 이름을 다시 확인해 주세요' using errcode = 'P0001';
  end if;
  update public.study_sessions set ended_at = last_beat_at where user_id = p_user and ended_at is null;
  insert into public.study_sessions (user_id, school_year, grade, class_no, subject, started_at, last_beat_at)
  values (p_user, e.school_year, e.grade, e.class_no, s, p_now, p_now)
  returning id into sid;
  return jsonb_build_object('id', sid, 'in_class', public.is_class_time(e.grade, e.class_no, p_now),
                            'today', public._study_today(p_user, (p_now at time zone 'Asia/Seoul')::date));
end $$;

create or replace function public._beat_study(p_user uuid, p_id uuid, p_now timestamptz, p_skip boolean, p_end boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.study_sessions;
  d public.study_daily;
  gap int;
  credit int := 0;
  ranked int := 0;
  in_class boolean;
  dday date := (p_now at time zone 'Asia/Seoul')::date;
  due int;
  k int;
begin
  perform pg_advisory_xact_lock(hashtext('ledger:' || p_user::text));
  select * into s from public.study_sessions where id = p_id and user_id = p_user and ended_at is null for update;
  if not found then
    return jsonb_build_object('ended', true, 'reason', 'not_found', 'today', public._study_today(p_user, dday));
  end if;

  gap := floor(extract(epoch from (p_now - s.last_beat_at)))::int;
  if gap > 90 then
    update public.study_sessions set ended_at = last_beat_at where id = p_id;
    return jsonb_build_object('ended', true, 'reason', 'timeout', 'today', public._study_today(p_user, dday));
  end if;
  if not p_skip and gap > 0 then credit := gap; end if;

  in_class := public.is_class_time(s.grade, s.class_no, p_now - make_interval(secs => credit / 2.0));

  if credit > 0 then
    insert into public.study_daily (user_id, day, school_year, grade, class_no)
    values (p_user, dday, s.school_year, s.grade, s.class_no)
    on conflict (user_id, day) do nothing;
    select * into d from public.study_daily where user_id = p_user and day = dday for update;
    if in_class then
      update public.study_daily set class_seconds = class_seconds + credit where user_id = p_user and day = dday;
    else
      ranked := greatest(0, least(credit, 12 * 3600 - d.ranked_seconds));
      update public.study_daily set ranked_seconds = ranked_seconds + ranked, class_seconds = class_seconds + (credit - ranked)
       where user_id = p_user and day = dday;
      due := least(30, (d.ranked_seconds + ranked) / 600);
      if due > d.tokens then
        for k in d.tokens + 1 .. due loop
          perform public.award_tokens(p_user, 1, 'study', dday::text || ':' || k);
        end loop;
        update public.study_daily set tokens = due where user_id = p_user and day = dday;
      end if;
    end if;
  end if;

  update public.study_sessions
     set last_beat_at = p_now,
         ranked_seconds = ranked_seconds + ranked,
         class_seconds = class_seconds + (credit - ranked),
         ended_at = case when p_end then p_now else null end
   where id = p_id;

  return jsonb_build_object('ended', p_end, 'in_class', public.is_class_time(s.grade, s.class_no, p_now),
                            'credited', credit, 'today', public._study_today(p_user, dday));
end $$;

-- 앱이 '지금 수업 중인지' 물을 때 (게임 잠금 안내 등)
create or replace function public.my_class_time_now()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select public.is_class_time(e.grade, e.class_no, now()) from public.enrollment_of(auth.uid()) e where e.user_id is not null), false)
$$;

-- ───────────────────────── 의견 보내기 ─────────────────────────

create table public.feedback (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  kind         text not null check (kind in ('bug', 'idea', 'other')),
  body         text not null check (char_length(body) between 5 and 1000),
  screen       text check (char_length(screen) <= 100),
  app_version  text check (char_length(app_version) <= 30),
  device       text check (char_length(device) <= 200),
  status       text not null default 'new' check (status in ('new', 'seen', 'done', 'wontfix')),
  reply        text check (char_length(reply) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index feedback_by_status on public.feedback (status, created_at desc);

create or replace function public.submit_feedback(p_kind text, p_body text, p_screen text, p_app_version text, p_device text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  b text := btrim(coalesce(p_body, ''));
  rid bigint;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if p_kind not in ('bug', 'idea', 'other') then raise exception '종류를 골라 주세요' using errcode = 'P0001'; end if;
  if char_length(b) < 5 or char_length(b) > 1000 then raise exception '내용은 5~1000자로 써 주세요' using errcode = 'P0001'; end if;
  if (select count(*) from public.feedback where user_id = me and created_at > now() - interval '1 day') >= 5 then
    raise exception '하루에 5개까지 보낼 수 있어요' using errcode = 'P0001';
  end if;
  insert into public.feedback (user_id, kind, body, screen, app_version, device)
  values (me, p_kind, b, left(p_screen, 100), left(p_app_version, 30), left(p_device, 200))
  returning id into rid;
  return rid;
end $$;

-- 관리자: 상태·답변. '반영 완료(done)'가 되면 작성자 +5 (한 번만)
create or replace function public.admin_update_feedback(p_id bigint, p_status text, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
declare
  author uuid;
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  if p_status not in ('new', 'seen', 'done', 'wontfix') then raise exception '잘못된 상태예요' using errcode = 'P0001'; end if;
  update public.feedback set status = p_status, reply = nullif(btrim(coalesce(p_reply, '')), ''), updated_at = now()
   where id = p_id returning user_id into author;
  if not found then raise exception '없는 의견이에요' using errcode = 'P0001'; end if;
  if p_status = 'done' then perform public.award_tokens(author, 5, 'feedback_done', p_id::text); end if;
end $$;

-- 관리자용 목록 (작성자 닉네임·학년반까지. 실명·이메일은 필요할 때 관리자가 따로 조회)
create view public.feedback_admin as
  select f.id, f.kind, f.body, f.screen, f.app_version, f.device, f.status, f.reply, f.created_at, f.updated_at,
         p.nickname, e.grade, e.class_no
    from public.feedback f
    join public.profiles p on p.id = f.user_id
    left join public.enrollments e on e.user_id = f.user_id and e.school_year = public.current_school_year()
   where public.is_admin();

-- ───────────────────────── 권한(RLS) ─────────────────────────

alter table public.class_lessons enable row level security;
alter table public.meals_cache enable row level security;
alter table public.school_events enable row level security;
alter table public.sync_log enable row level security;
alter table public.feedback enable row level security;

create policy class_lessons_read on public.class_lessons for select using (public.is_school_user());
create policy meals_cache_read on public.meals_cache for select using (public.is_school_user());
create policy school_events_read on public.school_events for select using (public.is_school_user());
create policy sync_log_admin on public.sync_log for select using (public.is_admin());
create policy feedback_read_own on public.feedback for select using (user_id = auth.uid());

revoke all on public.feedback_admin from public, anon;
grant select on public.feedback_admin to authenticated;
grant execute on function public.my_class_time_now() to authenticated;
grant execute on function public.submit_feedback(text, text, text, text, text) to authenticated;
grant execute on function public.admin_update_feedback(bigint, text, text) to authenticated;
