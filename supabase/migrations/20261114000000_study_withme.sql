-- 운중고 앱 — 스터디 윗미(교육활동부 행사, 11/9~11/25)
-- 호원 결정(11-05)
--  · 공부 타이머 이름을 '스터디 윗미'로. 열품타처럼 과목별 시간 + 그룹(비밀번호 방).
--  · 이번에는 교육활동부(관리자)가 만든 행사 그룹만: 1학년·2학년 그룹 각 50명, 비밀번호 2026, 자기 학년 그룹에만 참여.
--  · 그룹 안에서 학생끼리는 닉네임으로 보인다(닉네임이 있어야 참여). 관리자는 실명·학번을 본다.
--  · 행사 집계는 수업 시간에 잰 시간도 포함한다(공부 시간 = 랭킹 인정 + 수업 중). 토큰은 지금처럼 수업 시간 제외.
--  · 관리자 화면: 기간 누적 시간 + 참여일 수(하루 30분 이상 공부한 날) + 날짜별 시간.

-- ───────────────────────── 스터디 관리자(교육활동부) ─────────────────────────

alter table public.profiles add column is_study_manager boolean not null default false;

-- 교육활동부 학번 목록: 이 학번으로 등록한 계정은 자동으로 관리자(가입 전이어도 미리 넣어 둘 수 있게)
insert into public.app_config values ('study_managers', '20507,10705,20208,20705,10118,10312,10402')
on conflict (key) do update set value = excluded.value;

create or replace function public.is_study_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.role = 'admin' or p.is_study_manager
           or exists (select 1 from public.enrollments e
                       where e.user_id = p.id and e.school_year = public.current_school_year()
                         and e.student_no = any (string_to_array((select value from public.app_config where key = 'study_managers'), ',')))
      from public.profiles p where p.id = auth.uid()), false)
$$;

create or replace function public.admin_set_study_manager(p_user uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  update public.profiles set is_study_manager = coalesce(p_on, false) where id = p_user;
  if not found then raise exception '없는 학생이에요' using errcode = 'P0001'; end if;
end $$;

-- ───────────────────────── 내 과목 ─────────────────────────

create table public.study_subjects (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 20),
  color       text not null default 'navy' check (char_length(color) <= 20),
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

create or replace function public.save_study_subject(p_id bigint, p_name text, p_color text, p_sort int)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n text := btrim(coalesce(p_name, ''));
  rid bigint;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if char_length(n) < 1 or char_length(n) > 20 then raise exception '과목 이름은 1~20자예요' using errcode = 'P0001'; end if;
  if public.has_banned_word(n) then raise exception '과목 이름을 다시 확인해 주세요' using errcode = 'P0001'; end if;
  if p_id is null then
    if (select count(*) from public.study_subjects where user_id = me) >= 20 then raise exception '과목은 20개까지 만들 수 있어요' using errcode = 'P0001'; end if;
    insert into public.study_subjects (user_id, name, color, sort) values (me, n, coalesce(p_color, 'navy'), coalesce(p_sort, 0)) returning id into rid;
  else
    update public.study_subjects set name = n, color = coalesce(p_color, color), sort = coalesce(p_sort, sort)
     where id = p_id and user_id = me returning id into rid;
    if rid is null then raise exception '내 과목만 고칠 수 있어요' using errcode = 'P0001'; end if;
  end if;
  return rid;
exception when unique_violation then
  raise exception '같은 이름의 과목이 이미 있어요' using errcode = 'P0001';
end $$;

create or replace function public.delete_study_subject(p_id bigint)
returns void language sql security definer set search_path = public as $$
  delete from public.study_subjects where id = p_id and user_id = auth.uid()
$$;

-- ───────────────────────── 그룹 ─────────────────────────

create table public.study_groups (
  id          bigint generated always as identity primary key,
  name        text not null check (char_length(name) between 2 and 30),
  description text not null default '' check (char_length(description) <= 200),
  grade       smallint check (grade between 1 and 3),              -- null = 모든 학년
  password    text not null check (char_length(password) between 1 and 20),
  capacity    int not null default 50 check (capacity between 2 and 300),
  starts_on   date not null,
  ends_on     date not null,
  created_by  uuid references public.profiles (id) on delete set null,
  closed      boolean not null default false,
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table public.study_group_members (
  group_id   bigint not null references public.study_groups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index study_group_members_user on public.study_group_members (user_id);

-- 행사 그룹 2개
insert into public.study_groups (name, description, grade, password, capacity, starts_on, ends_on)
values ('1학년 스터디 윗미', '교육활동부 주관 · 11/9(월)~11/25(수) 공부 시간 집계', 1, '2026', 50, '2026-11-09', '2026-11-25'),
       ('2학년 스터디 윗미', '교육활동부 주관 · 11/9(월)~11/25(수) 공부 시간 집계', 2, '2026', 50, '2026-11-09', '2026-11-25');

-- 하루 공부 시간(초) = 랭킹 인정 + 수업 중(행사 집계 기준)
create or replace function public.study_day_seconds(p_user uuid, p_day date)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select ranked_seconds + class_seconds from public.study_daily where user_id = p_user and day = p_day), 0)
$$;

-- 지금 공부 중인가(열린 세션 + 2분 안의 신호)
create or replace function public.study_is_live(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.study_sessions s
                  where s.user_id = p_user and s.ended_at is null and s.last_beat_at > now() - interval '120 seconds')
$$;

-- 내가 볼 수 있는 그룹 목록: 내 학년 그룹(+전체 학년). 비밀번호는 주지 않는다.
create or replace function public.study_group_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e public.enrollments := public.enrollment_of(auth.uid());
  mgr boolean := public.is_study_manager();
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', g.id, 'name', g.name, 'description', g.description, 'grade', g.grade, 'capacity', g.capacity,
      'starts_on', g.starts_on, 'ends_on', g.ends_on, 'closed', g.closed,
      'members', (select count(*) from public.study_group_members m where m.group_id = g.id),
      'joined', exists (select 1 from public.study_group_members m where m.group_id = g.id and m.user_id = auth.uid()),
      'can_join', (g.grade is null or g.grade = e.grade) and not g.closed and g.ends_on >= public.seoul_today()
    ) order by g.grade nulls last, g.id)
    from public.study_groups g
   where mgr or g.grade is null or g.grade = e.grade), '[]'::jsonb);
end $$;

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
  if btrim(coalesce(p_password, '')) <> g.password then raise exception '비밀번호가 맞지 않아요' using errcode = 'P0001'; end if;
  if exists (select 1 from public.study_group_members where group_id = p_id and user_id = me) then return; end if;
  if (select count(*) from public.study_group_members where group_id = p_id) >= g.capacity then
    raise exception '정원(%명)이 다 찼어요', g.capacity using errcode = 'P0001';
  end if;
  insert into public.study_group_members (group_id, user_id) values (p_id, me);
end $$;

create or replace function public.leave_study_group(p_id bigint)
returns void language sql security definer set search_path = public as $$
  delete from public.study_group_members where group_id = p_id and user_id = auth.uid()
$$;

-- 그룹 보드(멤버 또는 관리자만): 닉네임 · 지금 공부 중 · 오늘 · 기간 누적 · 참여일 수, 누적 순
create or replace function public.study_group_board(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  g public.study_groups;
  today date := public.seoul_today();
  mgr boolean := public.is_study_manager();
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  select * into g from public.study_groups where id = p_id;
  if not found then raise exception '없는 그룹이에요' using errcode = 'P0001'; end if;
  if not mgr and not exists (select 1 from public.study_group_members where group_id = p_id and user_id = auth.uid()) then
    raise exception '그룹 멤버만 볼 수 있어요' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'id', g.id, 'name', g.name, 'description', g.description, 'grade', g.grade, 'capacity', g.capacity,
    'starts_on', g.starts_on, 'ends_on', g.ends_on, 'today', today, 'manager', mgr,
    'joined', exists (select 1 from public.study_group_members where group_id = p_id and user_id = auth.uid()),
    'members', coalesce((select jsonb_agg(x order by (x->>'period_seconds')::int desc, (x->>'today_seconds')::int desc) from (
      select jsonb_build_object(
        'mine', m.user_id = auth.uid(),
        'nickname', p.nickname,
        'equip', jsonb_build_object('emoji', p.equip_emoji, 'name_color', p.equip_color, 'badge', p.equip_badge),
        'live', public.study_is_live(m.user_id),
        'today_seconds', public.study_day_seconds(m.user_id, today),
        'period_seconds', coalesce((select sum(d.ranked_seconds + d.class_seconds) from public.study_daily d
                                     where d.user_id = m.user_id and d.day between g.starts_on and g.ends_on), 0),
        'days', (select count(*) from public.study_daily d
                  where d.user_id = m.user_id and d.day between g.starts_on and g.ends_on
                    and d.ranked_seconds + d.class_seconds >= 1800)
      ) x
      from public.study_group_members m join public.profiles p on p.id = m.user_id
     where m.group_id = p_id) t), '[]'::jsonb)
  );
end $$;

-- 관리자 보드: 실명·학번 + 날짜별 시간(초)
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
    'starts_on', g.starts_on, 'ends_on', g.ends_on, 'today', today,
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

create or replace function public.manage_study_member(p_group bigint, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_study_manager() then raise exception '스터디 윗미 관리자만 할 수 있어요' using errcode = '42501'; end if;
  delete from public.study_group_members where group_id = p_group and user_id = p_user;
  if not found then raise exception '그룹 멤버가 아니에요' using errcode = 'P0001'; end if;
end $$;

-- 관리자: 그룹 정보 바꾸기(비밀번호·정원·기간·닫기)
create or replace function public.manage_study_group(p_id bigint, p_password text, p_capacity int, p_starts date, p_ends date, p_closed boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_study_manager() then raise exception '스터디 윗미 관리자만 할 수 있어요' using errcode = '42501'; end if;
  update public.study_groups
     set password = coalesce(nullif(btrim(p_password), ''), password),
         capacity = coalesce(p_capacity, capacity),
         starts_on = coalesce(p_starts, starts_on),
         ends_on = coalesce(p_ends, ends_on),
         closed = coalesce(p_closed, closed)
   where id = p_id;
  if not found then raise exception '없는 그룹이에요' using errcode = 'P0001'; end if;
end $$;

-- ───────────────────────── 오늘 대시보드(열품타식 첫 화면) ─────────────────────────

create or replace function public.my_study_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := public.seoul_today();
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  return jsonb_build_object(
    'today', public._study_today(me, today) || jsonb_build_object('total_seconds', public.study_day_seconds(me, today)),
    'week_total_seconds', coalesce((select sum(ranked_seconds + class_seconds) from public.study_daily
                                     where user_id = me and day between date_trunc('week', today)::date and today), 0),
    'subjects', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'color', s.color, 'sort', s.sort) order by s.sort, s.id)
                            from public.study_subjects s where s.user_id = me), '[]'::jsonb),
    -- 오늘 과목별 시간(세션의 과목 이름 기준, 과목 없음 = '')
    'by_subject', coalesce((select jsonb_object_agg(k, v) from (
        select coalesce(ss.subject, '') k, sum(ss.ranked_seconds + ss.class_seconds) v
          from public.study_sessions ss
         where ss.user_id = me and (ss.started_at at time zone 'Asia/Seoul')::date = today
         group by 1) t), '{}'::jsonb),
    'groups', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'ends_on', g.ends_on,
        'live', (select count(*) from public.study_group_members m2 where m2.group_id = g.id and public.study_is_live(m2.user_id)),
        'members', (select count(*) from public.study_group_members m3 where m3.group_id = g.id)))
        from public.study_group_members m join public.study_groups g on g.id = m.group_id
       where m.user_id = me and not g.closed), '[]'::jsonb),
    'manager', public.is_study_manager()
  );
end $$;

-- ───────────────────────── 관리자: 학생 찾기에 스터디 관리자 여부 ─────────────────────────

drop function public.admin_find_user(text);
create function public.admin_find_user(p_query text)
returns table (user_id uuid, name text, student_no text, email text, role text, grade int, class_no int, nickname text, is_planner boolean, balance int, is_study_manager boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  qy text := btrim(coalesce(p_query, ''));
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  return query
    select p.id, e.name, e.student_no, p.email, p.role, e.grade, e.class_no, p.nickname, p.is_planner,
           coalesce((select sum(l.delta) from public.token_ledger l where l.user_id = p.id), 0)::int,
           p.is_study_manager
      from public.profiles p
      left join public.enrollments e on e.user_id = p.id and e.school_year = public.current_school_year()
     where (qy ~ '^[0-9]{5}$' and e.student_no = qy)
        or (qy !~ '^[0-9]{5}$' and char_length(qy) >= 2 and (lower(p.nickname) = lower(qy) or lower(p.email) = lower(qy)))
     limit 5;
end $$;

-- ───────────────────────── 권한 ─────────────────────────

alter table public.study_subjects enable row level security;
alter table public.study_groups enable row level security;
alter table public.study_group_members enable row level security;
create policy study_subjects_read_own on public.study_subjects for select using (user_id = auth.uid());
-- 그룹·멤버 원본 표는 직접 읽지 못한다(비밀번호 보호). 함수로만.

revoke all on function public.study_day_seconds(uuid, date) from public, anon, authenticated;
revoke all on function public.study_is_live(uuid) from public, anon, authenticated;

grant execute on function public.is_study_manager() to authenticated;
grant execute on function public.admin_set_study_manager(uuid, boolean) to authenticated;
grant execute on function public.save_study_subject(bigint, text, text, int) to authenticated;
grant execute on function public.delete_study_subject(bigint) to authenticated;
grant execute on function public.study_group_list() to authenticated;
grant execute on function public.join_study_group(bigint, text) to authenticated;
grant execute on function public.leave_study_group(bigint) to authenticated;
grant execute on function public.study_group_board(bigint) to authenticated;
grant execute on function public.study_group_admin(bigint) to authenticated;
grant execute on function public.manage_study_member(bigint, uuid) to authenticated;
grant execute on function public.manage_study_group(bigint, text, int, date, date, boolean) to authenticated;
grant execute on function public.my_study_dashboard() to authenticated;
grant execute on function public.admin_find_user(text) to authenticated;
