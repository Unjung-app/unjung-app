-- 11-09 호원 결정(학생 의견 #27): 학생도 설문을 '신청'하고, 기획행정부가 승인하면 올라간다
--  · 신청: 학번 등록 학생, 검토 중인 신청은 한 사람당 2개까지(하루 5개 제한은 그대로)
--  · 승인하면 그때부터 신청한 기간만큼 열린다 / 반려하면 사유가 신청한 학생에게 간다
--  · 신청한 학생은 자기 설문 결과(주관식 답 포함)를 볼 수 있다. 누가 답했는지는 아무도 모른다
-- 여러 번 실행해도 안전

alter table public.surveys add column if not exists from_student boolean not null default false;
alter table public.surveys add column if not exists req_days smallint;
alter table public.surveys add column if not exists review_note text;
alter table public.surveys drop constraint if exists surveys_status_check;
alter table public.surveys add constraint surveys_status_check check (status in ('requested', 'rejected', 'open', 'closed', 'deleted'));

-- 설문 넣기(권한 검사는 부르는 쪽에서)
create or replace function public._survey_insert(
  p_status text, p_title text, p_description text, p_scope_grade int, p_days int, p_results text, p_questions jsonb)
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
  if char_length(t) < 2 or char_length(t) > 60 then raise exception '제목은 2~60자예요' using errcode = 'P0001'; end if;
  if char_length(d) > 500 then raise exception '설명은 500자까지예요' using errcode = 'P0001'; end if;
  if p_scope_grade is not null and p_scope_grade not between 1 and 3 then raise exception '대상 학년을 다시 골라 주세요' using errcode = 'P0001'; end if;
  if p_days is null or p_days < 1 or p_days > 14 then raise exception '기간은 1~14일이에요' using errcode = 'P0001'; end if;
  if p_results not in ('after_vote', 'after_close', 'planner_only') then raise exception '결과 공개 방식을 골라 주세요' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) < 1 or jsonb_array_length(p_questions) > 10 then
    raise exception '질문은 1~10개예요' using errcode = 'P0001';
  end if;
  if public.has_banned_word(t || ' ' || d) then raise exception '부적절한 표현이 들어 있어요' using errcode = 'P0001'; end if;

  insert into public.surveys (author, title, description, scope_grade, results, closes_at, status, from_student, req_days)
  values (auth.uid(), t, d, p_scope_grade, p_results,
          ((public.seoul_today() + p_days)::timestamp at time zone 'Asia/Seoul'),  -- 마지막 날 자정까지(신청은 승인 때 다시 정한다)
          p_status, p_status = 'requested', p_days)
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
revoke all on function public._survey_insert(text, text, text, int, int, text, jsonb) from public, anon, authenticated;

create or replace function public.create_survey(
  p_title text, p_description text, p_scope_grade int, p_days int, p_results text, p_questions jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
begin
  if not public.is_planner() then raise exception '기획행정부만 설문을 만들 수 있어요' using errcode = '42501'; end if;
  return public._survey_insert('open', p_title, p_description, p_scope_grade, p_days, p_results, p_questions);
end $$;

create or replace function public.request_survey(
  p_title text, p_description text, p_scope_grade int, p_days int, p_results text, p_questions jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_user() or (public.enrollment_of(auth.uid())).user_id is null then
    raise exception '학번을 등록한 학생만 신청할 수 있어요' using errcode = '42501';
  end if;
  if (select count(*) from public.surveys where author = auth.uid() and status = 'requested') >= 2 then
    raise exception '검토 중인 신청이 2개 있어요. 결과가 나온 뒤 다시 신청해 주세요' using errcode = 'P0001';
  end if;
  return public._survey_insert('requested', p_title, p_description, p_scope_grade, p_days, p_results, p_questions);
end $$;
revoke all on function public.request_survey(text, text, int, int, text, jsonb) from public, anon;
grant execute on function public.request_survey(text, text, int, int, text, jsonb) to authenticated;

-- 기획행정부: 승인/반려
create or replace function public.review_survey(p_id bigint, p_ok boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  s public.surveys;
begin
  if not public.is_planner() then raise exception '기획행정부만 할 수 있어요' using errcode = '42501'; end if;
  select * into s from public.surveys where id = p_id and status = 'requested' for update;
  if not found then raise exception '검토할 신청이 아니에요' using errcode = 'P0001'; end if;
  if p_ok then
    update public.surveys
       set status = 'open', opens_at = now(), review_note = nullif(btrim(coalesce(p_note, '')), ''),
           closes_at = ((public.seoul_today() + coalesce(s.req_days, 5))::timestamp at time zone 'Asia/Seoul')
     where id = p_id;
    if s.author is not null then
      perform public.push_to(s.author, 'mine', 'survey-ok:' || p_id, '신청한 설문이 올라갔어요', s.title, '/voice/survey/' || p_id);
    end if;
  else
    if char_length(btrim(coalesce(p_note, ''))) < 2 then raise exception '반려 사유를 적어 주세요' using errcode = 'P0001'; end if;
    update public.surveys set status = 'rejected', review_note = left(btrim(p_note), 200) where id = p_id;
    if s.author is not null then
      perform public.push_to(s.author, 'mine', 'survey-no:' || p_id, '설문 신청이 반려됐어요', left(btrim(p_note), 80), '/voice/survey/' || p_id);
    end if;
  end if;
end $$;
revoke all on function public.review_survey(bigint, boolean, text) from public, anon;
grant execute on function public.review_survey(bigint, boolean, text) to authenticated;

-- 신청자도 결과를 본다
create or replace function public.survey_results_visible(s public.surveys)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_planner()
      or (s.from_student and s.author = auth.uid())
      or (s.results = 'after_close' and not public.survey_is_open(s))
      or (s.results = 'after_vote' and (not public.survey_is_open(s)
          or exists (select 1 from public.survey_responses r where r.survey_id = s.id and r.user_id = auth.uid())))
$$;

-- 학생 목록에는 올라간 설문만
drop view if exists public.survey_feed; -- 열이 바뀌어도 다시 실행할 수 있게
create view public.survey_feed as
  select s.id, s.title, s.description, s.scope_grade, s.results, s.opens_at, s.closes_at,
         public.survey_is_open(s) as is_open,
         exists (select 1 from public.survey_responses r where r.survey_id = s.id and r.user_id = auth.uid()) as responded,
         (select count(*)::int from public.survey_responses r where r.survey_id = s.id) as response_count,
         (select count(*)::int from public.survey_questions qq where qq.survey_id = s.id) as question_count,
         public.survey_results_visible(s) as can_see_results,
         s.from_student
    from public.surveys s
   where public.is_school_user() and s.status in ('open', 'closed')
     and s.closes_at > now() - interval '30 days'
     and (public.is_planner() or public.survey_for_me(s));
revoke all on public.survey_feed from public, anon;
grant select on public.survey_feed to authenticated;

-- 신청 목록: 기획행정부는 검토할 것 전부, 학생은 내 신청(30일)
create or replace function public.survey_requests()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'title', s.title, 'status', s.status, 'review_note', s.review_note, 'req_days', s.req_days,
           'scope_grade', s.scope_grade, 'created_at', s.created_at, 'mine', s.author = auth.uid(),
           'author_grade', (public.enrollment_of(s.author)).grade
         ) order by s.created_at desc), '[]')
    from public.surveys s
   where public.is_school_user()
     and ((public.is_planner() and s.status = 'requested')
       or (s.author = auth.uid() and s.from_student and s.status in ('requested', 'rejected') and s.created_at > now() - interval '30 days'))
$$;
revoke all on function public.survey_requests() from public, anon;
grant execute on function public.survey_requests() to authenticated;

-- 설문 한 개: 검토 중·반려된 신청은 기획행정부와 신청자만
create or replace function public.get_survey(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s public.surveys;
  vis boolean;
  planner boolean := public.is_planner();
  owner boolean;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  select * into s from public.surveys where id = p_id and status <> 'deleted';
  if not found then raise exception '없는 설문이에요' using errcode = 'P0001'; end if;
  owner := s.from_student and s.author = auth.uid();
  if s.status in ('requested', 'rejected') then
    if not (planner or owner) then raise exception '없는 설문이에요' using errcode = 'P0001'; end if;
  elsif not (planner or owner or public.survey_for_me(s)) then
    raise exception '없는 설문이에요' using errcode = 'P0001';
  end if;
  vis := public.survey_results_visible(s);
  return jsonb_build_object(
    'id', s.id, 'title', s.title, 'description', s.description, 'scope_grade', s.scope_grade, 'results', s.results,
    'closes_at', s.closes_at, 'is_open', public.survey_is_open(s),
    'status', s.status, 'from_student', s.from_student, 'owner', owner, 'review_note', s.review_note, 'req_days', s.req_days,
    'responded', exists (select 1 from public.survey_responses r where r.survey_id = s.id and r.user_id = auth.uid()),
    'response_count', (select count(*) from public.survey_responses r where r.survey_id = s.id),
    'can_see_results', vis,
    'by_grade', case when planner or owner then (select coalesce(jsonb_object_agg(g.grade, g.n), '{}') from
                  (select grade, count(*) n from public.survey_responses where survey_id = s.id group by grade) g) end,
    'questions', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', qq.id, 'ord', qq.ord, 'kind', qq.kind, 'prompt', qq.prompt, 'options', to_jsonb(qq.options), 'required', qq.required,
        'counts', case when vis and qq.kind <> 'text' then (
            select jsonb_agg((select count(*) from public.survey_answers sa where sa.question_id = qq.id and (i - 1)::smallint = any (sa.choices)) order by i)
              from generate_series(1, coalesce(array_length(qq.options, 1), 0)) i) end,
        'answered', case when vis then (select count(*) from public.survey_answers sa where sa.question_id = qq.id) end,
        'texts', case when (planner or owner) and qq.kind = 'text' then (
            select coalesce(jsonb_agg(sa.text_answer order by sa.text_answer), '[]') from public.survey_answers sa
             where sa.question_id = qq.id and sa.text_answer is not null) end
      ) order by qq.ord), '[]') from public.survey_questions qq where qq.survey_id = s.id)
  );
end $$;

-- 새 설문 알림: 올라갈 때(바로 만들거나 승인될 때)만
create or replace function public.push_on_survey()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'open' and (tg_op = 'INSERT' or old.status = 'requested') then
    perform public.push_to(e.user_id, 'survey', 'survey:' || new.id, case when new.from_student then '학생 설문이 올라왔어요' else '학생회 설문이 올라왔어요' end,
                           new.title || ' · 참여하면 +3 토큰', '/voice/survey/' || new.id)
       from public.enrollments e
      where e.school_year = public.current_school_year()
        and (new.scope_grade is null or e.grade = new.scope_grade);
  end if;
  return null;
end $$;
drop trigger if exists surveys_push on public.surveys;
create trigger surveys_push after insert or update of status on public.surveys for each row execute function public.push_on_survey();

-- 기획행정부 업무 알림: 설문 신청
do $$
begin
  if to_regprocedure('public._push_staff(text, text, text, text, text, text)') is not null then
    execute $f$
      create or replace function public.push_staff_survey_request()
      returns trigger language plpgsql security definer set search_path = public as $b$
      begin
        if new.status = 'requested' then
          perform public._push_staff('planner', 'survey-req', '🗳️ 설문 신청이 들어왔어요', left(new.title, 80), '/voice');
        end if;
        return null;
      end $b$;
    $f$;
    execute 'drop trigger if exists surveys_staff_push on public.surveys';
    execute 'create trigger surveys_staff_push after insert on public.surveys for each row execute function public.push_staff_survey_request()';
    execute 'revoke all on function public.push_staff_survey_request() from public, anon, authenticated';
  end if;
end $$;
revoke all on function public.push_on_survey() from public, anon, authenticated;

-- 11-09 호원 결정(학생 의견 #42): 타워 쌓기 담당 개발자에서 20505 제외
update public.app_config set value = (value::jsonb || '{"tower":"20516"}')::text where key = 'game_owners';

-- 알림 설정 화면에 보이는 업무 알림 설명
create or replace function public._my_staff_roles()
returns text[] language sql stable security definer set search_path = public as $$
  select array_remove(array[
    case when p.role = 'admin' then '관리자: 앱 의견 · 학번 정정 요청' end,
    case when p.role in ('reviewer', 'admin') then '검토: 공지 검토 · 신고 · 분실물 사진' end,
    case when p.is_planner then '기획행정부: 익명 건의 · 설문 신청' end,
    case when auth.uid() in (select public._dev_user_ids()) then '개발자: 내 게임 의견' end
  ], null)
  from public.profiles p where p.id = auth.uid()
$$;
revoke all on function public._my_staff_roles() from public, anon, authenticated;
