-- 11-12 학생 의견 반영
--  · #55 학교 한 바퀴(campus_walk)처럼 만점이 쉬운 게임은 주간 1~3위 토큰·게임왕 배지에서 뺀다(app_config 'no_weekly_reward', 쉼표로 여러 개)
--  · #58 게임 목록에 이번 주 인기 게임 1~2개 표시(game_status.popular)
--  · #59 게임별 역대 최고 기록 순위(game_ranking_all) — 주간 랭킹은 그대로
-- 여러 번 실행해도 안전

insert into public.app_config values ('no_weekly_reward', 'campus_walk') on conflict (key) do nothing;

create or replace function public.settle_game_week(p_week_start date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ws date := date_trunc('week', p_week_start)::date;
  g text;
  r record;
  paid int := 0;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if ws + 6 >= public.seoul_today() then return jsonb_build_object('settled', false, 'reason', 'week_not_over'); end if;
  for g in select distinct game from public.game_runs
            where score > 0 and (started_at at time zone 'Asia/Seoul')::date between ws and ws + 6
              and game <> all (string_to_array(coalesce((select value from public.app_config where key = 'no_weekly_reward'), ''), ',')) loop
    for r in
      select user_id, row_number() over (order by score desc, finished_at asc) as place from (
        select distinct on (user_id) user_id, score, coalesce(finished_at, started_at) as finished_at from public.game_runs
         where game = g and score > 0 and (started_at at time zone 'Asia/Seoul')::date between ws and ws + 6
         order by user_id, score desc, finished_at asc) b
      order by place limit 3
    loop
      if public.award_tokens(r.user_id, (array[30, 20, 10])[r.place], 'game_weekly', g || ':' || ws || ':' || r.place) then paid := paid + 1; end if;
      if r.place = 1 then
        insert into public.inventory (user_id, item_id) values (r.user_id, 'b_gameking') on conflict do nothing;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('settled', true, 'paid', paid);
end $$;

create or replace function public.game_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  plays int;
  ws date := date_trunc('week', public.seoul_today())::date;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  plays := public._game_plays_today(me, now());
  return jsonb_build_object(
    'plays_today', plays, 'max_plays', 10, 'max_total', 20,
    'next_cost', public._extra_play_cost(plays),
    'in_class', public.my_class_time_now(),
    -- 이번 주 가장 많은 학생이 한 게임 1~2개(3명 이상)에 '인기' 표시
    'popular', (select coalesce(jsonb_agg(game), '[]') from (
                  select game from public.game_runs
                   where (started_at at time zone 'Asia/Seoul')::date >= ws and public._is_quiz_game(game) is not true
                   group by game having count(distinct user_id) >= 3
                   order by count(distinct user_id) desc limit 2) pg),
    'score_tokens_today', (select coalesce(sum(delta), 0) from public.token_ledger
                            where user_id = me and reason = 'game_score' and (created_at at time zone 'Asia/Seoul')::date = public.seoul_today()),
    'best', (select jsonb_object_agg(game, best) from (
               select game, max(score) as best from public.game_runs
                where user_id = me and score > 0 and (started_at at time zone 'Asia/Seoul')::date >= ws group by game) b));
end $$;

create or replace function public.game_ranking_all(p_game text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  res jsonb;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if p_game is null or p_game !~ '^[a-z][a-z0-9_]{1,29}$' then raise exception '없는 게임이에요' using errcode = 'P0001'; end if;
  with best as (
    select distinct on (user_id) user_id, grade, score, coalesce(finished_at, started_at) as finished_at
      from public.game_runs
     where game = p_game and score > 0
     order by user_id, score desc, finished_at asc
  ),
  ranked as (select *, rank() over (order by score desc) as rank, row_number() over (order by score desc, finished_at asc) as rn from best)
  select jsonb_build_object(
    'game', p_game, 'all_time', true,
    'top', coalesce((select jsonb_agg(jsonb_build_object(
              'rank', r.rank, 'score', r.score, 'grade', r.grade, 'mine', r.user_id = me,
              'nickname', case when p.hide_in_ranking then null else p.nickname end,
              'hidden', p.hide_in_ranking or p.nickname is null,
              'equip', case when p.hide_in_ranking then null else jsonb_build_object(
                 'emoji', p.equip_emoji, 'name_color', p.equip_color, 'theme', p.equip_theme, 'badge', p.equip_badge) end)
              order by r.rn) from ranked r join public.profiles p on p.id = r.user_id where r.rn <= 10), '[]'),
    'me', (select jsonb_build_object('score', r.score, 'rank', r.rank) from ranked r where r.user_id = me),
    'players', (select count(*) from best)
  ) into res;
  return res;
end $$;
revoke all on function public.game_ranking_all(text) from public, anon;
grant execute on function public.game_ranking_all(text) to authenticated;
