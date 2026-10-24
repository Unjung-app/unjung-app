-- 운중고 앱 v3 — M3 2주차: 급식 한줄평 · 반별 수행평가·숙제 게시판
-- 원칙
--  · 한줄평은 화면에서 완전 익명('익명의 n학년'). 서버에는 작성 계정이 남아 신고·제재가 가능하다.
--    다른 학생이 읽는 통로(meal_review_feed)에는 user_id 가 아예 없다.
--  · 반별 게시판은 같은 반(올해 학번 기준)만 보고 쓸 수 있다. 다른 반 학생은 존재조차 모른다.
--  · 토큰: 한줄평 +3(하루 1번, 10자 이상), 공감 받음 +1(하루 최대 5), 게시판 글이 같은 반 2명에게 확인되면 +5(하루 최대 15).

-- ───────────────────────── 공용 ─────────────────────────

-- 지금 로그인한 학생의 올해 학적 (없으면 모든 칸이 null)
create or replace function public.enrollment_of(p_user uuid)
returns public.enrollments language sql stable security definer set search_path = public as $$
  select * from public.enrollments where user_id = p_user and school_year = public.current_school_year()
$$;
revoke all on function public.enrollment_of(uuid) from public, anon, authenticated;

-- 한국 시간 기준 '하루 중 몇 분'
create or replace function public.seoul_minutes(p_at timestamptz)
returns int language sql immutable as $$
  select (extract(hour from (p_at at time zone 'Asia/Seoul')) * 60 + extract(minute from (p_at at time zone 'Asia/Seoul')))::int
$$;

-- ───────────────────────── 급식 한줄평 ─────────────────────────

create table public.meal_reviews (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  meal_date     date not null,
  meal_code     smallint not null check (meal_code in (1, 2, 3)),   -- NEIS: 1 조식, 2 중식, 3 석식
  grade         smallint not null check (grade between 1 and 3),   -- '익명의 n학년' 표시용
  body          text not null check (char_length(body) between 2 and 100),
  like_count    int not null default 0,
  report_count  int not null default 0,
  hidden        boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, meal_date, meal_code)          -- 한 끼에 한 개
);
create index meal_reviews_by_meal on public.meal_reviews (meal_date, meal_code);

create table public.meal_review_likes (
  review_id   bigint not null references public.meal_reviews (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (review_id, user_id)
);

create table public.meal_review_reports (
  review_id   bigint not null references public.meal_reviews (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  reason      text not null default '' check (char_length(reason) <= 50),
  created_at  timestamptz not null default now(),
  primary key (review_id, user_id)
);

-- 쓸 수 있는 시간: 그 끼니 시작(중식은 1·2학년 12:30, 3학년 11:30)부터 다음 날 아침 8:40까지
create or replace function public.meal_review_open(p_date date, p_code int, p_grade int, p_now timestamptz)
returns boolean language sql immutable as $$
  select case
    when p_date = (p_now at time zone 'Asia/Seoul')::date then
      public.seoul_minutes(p_now) >= case p_code
        when 1 then 7 * 60
        when 3 then 17 * 60 + 30
        else case when p_grade = 3 then 11 * 60 + 30 else 12 * 60 + 30 end end
    when p_date = (p_now at time zone 'Asia/Seoul')::date - 1 then public.seoul_minutes(p_now) < 8 * 60 + 40
    else false
  end
$$;

-- 작성·수정 본체 (시각을 인자로 받아 테스트할 수 있게. 학생은 직접 못 부름)
create or replace function public._post_meal_review(p_user uuid, p_date date, p_code int, p_body text, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e public.enrollments := public.enrollment_of(p_user);
  b text := btrim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  rid bigint;
  got int := 0;
begin
  if e.user_id is null then raise exception '학번을 먼저 등록해 주세요' using errcode = 'P0001'; end if;
  if char_length(b) < 2 or char_length(b) > 100 then
    raise exception '한줄평은 2~100자로 써 주세요' using errcode = 'P0001';
  end if;
  if public.has_banned_word(b) then raise exception '부적절한 표현이 들어 있어요' using errcode = 'P0001'; end if;
  if not public.meal_review_open(p_date, p_code, e.grade, p_now) then
    raise exception '한줄평은 그 끼니 시간부터 다음 날 아침 8시 40분까지 쓸 수 있어요' using errcode = 'P0001';
  end if;

  insert into public.meal_reviews (user_id, meal_date, meal_code, grade, body)
  values (p_user, p_date, p_code, e.grade, b)
  on conflict (user_id, meal_date, meal_code) do update set body = excluded.body, updated_at = now()
  returning id into rid;

  if char_length(b) >= 10 and public.award_tokens(p_user, 3, 'meal_review', p_date::text) then got := 3; end if;
  return jsonb_build_object('id', rid, 'tokens', got);
end $$;
revoke all on function public._post_meal_review(uuid, date, int, text, timestamptz) from public, anon, authenticated;

create or replace function public.post_meal_review(p_date date, p_code int, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  return public._post_meal_review(auth.uid(), p_date, p_code, p_body, now());
end $$;

create or replace function public.delete_meal_review(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.meal_reviews where id = p_id and user_id = auth.uid();
end $$;

-- 공감 켜기/끄기. 내 글에는 못 누른다. 처음 공감받을 때 작성자에게 +1 (하루 최대 5)
create or replace function public.like_meal_review(p_id bigint, p_on boolean)
returns int language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r public.meal_reviews;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  select * into r from public.meal_reviews where id = p_id and not hidden for update;
  if not found then raise exception '없는 한줄평이에요' using errcode = 'P0001'; end if;
  if r.user_id = me then raise exception '내 한줄평에는 공감할 수 없어요' using errcode = 'P0001'; end if;
  if p_on then
    insert into public.meal_review_likes (review_id, user_id) values (p_id, me) on conflict do nothing;
    if found then
      update public.meal_reviews set like_count = like_count + 1 where id = p_id returning like_count into r.like_count;
      perform public.award_capped(r.user_id, 1, 'meal_like', p_id::text || ':' || me::text, 5);
    end if;
  else
    delete from public.meal_review_likes where review_id = p_id and user_id = me;
    if found then
      update public.meal_reviews set like_count = like_count - 1 where id = p_id returning like_count into r.like_count;
    end if;
  end if;
  return r.like_count;
end $$;

-- 신고: 3명이 신고하면 자동으로 숨기고 검토위원이 확인한다
create or replace function public.report_meal_review(p_id bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  owner uuid;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  select user_id into owner from public.meal_reviews where id = p_id for update;
  if not found then raise exception '없는 한줄평이에요' using errcode = 'P0001'; end if;
  if owner = me then raise exception '내 한줄평은 신고할 수 없어요' using errcode = 'P0001'; end if;
  insert into public.meal_review_reports (review_id, user_id, reason) values (p_id, me, left(coalesce(p_reason, ''), 50))
  on conflict do nothing;
  if found then
    update public.meal_reviews
       set report_count = report_count + 1,
           hidden = hidden or report_count + 1 >= 3
     where id = p_id;
  end if;
end $$;

-- 검토위원: 숨김/복구 (복구하면 신고 기록을 비운다)
create or replace function public.mod_set_meal_review_hidden(p_id bigint, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_reviewer() then raise exception '검토위원만 할 수 있어요' using errcode = '42501'; end if;
  update public.meal_reviews set hidden = p_hidden,
         report_count = case when p_hidden then report_count else 0 end
   where id = p_id;
  if not p_hidden then delete from public.meal_review_reports where review_id = p_id; end if;
end $$;

-- 학생이 읽는 피드: 작성자 정보 없음(학년만). 숨김 글은 작성자 본인에게만 보인다.
create view public.meal_review_feed as
  select r.id, r.meal_date, r.meal_code, r.grade, r.body, r.like_count, r.hidden, r.created_at, r.updated_at,
         (r.user_id = auth.uid()) as mine,
         exists (select 1 from public.meal_review_likes l where l.review_id = r.id and l.user_id = auth.uid()) as liked,
         exists (select 1 from public.meal_review_reports x where x.review_id = r.id and x.user_id = auth.uid()) as reported
    from public.meal_reviews r
   where public.is_school_user() and (not r.hidden or r.user_id = auth.uid());

-- 검토위원용: 신고된 한줄평
create view public.meal_review_mod_queue as
  select r.id, r.meal_date, r.meal_code, r.grade, r.body, r.report_count, r.hidden, r.created_at,
         (select string_agg(nullif(x.reason, ''), ' / ') from public.meal_review_reports x where x.review_id = r.id) as reasons
    from public.meal_reviews r
   where public.is_reviewer() and r.report_count > 0;

-- ───────────────────────── 반별 수행평가·숙제 게시판 ─────────────────────────

create table public.class_tasks (
  id             bigint generated always as identity primary key,
  school_year    int not null,
  grade          smallint not null,
  class_no       smallint not null,
  author         uuid not null references public.profiles (id) on delete cascade,
  subject        text not null check (char_length(subject) between 1 and 20),
  kind           text not null check (kind in ('assessment', 'homework', 'supplies', 'exam')),
  due            date not null,
  body           text not null default '' check (char_length(body) <= 200),
  confirm_count  int not null default 0,
  confirmed_at   timestamptz,
  deleted        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index class_tasks_by_class on public.class_tasks (school_year, grade, class_no, due);

create table public.task_confirms (
  task_id     bigint not null references public.class_tasks (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (task_id, user_id)
);

create table public.task_suggestions (
  id          bigint generated always as identity primary key,
  task_id     bigint not null references public.class_tasks (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 100),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 이 글이 내 반 글인가
create or replace function public.task_in_my_class(p_task bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_tasks t
      join public.enrollments e on e.user_id = auth.uid() and e.school_year = t.school_year
                               and e.grade = t.grade and e.class_no = t.class_no
     where t.id = p_task and not t.deleted)
  and public.is_school_user()
$$;

create or replace function public.create_class_task(p_subject text, p_kind text, p_due date, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  e public.enrollments := public.enrollment_of(auth.uid());
  s text := btrim(coalesce(p_subject, ''));
  b text := btrim(coalesce(p_body, ''));
  today date := public.seoul_today();
  rid bigint;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if e.user_id is null then raise exception '학번을 먼저 등록해 주세요' using errcode = 'P0001'; end if;
  if char_length(s) < 1 or char_length(s) > 20 then raise exception '과목을 골라 주세요' using errcode = 'P0001'; end if;
  if char_length(b) > 200 then raise exception '내용은 200자까지 쓸 수 있어요' using errcode = 'P0001'; end if;
  if p_due < today or p_due > today + 180 then raise exception '마감일은 오늘부터 180일 안으로 골라 주세요' using errcode = 'P0001'; end if;
  if public.has_banned_word(s || ' ' || b) then raise exception '부적절한 표현이 들어 있어요' using errcode = 'P0001'; end if;
  if (select count(*) from public.class_tasks where author = me and (created_at at time zone 'Asia/Seoul')::date = today) >= 10 then
    raise exception '하루에 10개까지 올릴 수 있어요' using errcode = 'P0001';
  end if;
  insert into public.class_tasks (school_year, grade, class_no, author, subject, kind, due, body)
  values (e.school_year, e.grade, e.class_no, me, s, p_kind, p_due, b)
  returning id into rid;
  return rid;
end $$;

-- 수정: 작성자만. 내용이 바뀌면 '확인'을 처음부터 다시 받는다(이미 받은 토큰은 그대로, 다시 받지는 못함)
create or replace function public.update_class_task(p_id bigint, p_subject text, p_kind text, p_due date, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  t public.class_tasks;
  s text := btrim(coalesce(p_subject, ''));
  b text := btrim(coalesce(p_body, ''));
begin
  select * into t from public.class_tasks where id = p_id and author = auth.uid() and not deleted for update;
  if not found then raise exception '내가 올린 글만 고칠 수 있어요' using errcode = 'P0001'; end if;
  if char_length(s) < 1 or char_length(s) > 20 or char_length(b) > 200 then
    raise exception '과목은 1~20자, 내용은 200자까지예요' using errcode = 'P0001';
  end if;
  if p_due < public.seoul_today() - 1 or p_due > public.seoul_today() + 180 then
    raise exception '마감일을 다시 골라 주세요' using errcode = 'P0001';
  end if;
  if public.has_banned_word(s || ' ' || b) then raise exception '부적절한 표현이 들어 있어요' using errcode = 'P0001'; end if;
  if (t.subject, t.kind, t.due, t.body) is distinct from (s, p_kind, p_due, b) then
    delete from public.task_confirms where task_id = p_id;
    update public.class_tasks
       set subject = s, kind = p_kind, due = p_due, body = b, confirm_count = 0, confirmed_at = null, updated_at = now()
     where id = p_id;
  end if;
end $$;

-- 삭제: 작성자 또는 검토위원·관리자
create or replace function public.delete_class_task(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.class_tasks set deleted = true, updated_at = now()
   where id = p_id and (author = auth.uid() or public.is_reviewer());
  if not found then raise exception '내가 올린 글만 지울 수 있어요' using errcode = 'P0001'; end if;
end $$;

-- 확인했어요: 같은 반 학생만, 내 글은 불가. 2명이 되면 '확인됨' + 작성자 +5
create or replace function public.confirm_class_task(p_id bigint)
returns int language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  t public.class_tasks;
begin
  if not public.task_in_my_class(p_id) then raise exception '우리 반 글만 확인할 수 있어요' using errcode = 'P0001'; end if;
  select * into t from public.class_tasks where id = p_id for update;
  if t.author = me then raise exception '내가 올린 글은 다른 친구가 확인해 줘야 해요' using errcode = 'P0001'; end if;
  insert into public.task_confirms (task_id, user_id) values (p_id, me) on conflict do nothing;
  if found then
    update public.class_tasks set confirm_count = confirm_count + 1 where id = p_id returning confirm_count into t.confirm_count;
    if t.confirm_count >= 2 and t.confirmed_at is null then
      update public.class_tasks set confirmed_at = now() where id = p_id;
      perform public.award_capped(t.author, 5, 'task_confirmed', p_id::text, 15);
    end if;
  end if;
  return t.confirm_count;
end $$;

-- 정정 제안: 같은 반 누구나 (글 하나에 1인 하루 3개까지)
create or replace function public.suggest_task_fix(p_id bigint, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  b text := btrim(coalesce(p_body, ''));
  rid bigint;
begin
  if not public.task_in_my_class(p_id) then raise exception '우리 반 글에만 쓸 수 있어요' using errcode = 'P0001'; end if;
  if char_length(b) < 1 or char_length(b) > 100 then raise exception '정정 내용은 100자까지예요' using errcode = 'P0001'; end if;
  if public.has_banned_word(b) then raise exception '부적절한 표현이 들어 있어요' using errcode = 'P0001'; end if;
  if (select count(*) from public.task_suggestions where task_id = p_id and user_id = me
        and (created_at at time zone 'Asia/Seoul')::date = public.seoul_today()) >= 3 then
    raise exception '같은 글에는 하루 3번까지 제안할 수 있어요' using errcode = 'P0001';
  end if;
  insert into public.task_suggestions (task_id, user_id, body) values (p_id, me, b) returning id into rid;
  return rid;
end $$;

-- 제안 반영 완료 표시: 글 작성자만
create or replace function public.resolve_task_suggestion(p_sid bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.task_suggestions s set resolved = true
    from public.class_tasks t
   where s.id = p_sid and t.id = s.task_id and t.author = auth.uid();
  if not found then raise exception '내 글에 달린 제안만 정리할 수 있어요' using errcode = 'P0001'; end if;
end $$;

-- 우리 반 게시판 피드 (다른 반 글은 아예 안 나온다). 작성자는 닉네임만.
create view public.class_task_feed as
  select t.id, t.subject, t.kind, t.due, t.body, t.confirm_count,
         (t.confirmed_at is not null) as confirmed,
         t.created_at, t.updated_at,
         (t.author = auth.uid()) as mine,
         exists (select 1 from public.task_confirms c where c.task_id = t.id and c.user_id = auth.uid()) as i_confirmed,
         p.nickname as author_nickname,
         (select count(*)::int from public.task_suggestions s where s.task_id = t.id and not s.resolved) as open_suggestions
    from public.class_tasks t
    join public.enrollments e on e.user_id = auth.uid() and e.school_year = t.school_year
                             and e.grade = t.grade and e.class_no = t.class_no
    left join public.profiles p on p.id = t.author
   where not t.deleted and public.is_school_user();

create view public.task_suggestion_feed as
  select s.id, s.task_id, s.body, s.resolved, s.created_at, (s.user_id = auth.uid()) as mine
    from public.task_suggestions s
   where public.task_in_my_class(s.task_id);

-- ───────────────────────── 권한(RLS) ─────────────────────────

alter table public.meal_reviews enable row level security;
alter table public.meal_review_likes enable row level security;
alter table public.meal_review_reports enable row level security;
alter table public.class_tasks enable row level security;
alter table public.task_confirms enable row level security;
alter table public.task_suggestions enable row level security;

-- 원본 테이블은 내 것만(또는 정책 없음). 다른 학생 글은 피드 뷰로만 읽는다.
create policy meal_reviews_read_own on public.meal_reviews for select using (user_id = auth.uid());
create policy meal_review_likes_read_own on public.meal_review_likes for select using (user_id = auth.uid());
create policy meal_review_reports_read_own on public.meal_review_reports for select using (user_id = auth.uid());
create policy class_tasks_read_own on public.class_tasks for select using (author = auth.uid());
create policy task_confirms_read_own on public.task_confirms for select using (user_id = auth.uid());
create policy task_suggestions_read_own on public.task_suggestions for select using (user_id = auth.uid());

revoke all on public.meal_review_feed, public.meal_review_mod_queue, public.class_task_feed, public.task_suggestion_feed from public, anon;
grant select on public.meal_review_feed, public.meal_review_mod_queue, public.class_task_feed, public.task_suggestion_feed to authenticated;

grant execute on function public.post_meal_review(date, int, text) to authenticated;
grant execute on function public.delete_meal_review(bigint) to authenticated;
grant execute on function public.like_meal_review(bigint, boolean) to authenticated;
grant execute on function public.report_meal_review(bigint, text) to authenticated;
grant execute on function public.mod_set_meal_review_hidden(bigint, boolean) to authenticated;
grant execute on function public.create_class_task(text, text, date, text) to authenticated;
grant execute on function public.update_class_task(bigint, text, text, date, text) to authenticated;
grant execute on function public.delete_class_task(bigint) to authenticated;
grant execute on function public.confirm_class_task(bigint) to authenticated;
grant execute on function public.suggest_task_fix(bigint, text) to authenticated;
grant execute on function public.resolve_task_suggestion(bigint) to authenticated;
