-- 11-15 호원 결정(기획행정부 차지현 PR #80 이어서): '학생회에 건의' → '학생 동의 청원'
--  · 분야 6개: 시설·환경(facility) / 급식(meal) / 수업·학사(study) / 행사·동아리(event) / 생활·규정(life, 새로) / 기타(etc)
--    기존 글은 키가 같아서 그대로 맞는 분야로 보인다
--  · '공감' → '동의'(이름만, 기준·공식 답변 없음). 서버 문구·알림 문구도 청원으로
-- 여러 번 실행해도 안전

alter table public.suggestions drop constraint if exists suggestions_category_check;
alter table public.suggestions add constraint suggestions_category_check check (category in ('facility', 'meal', 'event', 'study', 'life', 'etc'));

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
  if p_category not in ('facility', 'meal', 'event', 'study', 'life', 'etc') then raise exception '분야를 골라 주세요' using errcode = 'P0001'; end if;
  if char_length(t) < 2 or char_length(t) > 40 then raise exception '제목은 2~40자예요' using errcode = 'P0001'; end if;
  if char_length(b) < 5 or char_length(b) > 500 then raise exception '내용은 5~500자예요' using errcode = 'P0001'; end if;
  if public.has_banned_word(t || ' ' || b) then raise exception '부적절한 표현이 들어 있어요' using errcode = 'P0001'; end if;
  if (select count(*) from public.suggestions where author = me and created_at > now() - interval '1 day') >= 3 then
    raise exception '청원은 하루에 3개까지 올릴 수 있어요' using errcode = 'P0001';
  end if;
  insert into public.suggestions (author, author_grade, category, title, body)
  values (me, e.grade, p_category, t, b) returning id into rid;
  return rid;
end $$;

create or replace function public.withdraw_suggestion(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.suggestions set status = 'withdrawn' where id = p_id and author = auth.uid() and status = 'open';
  if not found then raise exception '내 청원만 내릴 수 있어요' using errcode = 'P0001'; end if;
end $$;

create or replace function public.like_suggestion(p_id bigint, p_on boolean)
returns int language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  x public.suggestions;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  select * into x from public.suggestions where id = p_id and status = 'open' for update;
  if not found then raise exception '없는 청원이에요' using errcode = 'P0001'; end if;
  if x.author = me then raise exception '내 청원에는 동의할 수 없어요' using errcode = 'P0001'; end if;
  if p_on then
    insert into public.suggestion_likes (suggestion_id, user_id) values (p_id, me) on conflict do nothing;
    if found then update public.suggestions set like_count = like_count + 1 where id = p_id; end if;
  else
    delete from public.suggestion_likes where suggestion_id = p_id and user_id = me;
    if found then update public.suggestions set like_count = greatest(0, like_count - 1) where id = p_id; end if;
  end if;
  return (select like_count from public.suggestions where id = p_id);
end $$;

create or replace function public.report_suggestion(p_id bigint, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  x public.suggestions;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  select * into x from public.suggestions where id = p_id and status = 'open' for update;
  if not found then raise exception '없는 청원이에요' using errcode = 'P0001'; end if;
  if x.author = me then raise exception '내 청원은 신고할 수 없어요' using errcode = 'P0001'; end if;
  insert into public.suggestion_reports (suggestion_id, user_id, reason) values (p_id, me, left(coalesce(p_reason, ''), 50)) on conflict do nothing;
  if found then
    update public.suggestions set report_count = report_count + 1,
           status = case when report_count + 1 >= 3 then 'hidden' else status end
     where id = p_id;
  end if;
end $$;

create or replace function public.push_on_suggestion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.checked_at is null and new.checked_at is not null then
    perform public.push_to(new.author, 'mine', 'sugg:' || new.id, '기획행정부가 청원을 확인했어요', new.title, '/voice?tab=suggest');
  end if;
  return null;
end $$;

create or replace function public.push_staff_suggestion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._push_staff('planner', 'sugg', '📢 새 학생 동의 청원이 올라왔어요', left(new.title, 80), '/voice?tab=suggest');
  return null;
end $$;

create or replace function public._my_staff_roles()
returns text[] language sql stable security definer set search_path = public as $$
  select array_remove(array[
    case when p.role = 'admin' then '관리자: 앱 의견 · 학번 정정 요청' end,
    case when p.role in ('reviewer', 'admin') then '검토: 공지 검토 · 신고 · 분실물 사진' end,
    case when p.is_planner then '기획행정부: 학생 동의 청원 · 설문 신청' end,
    case when auth.uid() in (select public._dev_user_ids()) then '개발자: 내 게임 의견' end
  ], null)
  from public.profiles p where p.id = auth.uid()
$$;
revoke all on function public._my_staff_roles() from public, anon, authenticated;
