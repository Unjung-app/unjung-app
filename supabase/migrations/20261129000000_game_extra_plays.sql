-- 11-08 호원 결정: 하루 무료 10판은 그대로. 10판을 다 하면 토큰으로 한 판씩 연장할 수 있다.
-- 연장할수록 비싸진다: 11·12판 5, 13·14판 8, 15·16판 12, 17·18판 16, 19·20판 20토큰. 하루 최대 20판(연장 합계 122토큰).
-- 연장 판은 앱이 보여 준 가격(p_cost)과 서버 가격이 같을 때만 시작한다(모르는 사이에 토큰이 빠지지 않게).

create or replace function public._extra_play_cost(p_plays int)
returns int language sql immutable set search_path = public as $$
  -- p_plays: 오늘 이미 한 판 수. 10 미만이면 연장 아님(0), 20 이상이면 더 못 함(null)
  select case when p_plays < 10 then 0 when p_plays >= 20 then null
              else (array[5, 5, 8, 8, 12, 12, 16, 16, 20, 20])[p_plays - 9] end
$$;

create or replace function public._start_game(p_user uuid, p_game text, p_now timestamptz, p_cost int)
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
  if plays >= 20 then raise exception '오늘은 20판을 다 했어요. 내일 또 만나요!' using errcode = 'P0001'; end if;
  if plays >= 10 then
    fee := public._extra_play_cost(plays);
    if p_cost is distinct from fee then
      raise exception '연장 가격이 바뀌었어요(이번 판 %토큰). 다시 확인해 주세요', fee using errcode = 'P0001';
    end if;
  else
    -- 무료 10판: 학생 제작 게임은 무료, 퀴즈 게임은 기존대로(첫 판 무료, 이후 5)
    fee := case when not quiz or plays = 0 then 0 else 5 end;
  end if;
  if fee > 0 then
    select coalesce(sum(delta), 0) into bal from public.token_ledger where user_id = p_user;
    if bal < fee then raise exception '토큰이 부족해요 (이번 판 %개)', fee using errcode = 'P0001'; end if;
    insert into public.token_ledger (user_id, delta, reason, ref_id, note)
    values (p_user, -fee, 'game', rid::text, p_game || case when plays >= 10 then ':extra' else '' end);
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
revoke all on function public._start_game(uuid, text, timestamptz, int) from public, anon, authenticated;

-- 예전 호출(가격 없이): 무료 10판 안에서만 동작, 연장 판은 가격 확인 오류
create or replace function public._start_game(p_user uuid, p_game text, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return public._start_game(p_user, p_game, p_now, null);
end $$;
revoke all on function public._start_game(uuid, text, timestamptz) from public, anon, authenticated;

create or replace function public.start_game(p_game text, p_cost int)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  return public._start_game(auth.uid(), p_game, now(), p_cost);
end $$;
revoke all on function public.start_game(text, int) from public, anon;
grant execute on function public.start_game(text, int) to authenticated;

-- 게임 상태: max_plays = 무료 판(10), max_total = 하루 최대(20), next_cost = 다음 판 가격(null이면 오늘 끝)
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
    'score_tokens_today', (select coalesce(sum(delta), 0) from public.token_ledger
                            where user_id = me and reason = 'game_score' and (created_at at time zone 'Asia/Seoul')::date = public.seoul_today()),
    'best', (select jsonb_object_agg(game, best) from (
               select game, max(score) as best from public.game_runs
                where user_id = me and score > 0 and (started_at at time zone 'Asia/Seoul')::date >= ws group by game) b));
end $$;
