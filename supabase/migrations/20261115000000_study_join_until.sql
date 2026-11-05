-- 스터디 윗미: 그룹 참여 마감일
-- 포스터 공지 "11/9 월요일 자정 전까지 가입한 사람에 한해 참여 가능"에 맞춰, 11/9(월) 23:59(한국 시간)까지만 참여할 수 있다.
-- 교육활동부(관리자)가 앱에서 마감일을 바꿀 수 있다(연장 등).

alter table public.study_groups add column join_until date;
update public.study_groups set join_until = '2026-11-09' where name in ('1학년 스터디 윗미', '2학년 스터디 윗미');

create or replace function public.join_study_group(p_id bigint, p_password text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  e public.enrollments := public.enrollment_of(auth.uid());
  g public.study_groups;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if e.user_id is null then raise exception '학번을 먼저 등록해 주세요' using errcode = 'P0001'; end if;
  if (select nickname from public.profiles where id = me) is null then raise exception '닉네임을 먼저 정해 주세요' using errcode = 'P0001'; end if;
  select * into g from public.study_groups where id = p_id for update;
  if not found or g.closed then raise exception '없는 그룹이에요' using errcode = 'P0001'; end if;
  if g.grade is not null and g.grade <> e.grade then raise exception '%학년만 들어갈 수 있는 그룹이에요', g.grade using errcode = 'P0001'; end if;
  if g.ends_on < public.seoul_today() then raise exception '이미 끝난 그룹이에요' using errcode = 'P0001'; end if;
  if exists (select 1 from public.study_group_members where group_id = p_id and user_id = me) then return; end if;
  if g.join_until is not null and public.seoul_today() > g.join_until then
    raise exception '참여 신청은 %월 %일까지였어요', extract(month from g.join_until), extract(day from g.join_until) using errcode = 'P0001';
  end if;
  if btrim(coalesce(p_password, '')) <> g.password then raise exception '비밀번호가 맞지 않아요' using errcode = 'P0001'; end if;
  if (select count(*) from public.study_group_members where group_id = p_id) >= g.capacity then
    raise exception '정원(%명)이 다 찼어요', g.capacity using errcode = 'P0001';
  end if;
  insert into public.study_group_members (group_id, user_id) values (p_id, me);
end $$;

create or replace function public.study_group_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e public.enrollments := public.enrollment_of(auth.uid());
  mgr boolean := public.is_study_manager();
  today date := public.seoul_today();
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', g.id, 'name', g.name, 'description', g.description, 'grade', g.grade, 'capacity', g.capacity,
      'starts_on', g.starts_on, 'ends_on', g.ends_on, 'join_until', g.join_until, 'closed', g.closed,
      'members', (select count(*) from public.study_group_members m where m.group_id = g.id),
      'joined', exists (select 1 from public.study_group_members m where m.group_id = g.id and m.user_id = auth.uid()),
      'can_join', (g.grade is null or g.grade = e.grade) and not g.closed and g.ends_on >= today
                  and (g.join_until is null or today <= g.join_until)
    ) order by g.grade nulls last, g.id)
    from public.study_groups g
   where mgr or g.grade is null or g.grade = e.grade), '[]'::jsonb);
end $$;

-- 관리자: 참여 마감일 바꾸기(null이면 마감 없음)
create or replace function public.set_study_join_until(p_id bigint, p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_study_manager() then raise exception '스터디 윗미 관리자만 할 수 있어요' using errcode = '42501'; end if;
  update public.study_groups set join_until = p_date where id = p_id;
  if not found then raise exception '없는 그룹이에요' using errcode = 'P0001'; end if;
end $$;

-- 관리자 보드에도 마감일
create or replace function public.study_group_admin(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  g public.study_groups;
  today date := public.seoul_today();
begin
  if not public.is_study_manager() then raise exception '스터디 윗미 관리자만 볼 수 있어요' using errcode = '42501'; end if;
  select * into g from public.study_groups where id = p_id;
  if not found then raise exception '없는 그룹이에요' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'id', g.id, 'name', g.name, 'grade', g.grade, 'password', g.password, 'capacity', g.capacity,
    'starts_on', g.starts_on, 'ends_on', g.ends_on, 'join_until', g.join_until, 'today', today,
    'days', (select jsonb_agg(d::date order by d) from generate_series(g.starts_on, g.ends_on, interval '1 day') d),
    'members', coalesce((select jsonb_agg(x order by (x->>'period_seconds')::int desc) from (
      select jsonb_build_object(
        'user_id', m.user_id, 'name', e.name, 'student_no', e.student_no, 'nickname', p.nickname,
        'joined_at', m.joined_at, 'live', public.study_is_live(m.user_id),
        'today_seconds', public.study_day_seconds(m.user_id, today),
        'period_seconds', coalesce((select sum(d.ranked_seconds + d.class_seconds) from public.study_daily d
                                     where d.user_id = m.user_id and d.day between g.starts_on and g.ends_on), 0),
        'days', (select count(*) from public.study_daily d
                  where d.user_id = m.user_id and d.day between g.starts_on and g.ends_on and d.ranked_seconds + d.class_seconds >= 1800),
        'by_day', coalesce((select jsonb_object_agg(d.day, d.ranked_seconds + d.class_seconds) from public.study_daily d
                             where d.user_id = m.user_id and d.day between g.starts_on and g.ends_on), '{}'::jsonb)
      ) x
      from public.study_group_members m
      join public.profiles p on p.id = m.user_id
      left join public.enrollments e on e.user_id = m.user_id and e.school_year = public.current_school_year()
     where m.group_id = p_id) t), '[]'::jsonb)
  );
end $$;

grant execute on function public.set_study_join_until(bigint, date) to authenticated;
