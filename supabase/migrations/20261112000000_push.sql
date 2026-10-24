-- 운중고 앱 v3 — M4: 웹 푸시 알림
-- 호원 결정(10-24): 처음 켜 두는 알림 = 내 글 관련 · 과제 마감 전날 · 아침 급식·시간표. (새 학생회 설문은 꺼 둠)
-- 구조
--  1) 앱이 알림 구독(기기마다 endpoint)을 save_push_subscription으로 저장한다.
--  2) 보낼 알림은 push_outbox에 한 줄씩 쌓인다(같은 일로 두 번 쌓이지 않게 user·kind·ref 고유).
--     · 내 글 관련: 공지 승인·반려, 분실물 응답·해결, 건의 확인, 과제 글 확인, 의견 반영 → 표의 변화(트리거)로 쌓는다.
--     · 아침(학교 가는 날 07:30)·마감 전날(19:00): pg_cron이 push_enqueue_* 를 부른다.
--  3) 쌓이면 pg_net이 앱 서버(/api/push/send)를 깨우고, 서버가 VAPID 키로 실제 발송한 뒤 결과를 알려 준다.
--  4) 수업 시간에는 보내지 않고 미뤘다가(10분마다 다시 깨움) 쉬는 시간·방과 후에 보낸다.

-- ───────────────────────── 표 ─────────────────────────

create table public.app_config (
  key    text primary key,
  value  text not null
);
insert into public.app_config values ('app_url', 'https://unjung-app-git-lead-v3-unjung-app.vercel.app');

create table public.push_subscriptions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh      text not null check (char_length(p256dh) <= 200),
  auth        text not null check (char_length(auth) <= 100),
  ua          text check (char_length(ua) <= 200),
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);
create index push_subscriptions_user on public.push_subscriptions (user_id);

create table public.push_prefs (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  mine        boolean not null default true,
  deadline    boolean not null default true,
  morning     boolean not null default true,
  survey      boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table public.push_outbox (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('mine', 'deadline', 'morning', 'survey', 'test')),
  ref         text not null,
  title       text not null,
  body        text not null default '',
  url         text not null default '/',
  created_at  timestamptz not null default now(),
  not_before  timestamptz not null default now(),
  claimed_at  timestamptz,
  attempts    int not null default 0,
  sent_at     timestamptz,
  unique (user_id, kind, ref)
);
create index push_outbox_due on public.push_outbox (not_before) where sent_at is null;

-- ───────────────────────── 쌓기 ─────────────────────────

-- 이 학생이 이 종류의 알림을 받나(설정이 없으면 기본값) + 구독한 기기가 있나
create or replace function public.push_wants(p_user uuid, p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.push_subscriptions s where s.user_id = p_user)
     and case p_kind
           when 'test' then true
           when 'mine' then coalesce((select mine from public.push_prefs where user_id = p_user), true)
           when 'deadline' then coalesce((select deadline from public.push_prefs where user_id = p_user), true)
           when 'morning' then coalesce((select morning from public.push_prefs where user_id = p_user), true)
           when 'survey' then coalesce((select survey from public.push_prefs where user_id = p_user), false)
           else false end
$$;

create or replace function public.push_to(p_user uuid, p_kind text, p_ref text, p_title text, p_body text, p_url text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or not public.push_wants(p_user, p_kind) then return false; end if;
  insert into public.push_outbox (user_id, kind, ref, title, body, url)
  values (p_user, p_kind, p_ref, left(p_title, 60), left(coalesce(p_body, ''), 160), coalesce(p_url, '/'))
  on conflict (user_id, kind, ref) do nothing;
  return found;
end $$;

-- 보낼 것이 있으면 앱 서버를 깨운다(pg_net이 있을 때만. 실패해도 원래 일은 그대로 진행)
create or replace function public.push_kick()
returns void language plpgsql security definer set search_path = public as $$
declare
  u text := (select value from public.app_config where key = 'app_url');
begin
  if u is null or not exists (select 1 from pg_extension where extname = 'pg_net') then return; end if;
  if not exists (select 1 from public.push_outbox where sent_at is null and attempts < 5 and not_before <= now()) then return; end if;
  execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := ''{"Content-Type": "application/json"}''::jsonb, timeout_milliseconds := 2000)'
    using u || '/api/push/send';
exception when others then
  raise notice 'push_kick 실패: %', sqlerrm;
end $$;

create or replace function public.push_outbox_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.push_kick();
  return null;
end $$;
create trigger push_outbox_kick after insert on public.push_outbox for each statement execute function public.push_outbox_after_insert();

-- ── 내 글 관련 (트리거) ──

create or replace function public.push_on_notice()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'pending' and new.status = 'approved' then
    perform public.push_to(new.author, 'mine', 'notice:' || new.id, '공지가 게시됐어요 · +30 토큰', new.title, '/notice');
  elsif old.status = 'pending' and new.status = 'rejected' then
    perform public.push_to(new.author, 'mine', 'notice:' || new.id, '공지가 반려됐어요', coalesce(new.reject_reason, '') || ' · ' || new.title, '/notice');
  end if;
  return null;
end $$;
create trigger notices_push after update of status on public.notices for each row execute function public.push_on_notice();

create or replace function public.push_on_lost()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.helper is not null and new.helper is distinct from old.helper and new.status = 'open' then
    if new.type = 'found' then
      perform public.push_to(new.author, 'mine', 'lost-help:' || new.id || ':' || new.helper, '"' || new.item || '" 주인이 나타났어요',
        '주인이 물건을 받고 ''받았어요''를 누르면 +20 토큰을 받아요', '/lost');
    else
      perform public.push_to(new.author, 'mine', 'lost-help:' || new.id || ':' || new.helper, '"' || new.item || '"을(를) 찾았다는 학생이 있어요',
        '전해 받은 뒤 ''받았어요''를 눌러 주세요', '/lost');
    end if;
  end if;
  if old.status = 'open' and new.status = 'resolved' then
    perform public.push_to(case when new.type = 'found' then new.author else new.helper end, 'mine', 'lost-done:' || new.id,
      '+20 토큰을 받았어요', '"' || new.item || '"이(가) 주인에게 돌아갔어요. 고마워요!', '/wallet');
  end if;
  return null;
end $$;
create trigger lost_items_push after update on public.lost_items for each row execute function public.push_on_lost();

create or replace function public.push_on_suggestion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.checked_at is null and new.checked_at is not null then
    perform public.push_to(new.author, 'mine', 'sugg:' || new.id, '기획행정부가 건의를 확인했어요', new.title, '/voice?tab=suggest');
  end if;
  return null;
end $$;
create trigger suggestions_push after update of checked_at on public.suggestions for each row execute function public.push_on_suggestion();

create or replace function public.push_on_task()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.confirmed_at is null and new.confirmed_at is not null then
    perform public.push_to(new.author, 'mine', 'task:' || new.id, '과제 글이 확인됐어요 · +5 토큰', new.subject || ' · 친구 2명이 확인했어요', '/tasks');
  end if;
  return null;
end $$;
create trigger class_tasks_push after update of confirmed_at on public.class_tasks for each row execute function public.push_on_task();

create or replace function public.push_on_feedback()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'done' and old.status <> 'done' then
    perform public.push_to(new.user_id, 'mine', 'feedback:' || new.id, '보낸 의견이 반영됐어요 · +5 토큰', coalesce(new.reply, '고마워요!'), '/wallet');
  end if;
  return null;
end $$;
create trigger feedback_push after update of status on public.feedback for each row execute function public.push_on_feedback();

-- ── 새 학생회 설문(기본 꺼짐) ──
create or replace function public.push_on_survey()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.push_to(e.user_id, 'survey', 'survey:' || new.id, '학생회 설문이 올라왔어요', new.title || ' · 참여하면 +3 토큰', '/voice/survey/' || new.id)
     from public.enrollments e
    where e.school_year = public.current_school_year()
      and (new.scope_grade is null or e.grade = new.scope_grade);
  return null;
end $$;
create trigger surveys_push after insert on public.surveys for each row execute function public.push_on_survey();

-- ── 아침 07:30: 학교 가는 날, 1교시 + 점심 메뉴 ──
create or replace function public.push_enqueue_morning(p_day date)
returns int language plpgsql security definer set search_path = public as $$
declare
  lunch text := (select array_to_string(dishes[1:3], ', ') from public.meals_cache where day = p_day and code = 2);
  n int := 0;
  r record;
  first text;
  due int;
  b text;
begin
  if not public.is_school_day(p_day) then return 0; end if;
  for r in
    select e.user_id, e.grade, e.class_no from public.enrollments e
     where e.school_year = public.current_school_year() and public.push_wants(e.user_id, 'morning')
  loop
    first := (select l.subject from public.class_lessons l where l.grade = r.grade and l.class_no = r.class_no and l.day = p_day order by l.period limit 1);
    due := (select count(*) from public.class_tasks t where t.grade = r.grade and t.class_no = r.class_no and t.due = p_day and not t.deleted);
    b := concat_ws(' · ',
           case when first is not null then '1교시 ' || first end,
           case when lunch is not null then '점심 ' || lunch end,
           case when due > 0 then '오늘 마감 ' || due || '개' end);
    if public.push_to(r.user_id, 'morning', 'morning:' || p_day,
         '오늘 ' || extract(month from p_day)::int || '/' || extract(day from p_day)::int || ' (' || (array['월','화','수','목','금','토','일'])[extract(isodow from p_day)::int] || ')',
         coalesce(nullif(b, ''), '오늘 시간표와 급식을 확인해 보세요'), '/') then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ── 저녁 19:00: 내일 마감인 우리 반 과제 ──
create or replace function public.push_enqueue_deadlines(p_day date)
returns int language plpgsql security definer set search_path = public as $$
declare
  n int := 0;
  c record;
begin
  for c in
    select t.grade, t.class_no, count(*) as cnt,
           string_agg(t.subject || ' ' || case t.kind when 'assessment' then '수행평가' when 'homework' then '숙제' when 'supplies' then '준비물' else '시험' end,
                      ' · ' order by t.kind, t.subject) as list
      from public.class_tasks t
     where t.due = p_day + 1 and not t.deleted and t.school_year = public.current_school_year()
     group by t.grade, t.class_no
  loop
    n := n + (select count(*) from (
      select public.push_to(e.user_id, 'deadline', 'deadline:' || (p_day + 1), '내일 마감 ' || c.cnt || '개', c.list, '/tasks') ok
        from public.enrollments e
       where e.school_year = public.current_school_year() and e.grade = c.grade and e.class_no = c.class_no) x where x.ok);
  end loop;
  return n;
end $$;

-- ───────────────────────── 보내기(서버 전용) ─────────────────────────

-- 보낼 알림 가져가기: 수업 중인 학생 것은 남겨 두고, 가져간 것은 2분 동안 다시 안 준다
create or replace function public.push_take_batch(p_limit int, p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  out jsonb;
begin
  with due as (
    select o.id from public.push_outbox o
      left join public.enrollments e on e.user_id = o.user_id and e.school_year = public.current_school_year()
     where o.sent_at is null and o.attempts < 5 and o.not_before <= p_now
       and (o.claimed_at is null or o.claimed_at < p_now - interval '2 minutes')
       and (o.kind = 'test' or e.user_id is null or not public.is_class_time(e.grade, e.class_no, p_now))
     order by o.id
     limit greatest(1, least(coalesce(p_limit, 100), 500))
     for update of o skip locked
  ), claimed as (
    update public.push_outbox o set claimed_at = p_now, attempts = o.attempts + 1
      from due where o.id = due.id
    returning o.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'title', c.title, 'body', c.body, 'url', c.url, 'tag', c.kind || ':' || c.ref,
           'subs', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)), '[]')
                      from public.push_subscriptions s where s.user_id = c.user_id))), '[]')
    into out from claimed c;
  return out;
end $$;

-- 결과 알려 주기: 보낸 것은 완료, 없어진 구독(404·410)은 지운다
create or replace function public.push_report(p_sent bigint[], p_ok_endpoints text[], p_gone_endpoints text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.push_outbox set sent_at = now() where id = any (coalesce(p_sent, '{}'));
  update public.push_subscriptions set last_ok_at = now() where endpoint = any (coalesce(p_ok_endpoints, '{}'));
  delete from public.push_subscriptions where endpoint = any (coalesce(p_gone_endpoints, '{}'));
  delete from public.push_outbox where sent_at < now() - interval '14 days' or created_at < now() - interval '14 days';
end $$;

-- ───────────────────────── 앱에서 부르는 함수 ─────────────────────────

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_ua text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception '알림 정보를 다시 확인해 주세요' using errcode = 'P0001';
  end if;
  -- 같은 기기를 다른 계정으로 쓰면 마지막에 로그인한 계정으로 옮긴다
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, ua)
  values (me, p_endpoint, left(p_p256dh, 200), left(p_auth, 100), left(p_ua, 200))
  on conflict (endpoint) do update set user_id = me, p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua, created_at = now();
  -- 한 학생당 기기 5개까지(오래된 것부터 정리)
  delete from public.push_subscriptions where id in (
    select id from public.push_subscriptions where user_id = me order by created_at desc offset 5);
  insert into public.push_prefs (user_id) values (me) on conflict do nothing;
end $$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid()
$$;

create or replace function public.my_push_prefs()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'mine', coalesce(p.mine, true), 'deadline', coalesce(p.deadline, true), 'morning', coalesce(p.morning, true), 'survey', coalesce(p.survey, false),
    'devices', (select count(*) from public.push_subscriptions s where s.user_id = auth.uid()))
  from (select 1) one left join public.push_prefs p on p.user_id = auth.uid()
  where public.is_school_user()
$$;

create or replace function public.set_push_prefs(p_mine boolean, p_deadline boolean, p_morning boolean, p_survey boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  insert into public.push_prefs (user_id, mine, deadline, morning, survey, updated_at)
  values (auth.uid(), coalesce(p_mine, true), coalesce(p_deadline, true), coalesce(p_morning, true), coalesce(p_survey, false), now())
  on conflict (user_id) do update set mine = excluded.mine, deadline = excluded.deadline, morning = excluded.morning, survey = excluded.survey, updated_at = now();
  return public.my_push_prefs();
end $$;

-- 설정 화면의 '시험 알림 보내기'(1분에 한 번)
create or replace function public.send_test_push()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if not exists (select 1 from public.push_subscriptions where user_id = auth.uid()) then
    raise exception '이 기기에서 먼저 알림을 켜 주세요' using errcode = 'P0001';
  end if;
  return public.push_to(auth.uid(), 'test', 'test:' || to_char(now(), 'YYYYMMDDHH24MI'), '알림이 잘 와요 🔔', '운중고 앱 알림이 켜져 있어요.', '/settings/notifications');
end $$;

-- ───────────────────────── 권한 ─────────────────────────

alter table public.app_config enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_prefs enable row level security;
alter table public.push_outbox enable row level security;
-- 정책 없음 = 앱에서 표를 직접 읽거나 쓰지 못한다(위 함수로만)

revoke all on function public.push_wants(uuid, text) from public, anon, authenticated;
revoke all on function public.push_to(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.push_kick() from public, anon, authenticated;
revoke all on function public.push_enqueue_morning(date) from public, anon, authenticated;
revoke all on function public.push_enqueue_deadlines(date) from public, anon, authenticated;
revoke all on function public.push_take_batch(int, timestamptz) from public, anon, authenticated;
revoke all on function public.push_report(bigint[], text[], text[]) from public, anon, authenticated;
grant execute on function public.push_take_batch(int, timestamptz) to service_role;
grant execute on function public.push_report(bigint[], text[], text[]) to service_role;

grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;
grant execute on function public.my_push_prefs() to authenticated;
grant execute on function public.set_push_prefs(boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.send_test_push() to authenticated;

-- ───────────────────────── 예약 실행(Supabase에서만) ─────────────────────────
-- pg_net: 서버 깨우기 / pg_cron: 아침·저녁 알림과 10분마다 미뤄 둔 알림 보내기. (시각은 UTC 기준)
do $$
begin
  begin
    if exists (select 1 from pg_available_extensions where name = 'pg_net') then
      create extension if not exists pg_net;
    end if;
  exception when others then
    raise notice 'pg_net을 켜지 못했어요(Database → Extensions에서 켜 주세요): %', sqlerrm;
  end;
  begin
    if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
      create extension if not exists pg_cron;
      -- 월~금 07:30 (한국) = 일~목 22:30 (UTC)
      perform cron.schedule('unjung-push-morning', '30 22 * * 0-4', 'select public.push_enqueue_morning(public.seoul_today())');
      -- 매일 19:00 (한국) = 10:00 (UTC)
      perform cron.schedule('unjung-push-deadline', '0 10 * * *', 'select public.push_enqueue_deadlines(public.seoul_today())');
      -- 08:00~17:59 (한국) 10분마다: 수업 시간이라 미뤄 둔 알림 보내기
      perform cron.schedule('unjung-push-flush', '*/10 23,0-8 * * *', 'select public.push_kick()');
    end if;
  exception when others then
    raise notice 'pg_cron 예약을 만들지 못했어요(Database → Extensions에서 pg_cron을 켜 주세요): %', sqlerrm;
  end;
end $$;
