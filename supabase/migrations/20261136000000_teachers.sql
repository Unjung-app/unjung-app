-- 11-09 호원 요청: 선생님 계정(학교 구글 계정, 학번 없음)
--  · 선생님 명단(teachers)에 이메일을 넣으면 그 계정은 학번 등록 없이 앱을 쓰고 '선생님' 배지가 붙는다
--  · admin=true면 관리자 권한(학생 관리·검토·의견 관리·사용 현황·설문 등 전부)
--  · 명단은 관리자가 앱(학생 관리 화면)에서 추가·삭제한다. 학생 계정(숫자 아이디·학번 등록된 계정)은 넣을 수 없다
--  · 선생님 공지는 검토 없이 바로 게시되고 '👩‍🏫 ○○○ 선생님'으로 표시된다
-- 여러 번 실행해도 안전

create table if not exists public.teachers (
  email      text primary key check (email = lower(email) and email like '%@unjung.hs.kr'),
  name       text not null check (char_length(name) between 2 and 10),
  admin      boolean not null default true,
  added_by   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.teachers enable row level security; -- 직접 읽기·쓰기 없음(아래 함수로만)

-- 프로필에 선생님 이름을 붙여 둔다(앱이 자기 프로필을 읽을 때 함께 받는다). null = 학생
alter table public.profiles add column if not exists teacher_name text;

create or replace function public.is_teacher(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = p_user and p.teacher_name is not null)
$$;

-- 명단 → 프로필 반영(역할·이름). 명단에서 빠지면 학생으로 되돌린다
create or replace function public._sync_teacher(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  t public.teachers;
begin
  select * into t from public.teachers where email = lower(p_email);
  if found then
    update public.profiles
       set teacher_name = t.name,
           role = case when t.admin then 'admin' when role = 'admin' then 'student' else role end
     where lower(email) = t.email;
  else
    update public.profiles set teacher_name = null, role = case when role = 'admin' then 'student' else role end
     where lower(email) = lower(p_email) and teacher_name is not null;
  end if;
end $$;
revoke all on function public._sync_teacher(text) from public, anon, authenticated;

create or replace function public._teachers_sync_trg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform public._sync_teacher(old.email); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform public._sync_teacher(new.email); end if;
  return null;
end $$;
drop trigger if exists teachers_sync on public.teachers;
create trigger teachers_sync after insert or update or delete on public.teachers for each row execute function public._teachers_sync_trg();

-- 선생님이 처음 로그인해서 프로필이 생길 때 바로 반영
create or replace function public._profile_teacher_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t public.teachers;
begin
  select * into t from public.teachers where email = lower(new.email);
  if found then
    new.teacher_name := t.name;
    if t.admin then new.role := 'admin'; end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_teacher on public.profiles;
create trigger profiles_teacher before insert on public.profiles for each row execute function public._profile_teacher_trg();

-- 학생이 스스로 teacher_name·role을 바꾸지 못하게(혹시 열린 update 정책이 있어도)
create or replace function public._profile_teacher_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and new.teacher_name is distinct from old.teacher_name then
    raise exception '바꿀 수 없는 항목이에요' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists profiles_teacher_guard on public.profiles;
create trigger profiles_teacher_guard before update of teacher_name on public.profiles for each row execute function public._profile_teacher_guard();

-- 선생님 계정은 학번을 등록하지 않는다(랭킹·반 기능에 섞이지 않게)
create or replace function public._enrollment_not_teacher()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null and public.is_teacher(new.user_id) then
    raise exception '선생님 계정은 학번을 등록하지 않아도 돼요' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists enrollments_not_teacher on public.enrollments;
create trigger enrollments_not_teacher before insert or update of user_id on public.enrollments for each row execute function public._enrollment_not_teacher();

-- ───────── 관리자: 선생님 명단 관리 ─────────
create or replace function public.admin_list_teachers()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
            'email', t.email, 'name', t.name, 'admin', t.admin, 'created_at', t.created_at,
            'joined', exists (select 1 from public.profiles p where lower(p.email) = t.email)) order by t.name), '[]')
            from public.teachers t);
end $$;

create or replace function public.admin_add_teacher(p_email text, p_name text, p_admin boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare
  em text := lower(btrim(coalesce(p_email, '')));
  nm text := btrim(coalesce(p_name, ''));
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  if em !~ '^[a-z0-9._-]+@unjung\.hs\.kr$' then raise exception '학교 이메일(@unjung.hs.kr)을 정확히 적어 주세요' using errcode = 'P0001'; end if;
  if split_part(em, '@', 1) ~ '^[0-9]+$' then raise exception '학생 계정(숫자 아이디)은 선생님으로 넣을 수 없어요' using errcode = 'P0001'; end if;
  if exists (select 1 from public.profiles p join public.enrollments e on e.user_id = p.id where lower(p.email) = em) then
    raise exception '학번이 등록된 학생 계정이에요' using errcode = 'P0001';
  end if;
  if char_length(nm) < 2 or char_length(nm) > 10 then raise exception '이름은 2~10자예요(예: 박경애)' using errcode = 'P0001'; end if;
  insert into public.teachers (email, name, admin, added_by) values (em, nm, coalesce(p_admin, true), auth.uid())
  on conflict (email) do update set name = excluded.name, admin = excluded.admin;
end $$;

create or replace function public.admin_remove_teacher(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  if lower(btrim(p_email)) = lower(auth.jwt() ->> 'email') then raise exception '내 계정은 뺄 수 없어요' using errcode = 'P0001'; end if;
  delete from public.teachers where email = lower(btrim(p_email));
end $$;

revoke all on function public.admin_list_teachers() from public, anon;
revoke all on function public.admin_add_teacher(text, text, boolean) from public, anon;
revoke all on function public.admin_remove_teacher(text) from public, anon;
grant execute on function public.admin_list_teachers() to authenticated;
grant execute on function public.admin_add_teacher(text, text, boolean) to authenticated;
grant execute on function public.admin_remove_teacher(text) to authenticated;

-- 관리자 목록에 선생님 표시
drop function if exists public.admin_list_staff();
create function public.admin_list_staff()
returns table (user_id uuid, name text, student_no text, role text, is_planner boolean, teacher boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  return query
    select p.id, coalesce(e.name, p.teacher_name || ' 선생님'), e.student_no, p.role, p.is_planner, p.teacher_name is not null
      from public.profiles p
      left join public.enrollments e on e.user_id = p.id and e.school_year = public.current_school_year()
     where p.role in ('reviewer', 'admin') or p.is_planner or p.teacher_name is not null
     order by (p.teacher_name is null), p.role, e.student_no;
end $$;
revoke all on function public.admin_list_staff() from public, anon;
grant execute on function public.admin_list_staff() to authenticated;

-- ───────── 공지: 선생님은 학번 없이, 검토 없이 ─────────
create or replace function public.submit_notice(
  p_kind text, p_title text, p_body text, p_event_date date, p_scope text, p_show_from date, p_show_days int)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  e public.enrollments := public.enrollment_of(auth.uid());
  teacher boolean := public.is_teacher();
  t text := btrim(coalesce(p_title, ''));
  b text := btrim(coalesce(p_body, ''));
  today date := public.seoul_today();
  rid bigint;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if e.user_id is null and not teacher then raise exception '학번을 먼저 등록해 주세요' using errcode = 'P0001'; end if;
  if teacher and p_scope <> 'all' then raise exception '선생님 공지는 전체 학생에게 보여요' using errcode = 'P0001'; end if;
  if p_kind not in ('event', 'club', 'council', 'recruit', 'etc') then raise exception '종류를 골라 주세요' using errcode = 'P0001'; end if;
  if p_scope not in ('all', 'grade', 'class') then raise exception '알릴 범위를 골라 주세요' using errcode = 'P0001'; end if;
  if char_length(t) < 2 or char_length(t) > 40 then raise exception '제목은 2~40자예요' using errcode = 'P0001'; end if;
  if char_length(b) < 5 or char_length(b) > 1000 then raise exception '내용은 5~1000자예요' using errcode = 'P0001'; end if;
  if p_show_from < today or p_show_from > today + 30 then raise exception '게시 시작일은 오늘부터 30일 안이에요' using errcode = 'P0001'; end if;
  if p_show_days < 1 or p_show_days > 14 then raise exception '게시 기간은 1~14일이에요' using errcode = 'P0001'; end if;
  if p_event_date is not null and (p_event_date < today or p_event_date > today + 180) then raise exception '날짜를 다시 확인해 주세요' using errcode = 'P0001'; end if;
  if public.has_banned_word(t || ' ' || b) then raise exception '부적절한 표현이 들어 있어요' using errcode = 'P0001'; end if;
  if (select count(*) from public.notices where author = me and status = 'pending') >= 3 then
    raise exception '검토를 기다리는 공지가 3개 있어요. 검토가 끝난 뒤 올려 주세요' using errcode = 'P0001';
  end if;
  insert into public.notices (author, author_grade, kind, title, body, event_date, scope, scope_grade, scope_class, show_from, show_until)
  values (me, e.grade, p_kind, t, b, p_event_date, p_scope,
          case when p_scope in ('grade', 'class') then e.grade end,
          case when p_scope = 'class' then e.class_no end,
          p_show_from, p_show_from + p_show_days - 1)
  returning id into rid;
  return rid;
end $$;

create or replace function public._notice_auto_approve()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public._is_comm_member() or public.is_teacher(new.author)
     or coalesce((select is_planner from public.profiles where id = new.author), false) then
    new.status := 'approved';
    new.reviewer := new.author;
    new.reviewed_at := now();
  end if;
  return new;
end $$;

create or replace view public.notice_feed as
  select n.id, n.kind, n.title, n.body, n.event_date, n.scope, n.scope_grade, n.scope_class,
         n.show_from, n.show_until, n.created_at, n.reviewed_at,
         p.nickname as author_nickname, n.author_grade,
         (n.author = auth.uid()) as mine,
         exists (select 1 from public.notice_reports r where r.notice_id = n.id and r.user_id = auth.uid()) as reported,
         p.teacher_name as author_teacher
    from public.notices n
    join public.profiles p on p.id = n.author
    left join public.enrollments e on e.user_id = auth.uid() and e.school_year = public.current_school_year()
   where public.is_school_user() and n.status = 'approved'
     and public.seoul_today() between n.show_from and n.show_until
     and (n.scope = 'all'
          or (n.scope = 'grade' and e.grade = n.scope_grade)
          or (n.scope = 'class' and e.grade = n.scope_grade and e.class_no = n.scope_class));
