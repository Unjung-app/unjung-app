-- 11-06 출시 직전 점검 (호원 요청: 보안 철저히 · 피드백 유도)
--  1) '학교 학생' 판정 강화: 로그인 토큰의 이메일만 보지 않고, 실제 '구글 학교 계정'으로 로그인했는지 auth.identities로 확인한다.
--     (Supabase에서 이메일 가입이 켜져 있거나 이메일 변경 확인이 꺼져 있어도 가짜 @unjung.hs.kr 계정이 통과하지 못한다)
--  2) 글쓰기 폭탄 방지: 공지(자동 승인 포함) 하루 10개, 행사 사진 하루 10개·글 하나에 사진 30장, 설문 하루 5개
--  3) 트리거 함수는 직접 부를 수 없게
--  4) 출시 기간 의견 보내기 보상: 기간 중 하루 첫 의견(10자 이상) +5, 반영 완료 보상(+10)은 부스트 2배
--     의견 현황(전체 몇 개 · 몇 개 반영)을 홈에 보여 주는 함수

-- ───────── 1) 학교 학생 판정 ─────────

-- 지금 로그인한 계정이 '구글 + @unjung.hs.kr' 신원(identity)을 갖고, 토큰의 이메일과 같은가
create or replace function public._school_identity_ok()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.identities i
     where i.user_id = auth.uid()
       and i.provider = 'google'
       and public.is_school_email(i.identity_data ->> 'email')
       and lower(i.identity_data ->> 'email') = lower(auth.jwt() ->> 'email')
  )
$$;
-- 비로그인(anon)이 표를 읽을 때도 정책에서 불리므로 실행 권한은 둔다(그 경우 항상 false)
revoke all on function public._school_identity_ok() from public;
grant execute on function public._school_identity_ok() to anon, authenticated;

create or replace function public.is_school_user()
returns boolean language sql stable as $$
  select auth.uid() is not null
     and public.is_school_email(auth.jwt() ->> 'email')
     and coalesce(auth.jwt() ->> 'is_anonymous', 'false') <> 'true'
     and public._school_identity_ok()
$$;

-- 안전장치: 이미 학번을 등록한 학생 중 구글 학교 신원이 없는 사람이 있으면(판정을 잘못 바꾼 것) 전체를 되돌린다
do $$
declare
  bad int;
begin
  select count(*) into bad
    from public.enrollments e
    join public.profiles p on p.id = e.user_id
   where e.user_id is not null
     and not exists (select 1 from auth.identities i
                      where i.user_id = e.user_id and i.provider = 'google'
                        and lower(i.identity_data ->> 'email') = lower(p.email));
  if bad > 0 then
    raise exception '검증 실패: 학번을 등록한 학생 %명이 구글 학교 신원과 맞지 않아요. 적용하지 않고 되돌립니다. 리드에게 이 문구를 보내 주세요.', bad;
  end if;
end $$;

-- ───────── 2) 글쓰기 폭탄 방지 ─────────

create or replace function public._daily_post_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n int;
  cap int := tg_argv[1]::int;
begin
  execute format('select count(*) from public.%I where %I = $1 and created_at > now() - interval ''1 day''', tg_table_name, tg_argv[0])
     into n using (to_jsonb(new) ->> tg_argv[0])::uuid;
  if n >= cap then
    raise exception '하루에 %개까지 올릴 수 있어요', cap using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public._daily_post_limit() from public, anon, authenticated;

drop trigger if exists notices_daily_limit on public.notices;
create trigger notices_daily_limit before insert on public.notices
  for each row execute function public._daily_post_limit('author', '10');
drop trigger if exists gallery_daily_limit on public.gallery_posts;
create trigger gallery_daily_limit before insert on public.gallery_posts
  for each row execute function public._daily_post_limit('author', '10');
drop trigger if exists surveys_daily_limit on public.surveys;
create trigger surveys_daily_limit before insert on public.surveys
  for each row execute function public._daily_post_limit('author', '5');

alter table public.gallery_posts drop constraint if exists gallery_photos_max;
alter table public.gallery_posts add constraint gallery_photos_max check (coalesce(cardinality(photos), 0) <= 30);

-- ───────── 3) 트리거 함수는 직접 부를 수 없게 ─────────

do $$
declare
  f record;
begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prorettype = 'trigger'::regtype loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- ───────── 4) 출시 기간 의견 보내기 ─────────

create or replace function public._launch_mult(p_reason text)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  ev jsonb;
begin
  if p_reason not in ('check_in', 'meal_review', 'study', 'survey', 'game_score', 'game_best', 'done', 'notice_approved', 'lost_found', 'feedback_done') then return 1; end if;
  select value::jsonb into ev from public.app_config where key = 'launch_event';
  if ev is null or now() < (ev->>'from')::timestamptz or now() > (ev->>'until')::timestamptz then return 1; end if;
  return greatest(1, least(5, coalesce((ev->>'mult')::int, 1)));
exception when others then
  return 1;
end $$;
revoke all on function public._launch_mult(text) from public, anon, authenticated;

create or replace function public._launch_active()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select now() between (v->>'from')::timestamptz and (v->>'until')::timestamptz
                     from (select value::jsonb v from public.app_config where key = 'launch_event') c), false)
$$;
revoke all on function public._launch_active() from public, anon, authenticated;

drop function if exists public.submit_feedback(text, text, text, text, text);
create or replace function public.submit_feedback(p_kind text, p_body text, p_screen text, p_app_version text, p_device text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  b text := btrim(coalesce(p_body, ''));
  rid bigint;
  bonus int := 0;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if p_kind not in ('bug', 'idea', 'other') then raise exception '종류를 골라 주세요' using errcode = 'P0001'; end if;
  if char_length(b) < 5 or char_length(b) > 1000 then raise exception '내용은 5~1000자로 써 주세요' using errcode = 'P0001'; end if;
  if (select count(*) from public.feedback where user_id = me and created_at > now() - interval '1 day') >= 5 then
    raise exception '하루에 5개까지 보낼 수 있어요' using errcode = 'P0001';
  end if;
  insert into public.feedback (user_id, kind, body, screen, app_version, device)
  values (me, p_kind, b, left(p_screen, 100), left(p_app_version, 30), left(p_device, 200))
  returning id into rid;
  -- 출시 기간: 하루 첫 의견(10자 이상, 학번 등록한 학생) +5
  if public._launch_active() and char_length(b) >= 10 and (public.enrollment_of(me)).user_id is not null then
    if public.award_tokens(me, 5, 'feedback_launch', public.seoul_today()::text) then bonus := 5; end if;
  end if;
  return jsonb_build_object('id', rid, 'bonus', bonus);
end $$;
revoke all on function public.submit_feedback(text, text, text, text, text) from public, anon;
grant execute on function public.submit_feedback(text, text, text, text, text) to authenticated;

-- 의견 현황(학생 모두에게): 전체 몇 개 · 반영 몇 개 · 오늘 보너스 받았는지
create or replace function public.feedback_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.feedback),
    'done', (select count(*) from public.feedback where status = 'done'),
    'mine', (select count(*) from public.feedback where user_id = auth.uid()),
    'launch', public._launch_active(),
    'bonus_today', exists (select 1 from public.token_ledger where user_id = auth.uid() and reason = 'feedback_launch' and ref_id = public.seoul_today()::text));
end $$;
revoke all on function public.feedback_stats() from public, anon;
grant execute on function public.feedback_stats() to authenticated;

-- 반영 완료 알림 문구에 실제 받은 토큰을 쓴다(부스트 기간 2배)
create or replace function public.push_on_feedback()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'done' and old.status <> 'done' then
    perform public.push_to(new.user_id, 'mine', 'feedback:' || new.id,
      '보낸 의견이 반영됐어요 · +' || (10 * public._launch_mult('feedback_done')) || ' 토큰', coalesce(new.reply, '고마워요!'), '/wallet');
  end if;
  return null;
end $$;
revoke all on function public.push_on_feedback() from public, anon, authenticated;
