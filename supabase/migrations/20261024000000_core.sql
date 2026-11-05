-- 운중고 앱 v3 — 핵심 스키마 (M2)
-- 원칙
--  1) 학교 계정(@unjung.hs.kr)만 쓸 수 있다: 가입 단계(auth hook)와 모든 정책(RLS) 두 곳에서 막는다.
--  2) 학번·이름은 학년도마다 한 번 학생이 입력하고, 학생은 고칠 수 없다(관리자만). 정정 문의: howonlee728@gmail.com
--  3) 토큰은 '원장(ledger)'에 한 줄씩 쌓는다. 잔액은 합계. 같은 이유로 두 번 받지 못하게 고유키로 막는다.
--  4) 역할: student(기본) / reviewer(검토위원, 학생자치회 임명) / admin(대표 3인).


-- ───────────────────────── 공용 함수 ─────────────────────────

create or replace function public.is_school_email(email text)
returns boolean language sql immutable as $$
  select coalesce(lower(email) like '%@unjung.hs.kr', false)
$$;

-- 지금 로그인한 사람이 학교 계정인가 (모든 정책의 출발점)
create or replace function public.is_school_user()
returns boolean language sql stable as $$
  select auth.uid() is not null and public.is_school_email(auth.jwt() ->> 'email')
$$;

-- 학년도: 3~12월은 그해, 1~2월은 전년도 (한국 시간 기준)
create or replace function public.current_school_year()
returns int language sql stable as $$
  select case when extract(month from (now() at time zone 'Asia/Seoul')) >= 3
              then extract(year from (now() at time zone 'Asia/Seoul'))::int
              else extract(year from (now() at time zone 'Asia/Seoul'))::int - 1 end
$$;

-- ───────────────────────── 프로필 ─────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique check (public.is_school_email(email)),
  role        text not null default 'student' check (role in ('student', 'reviewer', 'admin')),
  nickname    text check (char_length(nickname) between 2 and 12),
  created_at  timestamptz not null default now()
);

-- 학년도별 학적(학번·이름). 학생은 한 해에 한 번 넣고 끝. 고치는 건 관리자만.
create table public.enrollments (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  school_year  int  not null,
  student_no   text not null check (student_no ~ '^[1-3]0[1-8](0[1-9]|[1-3][0-9]|40)$'),
  name         text not null check (char_length(btrim(name)) between 2 and 10),
  grade        int  generated always as (substr(student_no, 1, 1)::int) stored,
  class_no     int  generated always as (substr(student_no, 2, 2)::int) stored,
  number       int  generated always as (substr(student_no, 4, 2)::int) stored,
  created_at   timestamptz not null default now(),
  primary key (user_id, school_year),
  unique (school_year, student_no) -- 같은 해에 같은 학번 두 명 금지
);

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable as $$ select coalesce(public.my_role() = 'admin', false) $$;

create or replace function public.is_reviewer()
returns boolean language sql stable as $$ select coalesce(public.my_role() in ('reviewer', 'admin'), false) $$;

-- 가입 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_school_email(new.email) then
    insert into public.profiles (id, email) values (new.id, lower(new.email))
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 학생이 올해 학번·이름을 처음 등록 (한 번만, 이후 수정 불가)
create or replace function public.register_enrollment(p_student_no text, p_name text)
returns public.enrollments language plpgsql security definer set search_path = public as $$
declare
  r public.enrollments;
begin
  if not public.is_school_user() then
    raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501';
  end if;
  if exists (select 1 from public.enrollments where user_id = auth.uid() and school_year = public.current_school_year()) then
    raise exception '이미 올해 학번이 등록되어 있어요. 잘못 입력했다면 howonlee728@gmail.com 으로 연락해 주세요'
      using errcode = 'P0001';
  end if;
  insert into public.enrollments (user_id, school_year, student_no, name)
  values (auth.uid(), public.current_school_year(), btrim(p_student_no), btrim(p_name))
  returning * into r;
  return r;
exception
  when unique_violation then
    raise exception '이 학번은 이미 다른 계정이 등록했어요. howonlee728@gmail.com 으로 연락해 주세요' using errcode = 'P0001';
  when check_violation then
    raise exception '학번(5자리)이나 이름 형식이 올바르지 않아요' using errcode = 'P0001';
end $$;

-- 닉네임은 학생이 바꿀 수 있다 (랭킹 표시용)
create or replace function public.set_nickname(p_nickname text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_user() then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  update public.profiles set nickname = nullif(btrim(p_nickname), '') where id = auth.uid();
end $$;

-- 관리자: 역할 부여 (검토위원 임명·해임)
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  update public.profiles set role = p_role where id = p_user;
end $$;

-- ───────────────────────── 토큰 원장 ─────────────────────────

create table public.token_ledger (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  delta       int  not null check (delta <> 0 and abs(delta) <= 1000),
  reason      text not null,                  -- 예: notice_approved, meal_review, study_daily
  ref_id      text not null default '',       -- 무엇 때문에 받았는지 (공지 id, 날짜 등)
  created_at  timestamptz not null default now(),
  unique (user_id, reason, ref_id)            -- 같은 일로 두 번 받기 금지
);

create view public.token_balances with (security_invoker = true) as
  select user_id, sum(delta)::int as balance from public.token_ledger group by user_id;

-- 토큰 지급은 서버 함수(다른 SECURITY DEFINER 함수)에서만 부른다. 학생이 직접 부를 수 없게 권한을 뺀다.
create or replace function public.award_tokens(p_user uuid, p_delta int, p_reason text, p_ref text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.token_ledger (user_id, delta, reason, ref_id) values (p_user, p_delta, p_reason, coalesce(p_ref, ''))
  on conflict (user_id, reason, ref_id) do nothing;
  return found;
end $$;

revoke all on function public.award_tokens(uuid, int, text, text) from public, anon, authenticated;

-- ───────────────────────── 권한(RLS) ─────────────────────────

alter table public.profiles enable row level security;
alter table public.enrollments enable row level security;
alter table public.token_ledger enable row level security;

-- 프로필(이메일 포함): 본인과 관리자만. 직접 수정은 불가(함수로만).
create policy profiles_read_own on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- 다른 학생에게 보이는 정보는 닉네임·역할뿐 (랭킹·검토자 표시용). 학교 계정만 조회 가능.
create view public.profile_cards as
  select id, nickname, role from public.profiles where public.is_school_user();
revoke all on public.profile_cards from public, anon;
grant select on public.profile_cards to authenticated;

-- 학적: 본인과 관리자만 본다 (실명·학번 보호). 쓰기는 함수로만.
create policy enrollments_read_own on public.enrollments for select
  using (user_id = auth.uid() or public.is_admin());
create policy enrollments_admin_update on public.enrollments for update
  using (public.is_admin()) with check (public.is_admin());

-- 토큰: 본인 기록만 본다.
create policy ledger_read_own on public.token_ledger for select using (user_id = auth.uid());

grant execute on function public.register_enrollment(text, text) to authenticated;
grant execute on function public.set_nickname(text) to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
