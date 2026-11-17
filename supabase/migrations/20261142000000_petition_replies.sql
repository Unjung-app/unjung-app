-- 11-17 기획행정부 요청
--  · 신고된 청원: '확인했어요'·'숨기기'·'보이기' 중 하나를 하면 신고 목록과 처리할 일 숫자에서 빠진다(전에는 계속 남음)
--    처리 뒤 새 신고가 들어오면 다시 목록에 올라온다
--  · 청원 답글: 기획행정부만 단다(학생 화면에는 '기획행정부 답변'으로, 누가 썼는지는 안 보임). 답글이 달리면 청원 쓴 학생에게 알림
-- 여러 번 실행해도 안전

alter table public.suggestions add column if not exists report_reviewed_at timestamptz;

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
    update public.suggestions set report_count = report_count + 1, report_reviewed_at = null, -- 새 신고가 오면 다시 처리할 일로
           status = case when report_count + 1 >= 3 then 'hidden' else status end
     where id = p_id;
  end if;
end $$;

create or replace function public.check_suggestion(p_id bigint, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_planner() then raise exception '기획행정부만 할 수 있어요' using errcode = '42501'; end if;
  update public.suggestions
     set checked_by = case when p_on then auth.uid() end,
         checked_at = case when p_on then coalesce(checked_at, now()) end,
         report_reviewed_at = case when p_on then now() else report_reviewed_at end -- 확인하면 신고 목록에서도 빠진다
   where id = p_id and status in ('open', 'hidden');
  if not found then raise exception '없는 청원이에요' using errcode = 'P0001'; end if;
end $$;

create or replace function public.mod_suggestion(p_id bigint, p_show boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_planner() then raise exception '기획행정부만 할 수 있어요' using errcode = '42501'; end if;
  update public.suggestions set status = case when p_show then 'open' else 'hidden' end,
         report_count = case when p_show then 0 else report_count end,
         report_reviewed_at = now() -- 보이기든 숨기기든 결정했으면 처리 완료
   where id = p_id and status in ('open', 'hidden');
  if not found then raise exception '처리할 수 없는 청원이에요' using errcode = 'P0001'; end if;
  if p_show then delete from public.suggestion_reports where suggestion_id = p_id; end if;
end $$;

drop view if exists public.suggestion_mod_queue;
create view public.suggestion_mod_queue as
  select x.id, x.category, x.title, x.body, x.author_grade, x.status, x.report_count, x.created_at,
         (select string_agg(nullif(r.reason, ''), ' / ') from public.suggestion_reports r where r.suggestion_id = x.id) as reasons
    from public.suggestions x
   where public.is_planner() and x.report_count > 0 and x.status in ('open', 'hidden') and x.report_reviewed_at is null;
revoke all on public.suggestion_mod_queue from public, anon;
grant select on public.suggestion_mod_queue to authenticated;

-- ───────── 답글 ─────────
create table if not exists public.suggestion_replies (
  id            bigint generated always as identity primary key,
  suggestion_id bigint not null references public.suggestions (id) on delete cascade,
  author        uuid not null references public.profiles (id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 500),
  created_at    timestamptz not null default now()
);
create index if not exists suggestion_replies_by_suggestion on public.suggestion_replies (suggestion_id, created_at);
alter table public.suggestion_replies enable row level security; -- 직접 읽기·쓰기 없음(아래 함수·보기로만)

create or replace function public.reply_suggestion(p_id bigint, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  b text := btrim(coalesce(p_body, ''));
  x public.suggestions;
begin
  if not public.is_planner() then raise exception '기획행정부만 답글을 달 수 있어요' using errcode = '42501'; end if;
  if char_length(b) < 1 or char_length(b) > 500 then raise exception '답글은 1~500자예요' using errcode = 'P0001'; end if;
  if public.has_banned_word(b) then raise exception '부적절한 표현이 들어 있어요' using errcode = 'P0001'; end if;
  select * into x from public.suggestions where id = p_id and status in ('open', 'hidden') for update;
  if not found then raise exception '없는 청원이에요' using errcode = 'P0001'; end if;
  insert into public.suggestion_replies (suggestion_id, author, body) values (p_id, auth.uid(), b);
  -- 답글을 달면 '확인' 표시도 함께
  update public.suggestions set checked_by = coalesce(checked_by, auth.uid()), checked_at = coalesce(checked_at, now()) where id = p_id;
  if x.author is not null and x.author <> auth.uid() then
    perform public.push_to(x.author, 'mine', 'sugg-reply:' || p_id || ':' || extract(epoch from now())::bigint,
                           '내 청원에 기획행정부 답변이 달렸어요', left(b, 80), '/voice?tab=suggest');
  end if;
end $$;

create or replace function public.delete_suggestion_reply(p_reply bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_planner() then raise exception '기획행정부만 할 수 있어요' using errcode = '42501'; end if;
  delete from public.suggestion_replies where id = p_reply;
  if not found then raise exception '없는 답글이에요' using errcode = 'P0001'; end if;
end $$;
revoke all on function public.reply_suggestion(bigint, text) from public, anon;
revoke all on function public.delete_suggestion_reply(bigint) from public, anon;
grant execute on function public.reply_suggestion(bigint, text) to authenticated;
grant execute on function public.delete_suggestion_reply(bigint) to authenticated;

-- 학생이 보는 청원 목록에 답글(쓴 사람은 숨김)
create or replace view public.suggestion_feed as
  select x.id, x.category, x.title, x.body, x.author_grade, x.like_count, x.created_at,
         (x.checked_at is not null) as checked, x.checked_at,
         (x.author = auth.uid()) as mine,
         exists (select 1 from public.suggestion_likes l where l.suggestion_id = x.id and l.user_id = auth.uid()) as liked,
         exists (select 1 from public.suggestion_reports r where r.suggestion_id = x.id and r.user_id = auth.uid()) as reported,
         (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'body', r.body, 'created_at', r.created_at) order by r.created_at), '[]')
            from public.suggestion_replies r where r.suggestion_id = x.id) as replies
    from public.suggestions x
   where public.is_school_user() and x.status = 'open' and x.created_at > now() - interval '60 days';
