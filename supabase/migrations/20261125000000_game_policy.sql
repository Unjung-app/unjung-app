-- 11-08 호원 결정: 게임 교체 기준 = 교체 결정 직전 4주 동안 '플레이한 학생 수'(개발자 계정 제외).
-- 새로 들어온 게임은 첫 업데이트 한 번은 교체 대상에서 뺀다. 한 사람이 여러 게임 가능, 탈락한 게임은 고치면 다시 검토.
-- 사용 현황에 '최근 4주' 게임별 표를 추가한다.

create or replace function public.admin_usage()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  today date := public.seoul_today();
  yr int := public.current_school_year();
  since date := coalesce((select ((value::jsonb)->>'from')::timestamptz at time zone 'Asia/Seoul' from public.app_config where key = 'launch_event')::date, today - 30);
begin
  if not (public.is_admin() or public.is_developer()) then raise exception '관리자·개발자만 볼 수 있어요' using errcode = '42501'; end if;
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
revoke all on function public.admin_usage() from public, anon;
grant execute on function public.admin_usage() to authenticated;
