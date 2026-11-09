-- 11-09 호원 결정
--  · #33 우리 반 공부 순위(이번 주): 같은 반 학생끼리, 랭킹 숨김을 켠 학생은 '익명'
--  · #31 #50 공부 시작하면 '지금 N명 공부 중 · 우리 반 M명'(닉네임은 보이지 않는다)
--  · #24 #34 프로필: 랭킹에서 닉네임을 누르면 꾸미기(테마 포함)·출석·공부·게임 기록을 본다. 랭킹 숨김이면 안 보인다
-- 여러 번 실행해도 안전

-- 지금 공부 중인 인원 + 우리 반
create or replace function public.study_live()
returns jsonb language sql stable security definer set search_path = public as $$
  with live as (
    select distinct s.user_id, s.grade
      from public.study_sessions s
     where s.ended_at is null and s.last_beat_at between now() - interval '90 seconds' and now() + interval '5 seconds'
  ), me as (select * from public.enrollment_of(auth.uid()))
  select jsonb_build_object(
    'all', count(*),
    'g1', count(*) filter (where l.grade = 1),
    'g2', count(*) filter (where l.grade = 2),
    'g3', count(*) filter (where l.grade = 3),
    'my_class', count(*) filter (where e.grade = (select grade from me) and e.class_no = (select class_no from me)))
    from live l
    left join public.enrollments e on e.user_id = l.user_id and e.school_year = public.current_school_year()
   where public.is_school_user()
$$;

-- 우리 반 이번 주 공부 순위(랭킹과 같은 기준: 수업 시간 밖 인정 시간)
create or replace function public.study_class_board()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e public.enrollments := public.enrollment_of(auth.uid());
  today date := public.seoul_today();
  ws date := date_trunc('week', public.seoul_today())::date;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if e.user_id is null then raise exception '학번을 먼저 등록해 주세요' using errcode = 'P0001'; end if;
  return (
    with mates as (
      select m.user_id from public.enrollments m
       where m.school_year = e.school_year and m.grade = e.grade and m.class_no = e.class_no and m.user_id is not null
    ), scores as (
      select t.user_id,
             coalesce((select sum(d.ranked_seconds) from public.study_daily d where d.user_id = t.user_id and d.day between ws and ws + 6), 0)::int as week_seconds,
             coalesce((select d.ranked_seconds from public.study_daily d where d.user_id = t.user_id and d.day = today), 0)::int as today_seconds
        from mates t
    ), ranked as (
      select s.*, rank() over (order by s.week_seconds desc) as rank from scores s where s.week_seconds > 0
    )
    select jsonb_build_object(
      'grade', e.grade, 'class_no', e.class_no, 'week_start', ws, 'week_end', ws + 6,
      'members', (select count(*) from mates),
      'studied', (select count(*) from ranked),
      'rows', coalesce((select jsonb_agg(jsonb_build_object(
          'rank', r.rank, 'week_seconds', r.week_seconds, 'today_seconds', r.today_seconds, 'mine', r.user_id = auth.uid(),
          'nickname', case when p.hide_in_ranking then null else p.nickname end,
          'hidden', p.hide_in_ranking or p.nickname is null,
          'equip', case when p.hide_in_ranking then null else jsonb_build_object(
             'emoji', p.equip_emoji, 'name_color', p.equip_color, 'theme', p.equip_theme, 'badge', p.equip_badge) end
        ) order by r.rank, r.today_seconds desc) from ranked r join public.profiles p on p.id = r.user_id), '[]')
    ));
end $$;
revoke all on function public.study_class_board() from public, anon;
grant execute on function public.study_class_board() to authenticated;

-- 다른 학생 프로필(닉네임으로). 실명·학번·반은 주지 않는다
create or replace function public.public_profile(p_nickname text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles;
  ws date := date_trunc('week', public.seoul_today())::date;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  select * into p from public.profiles where lower(nickname) = lower(btrim(coalesce(p_nickname, '')));
  if not found or (p.hide_in_ranking and p.id <> auth.uid()) then
    raise exception '프로필을 볼 수 없어요' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'nickname', p.nickname, 'mine', p.id = auth.uid(),
    'grade', (public.enrollment_of(p.id)).grade,
    'equip', jsonb_build_object('emoji', p.equip_emoji, 'name_color', p.equip_color, 'theme', p.equip_theme, 'badge', p.equip_badge),
    'streak', (select jsonb_build_object('current', s.current, 'best', s.best) from public.streaks s where s.user_id = p.id),
    'study_week_seconds', coalesce((select sum(d.ranked_seconds + d.class_seconds) from public.study_daily d where d.user_id = p.id and d.day between ws and ws + 6), 0),
    'study_total_seconds', coalesce((select sum(d.ranked_seconds + d.class_seconds) from public.study_daily d where d.user_id = p.id), 0),
    'study_days', (select count(*) from public.study_daily d where d.user_id = p.id and d.ranked_seconds + d.class_seconds >= 1800),
    'games', coalesce((select jsonb_agg(jsonb_build_object('game', g.game, 'best', g.best, 'week_best', g.week_best) order by g.best desc)
                         from (select r.game, max(r.score) best,
                                      max(r.score) filter (where (r.started_at at time zone 'Asia/Seoul')::date between ws and ws + 6) week_best
                                 from public.game_runs r where r.user_id = p.id and r.score > 0 group by r.game) g), '[]'),
    'badges', coalesce((select jsonb_agg(si.value order by si.sort) from public.inventory i join public.shop_items si on si.id = i.item_id
                         where i.user_id = p.id and si.kind = 'badge'), '[]')
  );
end $$;
revoke all on function public.public_profile(text) from public, anon;
grant execute on function public.public_profile(text) to authenticated;
