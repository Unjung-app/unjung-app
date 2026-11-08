-- 11-08 호원 결정: 게임을 맡는 앱 개발자(9명)에게 '개발자' 권한
--  · 볼 수 있는 것: 앱 사용 현황(게임별 사용량 포함), 학생이 보낸 앱 의견(닉네임·반까지만, 실명·학번 없음)
--  · 할 수 있는 것: 의견에 '확인 중' 표시와 답변. '반영 완료'(토큰 지급)와 '보류'는 관리자만
--  · 명단은 app_config 'developers'(학번). 바꾸면 바로 적용된다(계정 표시를 따로 고칠 필요 없음)
--  · 게임 정리 정책(1차 출시 뒤 게임별 사용량으로 5개만 남기고, 업데이트마다 꼴찌 1개 교체)의 근거 지표:
--    개발자 본인 계정의 플레이는 빼고 센다(자기 게임 판 수 부풀리기 방지)

insert into public.app_config values ('developers', '10309,20811,20505,10718,20612,10223,20516,20513,20702')
on conflict (key) do update set value = excluded.value;

create or replace function public._dev_user_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select e.user_id from public.enrollments e
   where e.school_year = public.current_school_year() and e.user_id is not null
     and e.student_no = any (string_to_array((select value from public.app_config where key = 'developers'), ','))
$$;
revoke all on function public._dev_user_ids() from public, anon, authenticated;

create or replace function public.is_developer()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_school_user() and auth.uid() in (select public._dev_user_ids())
$$;
revoke all on function public.is_developer() from public, anon;
grant execute on function public.is_developer() to authenticated;

-- ───────── 의견: 개발자도 보기 · 확인 중/답변 ─────────

create or replace view public.feedback_admin as
  select f.id, f.kind, f.body, f.screen, f.app_version, f.device, f.status, f.reply, f.created_at, f.updated_at,
         p.nickname, e.grade, e.class_no
    from public.feedback f
    join public.profiles p on p.id = f.user_id
    left join public.enrollments e on e.user_id = f.user_id and e.school_year = public.current_school_year()
   where public.is_admin() or public.is_developer();
revoke all on public.feedback_admin from public, anon;
grant select on public.feedback_admin to authenticated;

create or replace function public.admin_update_feedback(p_id bigint, p_status text, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
declare
  author uuid;
  admin boolean := public.is_admin();
begin
  if not (admin or public.is_developer()) then raise exception '관리자·개발자만 할 수 있어요' using errcode = '42501'; end if;
  if p_status not in ('new', 'seen', 'done', 'wontfix') then raise exception '잘못된 상태예요' using errcode = 'P0001'; end if;
  if not admin and p_status not in ('new', 'seen') then raise exception '반영 완료·보류는 관리자만 할 수 있어요' using errcode = '42501'; end if;
  update public.feedback set status = p_status, reply = nullif(btrim(coalesce(p_reply, '')), ''), updated_at = now()
   where id = p_id returning user_id into author;
  if not found then raise exception '없는 의견이에요' using errcode = 'P0001'; end if;
  if p_status = 'done' then perform public.award_tokens(author, 10, 'feedback_done', p_id::text); end if;
end $$;
revoke all on function public.admin_update_feedback(bigint, text, text) from public, anon;
grant execute on function public.admin_update_feedback(bigint, text, text) to authenticated;

-- ───────── 앱 사용 현황: 개발자도 보기 + 게임별 사용량 ─────────

-- 게임별: 최근 7일·출시 이후. 플레이한 학생 수(players)는 개발자 계정을 뺀다
create or replace function public._game_usage(p_since date)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x->>'players')::int desc, (x->>'plays')::int desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'game', r.game,
      'plays', count(*) filter (where r.user_id not in (select public._dev_user_ids())),
      'players', count(distinct r.user_id) filter (where r.user_id not in (select public._dev_user_ids())),
      'dev_plays', count(*) filter (where r.user_id in (select public._dev_user_ids())),
      'repeat_players', (select count(*) from (select r2.user_id from public.game_runs r2
                          where r2.game = r.game and (r2.started_at at time zone 'Asia/Seoul')::date >= p_since
                            and r2.user_id not in (select public._dev_user_ids())
                          group by r2.user_id having count(distinct (r2.started_at at time zone 'Asia/Seoul')::date) >= 2) t),
      'avg_minutes', round(coalesce(avg(extract(epoch from (r.finished_at - r.started_at)) / 60.0)
                       filter (where r.finished_at is not null and r.user_id not in (select public._dev_user_ids())), 0)::numeric, 1),
      'feedback', (select count(*) from public.feedback f where f.screen = 'game:' || r.game and (f.created_at at time zone 'Asia/Seoul')::date >= p_since)
    ) x
    from public.game_runs r
    where (r.started_at at time zone 'Asia/Seoul')::date >= p_since
      and r.game not in ('word', 'math', 'life')
    group by r.game
  ) g
$$;
revoke all on function public._game_usage(date) from public, anon, authenticated;

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
    'games_since', public._game_usage(since),
    'games_since_day', since
  );
end $$;
revoke all on function public.admin_usage() from public, anon;
grant execute on function public.admin_usage() to authenticated;
