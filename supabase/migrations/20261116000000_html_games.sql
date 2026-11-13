-- 운중고 앱 — HTML 게임(참여 학생이 만든 게임)
-- 호원 결정(11-05): 학습형 게임(영단어·암산·라이프 퀴즈)을 재미 중심의 학생 제작 게임으로 바꾼다.
--  · 보상 체계는 기존 그대로: 하루 첫 판 무료·이후 5토큰·하루 10판, 주간 최고 갱신 +2, 게임별 주간 1~3위 +30/+20/+10
--  · 수업 시간에는 시작할 수 없다(서버가 우리 반 시간표로 판단)
--  · 게임 id는 앱의 게임 목록(src/features/games/catalog.ts)에 있는 영문 소문자 id. 새 게임을 넣을 때 SQL은 필요 없다.
--  · 점수는 폰에서 계산되므로 조작 여지가 있다 → 최소 플레이 시간·점수 상한만 둔다(보상 규모가 작다)

alter table public.game_runs drop constraint if exists game_runs_game_check;
alter table public.game_runs add constraint game_runs_game_check check (game ~ '^[a-z][a-z0-9_]{1,29}$');

create or replace function public._is_quiz_game(p_game text)
returns boolean language sql immutable as $$ select p_game in ('word', 'math', 'life') $$;

-- 시작: 퀴즈 게임은 그대로, HTML 게임은 문제 없이 판만 연다(최대 1시간)
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
  fee := case when plays = 0 then 0 else 5 end;
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

-- HTML 게임 끝내기: 점수를 받아 기록하고, 기존 끝내기(최고 기록 보상)를 그대로 쓴다
create or replace function public._finish_html_game(p_user uuid, p_id uuid, p_score int, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  g public.game_runs;
begin
  select * into g from public.game_runs where id = p_id and user_id = p_user for update;
  if not found or public._is_quiz_game(g.game) then raise exception '없는 게임이에요' using errcode = 'P0001'; end if;
  if g.finished_at is null then
    -- 3초도 안 걸린 판, 1시간 넘은 판은 점수를 인정하지 않는다
    update public.game_runs
       set score = case when p_now - g.started_at between interval '3 seconds' and interval '1 hour'
                        then least(greatest(coalesce(p_score, 0), 0), 10000000) else 0 end
     where id = p_id;
  end if;
  return public._finish_game(p_user, p_id, p_now);
end $$;

create or replace function public.finish_html_game(p_id uuid, p_score int)
returns jsonb language sql security definer set search_path = public as $$
  select public._finish_html_game(auth.uid(), p_id, p_score, now())
$$;

-- 랭킹: 어떤 게임 id든(형식만 확인)
create or replace function public.game_ranking(p_game text, p_week_start date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  ws date := date_trunc('week', p_week_start)::date;
  me uuid := auth.uid();
  res jsonb;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if p_game is null or p_game !~ '^[a-z][a-z0-9_]{1,29}$' then raise exception '없는 게임이에요' using errcode = 'P0001'; end if;
  with best as (
    select distinct on (user_id) user_id, grade, score, coalesce(finished_at, started_at) as finished_at
      from public.game_runs
     where game = p_game and score > 0 and (started_at at time zone 'Asia/Seoul')::date between ws and ws + 6
     order by user_id, score desc, finished_at asc
  ),
  ranked as (select *, rank() over (order by score desc) as rank, row_number() over (order by score desc, finished_at asc) as rn from best)
  select jsonb_build_object(
    'game', p_game, 'week_start', ws, 'week_end', ws + 6,
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

-- 주간 정산: 그 주에 기록이 있는 모든 게임
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
            where score > 0 and (started_at at time zone 'Asia/Seoul')::date between ws and ws + 6 loop
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

-- 이어하기 저장(게임별 10KB)
create table if not exists public.game_saves (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game       text not null check (game ~ '^[a-z][a-z0-9_]{1,29}$'),
  data       text not null check (char_length(data) <= 10000),
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
alter table public.game_saves enable row level security;

create or replace function public.save_game(p_game text, p_data text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  insert into public.game_saves (user_id, game, data) values (auth.uid(), p_game, coalesce(p_data, 'null'))
  on conflict (user_id, game) do update set data = excluded.data, updated_at = now();
end $$;

create or replace function public.load_game(p_game text)
returns text language sql stable security definer set search_path = public as $$
  select data from public.game_saves where user_id = auth.uid() and game = p_game
$$;

revoke all on function public._finish_html_game(uuid, uuid, int, timestamptz) from public, anon, authenticated;
revoke all on function public.finish_html_game(uuid, int) from public, anon;
revoke all on function public.save_game(text, text) from public, anon;
revoke all on function public.load_game(text) from public, anon;
grant execute on function public.finish_html_game(uuid, int) to authenticated;
grant execute on function public.save_game(text, text) to authenticated;
grant execute on function public.load_game(text) to authenticated;
