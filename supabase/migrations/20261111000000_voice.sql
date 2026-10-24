-- 운중고 앱 v3 — M4: 운중 보이스(학생회 설문 · 건의)
-- 호원 결정(10-24)
--  · 설문은 학생자치회 '기획행정부' 학생만 만든다(관리자가 앱에서 지정). 학생은 참여만 한다.
--  · 건의는 누구나 올리고 공감할 수 있다. 답변 의무는 없고, 기획행정부가 '확인했어요' 표시만 한다.
--  · 건의 작성자는 완전 익명(학년만 표시). 서버에는 계정이 남는다(신고·제재용).
-- Claude 기본값
--  · 설문 참여 +3 토큰(설문마다 1번). 주관식 답은 기획행정부·관리자만 본다.
--  · 결과 공개: 참여 후 / 마감 후 / 기획행정부만 중에서 설문을 만들 때 고른다.
--  · 건의는 하루 3개까지, 토큰은 주지 않는다(도배 방지). 신고 3건이면 숨기고 기획행정부가 확인한다.

-- ───────────────────────── 기획행정부 ─────────────────────────

alter table public.profiles add column is_planner boolean not null default false;

-- 기획행정부(또는 관리자)인가
create or replace function public.is_planner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_planner or p.role = 'admin' from public.profiles p where p.id = auth.uid()), false)
$$;

create or replace function public.admin_set_planner(p_user uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  update public.profiles set is_planner = coalesce(p_on, false) where id = p_user;
  if not found then raise exception '없는 학생이에요' using errcode = 'P0001'; end if;
end $$;

-- 학번 검색·직책 목록에 기획행정부 여부를 더한다(반환 형식이 바뀌어 다시 만든다)
drop function public.admin_find_user(text);
create function public.admin_find_user(p_student_no text)
returns table (user_id uuid, name text, email text, role text, grade int, class_no int, nickname text, is_planner boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  return query
    select p.id, e.name, p.email, p.role, e.grade, e.class_no, p.nickname, p.is_planner
      from public.enrollments e join public.profiles p on p.id = e.user_id
     where e.school_year = public.current_school_year() and e.student_no = btrim(p_student_no);
end $$;

drop function public.admin_list_staff();
create function public.admin_list_staff()
returns table (user_id uuid, name text, student_no text, role text, is_planner boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  return query
    select p.id, e.name, e.student_no, p.role, p.is_planner
      from public.profiles p
      left join public.enrollments e on e.user_id = p.id and e.school_year = public.current_school_year()
     where p.role in ('reviewer', 'admin') or p.is_planner
     order by p.role, e.student_no;
end $$;

-- ───────────────────────── 설문 ─────────────────────────

create table public.surveys (
  id           bigint generated always as identity primary key,
  author       uuid references public.profiles (id) on delete set null,
  title        text not null check (char_length(title) between 2 and 60),
  description  text not null default '' check (char_length(description) <= 500),
  scope_grade  smallint check (scope_grade between 1 and 3),       -- null = 전체
  results      text not null default 'after_vote' check (results in ('after_vote', 'after_close', 'planner_only')),
  opens_at     timestamptz not null default now(),
  closes_at    timestamptz not null,
  status       text not null default 'open' check (status in ('open', 'closed', 'deleted')),
  created_at   timestamptz not null default now()
);
create index surveys_recent on public.surveys (closes_at desc);

create table public.survey_questions (
  id         bigint generated always as identity primary key,
  survey_id  bigint not null references public.surveys (id) on delete cascade,
  ord        smallint not null,
  kind       text not null check (kind in ('single', 'multi', 'text')),
  prompt     text not null check (char_length(prompt) between 1 and 100),
  options    text[] not null default '{}',
  required   boolean not null default true,
  unique (survey_id, ord)
);

create table public.survey_responses (
  survey_id   bigint not null references public.surveys (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  grade       smallint,
  created_at  timestamptz not null default now(),
  primary key (survey_id, user_id)
);

create table public.survey_answers (
  question_id  bigint not null references public.survey_questions (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  choices      smallint[] not null default '{}',
  text_answer  text check (char_length(text_answer) <= 200),
  primary key (question_id, user_id)
);

-- 지금 이 설문이 열려 있나
create or replace function public.survey_is_open(s public.surveys)
returns boolean language sql stable as $$
  select s.status = 'open' and now() >= s.opens_at and now() < s.closes_at
$$;

-- 내가 참여할 수 있는 범위인가(전체 또는 내 학년)
create or replace function public.survey_for_me(s public.surveys)
returns boolean language sql stable security definer set search_path = public as $$
  select s.scope_grade is null or s.scope_grade = (public.enrollment_of(auth.uid())).grade
$$;

-- 기획행정부: 설문 만들기
-- p_questions: [{ "kind": "single"|"multi"|"text", "prompt": "...", "options": ["...", ...], "required": true }]
create or replace function public.create_survey(
  p_title text, p_description text, p_scope_grade int, p_days int, p_results text, p_questions jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  t text := btrim(coalesce(p_title, ''));
  d text := btrim(coalesce(p_description, ''));
  sid bigint;
  q jsonb;
  i int := 0;
  k text;
  pr text;
  opts text[];
  o text;
begin
  if not public.is_planner() then raise exception '기획행정부만 설문을 만들 수 있어요' using errcode = '42501'; end if;
  if char_length(t) < 2 or char_length(t) > 60 then raise exception '제목은 2~60자예요' using errcode = 'P0001'; end if;
  if char_length(d) > 500 then raise exception '설명은 500자까지예요' using errcode = 'P0001'; end if;
  if p_scope_grade is not null and p_scope_grade not between 1 and 3 then raise exception '대상 학년을 다시 골라 주세요' using errcode = 'P0001'; end if;
  if p_days is null or p_days < 1 or p_days > 14 then raise exception '기간은 1~14일이에요' using errcode = 'P0001'; end if;
  if p_results not in ('after_vote', 'after_close', 'planner_only') then raise exception '결과 공개 방식을 골라 주세요' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) < 1 or jsonb_array_length(p_questions) > 10 then
    raise exception '질문은 1~10개예요' using errcode = 'P0001';
  end if;
  if public.has_banned_word(t || ' ' || d) then raise exception '부적절한 표현이 들어 있어요' using errcode = 'P0001'; end if;

  insert into public.surveys (author, title, description, scope_grade, results, closes_at)
  values (auth.uid(), t, d, p_scope_grade, p_results,
          ((public.seoul_today() + p_days)::timestamp at time zone 'Asia/Seoul'))  -- 마지막 날 자정까지
  returning id into sid;

  for q in select * from jsonb_array_elements(p_questions) loop
    i := i + 1;
    k := q ->> 'kind';
    pr := btrim(coalesce(q ->> 'prompt', ''));
    if k not in ('single', 'multi', 'text') then raise exception '%번 질문의 종류를 골라 주세요', i using errcode = 'P0001'; end if;
    if char_length(pr) < 1 or char_length(pr) > 100 then raise exception '%번 질문은 1~100자예요', i using errcode = 'P0001'; end if;
    opts := '{}';
    if k <> 'text' then
      for o in select btrim(x) from jsonb_array_elements_text(coalesce(q -> 'options', '[]'::jsonb)) x loop
        if o <> '' then opts := opts || left(o, 40); end if;
      end loop;
      if array_length(opts, 1) is null or array_length(opts, 1) < 2 or array_length(opts, 1) > 8 then
        raise exception '%번 질문의 보기는 2~8개예요', i using errcode = 'P0001';
      end if;
    end if;
    if public.has_banned_word(pr || ' ' || array_to_string(opts, ' ')) then raise exception '부적절한 표현이 들어 있어요' using errcode = 'P0001'; end if;
    insert into public.survey_questions (survey_id, ord, kind, prompt, options, required)
    values (sid, i, k, pr, opts, coalesce((q ->> 'required')::boolean, true));
  end loop;
  return sid;
end $$;

-- 기획행정부: 일찍 마감 / 삭제(잘못 만든 설문)
create or replace function public.close_survey(p_id bigint, p_delete boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_planner() then raise exception '기획행정부만 할 수 있어요' using errcode = '42501'; end if;
  update public.surveys
     set status = case when p_delete then 'deleted' else 'closed' end,
         closes_at = least(closes_at, now())
   where id = p_id and status <> 'deleted';
  if not found then raise exception '없는 설문이에요' using errcode = 'P0001'; end if;
end $$;

-- 학생: 설문 참여. p_answers: [{ "q": 질문 id, "choices": [0, 2], "text": "..." }]
create or replace function public.submit_survey(p_id bigint, p_answers jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  e public.enrollments := public.enrollment_of(auth.uid());
  s public.surveys;
  qq public.survey_questions;
  a jsonb;
  ch smallint[];
  tx text;
  n int;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if e.user_id is null then raise exception '학번을 먼저 등록해 주세요' using errcode = 'P0001'; end if;
  select * into s from public.surveys where id = p_id for share;
  if not found or s.status = 'deleted' then raise exception '없는 설문이에요' using errcode = 'P0001'; end if;
  if not public.survey_is_open(s) then raise exception '마감된 설문이에요' using errcode = 'P0001'; end if;
  if s.scope_grade is not null and s.scope_grade <> e.grade then raise exception '%학년 대상 설문이에요', s.scope_grade using errcode = 'P0001'; end if;
  if jsonb_typeof(coalesce(p_answers, 'null'::jsonb)) <> 'array' then raise exception '답을 다시 확인해 주세요' using errcode = 'P0001'; end if;

  insert into public.survey_responses (survey_id, user_id, grade) values (p_id, me, e.grade) on conflict do nothing;
  if not found then raise exception '이미 참여한 설문이에요' using errcode = 'P0001'; end if;

  for qq in select * from public.survey_questions where survey_id = p_id order by ord loop
    select x into a from jsonb_array_elements(p_answers) x where (x ->> 'q')::bigint = qq.id limit 1;
    ch := '{}';
    tx := null;
    if a is not null then
      if qq.kind = 'text' then
        tx := nullif(btrim(coalesce(a ->> 'text', '')), '');
        if tx is not null and char_length(tx) > 200 then raise exception '%번 답은 200자까지예요', qq.ord using errcode = 'P0001'; end if;
        if tx is not null and public.has_banned_word(tx) then raise exception '%번 답에 부적절한 표현이 있어요', qq.ord using errcode = 'P0001'; end if;
      else
        select coalesce(array_agg(distinct v::smallint order by v::smallint), '{}') into ch
          from jsonb_array_elements_text(coalesce(a -> 'choices', '[]'::jsonb)) v;
        n := coalesce(array_length(ch, 1), 0);
        if exists (select 1 from unnest(ch) c where c < 0 or c >= coalesce(array_length(qq.options, 1), 0)) then
          raise exception '%번 질문의 보기를 다시 골라 주세요', qq.ord using errcode = 'P0001';
        end if;
        if qq.kind = 'single' and n > 1 then raise exception '%번 질문은 하나만 골라요', qq.ord using errcode = 'P0001'; end if;
      end if;
    end if;
    if qq.required and (case when qq.kind = 'text' then tx is null else coalesce(array_length(ch, 1), 0) = 0 end) then
      raise exception '%번 질문에 답해 주세요', qq.ord using errcode = 'P0001';
    end if;
    if tx is not null or coalesce(array_length(ch, 1), 0) > 0 then
      insert into public.survey_answers (question_id, user_id, choices, text_answer) values (qq.id, me, ch, tx);
    end if;
    a := null;
  end loop;

  perform public.award_tokens(me, 3, 'survey', p_id::text);
  return 3;
end $$;

-- 결과를 볼 수 있나
create or replace function public.survey_results_visible(s public.surveys)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_planner()
      or (s.results = 'after_close' and not public.survey_is_open(s))
      or (s.results = 'after_vote' and (not public.survey_is_open(s)
          or exists (select 1 from public.survey_responses r where r.survey_id = s.id and r.user_id = auth.uid())))
$$;

-- 학생이 보는 설문 목록: 열려 있거나 30일 안에 끝난 것, 내 범위만(기획행정부는 전부)
create view public.survey_feed as
  select s.id, s.title, s.description, s.scope_grade, s.results, s.opens_at, s.closes_at,
         public.survey_is_open(s) as is_open,
         exists (select 1 from public.survey_responses r where r.survey_id = s.id and r.user_id = auth.uid()) as responded,
         (select count(*)::int from public.survey_responses r where r.survey_id = s.id) as response_count,
         (select count(*)::int from public.survey_questions qq where qq.survey_id = s.id) as question_count,
         public.survey_results_visible(s) as can_see_results
    from public.surveys s
   where public.is_school_user() and s.status <> 'deleted'
     and s.closes_at > now() - interval '30 days'
     and (public.is_planner() or public.survey_for_me(s));

-- 설문 한 개: 질문 + (볼 수 있으면) 결과
create or replace function public.get_survey(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s public.surveys;
  vis boolean;
  planner boolean := public.is_planner();
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  select * into s from public.surveys where id = p_id and status <> 'deleted';
  if not found or not (planner or public.survey_for_me(s)) then raise exception '없는 설문이에요' using errcode = 'P0001'; end if;
  vis := public.survey_results_visible(s);
  return jsonb_build_object(
    'id', s.id, 'title', s.title, 'description', s.description, 'scope_grade', s.scope_grade, 'results', s.results,
    'closes_at', s.closes_at, 'is_open', public.survey_is_open(s),
    'responded', exists (select 1 from public.survey_responses r where r.survey_id = s.id and r.user_id = auth.uid()),
    'response_count', (select count(*) from public.survey_responses r where r.survey_id = s.id),
    'can_see_results', vis,
    'by_grade', case when planner then (select coalesce(jsonb_object_agg(g.grade, g.n), '{}') from
                  (select grade, count(*) n from public.survey_responses where survey_id = s.id group by grade) g) end,
    'questions', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', qq.id, 'ord', qq.ord, 'kind', qq.kind, 'prompt', qq.prompt, 'options', to_jsonb(qq.options), 'required', qq.required,
        'counts', case when vis and qq.kind <> 'text' then (
            select jsonb_agg((select count(*) from public.survey_answers sa where sa.question_id = qq.id and (i - 1)::smallint = any (sa.choices)) order by i)
              from generate_series(1, coalesce(array_length(qq.options, 1), 0)) i) end,
        'answered', case when vis then (select count(*) from public.survey_answers sa where sa.question_id = qq.id) end,
        'texts', case when planner and qq.kind = 'text' then (
            select coalesce(jsonb_agg(sa.text_answer order by sa.text_answer), '[]') from public.survey_answers sa
             where sa.question_id = qq.id and sa.text_answer is not null) end
      ) order by qq.ord), '[]') from public.survey_questions qq where qq.survey_id = s.id)
  );
end $$;

-- ───────────────────────── 건의 ─────────────────────────

create table public.suggestions (
  id            bigint generated always as identity primary key,
  author        uuid not null references public.profiles (id) on delete cascade,
  author_grade  smallint,
  category      text not null check (category in ('facility', 'meal', 'event', 'study', 'etc')),
  title         text not null check (char_length(title) between 2 and 40),
  body          text not null check (char_length(body) between 5 and 500),
  status        text not null default 'open' check (status in ('open', 'hidden', 'withdrawn')),
  like_count    int not null default 0,
  report_count  int not null default 0,
  checked_by    uuid references public.profiles (id) on delete set null,
  checked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index suggestions_recent on public.suggestions (created_at desc);

create table public.suggestion_likes (
  suggestion_id  bigint not null references public.suggestions (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);

create table public.suggestion_reports (
  suggestion_id  bigint not null references public.suggestions (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  reason         text not null default '' check (char_length(reason) <= 50),
  created_at     timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);

create or replace function public.post_suggestion(p_category text, p_title text, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  e public.enrollments := public.enrollment_of(auth.uid());
  t text := btrim(coalesce(p_title, ''));
  b text := btrim(coalesce(p_body, ''));
  rid bigint;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if e.user_id is null then raise exception '학번을 먼저 등록해 주세요' using errcode = 'P0001'; end if;
  if p_category not in ('facility', 'meal', 'event', 'study', 'etc') then raise exception '분야를 골라 주세요' using errcode = 'P0001'; end if;
  if char_length(t) < 2 or char_length(t) > 40 then raise exception '제목은 2~40자예요' using errcode = 'P0001'; end if;
  if char_length(b) < 5 or char_length(b) > 500 then raise exception '내용은 5~500자예요' using errcode = 'P0001'; end if;
  if public.has_banned_word(t || ' ' || b) then raise exception '부적절한 표현이 들어 있어요' using errcode = 'P0001'; end if;
  if (select count(*) from public.suggestions where author = me and created_at > now() - interval '1 day') >= 3 then
    raise exception '건의는 하루에 3개까지 올릴 수 있어요' using errcode = 'P0001';
  end if;
  insert into public.suggestions (author, author_grade, category, title, body)
  values (me, e.grade, p_category, t, b) returning id into rid;
  return rid;
end $$;

create or replace function public.withdraw_suggestion(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.suggestions set status = 'withdrawn' where id = p_id and author = auth.uid() and status = 'open';
  if not found then raise exception '내 건의만 내릴 수 있어요' using errcode = 'P0001'; end if;
end $$;

-- 공감(1인 1회, 다시 누르면 취소). 토큰 없음.
create or replace function public.like_suggestion(p_id bigint, p_on boolean)
returns int language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  x public.suggestions;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  select * into x from public.suggestions where id = p_id and status = 'open' for update;
  if not found then raise exception '없는 건의예요' using errcode = 'P0001'; end if;
  if x.author = me then raise exception '내 건의에는 공감할 수 없어요' using errcode = 'P0001'; end if;
  if p_on then
    insert into public.suggestion_likes (suggestion_id, user_id) values (p_id, me) on conflict do nothing;
    if found then update public.suggestions set like_count = like_count + 1 where id = p_id; end if;
  else
    delete from public.suggestion_likes where suggestion_id = p_id and user_id = me;
    if found then update public.suggestions set like_count = greatest(0, like_count - 1) where id = p_id; end if;
  end if;
  return (select like_count from public.suggestions where id = p_id);
end $$;

-- 신고: 3명이면 숨김 → 기획행정부가 확인
create or replace function public.report_suggestion(p_id bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  x public.suggestions;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  select * into x from public.suggestions where id = p_id and status = 'open' for update;
  if not found then raise exception '없는 건의예요' using errcode = 'P0001'; end if;
  if x.author = me then raise exception '내 건의는 신고할 수 없어요' using errcode = 'P0001'; end if;
  insert into public.suggestion_reports (suggestion_id, user_id, reason) values (p_id, me, left(coalesce(p_reason, ''), 50)) on conflict do nothing;
  if found then
    update public.suggestions set report_count = report_count + 1,
           status = case when report_count + 1 >= 3 then 'hidden' else status end
     where id = p_id;
  end if;
end $$;

-- 기획행정부: '확인했어요' 표시(다시 누르면 취소)
create or replace function public.check_suggestion(p_id bigint, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_planner() then raise exception '기획행정부만 할 수 있어요' using errcode = '42501'; end if;
  update public.suggestions
     set checked_by = case when p_on then auth.uid() end,
         checked_at = case when p_on then coalesce(checked_at, now()) end
   where id = p_id and status in ('open', 'hidden');
  if not found then raise exception '없는 건의예요' using errcode = 'P0001'; end if;
end $$;

-- 기획행정부: 숨김 / 다시 보이기(신고 기록을 비운다)
create or replace function public.mod_suggestion(p_id bigint, p_show boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_planner() then raise exception '기획행정부만 할 수 있어요' using errcode = '42501'; end if;
  update public.suggestions set status = case when p_show then 'open' else 'hidden' end,
         report_count = case when p_show then 0 else report_count end
   where id = p_id and status in ('open', 'hidden');
  if not found then raise exception '처리할 수 없는 건의예요' using errcode = 'P0001'; end if;
  if p_show then delete from public.suggestion_reports where suggestion_id = p_id; end if;
end $$;

-- 학생이 보는 건의: 최근 60일, 게시 중인 것(작성자는 학년만)
create view public.suggestion_feed as
  select x.id, x.category, x.title, x.body, x.author_grade, x.like_count, x.created_at,
         (x.checked_at is not null) as checked, x.checked_at,
         (x.author = auth.uid()) as mine,
         exists (select 1 from public.suggestion_likes l where l.suggestion_id = x.id and l.user_id = auth.uid()) as liked,
         exists (select 1 from public.suggestion_reports r where r.suggestion_id = x.id and r.user_id = auth.uid()) as reported
    from public.suggestions x
   where public.is_school_user() and x.status = 'open' and x.created_at > now() - interval '60 days';

-- 기획행정부: 신고로 숨겨졌거나 신고가 들어온 건의
create view public.suggestion_mod_queue as
  select x.id, x.category, x.title, x.body, x.author_grade, x.status, x.report_count, x.created_at,
         (select string_agg(nullif(r.reason, ''), ' / ') from public.suggestion_reports r where r.suggestion_id = x.id) as reasons
    from public.suggestions x
   where public.is_planner() and x.report_count > 0 and x.status in ('open', 'hidden');

-- ───────────────────────── 권한(RLS) ─────────────────────────

alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_answers enable row level security;
alter table public.suggestions enable row level security;
alter table public.suggestion_likes enable row level security;
alter table public.suggestion_reports enable row level security;

-- 원본 표는 내 것만(목록·결과는 위의 보기와 함수로)
create policy survey_responses_read_own on public.survey_responses for select using (user_id = auth.uid());
create policy survey_answers_read_own on public.survey_answers for select using (user_id = auth.uid());
create policy suggestions_read_own on public.suggestions for select using (author = auth.uid());

revoke all on public.survey_feed, public.suggestion_feed, public.suggestion_mod_queue from public, anon;
grant select on public.survey_feed, public.suggestion_feed, public.suggestion_mod_queue to authenticated;

-- 보기(view) 안에서 부르는 함수는 조회하는 사람 권한으로 실행되므로 로그인 학생에게 열어 둔다(정보를 더 주지는 않음)
revoke all on function public.survey_for_me(public.surveys) from public, anon;
revoke all on function public.survey_results_visible(public.surveys) from public, anon;
grant execute on function public.survey_for_me(public.surveys) to authenticated;
grant execute on function public.survey_results_visible(public.surveys) to authenticated;

grant execute on function public.admin_set_planner(uuid, boolean) to authenticated;
grant execute on function public.admin_find_user(text) to authenticated;
grant execute on function public.admin_list_staff() to authenticated;
grant execute on function public.create_survey(text, text, int, int, text, jsonb) to authenticated;
grant execute on function public.close_survey(bigint, boolean) to authenticated;
grant execute on function public.submit_survey(bigint, jsonb) to authenticated;
grant execute on function public.get_survey(bigint) to authenticated;
grant execute on function public.post_suggestion(text, text, text) to authenticated;
grant execute on function public.withdraw_suggestion(bigint) to authenticated;
grant execute on function public.like_suggestion(bigint, boolean) to authenticated;
grant execute on function public.report_suggestion(bigint, text) to authenticated;
grant execute on function public.check_suggestion(bigint, boolean) to authenticated;
grant execute on function public.mod_suggestion(bigint, boolean) to authenticated;
