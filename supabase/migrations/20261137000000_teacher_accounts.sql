-- 11-10 호원 결정: 선생님 계정 시스템
--  · 학교 계정 중 앞 5자리가 숫자가 아니면 교직원 계정 → 처음 로그인할 때 이름(필수)·담임 반·담당(선택)을 쓰면 바로 선생님(자동, 승인 없음)
--  · 선생님: 공지 바로 게시(전체·학년·반) · 행사 사진 올리기 · 설문 만들기('선생님 설문') · 앱 사용 현황 읽기
--            · 스터디 윗미 이용 현황(학년·반 합계 + 학생 이름별 기록, 모든 선생님)
--  · 익명 건의는 관리자 권한이 있는 선생님만(기존 규칙 그대로)
--  · 관리자: 선생님 계정에 관리자 권한 주기/빼기, 공용·행정 계정은 '선생님 해제'로 막기
--  · 11-09의 선생님 명단(teachers)은 '로그인 전에 미리 등록(관리자 권한 포함)'으로 쓴다
-- 여러 번 실행해도 안전

alter table public.profiles add column if not exists teacher_home_grade smallint check (teacher_home_grade between 1 and 3);
alter table public.profiles add column if not exists teacher_home_class smallint check (teacher_home_class between 1 and 15);
alter table public.profiles add column if not exists teacher_dept text check (char_length(teacher_dept) <= 30);
alter table public.profiles add column if not exists teacher_blocked boolean not null default false;

-- 학생 계정 = 앞 5자리가 숫자
create or replace function public.is_student_email(p_email text)
returns boolean language sql immutable as $$
  select coalesce(split_part(lower(p_email), '@', 1) ~ '^[0-9]{5}', false)
$$;

-- 교직원 계정이 선생님으로 쓸 수 있는 상태인가(로그인한 본인)
create or replace function public.can_be_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_school_user()
     and not public.is_student_email(auth.jwt() ->> 'email')
     and not exists (select 1 from public.enrollments e where e.user_id = auth.uid())
     and not coalesce((select teacher_blocked from public.profiles where id = auth.uid()), false)
$$;
grant execute on function public.can_be_teacher() to authenticated;

create or replace function public.is_teacher(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = p_user and p.teacher_name is not null and not p.teacher_blocked)
$$;

-- 선생님 정보 등록·수정(처음 로그인할 때, 설정에서)
create or replace function public.register_teacher(p_name text, p_home_grade int default null, p_home_class int default null, p_dept text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  nm text := btrim(coalesce(p_name, ''));
  dp text := nullif(btrim(coalesce(p_dept, '')), '');
  pre public.teachers;
begin
  if not public.can_be_teacher() then
    raise exception '선생님 계정으로 쓸 수 없는 계정이에요(학생 계정이거나 관리자가 해제한 계정)' using errcode = '42501';
  end if;
  if nm !~ '^[가-힣]{2,5}$' then raise exception '이름을 한글 2~5자로 적어 주세요(예: 박경애)' using errcode = 'P0001'; end if;
  if (p_home_grade is null) <> (p_home_class is null) then raise exception '담임 학년과 반을 함께 골라 주세요' using errcode = 'P0001'; end if;
  if p_home_grade is not null and (p_home_grade not between 1 and 3 or p_home_class not between 1 and 15) then
    raise exception '담임 반을 다시 골라 주세요' using errcode = 'P0001';
  end if;
  if dp is not null and (char_length(dp) > 30 or public.has_banned_word(dp)) then raise exception '담당은 30자까지예요' using errcode = 'P0001'; end if;
  select * into pre from public.teachers where email = lower(auth.jwt() ->> 'email');
  update public.profiles
     set teacher_name = nm, teacher_home_grade = p_home_grade, teacher_home_class = p_home_class, teacher_dept = dp,
         role = case when pre.admin then 'admin' else role end
   where id = auth.uid();
end $$;
revoke all on function public.register_teacher(text, int, int, text) from public, anon;
grant execute on function public.register_teacher(text, int, int, text) to authenticated;

-- 명단(미리 등록)은 이제 '권한 주기'만 한다. 명단에서 빠져도 선생님 계정은 그대로
create or replace function public._sync_teacher(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  t public.teachers;
begin
  select * into t from public.teachers where email = lower(p_email);
  if found then
    update public.profiles
       set teacher_name = coalesce(teacher_name, t.name), teacher_blocked = false,
           role = case when t.admin then 'admin' else role end
     where lower(email) = t.email and not exists (select 1 from public.enrollments e where e.user_id = profiles.id);
  end if;
end $$;

-- 학생이 선생님 항목을 직접 못 바꾸게
create or replace function public._profile_teacher_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.teacher_name is distinct from old.teacher_name or new.teacher_blocked is distinct from old.teacher_blocked
    or new.teacher_home_grade is distinct from old.teacher_home_grade or new.teacher_home_class is distinct from old.teacher_home_class
    or new.teacher_dept is distinct from old.teacher_dept) then
    raise exception '바꿀 수 없는 항목이에요' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists profiles_teacher_guard on public.profiles;
create trigger profiles_teacher_guard before update of teacher_name, teacher_blocked, teacher_home_grade, teacher_home_class, teacher_dept
  on public.profiles for each row execute function public._profile_teacher_guard();

-- ───────── 관리자: 선생님 계정 관리 ─────────
drop function if exists public.admin_list_teachers();
create function public.admin_list_teachers()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  return jsonb_build_object(
    'accounts', (select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', p.id, 'email', p.email, 'name', p.teacher_name, 'admin', p.role = 'admin', 'blocked', p.teacher_blocked,
        'home', case when p.teacher_home_grade is not null then p.teacher_home_grade || '-' || p.teacher_home_class end, 'dept', p.teacher_dept,
        'me', p.id = auth.uid()) order by p.teacher_blocked, p.teacher_name), '[]')
       from public.profiles p where p.teacher_name is not null or p.teacher_blocked),
    'pending', (select coalesce(jsonb_agg(jsonb_build_object('email', t.email, 'name', t.name, 'admin', t.admin) order by t.name), '[]')
       from public.teachers t where not exists (select 1 from public.profiles p where lower(p.email) = t.email)));
end $$;

-- 선생님 계정의 관리자 권한(학생 관리자 지정은 지금처럼 SQL로만)
create or replace function public.admin_set_teacher_admin(p_user uuid, p_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception '내 권한은 바꿀 수 없어요' using errcode = 'P0001'; end if;
  if not public.is_teacher(p_user) then raise exception '선생님 계정만 바꿀 수 있어요' using errcode = 'P0001'; end if;
  update public.profiles set role = case when p_admin then 'admin' else 'student' end where id = p_user;
  update public.teachers set admin = p_admin where email = (select lower(email) from public.profiles where id = p_user);
end $$;

-- 공용·행정 계정 등 선생님이 아닌 계정 막기 / 다시 풀기
create or replace function public.admin_block_teacher(p_user uuid, p_block boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception '내 계정은 바꿀 수 없어요' using errcode = 'P0001'; end if;
  if p_block then
    update public.profiles set teacher_blocked = true, teacher_name = coalesce(teacher_name, '해제됨'),
           role = case when role = 'admin' and teacher_name is not null then 'student' else role end
     where id = p_user and not public.is_student_email(email);
    get diagnostics n = row_count;
    delete from public.teachers where email = (select lower(email) from public.profiles where id = p_user);
  else
    update public.profiles set teacher_blocked = false, teacher_name = null where id = p_user and teacher_blocked;
    get diagnostics n = row_count;
  end if;
  if n = 0 then raise exception '바꿀 수 없는 계정이에요' using errcode = 'P0001'; end if;
end $$;

revoke all on function public.admin_list_teachers() from public, anon;
revoke all on function public.admin_set_teacher_admin(uuid, boolean) from public, anon;
revoke all on function public.admin_block_teacher(uuid, boolean) from public, anon;
grant execute on function public.admin_list_teachers() to authenticated;
grant execute on function public.admin_set_teacher_admin(uuid, boolean) to authenticated;
grant execute on function public.admin_block_teacher(uuid, boolean) to authenticated;

-- ───────── 행사 사진: 선생님도 ─────────
create or replace function public.is_comm()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.role = 'admin' or public.is_teacher(p.id)
           or exists (select 1 from public.enrollments e
                       where e.user_id = p.id and e.school_year = public.current_school_year()
                         and e.student_no = any (string_to_array((select value from public.app_config where key = 'comm_members'), ',')))
      from public.profiles p where p.id = auth.uid()), false)
$$;

-- ───────── 공지: 선생님은 전체·학년·반을 골라서 바로 게시 ─────────
drop function if exists public.submit_notice(text, text, text, date, text, date, int);
create or replace function public.submit_notice(
  p_kind text, p_title text, p_body text, p_event_date date, p_scope text, p_show_from date, p_show_days int,
  p_grade int default null, p_class int default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  e public.enrollments := public.enrollment_of(auth.uid());
  teacher boolean := public.is_teacher();
  t text := btrim(coalesce(p_title, ''));
  b text := btrim(coalesce(p_body, ''));
  today date := public.seoul_today();
  g int;
  c int;
  rid bigint;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if e.user_id is null and not teacher then raise exception '학번을 먼저 등록해 주세요' using errcode = 'P0001'; end if;
  if p_kind not in ('event', 'club', 'council', 'recruit', 'etc') then raise exception '종류를 골라 주세요' using errcode = 'P0001'; end if;
  if p_scope not in ('all', 'grade', 'class') then raise exception '알릴 범위를 골라 주세요' using errcode = 'P0001'; end if;
  if teacher then
    g := p_grade; c := p_class;
    if p_scope in ('grade', 'class') and (g is null or g not between 1 and 3) then raise exception '학년을 골라 주세요' using errcode = 'P0001'; end if;
    if p_scope = 'class' and (c is null or c not between 1 and 15) then raise exception '반을 골라 주세요' using errcode = 'P0001'; end if;
  else
    g := e.grade; c := e.class_no;
  end if;
  if char_length(t) < 2 or char_length(t) > 40 then raise exception '제목은 2~40자예요' using errcode = 'P0001'; end if;
  if char_length(b) < 5 or char_length(b) > 1000 then raise exception '내용은 5~1000자예요' using errcode = 'P0001'; end if;
  if p_show_from < today or p_show_from > today + 30 then raise exception '게시 시작일은 오늘부터 30일 안이에요' using errcode = 'P0001'; end if;
  if p_show_days < 1 or p_show_days > 14 then raise exception '게시 기간은 1~14일이에요' using errcode = 'P0001'; end if;
  if p_event_date is not null and (p_event_date < today or p_event_date > today + 180) then raise exception '날짜를 다시 확인해 주세요' using errcode = 'P0001'; end if;
  if public.has_banned_word(t || ' ' || b) then raise exception '부적절한 표현이 들어 있어요' using errcode = 'P0001'; end if;
  if (select count(*) from public.notices where author = me and status = 'pending') >= 3 then
    raise exception '검토를 기다리는 공지가 3개 있어요. 검토가 끝난 뒤 올려 주세요' using errcode = 'P0001';
  end if;
  insert into public.notices (author, author_grade, kind, title, body, event_date, scope, scope_grade, scope_class, show_from, show_until)
  values (me, e.grade, p_kind, t, b, p_event_date, p_scope,
          case when p_scope in ('grade', 'class') then g end,
          case when p_scope = 'class' then c end,
          p_show_from, p_show_from + p_show_days - 1)
  returning id into rid;
  return rid;
end $$;
revoke all on function public.submit_notice(text, text, text, date, text, date, int, int, int) from public, anon;
grant execute on function public.submit_notice(text, text, text, date, text, date, int, int, int) to authenticated;

-- ───────── 설문: 선생님도 만들기, 만든 사람은 결과·마감 ─────────
create or replace function public.create_survey(
  p_title text, p_description text, p_scope_grade int, p_days int, p_results text, p_questions jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_planner() or public.is_teacher()) then raise exception '기획행정부·선생님만 설문을 만들 수 있어요' using errcode = '42501'; end if;
  return public._survey_insert('open', p_title, p_description, p_scope_grade, p_days, p_results, p_questions);
end $$;

create or replace function public.close_survey(p_id bigint, p_delete boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_planner() or exists (select 1 from public.surveys where id = p_id and author = auth.uid() and status in ('open', 'closed'))) then
    raise exception '기획행정부나 만든 사람만 할 수 있어요' using errcode = '42501';
  end if;
  update public.surveys
     set status = case when p_delete then 'deleted' else 'closed' end,
         closes_at = least(closes_at, now())
   where id = p_id and status <> 'deleted';
  if not found then raise exception '없는 설문이에요' using errcode = 'P0001'; end if;
end $$;

create or replace function public.survey_results_visible(s public.surveys)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_planner()
      or s.author = auth.uid()
      or (s.results = 'after_close' and not public.survey_is_open(s))
      or (s.results = 'after_vote' and (not public.survey_is_open(s)
          or exists (select 1 from public.survey_responses r where r.survey_id = s.id and r.user_id = auth.uid())))
$$;

drop view if exists public.survey_feed; -- 열이 바뀌어도 다시 실행할 수 있게
create view public.survey_feed as
  select s.id, s.title, s.description, s.scope_grade, s.results, s.opens_at, s.closes_at,
         public.survey_is_open(s) as is_open,
         exists (select 1 from public.survey_responses r where r.survey_id = s.id and r.user_id = auth.uid()) as responded,
         (select count(*)::int from public.survey_responses r where r.survey_id = s.id) as response_count,
         (select count(*)::int from public.survey_questions qq where qq.survey_id = s.id) as question_count,
         public.survey_results_visible(s) as can_see_results,
         s.from_student,
         (select p.teacher_name from public.profiles p where p.id = s.author) as author_teacher
    from public.surveys s
   where public.is_school_user() and s.status in ('open', 'closed')
     and s.closes_at > now() - interval '30 days'
     and (public.is_planner() or public.is_teacher() or public.survey_for_me(s));
revoke all on public.survey_feed from public, anon;
grant select on public.survey_feed to authenticated;

create or replace function public.push_on_survey()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  head text := case when public.is_teacher(new.author) then '선생님 설문이 올라왔어요'
                    when new.from_student then '학생 설문이 올라왔어요' else '학생회 설문이 올라왔어요' end;
begin
  if new.status = 'open' and (tg_op = 'INSERT' or old.status = 'requested') then
    perform public.push_to(e.user_id, 'survey', 'survey:' || new.id, head, new.title || ' · 참여하면 +3 토큰', '/voice/survey/' || new.id)
       from public.enrollments e
      where e.school_year = public.current_school_year()
        and (new.scope_grade is null or e.grade = new.scope_grade);
  end if;
  return null;
end $$;

-- ───────── 스터디 윗미 이용 현황(선생님) ─────────
-- 학년·반별 이번 주 참여 인원·시간, 최근 14일 추이, 지금 공부 중
create or replace function public.teacher_study_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  yr int := public.current_school_year();
  today date := public.seoul_today();
  ws date := date_trunc('week', public.seoul_today())::date;
begin
  if not public.is_teacher() then raise exception '선생님만 볼 수 있어요' using errcode = '42501'; end if;
  return jsonb_build_object(
    'week_start', ws, 'today', today,
    'live', public.study_live(),
    'classes', (select coalesce(jsonb_agg(x order by x ->> 'grade', (x ->> 'class_no')::int), '[]') from (
        select jsonb_build_object(
          'grade', e.grade, 'class_no', e.class_no,
          'members', count(*),
          'studied', count(*) filter (where w.sec > 0),
          'week_seconds', coalesce(sum(w.sec), 0),
          'today_seconds', coalesce(sum(w.today_s), 0)) x
          from public.enrollments e
          left join lateral (
            select sum(d.ranked_seconds + d.class_seconds) sec,
                   sum(d.ranked_seconds + d.class_seconds) filter (where d.day = today) today_s
              from public.study_daily d where d.user_id = e.user_id and d.day between ws and ws + 6) w on true
         where e.school_year = yr and e.user_id is not null
         group by e.grade, e.class_no) q),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', g.day, 'students', coalesce(s.n, 0), 'seconds', coalesce(s.sec, 0)) order by g.day), '[]')
                from generate_series(today - 13, today, interval '1 day') g(day)
                left join (select d.day, count(distinct d.user_id) n, sum(d.ranked_seconds + d.class_seconds) sec
                             from public.study_daily d where d.day >= today - 13 and d.school_year = yr group by d.day) s on s.day = g.day::date)
  );
end $$;

-- 반별 학생 이름별 기록(모든 선생님)
create or replace function public.teacher_study_class(p_grade int, p_class int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  yr int := public.current_school_year();
  today date := public.seoul_today();
  ws date := date_trunc('week', public.seoul_today())::date;
begin
  if not public.is_teacher() then raise exception '선생님만 볼 수 있어요' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'number', e.number, 'name', e.name, 'nickname', p.nickname,
      'today_seconds', coalesce(s.t_today, 0), 'week_seconds', coalesce(s.t_week, 0), 'month_seconds', coalesce(s.t_month, 0),
      'total_seconds', coalesce(s.t_total, 0), 'days_30', coalesce(s.days30, 0), 'last_day', s.last_day,
      'live', public.study_is_live(e.user_id)
    ) order by e.number), '[]')
    from public.enrollments e
    left join public.profiles p on p.id = e.user_id
    left join lateral (
      select sum(d.ranked_seconds + d.class_seconds) filter (where d.day = today) t_today,
             sum(d.ranked_seconds + d.class_seconds) filter (where d.day between ws and ws + 6) t_week,
             sum(d.ranked_seconds + d.class_seconds) filter (where d.day > today - 30) t_month,
             sum(d.ranked_seconds + d.class_seconds) t_total,
             count(*) filter (where d.day > today - 30 and d.ranked_seconds + d.class_seconds >= 1800) days30,
             max(d.day) filter (where d.ranked_seconds + d.class_seconds > 0) last_day
        from public.study_daily d where d.user_id = e.user_id) s on true
   where e.school_year = yr and e.grade = p_grade and e.class_no = p_class and e.user_id is not null);
end $$;
revoke all on function public.teacher_study_overview() from public, anon;
revoke all on function public.teacher_study_class(int, int) from public, anon;
grant execute on function public.teacher_study_overview() to authenticated;
grant execute on function public.teacher_study_class(int, int) to authenticated;

-- 앱 사용 현황: 선생님도 읽기
create or replace function public.admin_usage()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  today date := public.seoul_today();
  yr int := public.current_school_year();
  since date := coalesce((select ((value::jsonb)->>'from')::timestamptz at time zone 'Asia/Seoul' from public.app_config where key = 'launch_event')::date, today - 30);
begin
  if not (public.is_admin() or public.is_developer() or public.is_teacher()) then raise exception '관리자·개발자·선생님만 볼 수 있어요' using errcode = '42501'; end if;
  return jsonb_build_object(
    'today', today,
    'accounts', (select count(*) from public.profiles),
    'enrolled', (select count(*) from public.enrollments where school_year = yr),
    'by_grade', (select coalesce(jsonb_object_agg(grade, n), '{}'::jsonb) from (select grade, count(*) n from public.enrollments where school_year = yr group by grade) g),
    'new_today', (select count(*) from public.enrollments where school_year = yr and (created_at at time zone 'Asia/Seoul')::date = today),
    'daily', (select jsonb_agg(jsonb_build_object('day', d::date,
                'active', (select count(distinct user_id) from public.token_ledger l
                            where l.reason = 'check_in' and (l.created_at at time zone 'Asia/Seoul')::date = d::date)) order by d)
                from generate_series(today - 13, today, interval '1 day') d),
    'week_active', (select count(distinct user_id) from public.token_ledger
                     where reason = 'check_in' and (created_at at time zone 'Asia/Seoul')::date > today - 7),
    'push', (select count(distinct user_id) from public.push_subscriptions),
    'features', jsonb_build_object(
      'study_users', (select count(distinct user_id) from public.study_daily where day > today - 7 and ranked_seconds + class_seconds > 0),
      'study_hours', (select coalesce(round(sum(ranked_seconds + class_seconds) / 3600.0, 1), 0) from public.study_daily where day > today - 7),
      'game_plays', (select count(*) from public.game_runs where (started_at at time zone 'Asia/Seoul')::date > today - 7),
      'game_users', (select count(distinct user_id) from public.game_runs where (started_at at time zone 'Asia/Seoul')::date > today - 7),
      'meal_reviews', (select count(*) from public.meal_reviews where (created_at at time zone 'Asia/Seoul')::date > today - 7),
      'notices', (select count(*) from public.notices where (created_at at time zone 'Asia/Seoul')::date > today - 7),
      'suggestions', (select count(*) from public.suggestions where (created_at at time zone 'Asia/Seoul')::date > today - 7),
      'survey_answers', (select count(*) from public.survey_responses where (created_at at time zone 'Asia/Seoul')::date > today - 7)
    ),
    'games_week', public._game_usage(today - 6),
    'games_4w', public._game_usage(today - 27),
    'games_since', public._game_usage(since),
    'games_since_day', since
  );
end $$;

-- 설문 한 개: 만든 사람(선생님 포함)은 결과·주관식을 본다, 선생님 설문 표시
create or replace function public.get_survey(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s public.surveys;
  vis boolean;
  planner boolean := public.is_planner();
  owner boolean;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  select * into s from public.surveys where id = p_id and status <> 'deleted';
  if not found then raise exception '없는 설문이에요' using errcode = 'P0001'; end if;
  owner := s.author = auth.uid();
  if s.status in ('requested', 'rejected') then
    if not (planner or owner) then raise exception '없는 설문이에요' using errcode = 'P0001'; end if;
  elsif not (planner or owner or public.survey_for_me(s)) then
    raise exception '없는 설문이에요' using errcode = 'P0001';
  end if;
  vis := public.survey_results_visible(s);
  return jsonb_build_object(
    'id', s.id, 'title', s.title, 'description', s.description, 'scope_grade', s.scope_grade, 'results', s.results,
    'closes_at', s.closes_at, 'is_open', public.survey_is_open(s),
    'status', s.status, 'from_student', s.from_student, 'author_teacher', (select teacher_name from public.profiles where id = s.author), 'owner', owner, 'review_note', s.review_note, 'req_days', s.req_days,
    'responded', exists (select 1 from public.survey_responses r where r.survey_id = s.id and r.user_id = auth.uid()),
    'response_count', (select count(*) from public.survey_responses r where r.survey_id = s.id),
    'can_see_results', vis,
    'by_grade', case when planner or owner then (select coalesce(jsonb_object_agg(g.grade, g.n), '{}') from
                  (select grade, count(*) n from public.survey_responses where survey_id = s.id group by grade) g) end,
    'questions', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', qq.id, 'ord', qq.ord, 'kind', qq.kind, 'prompt', qq.prompt, 'options', to_jsonb(qq.options), 'required', qq.required,
        'counts', case when vis and qq.kind <> 'text' then (
            select jsonb_agg((select count(*) from public.survey_answers sa where sa.question_id = qq.id and (i - 1)::smallint = any (sa.choices)) order by i)
              from generate_series(1, coalesce(array_length(qq.options, 1), 0)) i) end,
        'answered', case when vis then (select count(*) from public.survey_answers sa where sa.question_id = qq.id) end,
        'texts', case when (planner or owner) and qq.kind = 'text' then (
            select coalesce(jsonb_agg(sa.text_answer order by sa.text_answer), '[]') from public.survey_answers sa
             where sa.question_id = qq.id and sa.text_answer is not null) end
      ) order by qq.ord), '[]') from public.survey_questions qq where qq.survey_id = s.id)
  );
end $$;

-- 알림 설정의 업무 알림 설명에 선생님
create or replace function public._my_staff_roles()
returns text[] language sql stable security definer set search_path = public as $$
  select array_remove(array[
    case when p.role = 'admin' then '관리자: 앱 의견 · 학번 정정 요청' end,
    case when p.role in ('reviewer', 'admin') then '검토: 공지 검토 · 신고 · 분실물 사진' end,
    case when p.is_planner then '기획행정부: 익명 건의 · 설문 신청' end,
    case when auth.uid() in (select public._dev_user_ids()) then '개발자: 내 게임 의견' end
  ], null)
  from public.profiles p where p.id = auth.uid()
$$;
revoke all on function public._my_staff_roles() from public, anon, authenticated;

-- 미리 지정: 학생 계정(앞 5자리 숫자) 거부
create or replace function public.admin_add_teacher(p_email text, p_name text, p_admin boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare
  em text := lower(btrim(coalesce(p_email, '')));
  nm text := btrim(coalesce(p_name, ''));
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  if em !~ '^[a-z0-9._-]+@unjung\.hs\.kr$' then raise exception '학교 이메일(@unjung.hs.kr)을 정확히 적어 주세요' using errcode = 'P0001'; end if;
  if public.is_student_email(em) then raise exception '학생 계정(숫자 5자리로 시작)은 선생님으로 넣을 수 없어요' using errcode = 'P0001'; end if;
  if exists (select 1 from public.profiles p join public.enrollments e on e.user_id = p.id where lower(p.email) = em) then
    raise exception '학번이 등록된 학생 계정이에요' using errcode = 'P0001';
  end if;
  if nm !~ '^[가-힣]{2,5}$' then raise exception '이름을 한글 2~5자로 적어 주세요(예: 박경애)' using errcode = 'P0001'; end if;
  insert into public.teachers (email, name, admin, added_by) values (em, nm, coalesce(p_admin, true), auth.uid())
  on conflict (email) do update set name = excluded.name, admin = excluded.admin;
end $$;
