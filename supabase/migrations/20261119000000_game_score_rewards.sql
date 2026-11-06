-- 11-06 호원 피드백 반영 (3): 게임 보상을 점수에 비례하게(사용률 최대화)
--  · 학생 제작 게임은 무료(하루 10판 제한은 유지)
--  · 판마다 점수가 그 게임의 이번 주 기록 중 어디쯤인지(상위 비율)로 1~5토큰. 기록이 5판 미만이면 2토큰
--  · 게임 점수 보상은 하루 최대 30토큰. 주간 최고 갱신 +2, 주간 1~3위 보상은 그대로
--  · 점수는 폰에서 계산되므로 비율 방식이 조작 피해를 줄인다(아무리 높아도 판당 5)

create or replace function public._start_game(p_user uuid, p_game text, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e public.enrollments := public.enrollment_of(p_user);
  plays int;
  fee int;
  bal int;
  qs jsonb;
  quiz boolean := public._is_quiz_game(p_game);
  dur int := case when p_game = 'life' then 90 when public._is_quiz_game(p_game) then 60 else 3600 end;
  rid uuid := gen_random_uuid();
begin
  if e.user_id is null then raise exception '학번을 먼저 등록해 주세요' using errcode = 'P0001'; end if;
  if p_game is null or p_game !~ '^[a-z][a-z0-9_]{1,29}$' then raise exception '없는 게임이에요' using errcode = 'P0001'; end if;
  if public.is_class_time(e.grade, e.class_no, p_now) then
    raise exception '수업 시간에는 게임을 할 수 없어요. 쉬는 시간이나 방과후에 만나요!' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('ledger:' || p_user::text));
  plays := public._game_plays_today(p_user, p_now);
  if plays >= 10 then raise exception '오늘은 10판을 다 했어요. 내일 또 만나요!' using errcode = 'P0001'; end if;
  -- 학생 제작 게임은 무료(하루 10판), 퀴즈 게임은 기존대로
  fee := case when not quiz or plays = 0 then 0 else 5 end;
  if fee > 0 then
    select coalesce(sum(delta), 0) into bal from public.token_ledger where user_id = p_user;
    if bal < fee then raise exception '토큰이 부족해요 (한 판에 %개)', fee using errcode = 'P0001'; end if;
    insert into public.token_ledger (user_id, delta, reason, ref_id, note) values (p_user, -fee, 'game', rid::text, p_game);
  end if;

  qs := case when not quiz then '[]'::jsonb
             when p_game = 'word' then public._q_word(40) when p_game = 'math' then public._q_math(40)
             else public._q_life(e.grade, e.class_no, p_now) end;
  insert into public.game_runs (id, user_id, game, grade, class_no, started_at, duration_s, questions, cost)
  values (rid, p_user, p_game, e.grade, e.class_no, p_now, dur, qs, fee);

  return jsonb_build_object(
    'id', rid, 'game', p_game, 'duration_s', dur, 'cost', fee, 'plays_today', plays + 1,
    'questions', coalesce((select jsonb_agg(x - 'a') from jsonb_array_elements(qs) x), '[]'::jsonb));
end $$;


create or replace function public._finish_html_game(p_user uuid, p_id uuid, p_score int, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  g public.game_runs;
  res jsonb;
  ws date;
  n int;
  below int;
  earn int := 0;
  today_sum int;
begin
  select * into g from public.game_runs where id = p_id and user_id = p_user for update;
  if not found or public._is_quiz_game(g.game) then raise exception '없는 게임이에요' using errcode = 'P0001'; end if;
  if g.finished_at is null then
    update public.game_runs
       set score = case when p_now - g.started_at between interval '3 seconds' and interval '1 hour'
                        then least(greatest(coalesce(p_score, 0), 0), 10000000) else 0 end
     where id = p_id returning * into g;
    if g.score > 0 then
      ws := date_trunc('week', (g.started_at at time zone 'Asia/Seoul')::date)::date;
      select count(*), count(*) filter (where score < g.score) into n, below
        from public.game_runs
       where game = g.game and id <> p_id and finished_at is not null and score > 0
         and (started_at at time zone 'Asia/Seoul')::date between ws and ws + 6;
      earn := case when n < 5 then 2 else 1 + least(4, floor(4.999 * below / n))::int end;
      perform pg_advisory_xact_lock(hashtext('ledger:' || p_user::text));
      select coalesce(sum(delta), 0) into today_sum from public.token_ledger
       where user_id = p_user and reason = 'game_score' and (created_at at time zone 'Asia/Seoul')::date = (p_now at time zone 'Asia/Seoul')::date;
      earn := greatest(0, least(earn, 30 - today_sum));
      if earn > 0 and not public.award_tokens(p_user, earn, 'game_score', p_id::text) then earn := 0; end if;
    end if;
  end if;
  res := public._finish_game(p_user, p_id, p_now);
  return res || jsonb_build_object('score_reward', earn, 'reward', coalesce((res->>'reward')::int, 0) + earn);
end $$;
revoke all on function public._finish_html_game(uuid, uuid, int, timestamptz) from public, anon, authenticated;

-- 게임 상태: 학생 제작 게임은 늘 무료(하루 10판까지)
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
    'plays_today', plays, 'max_plays', 10, 'next_cost', case when plays >= 10 then null else 0 end,
    'in_class', public.my_class_time_now(),
    'score_tokens_today', (select coalesce(sum(delta), 0) from public.token_ledger
                            where user_id = me and reason = 'game_score' and (created_at at time zone 'Asia/Seoul')::date = public.seoul_today()),
    'best', (select jsonb_object_agg(game, best) from (
               select game, max(score) as best from public.game_runs
                where user_id = me and score > 0 and (started_at at time zone 'Asia/Seoul')::date >= ws group by game) b));
end $$;
