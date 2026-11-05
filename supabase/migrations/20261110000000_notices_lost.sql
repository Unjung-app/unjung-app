-- 운중고 앱 v3 — M3 4주차: 학생 공지 · 검토위원 · 분실물
-- 원칙(M3 명세 8·9장)
--  · 학생 공지: 모든 학생이 쓰고, 학생자치회가 임명한 검토위원이 승인해야 게시된다. 승인 +30, 검토 활동 +2(하루 최대 20).
--    검토위원 본인 글은 다른 검토위원이 승인한다. 반려는 사유가 꼭 있어야 한다. 신고 3건이면 자동으로 숨긴다.
--  · 범위: 전체 / 내 학년 / 우리 반 (작성자의 학번 기준이라 남의 학년·반에는 못 올린다)
--  · 분실물: 글은 바로 게시, 사진은 검토위원 승인 뒤에만 보인다. 연락처 대신 전달 장소로 연결.
--    물건을 받은 사람이 '받았어요'를 누르면 도와준 사람에게 +20(하루 최대 20).

-- ───────────────────────── 금칙어 정리 (버그 수정) ─────────────────────────
-- 닉네임 사칭 방지용 예약어(선생님·학생회장·운중고 등)가 공지·한줄평·게시판 글까지 막고 있었다.
-- 욕설·성적 표현(abuse)과 예약어(reserved)를 나눠서, 예약어는 닉네임에만 적용한다.
alter table public.banned_words add column kind text not null default 'abuse' check (kind in ('abuse', 'reserved'));
update public.banned_words set kind = 'reserved'
 where word in ('관리자', '운영자', '검토위원', '선생님', '교장', '교감', '학생회장', 'admin', '익명', '운중고');

create or replace function public.has_banned_word(t text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.banned_words b where b.kind = 'abuse' and position(b.word in public.normalize_text(t)) > 0)
$$;

create or replace function public.has_reserved_word(t text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.banned_words b where b.kind = 'reserved' and position(b.word in public.normalize_text(t)) > 0)
$$;
revoke all on function public.has_reserved_word(text) from public, anon, authenticated;

create or replace function public.set_nickname(p_nickname text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n text := btrim(coalesce(p_nickname, ''));
  cur public.profiles;
  next_ok timestamptz;
begin
  if not public.is_school_user() then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  select * into cur from public.profiles where id = me for update;
  if cur.nickname is not null and cur.nickname = n then return public.my_wallet(); end if;
  if n !~ '^[가-힣A-Za-z0-9_]{2,10}$' then
    raise exception '닉네임은 한글·영문·숫자·_ 로 2~10자예요' using errcode = 'P0001';
  end if;
  if public.has_banned_word(n) or public.has_reserved_word(n) then
    raise exception '사용할 수 없는 단어가 들어 있어요' using errcode = 'P0001';
  end if;
  if cur.nickname is not null and cur.nickname_changed_at is not null
     and cur.nickname_changed_at > now() - interval '30 days' then
    next_ok := cur.nickname_changed_at + interval '30 days';
    raise exception '닉네임은 30일에 한 번 바꿀 수 있어요 (%부터 가능)',
      to_char(next_ok at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일"') using errcode = 'P0001';
  end if;
  begin
    update public.profiles set nickname = n, nickname_changed_at = now() where id = me;
  exception when unique_violation then
    raise exception '이미 다른 학생이 쓰는 닉네임이에요' using errcode = 'P0001';
  end;
  return public.my_wallet();
end $$;

-- ───────────────────────── 학생 공지 ─────────────────────────

create table public.notices (
  id             bigint generated always as identity primary key,
  author         uuid not null references public.profiles (id) on delete cascade,
  author_grade   smallint,
  kind           text not null check (kind in ('event', 'club', 'council', 'recruit', 'etc')),
  title          text not null check (char_length(title) between 2 and 40),
  body           text not null check (char_length(body) between 5 and 1000),
  event_date     date,
  scope          text not null check (scope in ('all', 'grade', 'class')),
  scope_grade    smallint,
  scope_class    smallint,
  show_from      date not null,
  show_until     date not null,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'hidden', 'withdrawn')),
  reviewer       uuid references public.profiles (id) on delete set null,
  reviewed_at    timestamptz,
  reject_reason  text check (char_length(reject_reason) <= 200),
  report_count   int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (show_until >= show_from and show_until <= show_from + 13)
);
create index notices_live on public.notices (status, show_from, show_until);

create table public.notice_reports (
  notice_id   bigint not null references public.notices (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  reason      text not null default '' check (char_length(reason) <= 50),
  created_at  timestamptz not null default now(),
  primary key (notice_id, user_id)
);

create or replace function public.submit_notice(
  p_kind text, p_title text, p_body text, p_event_date date, p_scope text, p_show_from date, p_show_days int)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  e public.enrollments := public.enrollment_of(auth.uid());
  t text := btrim(coalesce(p_title, ''));
  b text := btrim(coalesce(p_body, ''));
  today date := public.seoul_today();
  rid bigint;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if e.user_id is null then raise exception '학번을 먼저 등록해 주세요' using errcode = 'P0001'; end if;
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

-- 작성자: 검토 전 취소 또는 게시 중인 글 내리기
create or replace function public.withdraw_notice(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.notices set status = 'withdrawn', updated_at = now()
   where id = p_id and author = auth.uid() and status in ('pending', 'approved');
  if not found then raise exception '내 공지만 내릴 수 있어요' using errcode = 'P0001'; end if;
end $$;

-- 검토위원: 승인(+30 작성자) / 반려(사유 필수). 검토 활동 +2(하루 최대 20)
create or replace function public.review_notice(p_id bigint, p_approve boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n public.notices;
  r text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_reviewer() then raise exception '검토위원만 할 수 있어요' using errcode = '42501'; end if;
  select * into n from public.notices where id = p_id for update;
  if not found or n.status <> 'pending' then raise exception '검토할 수 없는 공지예요(이미 처리됨)' using errcode = 'P0001'; end if;
  if n.author = me then raise exception '내가 쓴 공지는 다른 검토위원이 검토해야 해요' using errcode = 'P0001'; end if;
  if not p_approve and (r is null or char_length(r) > 200) then raise exception '반려 사유를 적어 주세요' using errcode = 'P0001'; end if;
  update public.notices
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewer = me, reviewed_at = now(), reject_reason = case when p_approve then null else r end, updated_at = now()
   where id = p_id;
  if p_approve then perform public.award_tokens(n.author, 30, 'notice_approved', p_id::text); end if;
  perform public.award_capped(me, 2, 'review_done', 'notice:' || p_id, 20);
end $$;

-- 신고: 3명이면 자동으로 숨김
create or replace function public.report_notice(p_id bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n public.notices;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  select * into n from public.notices where id = p_id and status = 'approved' for update;
  if not found then raise exception '없는 공지예요' using errcode = 'P0001'; end if;
  if n.author = me then raise exception '내 공지는 신고할 수 없어요' using errcode = 'P0001'; end if;
  insert into public.notice_reports (notice_id, user_id, reason) values (p_id, me, left(coalesce(p_reason, ''), 50)) on conflict do nothing;
  if found then
    update public.notices set report_count = report_count + 1,
           status = case when report_count + 1 >= 3 then 'hidden' else status end
     where id = p_id;
  end if;
end $$;

-- 검토위원: 숨김 / 다시 게시(신고 기록을 비운다)
create or replace function public.mod_notice(p_id bigint, p_show boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_reviewer() then raise exception '검토위원만 할 수 있어요' using errcode = '42501'; end if;
  update public.notices set status = case when p_show then 'approved' else 'hidden' end,
         report_count = case when p_show then 0 else report_count end, updated_at = now()
   where id = p_id and status in ('approved', 'hidden');
  if not found then raise exception '처리할 수 없는 공지예요' using errcode = 'P0001'; end if;
  if p_show then delete from public.notice_reports where notice_id = p_id; end if;
end $$;

-- 학생이 보는 공지: 승인됨 + 게시 기간 + 나에게 해당하는 범위만
create view public.notice_feed as
  select n.id, n.kind, n.title, n.body, n.event_date, n.scope, n.scope_grade, n.scope_class,
         n.show_from, n.show_until, n.created_at, n.reviewed_at,
         p.nickname as author_nickname, n.author_grade,
         (n.author = auth.uid()) as mine,
         exists (select 1 from public.notice_reports r where r.notice_id = n.id and r.user_id = auth.uid()) as reported
    from public.notices n
    join public.profiles p on p.id = n.author
    left join public.enrollments e on e.user_id = auth.uid() and e.school_year = public.current_school_year()
   where public.is_school_user() and n.status = 'approved'
     and public.seoul_today() between n.show_from and n.show_until
     and (n.scope = 'all'
          or (n.scope = 'grade' and e.grade = n.scope_grade)
          or (n.scope = 'class' and e.grade = n.scope_grade and e.class_no = n.scope_class));

-- 검토위원용: 검토 대기 + 신고로 숨겨진 공지 (작성자는 닉네임·학년만)
create view public.notice_review_queue as
  select n.id, n.kind, n.title, n.body, n.event_date, n.scope, n.scope_grade, n.scope_class, n.show_from, n.show_until,
         n.status, n.report_count, n.created_at, p.nickname as author_nickname, n.author_grade,
         (n.author = auth.uid()) as mine,
         (select string_agg(nullif(r.reason, ''), ' / ') from public.notice_reports r where r.notice_id = n.id) as reasons
    from public.notices n
    join public.profiles p on p.id = n.author
   where public.is_reviewer() and (n.status = 'pending' or (n.status in ('approved', 'hidden') and n.report_count > 0));

-- ───────────────────────── 분실물 ─────────────────────────

create table public.lost_items (
  id            bigint generated always as identity primary key,
  author        uuid not null references public.profiles (id) on delete cascade,
  type          text not null check (type in ('lost', 'found')),
  item          text not null check (char_length(item) between 1 and 30),
  place         text not null check (char_length(place) between 1 and 30),
  happened_on   date not null,
  description   text not null default '' check (char_length(description) <= 300),
  keep_at       text check (char_length(keep_at) <= 30),           -- 주운 물건을 둔 곳(학생회실 등)
  photo_path    text,
  photo_status  text not null default 'none' check (photo_status in ('none', 'pending', 'approved', 'rejected')),
  helper        uuid references public.profiles (id) on delete set null, -- found 글: 주인 / lost 글: 찾아 준 사람
  helped_at     timestamptz,
  status        text not null default 'open' check (status in ('open', 'resolved', 'closed')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create index lost_items_recent on public.lost_items (created_at desc);

create or replace function public.post_lost_item(
  p_type text, p_item text, p_place text, p_happened_on date, p_description text, p_keep_at text, p_photo_path text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  it text := btrim(coalesce(p_item, ''));
  pl text := btrim(coalesce(p_place, ''));
  d text := btrim(coalesce(p_description, ''));
  photo text := nullif(btrim(coalesce(p_photo_path, '')), '');
  rid bigint;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if p_type not in ('lost', 'found') then raise exception '종류를 골라 주세요' using errcode = 'P0001'; end if;
  if char_length(it) < 1 or char_length(it) > 30 or char_length(pl) < 1 or char_length(pl) > 30 or char_length(d) > 300 then
    raise exception '물건·장소는 30자, 설명은 300자까지예요' using errcode = 'P0001';
  end if;
  if p_happened_on > public.seoul_today() or p_happened_on < public.seoul_today() - 30 then
    raise exception '날짜를 다시 확인해 주세요' using errcode = 'P0001';
  end if;
  if public.has_banned_word(it || ' ' || pl || ' ' || d) then raise exception '부적절한 표현이 들어 있어요' using errcode = 'P0001'; end if;
  if photo is not null and photo !~ ('^' || me::text || '/[A-Za-z0-9_-]+\.jpg$') then
    raise exception '사진을 다시 올려 주세요' using errcode = 'P0001';
  end if;
  if (select count(*) from public.lost_items where author = me and created_at > now() - interval '1 day') >= 5 then
    raise exception '하루에 5개까지 올릴 수 있어요' using errcode = 'P0001';
  end if;
  insert into public.lost_items (author, type, item, place, happened_on, description, keep_at, photo_path, photo_status)
  values (me, p_type, it, pl, p_happened_on, d, case when p_type = 'found' then left(nullif(btrim(coalesce(p_keep_at, '')), ''), 30) end,
          photo, case when photo is null then 'none' else 'pending' end)
  returning id into rid;
  return rid;
end $$;

-- '제 거예요'(주운 물건 글) / '제가 찾았어요'(잃어버린 물건 글)
create or replace function public.respond_lost_item(p_id bigint, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  x public.lost_items;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  select * into x from public.lost_items where id = p_id for update;
  if not found or x.status <> 'open' then raise exception '이미 끝난 글이에요' using errcode = 'P0001'; end if;
  if x.author = me then raise exception '내 글이에요' using errcode = 'P0001'; end if;
  if p_on then
    if x.helper is not null and x.helper <> me then raise exception '이미 다른 학생이 응답했어요' using errcode = 'P0001'; end if;
    update public.lost_items set helper = me, helped_at = now() where id = p_id;
  else
    update public.lost_items set helper = null, helped_at = null where id = p_id and helper = me;
  end if;
end $$;

-- 물건을 받은 사람이 '받았어요' → 도와준 사람 +20 (하루 최대 20)
create or replace function public.resolve_lost_item(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  x public.lost_items;
  finder uuid;
begin
  select * into x from public.lost_items where id = p_id for update;
  if not found or x.status <> 'open' or x.helper is null then raise exception '아직 받을 수 없는 글이에요' using errcode = 'P0001'; end if;
  -- 주운 물건 글: 받은 사람 = helper(주인), 도와준 사람 = 작성자 / 잃어버린 물건 글: 받은 사람 = 작성자, 도와준 사람 = helper
  if x.type = 'found' and me <> x.helper then raise exception '물건 주인만 받았다고 할 수 있어요' using errcode = 'P0001'; end if;
  if x.type = 'lost' and me <> x.author then raise exception '글쓴이만 받았다고 할 수 있어요' using errcode = 'P0001'; end if;
  finder := case when x.type = 'found' then x.author else x.helper end;
  update public.lost_items set status = 'resolved', resolved_at = now() where id = p_id;
  perform public.award_capped(finder, 20, 'lost_found', p_id::text, 20);
end $$;

-- 글쓴이: 그냥 닫기(보상 없음)
create or replace function public.close_lost_item(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.lost_items set status = 'closed', resolved_at = now() where id = p_id and author = auth.uid() and status = 'open';
  if not found then raise exception '내 글만 닫을 수 있어요' using errcode = 'P0001'; end if;
end $$;

-- 검토위원: 사진 승인/거절 (+2, 하루 최대 20)
create or replace function public.review_lost_photo(p_id bigint, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_reviewer() then raise exception '검토위원만 할 수 있어요' using errcode = '42501'; end if;
  update public.lost_items set photo_status = case when p_approve then 'approved' else 'rejected' end
   where id = p_id and photo_status = 'pending';
  if not found then raise exception '이미 처리된 사진이에요' using errcode = 'P0001'; end if;
  perform public.award_capped(auth.uid(), 2, 'review_done', 'photo:' || p_id, 20);
end $$;

-- 학생이 보는 분실물: 최근 30일, 닫힌 글 제외. 사진은 승인됐거나 내 글일 때만 경로를 준다.
create view public.lost_feed as
  select x.id, x.type, x.item, x.place, x.happened_on, x.description, x.keep_at,
         case when x.photo_status = 'approved' or x.author = auth.uid() then x.photo_path end as photo_path,
         case when x.author = auth.uid() then x.photo_status end as my_photo_status,
         x.status, x.created_at, x.resolved_at,
         (x.author = auth.uid()) as mine,
         (x.helper = auth.uid()) as i_responded,
         (x.helper is not null) as has_response
    from public.lost_items x
   where public.is_school_user() and x.status <> 'closed' and x.created_at > now() - interval '30 days';

create view public.lost_photo_queue as
  select x.id, x.type, x.item, x.place, x.photo_path, x.created_at
    from public.lost_items x
   where public.is_reviewer() and x.photo_status = 'pending';

-- ───────────────────────── 관리자: 검토위원 임명 ─────────────────────────

-- 학번으로 학생 찾기 (관리자만. 실명·이메일은 관리자에게만 보인다)
create or replace function public.admin_find_user(p_student_no text)
returns table (user_id uuid, name text, email text, role text, grade int, class_no int, nickname text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  return query
    select p.id, e.name, p.email, p.role, e.grade, e.class_no, p.nickname
      from public.enrollments e join public.profiles p on p.id = e.user_id
     where e.school_year = public.current_school_year() and e.student_no = btrim(p_student_no);
end $$;

create or replace function public.admin_list_staff()
returns table (user_id uuid, name text, student_no text, role text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  return query
    select p.id, e.name, e.student_no, p.role
      from public.profiles p
      left join public.enrollments e on e.user_id = p.id and e.school_year = public.current_school_year()
     where p.role in ('reviewer', 'admin')
     order by p.role, e.student_no;
end $$;

-- 역할 변경: 학생·검토위원만 바꿀 수 있게 (관리자 지정은 SQL로만)
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  if p_role not in ('student', 'reviewer') then raise exception '학생·검토위원으로만 바꿀 수 있어요' using errcode = 'P0001'; end if;
  if p_user = auth.uid() then raise exception '내 역할은 바꿀 수 없어요' using errcode = 'P0001'; end if;
  update public.profiles set role = p_role where id = p_user and role <> 'admin';
  if not found then raise exception '관리자의 역할은 여기서 바꿀 수 없어요' using errcode = 'P0001'; end if;
end $$;

-- ───────────────────────── 사진 저장소 (Supabase Storage) ─────────────────────────
-- 비공개 버킷. 학생은 자기 폴더(<user id>/)에만 올리고, 보기는 본인·검토위원·승인된 사진만.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('lost-photos', 'lost-photos', false, 1048576, array['image/jpeg'])
    on conflict (id) do nothing;

    execute $p$create policy lost_photos_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'lost-photos' and public.is_school_user() and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy lost_photos_select on storage.objects for select to authenticated
      using (bucket_id = 'lost-photos' and public.is_school_user() and (
        (storage.foldername(name))[1] = auth.uid()::text
        or public.is_reviewer()
        or exists (select 1 from public.lost_items x where x.photo_path = name and x.photo_status = 'approved')))$p$;
    execute $p$create policy lost_photos_delete on storage.objects for delete to authenticated
      using (bucket_id = 'lost-photos' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end $$;

-- ───────────────────────── 권한(RLS) ─────────────────────────

alter table public.notices enable row level security;
alter table public.notice_reports enable row level security;
alter table public.lost_items enable row level security;

create policy notices_read_own on public.notices for select using (author = auth.uid());
create policy notice_reports_read_own on public.notice_reports for select using (user_id = auth.uid());
create policy lost_items_read_own on public.lost_items for select using (author = auth.uid());

revoke all on public.notice_feed, public.notice_review_queue, public.lost_feed, public.lost_photo_queue from public, anon;
grant select on public.notice_feed, public.notice_review_queue, public.lost_feed, public.lost_photo_queue to authenticated;

grant execute on function public.submit_notice(text, text, text, date, text, date, int) to authenticated;
grant execute on function public.withdraw_notice(bigint) to authenticated;
grant execute on function public.review_notice(bigint, boolean, text) to authenticated;
grant execute on function public.report_notice(bigint, text) to authenticated;
grant execute on function public.mod_notice(bigint, boolean) to authenticated;
grant execute on function public.post_lost_item(text, text, text, date, text, text, text) to authenticated;
grant execute on function public.respond_lost_item(bigint, boolean) to authenticated;
grant execute on function public.resolve_lost_item(bigint) to authenticated;
grant execute on function public.close_lost_item(bigint) to authenticated;
grant execute on function public.review_lost_photo(bigint, boolean) to authenticated;
grant execute on function public.admin_find_user(text) to authenticated;
grant execute on function public.admin_list_staff() to authenticated;
