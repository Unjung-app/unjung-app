-- 11-06 학번·이름 정정 (호원 결정)
--  1) 처음 한 번은 학생이 직접: 등록 후 24시간 안에 1번. 빈 학번만, 직책 명단(관리자·기획행정부·스터디 관리·소통홍보부) 학번은 불가
--  2) 그 뒤에는 앱 안 '정정 요청' → 관리자가 승인/반려. 요청한 학번을 다른 계정이 쓰고 있으면 승인할 때 함께 정리
--     (학번을 남이 먼저 차지해서 등록조차 못 하는 학생도 요청할 수 있다)
--  3) 학적의 모든 변화(등록·직접 정정·요청 승인·관리자 정정·지우기)를 기록
--  4) 보안: '입력한 학번'만으로 관리자·기획행정부가 되던 자동 지정을 끈다. 학번은 아무나 칠 수 있는 값이기 때문.
--     이미 받은 직책은 그대로. 명단 학번으로 새로 등록한 계정은 관리자가 이름을 보고 '명단 확인'에서 지정한다.

-- ───────── 자동 지정 끄기 ─────────
drop trigger if exists enrollments_grant_admin on public.enrollments;
drop trigger if exists enrollments_grant_roles on public.enrollments;

-- ───────── 변경 기록 ─────────
create table if not exists public.enrollment_changes (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  school_year int  not null,
  kind        text not null check (kind in ('register', 'self', 'request', 'admin', 'release', 'sql')),
  old_no      text,
  old_name    text,
  new_no      text,
  new_name    text,
  actor       uuid,
  created_at  timestamptz not null default now()
);
create index if not exists enrollment_changes_user on public.enrollment_changes (user_id, school_year, kind);
alter table public.enrollment_changes enable row level security; -- 정책 없음: 함수로만 읽고 쓴다

-- 어떤 경로로 바뀌었는지는 함수가 app.enroll_kind에 적어 두고, 트리거가 기록한다(SQL 편집기에서 직접 고치면 'sql')
create or replace function public._log_enrollment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  k text := nullif(current_setting('app.enroll_kind', true), '');
begin
  if tg_op = 'INSERT' then
    insert into public.enrollment_changes (user_id, school_year, kind, new_no, new_name, actor)
    values (new.user_id, new.school_year, coalesce(k, case when auth.uid() = new.user_id then 'register' else 'sql' end), new.student_no, new.name, auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    if new.student_no is distinct from old.student_no or new.name is distinct from old.name then
      insert into public.enrollment_changes (user_id, school_year, kind, old_no, old_name, new_no, new_name, actor)
      values (new.user_id, new.school_year, coalesce(k, 'sql'), old.student_no, old.name, new.student_no, new.name, auth.uid());
    end if;
    return new;
  else
    insert into public.enrollment_changes (user_id, school_year, kind, old_no, old_name, actor)
    values (old.user_id, old.school_year, coalesce(k, 'sql'), old.student_no, old.name, auth.uid());
    return old;
  end if;
end $$;
drop trigger if exists enrollments_log on public.enrollments;
create trigger enrollments_log after insert or update or delete on public.enrollments
  for each row execute function public._log_enrollment();
revoke all on function public._log_enrollment() from public, anon, authenticated;

-- 직책 명단(관리자·기획행정부·스터디 윗미 관리·소통홍보부)에 있는 학번인가 → 직접 고치기로는 그 학번이 될 수 없다
create or replace function public._is_listed_no(p_no text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_config c
     where c.key in ('admins', 'planners', 'study_managers', 'comm_members')
       and p_no = any (string_to_array(c.value, ',')))
$$;
revoke all on function public._is_listed_no(text) from public, anon, authenticated;

-- ───────── 정정 요청 ─────────
create table if not exists public.enrollment_requests (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  school_year int  not null,
  student_no  text not null check (student_no ~ '^[1-3]0[1-8](0[1-9]|[1-3][0-9]|40)$'),
  name        text not null check (char_length(btrim(name)) between 2 and 10),
  reason      text check (char_length(reason) <= 100),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  note        text check (char_length(note) <= 100),
  decided_by  uuid,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);
create unique index if not exists enrollment_requests_one_pending on public.enrollment_requests (user_id) where status = 'pending';
alter table public.enrollment_requests enable row level security; -- 정책 없음: 함수로만

-- 내 학적 정정 상태: 직접 고칠 수 있는지(언제까지), 마지막 요청
create or replace function public.my_enrollment_fix()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  y int := public.current_school_year();
  e public.enrollments;
  used int;
  until timestamptz;
  rq public.enrollment_requests;
begin
  if me is null then return null; end if;
  select * into e from public.enrollments where user_id = me and school_year = y;
  select count(*) into used from public.enrollment_changes where user_id = me and school_year = y and kind = 'self';
  if e.user_id is not null then until := e.created_at + interval '24 hours'; end if;
  select * into rq from public.enrollment_requests where user_id = me and school_year = y order by created_at desc limit 1;
  return jsonb_build_object(
    'can_self_fix', coalesce(e.user_id is not null and used = 0 and now() < until, false),
    'self_until', until,
    'request', case when rq.id is null then null else jsonb_build_object(
      'id', rq.id, 'student_no', rq.student_no, 'name', rq.name, 'status', rq.status, 'note', rq.note, 'created_at', rq.created_at) end);
end $$;

-- 1) 학생이 직접 정정(등록 후 24시간 안에 1번)
create or replace function public.self_fix_enrollment(p_student_no text, p_name text)
returns public.enrollments language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  y int := public.current_school_year();
  no text := btrim(coalesce(p_student_no, ''));
  nm text := btrim(coalesce(p_name, ''));
  e public.enrollments;
  r public.enrollments;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  select * into e from public.enrollments where user_id = me and school_year = y;
  if e.user_id is null then raise exception '아직 학번을 등록하지 않았어요' using errcode = 'P0001'; end if;
  if exists (select 1 from public.enrollment_changes where user_id = me and school_year = y and kind = 'self') then
    raise exception '직접 고치기는 한 번만 할 수 있어요. 정정 요청을 보내 주세요' using errcode = 'P0001';
  end if;
  if now() >= e.created_at + interval '24 hours' then
    raise exception '등록 후 24시간이 지나 직접 고칠 수 없어요. 정정 요청을 보내 주세요' using errcode = 'P0001';
  end if;
  if no = e.student_no and nm = e.name then raise exception '바뀐 내용이 없어요' using errcode = 'P0001'; end if;
  if no <> e.student_no and public._is_listed_no(no) then
    raise exception '이 학번은 직접 바꿀 수 없어요. 정정 요청을 보내 주세요' using errcode = 'P0001';
  end if;
  perform set_config('app.enroll_kind', 'self', true);
  begin
    update public.enrollments set student_no = no, name = nm where user_id = me and school_year = y returning * into r;
  exception
    when unique_violation then raise exception '이 학번은 다른 계정이 쓰고 있어요. 정정 요청을 보내 주세요' using errcode = 'P0001';
    when check_violation then raise exception '학번(5자리)이나 이름 형식이 올바르지 않아요' using errcode = 'P0001';
  end;
  perform set_config('app.enroll_kind', '', true);
  return r;
end $$;

-- 2) 정정 요청(학번 등록 전이어도 가능: 내 학번을 남이 먼저 등록한 경우). 대기 중인 요청이 있으면 내용을 바꾼다
create or replace function public.request_enrollment_fix(p_student_no text, p_name text, p_reason text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  y int := public.current_school_year();
  no text := btrim(coalesce(p_student_no, ''));
  nm text := btrim(coalesce(p_name, ''));
  rs text := nullif(btrim(coalesce(p_reason, '')), '');
  e public.enrollments;
  rid bigint;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if no !~ '^[1-3]0[1-8](0[1-9]|[1-3][0-9]|40)$' or char_length(nm) not between 2 and 10 then
    raise exception '학번(5자리)이나 이름 형식이 올바르지 않아요' using errcode = 'P0001';
  end if;
  select * into e from public.enrollments where user_id = me and school_year = y;
  if e.user_id is not null and e.student_no = no and e.name = nm then raise exception '지금 등록된 내용과 같아요' using errcode = 'P0001'; end if;
  if (select count(*) from public.enrollment_requests where user_id = me and school_year = y) >= 5 then
    raise exception '올해 보낼 수 있는 정정 요청을 모두 썼어요. 학생회에 직접 알려 주세요' using errcode = 'P0001';
  end if;
  update public.enrollment_requests set student_no = no, name = nm, reason = left(rs, 100), created_at = now()
   where user_id = me and status = 'pending' returning id into rid;
  if rid is null then
    insert into public.enrollment_requests (user_id, school_year, student_no, name, reason)
    values (me, y, no, nm, left(rs, 100)) returning id into rid;
    -- 관리자에게 알림(학생 관리에서 바로 처리)
    perform public.push_to(p.id, 'mine', 'enroll-new-' || rid, '학적 정정 요청이 왔어요', nm || ' · ' || no, '/admin/staff')
       from public.profiles p where p.role = 'admin';
    begin perform public.push_kick(); exception when others then null; end;
  end if;
  return rid;
end $$;

create or replace function public.cancel_enrollment_request()
returns void language sql security definer set search_path = public as $$
  update public.enrollment_requests set status = 'cancelled', decided_at = now() where user_id = auth.uid() and status = 'pending'
$$;

-- 관리자: 대기 중인 요청(지금 학적 · 요청한 학번을 이미 쓰는 계정 함께)
create or replace function public.admin_enrollment_requests()
returns table (id bigint, user_id uuid, email text, cur_no text, cur_name text, req_no text, req_name text, reason text, created_at timestamptz,
               holder_id uuid, holder_name text, holder_email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  return query
    select r.id, r.user_id, p.email, e.student_no, e.name, r.student_no, r.name, r.reason, r.created_at,
           h.user_id, h.name, hp.email
      from public.enrollment_requests r
      join public.profiles p on p.id = r.user_id
      left join public.enrollments e on e.user_id = r.user_id and e.school_year = r.school_year
      left join public.enrollments h on h.school_year = r.school_year and h.student_no = r.student_no and h.user_id <> r.user_id
      left join public.profiles hp on hp.id = h.user_id
     where r.status = 'pending'
     order by r.created_at;
end $$;

-- 관리자: 승인(필요하면 그 학번을 쓰던 계정의 학적을 풀고) / 반려
create or replace function public.admin_decide_enrollment_request(p_id bigint, p_approve boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.enrollment_requests;
  h uuid;
  nt text := nullif(left(btrim(coalesce(p_note, '')), 100), '');
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  select * into r from public.enrollment_requests where id = p_id and status = 'pending' for update;
  if r.id is null then raise exception '이미 처리된 요청이에요' using errcode = 'P0001'; end if;
  if p_approve then
    select user_id into h from public.enrollments where school_year = r.school_year and student_no = r.student_no and user_id <> r.user_id;
    if h is not null then
      perform set_config('app.enroll_kind', 'release', true);
      delete from public.enrollments where user_id = h and school_year = r.school_year;
      perform public.push_to(h, 'mine', 'enroll-release-' || r.id, '학번을 다시 등록해 주세요',
        '등록한 학번이 다른 학생의 학번으로 확인되어 지워졌어요. 앱을 열고 내 학번을 다시 입력해 주세요', '/');
    end if;
    perform set_config('app.enroll_kind', 'request', true);
    insert into public.enrollments (user_id, school_year, student_no, name)
    values (r.user_id, r.school_year, r.student_no, r.name)
    on conflict (user_id, school_year) do update set student_no = excluded.student_no, name = excluded.name;
    perform set_config('app.enroll_kind', '', true);
    update public.enrollment_requests set status = 'approved', note = nt, decided_by = auth.uid(), decided_at = now() where id = r.id;
    perform public.push_to(r.user_id, 'mine', 'enroll-req-' || r.id, '학번·이름이 정정됐어요',
      r.name || ' · ' || r.student_no || '(으)로 바뀌었어요. 앱을 다시 열면 반영돼요', '/');
  else
    update public.enrollment_requests set status = 'rejected', note = nt, decided_by = auth.uid(), decided_at = now() where id = r.id;
    perform public.push_to(r.user_id, 'mine', 'enroll-req-' || r.id, '학적 정정 요청이 반려됐어요',
      coalesce(nt, '요청한 학번·이름을 확인하지 못했어요. 학생회에 직접 알려 주세요'), '/settings/enrollment');
  end if;
  begin perform public.push_kick(); exception when others then null; end;
end $$;

-- 관리자: 최근 학적 변경 기록
create or replace function public.admin_enrollment_log(p_limit int default 30)
returns table (at timestamptz, kind text, name text, old_no text, old_name text, new_no text, new_name text, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  return query
    select c.created_at, c.kind, coalesce(c.new_name, c.old_name), c.old_no, c.old_name, c.new_no, c.new_name, p.email
      from public.enrollment_changes c join public.profiles p on p.id = c.user_id
     where c.kind <> 'register'
     order by c.created_at desc limit least(greatest(coalesce(p_limit, 30), 1), 100);
end $$;

-- 관리자: 직책 명단 학번으로 등록했지만 아직 직책이 없는 계정 → 이름을 보고 '확인' 하면 지정
create or replace function public.admin_listed_pending()
returns table (user_id uuid, student_no text, name text, email text, want text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  return query
    select e.user_id, e.student_no, e.name, p.email,
           case when e.student_no = any (coalesce(string_to_array((select value from public.app_config where key = 'admins'), ','), '{}')) then 'admin' else 'planner' end
      from public.enrollments e join public.profiles p on p.id = e.user_id
     where e.school_year = public.current_school_year()
       and ((e.student_no = any (coalesce(string_to_array((select value from public.app_config where key = 'admins'), ','), '{}')) and p.role <> 'admin')
         or (e.student_no = any (coalesce(string_to_array((select value from public.app_config where key = 'planners'), ','), '{}')) and not p.is_planner))
     order by e.student_no;
end $$;

create or replace function public.admin_confirm_listed(p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  no text := (select student_no from public.enrollments where user_id = p_user and school_year = public.current_school_year());
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  if no is null then raise exception '학적이 없는 계정이에요' using errcode = 'P0001'; end if;
  if no = any (coalesce(string_to_array((select value from public.app_config where key = 'admins'), ','), '{}')) then
    update public.profiles set role = 'admin' where id = p_user;
    return 'admin';
  elsif no = any (coalesce(string_to_array((select value from public.app_config where key = 'planners'), ','), '{}')) then
    update public.profiles set is_planner = true where id = p_user;
    return 'planner';
  end if;
  raise exception '명단에 없는 학번이에요' using errcode = 'P0001';
end $$;

-- 관리자 정정·지우기도 기록에 'admin'·'release'로 남게
create or replace function public.admin_fix_enrollment(p_user uuid, p_student_no text, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  no text := btrim(coalesce(p_student_no, ''));
  nm text := btrim(coalesce(p_name, ''));
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception '없는 계정이에요' using errcode = 'P0001'; end if;
  perform set_config('app.enroll_kind', 'admin', true);
  begin
    insert into public.enrollments (user_id, school_year, student_no, name)
    values (p_user, public.current_school_year(), no, nm)
    on conflict (user_id, school_year) do update set student_no = excluded.student_no, name = excluded.name;
  exception
    when unique_violation then raise exception '이 학번은 다른 계정이 쓰고 있어요. 그 계정의 학적을 먼저 지워 주세요' using errcode = 'P0001';
    when check_violation then raise exception '학번(5자리)이나 이름 형식이 올바르지 않아요' using errcode = 'P0001';
  end;
  perform set_config('app.enroll_kind', '', true);
end $$;

create or replace function public.admin_release_enrollment(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  perform set_config('app.enroll_kind', 'release', true);
  delete from public.enrollments where user_id = p_user and school_year = public.current_school_year();
  if not found then raise exception '올해 등록된 학적이 없어요' using errcode = 'P0001'; end if;
  perform set_config('app.enroll_kind', '', true);
end $$;

-- 관리자 찾기: 이름(정확히)으로도 찾는다
drop function if exists public.admin_find_user(text);
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
        or (qy !~ '^[0-9]{5}$' and char_length(qy) >= 2
            and (lower(p.nickname) = lower(qy) or lower(p.email) = lower(qy) or e.name = qy))
     limit 8;
end $$;

-- 등록 안내 문구: 이메일 대신 앱 안 정정
create or replace function public.register_enrollment(p_student_no text, p_name text)
returns public.enrollments language plpgsql security definer set search_path = public as $$
declare
  r public.enrollments;
begin
  if not public.is_school_user() then
    raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501';
  end if;
  if exists (select 1 from public.enrollments where user_id = auth.uid() and school_year = public.current_school_year()) then
    raise exception '이미 올해 학번이 등록되어 있어요. 틀렸다면 설정 → 내 학번·이름에서 고쳐 주세요' using errcode = 'P0001';
  end if;
  insert into public.enrollments (user_id, school_year, student_no, name)
  values (auth.uid(), public.current_school_year(), btrim(p_student_no), btrim(p_name))
  returning * into r;
  return r;
exception
  when unique_violation then
    raise exception '이 학번은 이미 다른 계정이 등록했어요. 아래 ''정정 요청''을 보내 주시면 학생회가 확인해요' using errcode = 'P0001';
  when check_violation then
    raise exception '학번(5자리)이나 이름 형식이 올바르지 않아요' using errcode = 'P0001';
end $$;

grant execute on function public.my_enrollment_fix() to authenticated;
grant execute on function public.self_fix_enrollment(text, text) to authenticated;
grant execute on function public.request_enrollment_fix(text, text, text) to authenticated;
grant execute on function public.cancel_enrollment_request() to authenticated;
grant execute on function public.admin_enrollment_requests() to authenticated;
grant execute on function public.admin_decide_enrollment_request(bigint, boolean, text) to authenticated;
grant execute on function public.admin_enrollment_log(int) to authenticated;
grant execute on function public.admin_listed_pending() to authenticated;
grant execute on function public.admin_confirm_listed(uuid) to authenticated;
grant execute on function public.admin_find_user(text) to authenticated;
grant execute on function public.register_enrollment(text, text) to authenticated;
