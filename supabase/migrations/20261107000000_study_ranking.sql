-- 운중고 앱 v3 — M3 3주차: 집중 모드 공부 타이머 · 랭킹
-- 원칙(M3 명세 3·4장)
--  · 공부 시간은 앱이 1분마다 보내는 '살아 있음' 신호를 서버 시각으로 센다. 신호 간격이 90초를 넘으면 세션이 끝난다.
--    → 휴대폰 시계를 바꾸거나 앱을 끈 채로는 시간이 늘지 않는다.
--  · 수업 시간(학년별 일과표 1~7교시, 학교 가는 날)은 기록은 하되 랭킹·토큰에는 넣지 않는다.
--  · 하루 랭킹 인정 12시간, 토큰은 10분마다 +1(하루 최대 30).
--  · 랭킹: 반 대항(반 평균 = 반 합계 ÷ 앱에 학번을 등록한 학생 수, 5명 미만 반은 '참여 인원 부족'),
--    개인 상위 10명(닉네임·꾸미기, 숨기기 켠 학생은 '익명'), 내 순위는 본인에게만.

-- ───────────────────────── 수업 시간 판정 ─────────────────────────

create or replace function public.is_class_time(p_grade int, p_at timestamptz)
returns boolean language sql stable as $$
  select public.is_school_day((p_at at time zone 'Asia/Seoul')::date)
     and exists (
       select 1
         from (values (520, 570), (580, 630), (640, 690),            -- 1~3교시 08:40~11:30
                      (case when p_grade = 3 then 750 else 700 end,  -- 4교시 1·2학년 11:40, 3학년 12:30
                       case when p_grade = 3 then 800 else 750 end),
                      (810, 860), (870, 920), (930, 980)) as v(s, e) -- 5~7교시 13:30~16:20
        where public.seoul_minutes(p_at) >= v.s and public.seoul_minutes(p_at) < v.e)
$$;

-- ───────────────────────── 테이블 ─────────────────────────

create table public.study_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  school_year     int not null,
  grade           smallint not null,
  class_no        smallint not null,
  subject         text check (char_length(subject) <= 20),
  started_at      timestamptz not null,
  last_beat_at    timestamptz not null,
  ended_at        timestamptz,
  ranked_seconds  int not null default 0,
  class_seconds   int not null default 0
);
create index study_sessions_open on public.study_sessions (user_id) where ended_at is null;
create index study_sessions_live on public.study_sessions (last_beat_at) where ended_at is null;

-- 하루 합계 (랭킹은 이 표만 읽는다)
create table public.study_daily (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  day             date not null,
  school_year     int not null,
  grade           smallint not null,
  class_no        smallint not null,
  ranked_seconds  int not null default 0,
  class_seconds   int not null default 0,
  tokens          int not null default 0,
  primary key (user_id, day)
);
create index study_daily_by_class on public.study_daily (day, grade, class_no);

-- ───────────────────────── 세션 본체 (시각을 인자로: 테스트용. 학생은 직접 못 부름) ─────────────────────────

create or replace function public._study_today(p_user uuid, p_day date)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'day', p_day,
    'ranked_seconds', coalesce((select ranked_seconds from public.study_daily where user_id = p_user and day = p_day), 0),
    'class_seconds', coalesce((select class_seconds from public.study_daily where user_id = p_user and day = p_day), 0),
    'tokens', coalesce((select tokens from public.study_daily where user_id = p_user and day = p_day), 0),
    'week_ranked_seconds', coalesce((select sum(ranked_seconds) from public.study_daily
                                      where user_id = p_user and day >= date_trunc('week', p_day)::date and day <= p_day), 0))
$$;

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
  -- 열려 있던 세션은 마지막 신호 시각으로 닫는다 (한 사람에 세션 하나)
  update public.study_sessions set ended_at = last_beat_at where user_id = p_user and ended_at is null;
  insert into public.study_sessions (user_id, school_year, grade, class_no, subject, started_at, last_beat_at)
  values (p_user, e.school_year, e.grade, e.class_no, s, p_now, p_now)
  returning id into sid;
  return jsonb_build_object('id', sid, 'in_class', public.is_class_time(e.grade, p_now),
                            'today', public._study_today(p_user, (p_now at time zone 'Asia/Seoul')::date));
end $$;

-- 신호 한 번: 지난 신호부터 지금까지(90초 이하일 때만)를 공부 시간으로 인정
--  p_skip: 잠깐 앱을 떠났다 돌아왔을 때 → 떠나 있던 시간은 세지 않고 기준만 다시 잡는다
--  p_end : 타이머 종료
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
    -- 너무 오래 신호가 없었다: 마지막 신호 시각에 세션을 닫는다 (빈 시간은 세지 않음)
    update public.study_sessions set ended_at = last_beat_at where id = p_id;
    return jsonb_build_object('ended', true, 'reason', 'timeout', 'today', public._study_today(p_user, dday));
  end if;
  if not p_skip and gap > 0 then credit := gap; end if;

  in_class := public.is_class_time(s.grade, p_now - make_interval(secs => credit / 2.0));

  if credit > 0 then
    insert into public.study_daily (user_id, day, school_year, grade, class_no)
    values (p_user, dday, s.school_year, s.grade, s.class_no)
    on conflict (user_id, day) do nothing;
    select * into d from public.study_daily where user_id = p_user and day = dday for update;
    if in_class then
      update public.study_daily set class_seconds = class_seconds + credit where user_id = p_user and day = dday;
    else
      ranked := greatest(0, least(credit, 12 * 3600 - d.ranked_seconds));   -- 하루 12시간까지 인정
      update public.study_daily set ranked_seconds = ranked_seconds + ranked, class_seconds = class_seconds + (credit - ranked)
       where user_id = p_user and day = dday;
      -- 10분마다 +1, 하루 최대 30
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

  return jsonb_build_object('ended', p_end, 'in_class', public.is_class_time(s.grade, p_now),
                            'credited', credit, 'today', public._study_today(p_user, dday));
end $$;

revoke all on function public._study_today(uuid, date) from public, anon, authenticated;
revoke all on function public._start_study(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public._beat_study(uuid, uuid, timestamptz, boolean, boolean) from public, anon, authenticated;

-- ───────────────────────── 앱이 부르는 함수 ─────────────────────────

create or replace function public.start_study(p_subject text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  return public._start_study(auth.uid(), p_subject, now());
end $$;

create or replace function public.beat_study(p_id uuid, p_skip boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  return public._beat_study(auth.uid(), p_id, now(), coalesce(p_skip, false), false);
end $$;

create or replace function public.stop_study(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  return public._beat_study(auth.uid(), p_id, now(), false, true);
end $$;

create or replace function public.my_study_today()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  return public._study_today(auth.uid(), public.seoul_today());
end $$;

-- 지금 집중 중인 인원 (90초 안에 신호를 보낸 열린 세션)
create or replace function public.study_live()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'all', count(distinct user_id),
    'g1', count(distinct user_id) filter (where grade = 1),
    'g2', count(distinct user_id) filter (where grade = 2),
    'g3', count(distinct user_id) filter (where grade = 3))
    from public.study_sessions
   where ended_at is null and last_beat_at between now() - interval '90 seconds' and now() + interval '5 seconds'
     and public.is_school_user()
$$;

-- 랭킹: p_kind 'study'(초) | 'tokens'(개), 학년, 주 시작(월요일)
create or replace function public.ranking(p_kind text, p_grade int, p_week_start date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  ws date := date_trunc('week', p_week_start)::date;
  we date := date_trunc('week', p_week_start)::date + 6;
  yr int := public.current_school_year();
  me uuid := auth.uid();
  result jsonb;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if p_kind not in ('study', 'tokens') or p_grade not between 1 and 3 then
    raise exception '잘못된 요청이에요' using errcode = 'P0001';
  end if;

  with members as (
    select e.user_id, e.class_no from public.enrollments e where e.school_year = yr and e.grade = p_grade
  ),
  scores as (
    select m.user_id, m.class_no,
           case when p_kind = 'study' then
             coalesce((select sum(d.ranked_seconds) from public.study_daily d
                        where d.user_id = m.user_id and d.day between ws and we), 0)
           else
             coalesce((select sum(l.delta) from public.token_ledger l
                        where l.user_id = m.user_id and l.delta > 0 and l.reason <> 'admin'
                          and (l.created_at at time zone 'Asia/Seoul')::date between ws and we), 0)
           end::bigint as score
      from members m
  ),
  classes as (
    select c.class_no,
           count(s.user_id)::int as members,
           coalesce(sum(s.score), 0)::bigint as total,
           case when count(s.user_id) > 0 then round(coalesce(sum(s.score), 0)::numeric / count(s.user_id))::bigint else 0 end as avg,
           count(s.user_id) >= 5 as eligible
      from generate_series(1, 8) as c(class_no)
      left join scores s on s.class_no = c.class_no
     group by c.class_no
  ),
  ranked_classes as (
    select *, case when eligible then rank() over (partition by eligible order by avg desc) end as rank from classes
  ),
  top as (
    select s.user_id, s.score, rank() over (order by s.score desc) as rank
      from scores s where s.score > 0
     order by s.score desc limit 10
  )
  select jsonb_build_object(
    'kind', p_kind, 'grade', p_grade, 'week_start', ws, 'week_end', we,
    'classes', (select jsonb_agg(jsonb_build_object(
                  'class_no', class_no, 'members', members, 'total', total, 'avg', avg, 'eligible', eligible, 'rank', rank,
                  'mine', exists (select 1 from members m where m.user_id = me and m.class_no = rc.class_no))
                  order by eligible desc, avg desc, class_no) from ranked_classes rc),
    'top', coalesce((select jsonb_agg(jsonb_build_object(
                  'rank', t.rank, 'score', t.score, 'mine', t.user_id = me,
                  'nickname', case when p.hide_in_ranking then null else p.nickname end,
                  'hidden', p.hide_in_ranking or p.nickname is null,
                  'equip', case when p.hide_in_ranking then null else jsonb_build_object(
                     'emoji', p.equip_emoji, 'name_color', p.equip_color, 'theme', p.equip_theme, 'badge', p.equip_badge) end)
                  order by t.rank, t.score desc) from top t join public.profiles p on p.id = t.user_id), '[]'::jsonb),
    'me', (select jsonb_build_object(
              'score', s.score,
              'rank', case when s.score > 0 then (select count(*) from scores x where x.score > s.score) + 1 end,
              'of', (select count(*) from scores x where x.score > 0))
             from scores s where s.user_id = me),
    'participants', (select count(*) from scores where score > 0)
  ) into result;
  return result;
end $$;

-- ───────────────────────── 권한(RLS) ─────────────────────────

alter table public.study_sessions enable row level security;
alter table public.study_daily enable row level security;
create policy study_sessions_read_own on public.study_sessions for select using (user_id = auth.uid());
create policy study_daily_read_own on public.study_daily for select using (user_id = auth.uid());

revoke all on function public.study_live() from public, anon;
revoke all on function public.ranking(text, int, date) from public, anon;
grant execute on function public.start_study(text) to authenticated;
grant execute on function public.beat_study(uuid, boolean) to authenticated;
grant execute on function public.stop_study(uuid) to authenticated;
grant execute on function public.my_study_today() to authenticated;
grant execute on function public.study_live() to authenticated;
grant execute on function public.ranking(text, int, date) to authenticated;
