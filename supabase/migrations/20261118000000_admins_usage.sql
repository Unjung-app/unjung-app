-- 11-06 호원 피드백 반영 (2)
--  · 최종 관리자는 20818 이호원, 20512 배종범 두 명뿐. 학번으로 등록하면 자동으로 관리자가 되고, 그 밖의 관리자는 학생으로 돌린다.
--  · 관리자용 앱 사용 현황(가입·매일 접속·기능별 사용)

insert into public.app_config values ('admins', '20818,20512')
on conflict (key) do update set value = excluded.value;

create or replace function public._admin_numbers()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(string_to_array((select value from public.app_config where key = 'admins'), ','), '{}')
$$;

-- 지금 관리자 정리: 명단의 학번은 관리자로, 나머지 관리자는 학생으로
update public.profiles p set role = 'student'
 where p.role = 'admin'
   and not exists (select 1 from public.enrollments e where e.user_id = p.id and e.student_no = any (public._admin_numbers()));
update public.profiles p set role = 'admin'
  from public.enrollments e
 where e.user_id = p.id and e.school_year = public.current_school_year() and e.student_no = any (public._admin_numbers()) and p.role <> 'admin';

-- 명단의 학번으로 학적을 등록하면 자동으로 관리자
create or replace function public._grant_listed_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.student_no = any (public._admin_numbers()) then
    update public.profiles set role = 'admin' where id = new.user_id and role <> 'admin';
  end if;
  return new;
end $$;
drop trigger if exists enrollments_grant_admin on public.enrollments;
create trigger enrollments_grant_admin after insert or update of student_no, user_id on public.enrollments
  for each row execute function public._grant_listed_admin();
revoke all on function public._grant_listed_admin() from public, anon, authenticated;
revoke all on function public._admin_numbers() from public, anon, authenticated;

-- 앱 사용 현황 (관리자 전용)
create or replace function public.admin_usage()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  today date := public.seoul_today();
  yr int := public.current_school_year();
begin
  if not public.is_admin() then raise exception '관리자만 볼 수 있어요' using errcode = '42501'; end if;
  return jsonb_build_object(
    'today', today,
    'accounts', (select count(*) from public.profiles),
    'enrolled', (select count(*) from public.enrollments where school_year = yr),
    'by_grade', (select coalesce(jsonb_object_agg(grade, n), '{}'::jsonb) from (select grade, count(*) n from public.enrollments where school_year = yr group by grade) g),
    'new_today', (select count(*) from public.enrollments where school_year = yr and (created_at at time zone 'Asia/Seoul')::date = today),
    -- 매일 접속(앱을 열면 자동 출석) 최근 14일
    'daily', (select jsonb_agg(jsonb_build_object('day', d::date,
                'active', (select count(distinct user_id) from public.token_ledger l
                            where l.reason = 'check_in' and (l.created_at at time zone 'Asia/Seoul')::date = d::date)) order by d)
                from generate_series(today - 13, today, interval '1 day') d),
    'week_active', (select count(distinct user_id) from public.token_ledger
                     where reason = 'check_in' and (created_at at time zone 'Asia/Seoul')::date > today - 7),
    'push', (select count(distinct user_id) from public.push_subscriptions),
    -- 최근 7일 기능별
    'features', jsonb_build_object(
      'study_users', (select count(distinct user_id) from public.study_daily where day > today - 7 and ranked_seconds + class_seconds > 0),
      'study_hours', (select coalesce(round(sum(ranked_seconds + class_seconds) / 3600.0, 1), 0) from public.study_daily where day > today - 7),
      'game_plays', (select count(*) from public.game_runs where (started_at at time zone 'Asia/Seoul')::date > today - 7),
      'game_users', (select count(distinct user_id) from public.game_runs where (started_at at time zone 'Asia/Seoul')::date > today - 7),
      'meal_reviews', (select count(*) from public.meal_reviews where (created_at at time zone 'Asia/Seoul')::date > today - 7),
      'notices', (select count(*) from public.notices where (created_at at time zone 'Asia/Seoul')::date > today - 7),
      'suggestions', (select count(*) from public.suggestions where (created_at at time zone 'Asia/Seoul')::date > today - 7),
      'survey_answers', (select count(*) from public.survey_responses where (created_at at time zone 'Asia/Seoul')::date > today - 7)
    )
  );
end $$;
revoke all on function public.admin_usage() from public, anon;
grant execute on function public.admin_usage() to authenticated;
