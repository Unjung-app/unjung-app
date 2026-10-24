-- 운중고 앱 v3 — M5(출시 준비): 토큰 밸런스 · 악용 방지 · 관리자 도구 · 정식 주소
--
-- 토큰 표(1.0.0)            이전 → 지금
--  출석                      +2 → +2 (하루 1번)
--  연속 출석                 7일마다 +10 → 7일마다 +10, 30일마다 +30(새로)
--  급식 한줄평               +3 → +3 (하루 1번, 10자 이상)
--  한줄평 공감 받음          +1(하루 5) → 그대로
--  집중 모드 공부            10분 +1, 하루 30 → 처음 2시간 10분마다 +1, 그 뒤 4시간까지 15분마다 +1 (하루 20)
--  과제 등록(2명 확인)       +5(하루 15) → +3(하루 6)      ※ 친구끼리 가짜 과제 주고받기 방지
--  학생 공지 승인            +30 → +20 (하루 1건)
--  분실물 주인 찾아 줌       +20(하루 20) → +10, 주 2번까지, 같은 두 학생 사이는 30일에 1번, 글 올리고 10분 뒤부터
--  검토위원 처리             +2(하루 20) → +2(하루 10)
--  의견 반영                 +5 → +10 (버그 제보를 더 아끼기)
--  설문 참여 +3, 게임(최고 기록 +2, 주간 1~3위 30/20/10)은 그대로
-- 기준: 꾸준히 쓰는 학생 하루 약 10~20, 많이 공부하는 학생 최대 약 40. 이모지(30)는 며칠, 테마(150)는 2~3주.

-- ───────────────────────── 연속 출석 ─────────────────────────

-- 지금 보여 줄 연속 출석: 마지막 출석 뒤로 '빠진 학교 날'이 보호권보다 많으면 이미 끊긴 것(0)
create or replace function public.streak_now(p_user uuid, p_today date)
returns int language sql stable security definer set search_path = public as $$
  select case
           when s.last_day is null then 0
           when s.last_day >= p_today - 1 then s.current
           when (select count(*) from generate_series(s.last_day + 1, p_today - 1, interval '1 day') g
                  where public.is_school_day(g::date)) > s.shields then 0
           else s.current end
    from public.streaks s where s.user_id = p_user
$$;
revoke all on function public.streak_now(uuid, date) from public, anon, authenticated;

create or replace function public.my_wallet()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'balance', coalesce((select sum(delta) from public.token_ledger where user_id = p.id), 0),
    'week_earned', coalesce((
      select sum(delta) from public.token_ledger
       where user_id = p.id and delta > 0 and reason <> 'admin'
         and (created_at at time zone 'Asia/Seoul')::date >= date_trunc('week', public.seoul_today())::date), 0),
    'streak', coalesce(public.streak_now(p.id, public.seoul_today()), 0),
    'best', coalesce(s.best, 0),
    'shields', coalesce(s.shields, 0),
    'last_day', s.last_day,
    'checked_today', exists (select 1 from public.check_ins c where c.user_id = p.id and c.day = public.seoul_today()),
    'today_is_school_day', public.is_school_day(public.seoul_today()),
    'inventory', coalesce((select jsonb_agg(item_id order by acquired_at) from public.inventory i where i.user_id = p.id), '[]'::jsonb),
    'equip', jsonb_build_object('emoji', p.equip_emoji, 'name_color', p.equip_color, 'theme', p.equip_theme, 'badge', p.equip_badge),
    'nickname', p.nickname,
    'nickname_changed_at', p.nickname_changed_at,
    'hide_in_ranking', p.hide_in_ranking
  )
  from public.profiles p
  left join public.streaks s on s.user_id = p.id
  where p.id = auth.uid() and public.is_school_user()
$$;

create or replace function public._check_in(p_user uuid, p_day date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.streaks;
  first_today boolean;
  school boolean := public.is_school_day(p_day);
  missed int := 0;
  used int := 0;
  got int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('ledger:' || p_user::text));
  insert into public.check_ins (user_id, day) values (p_user, p_day) on conflict do nothing;
  first_today := found;
  insert into public.streaks (user_id) values (p_user) on conflict do nothing;
  select * into s from public.streaks where user_id = p_user for update;

  if first_today then
    if public.award_tokens(p_user, 2, 'check_in', p_day::text) then got := got + 2; end if;

    if school and (s.last_day is null or s.last_day < p_day) then
      if s.last_day is null then
        s.current := 1;
      else
        select count(*) into missed
          from generate_series(s.last_day + 1, p_day - 1, interval '1 day') g
         where public.is_school_day(g::date);
        if missed = 0 then
          s.current := s.current + 1;
        elsif missed <= s.shields then
          used := missed;
          s.shields := s.shields - missed;
          s.current := s.current + 1;
        else
          s.current := 1;
        end if;
      end if;
      s.last_day := p_day;
      s.best := greatest(s.best, s.current);
      update public.streaks
         set current = s.current, best = s.best, last_day = s.last_day, shields = s.shields
       where user_id = p_user;
      if s.current % 7 = 0 and public.award_tokens(p_user, 10, 'streak_7', p_day::text) then
        got := got + 10;
      end if;
      if s.current % 30 = 0 and public.award_tokens(p_user, 30, 'streak_30', p_day::text) then
        got := got + 30;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'day', p_day, 'first_today', first_today, 'school_day', school,
    'tokens', got, 'streak', s.current, 'shields', s.shields, 'shield_used', used);
end $$;
revoke all on function public._check_in(uuid, date) from public, anon, authenticated;

-- ───────────────────────── 집중 모드 공부 ─────────────────────────

-- 하루 인정 공부 시간(초) → 받을 토큰 수: 처음 2시간은 10분마다, 그 뒤 4시간까지는 15분마다
create or replace function public.study_tokens_for(p_seconds int)
returns int language sql immutable as $$
  select least(12, greatest(0, p_seconds) / 600) + least(8, greatest(0, p_seconds - 7200) / 900)
$$;

create or replace function public._beat_study(p_user uuid, p_id uuid, p_now timestamptz, p_skip boolean, p_end boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.study_sessions;
  d public.study_daily;
  gap int;
  credit int := 0;
  ranked int := 0;
  in_class boolean;
  dday date := (p_now at time zone 'Asia/Seoul')::date;
  due int;
  k int;
begin
  perform pg_advisory_xact_lock(hashtext('ledger:' || p_user::text));
  select * into s from public.study_sessions where id = p_id and user_id = p_user and ended_at is null for update;
  if not found then
    return jsonb_build_object('ended', true, 'reason', 'not_found', 'today', public._study_today(p_user, dday));
  end if;

  gap := floor(extract(epoch from (p_now - s.last_beat_at)))::int;
  if gap > 90 then
    update public.study_sessions set ended_at = last_beat_at where id = p_id;
    return jsonb_build_object('ended', true, 'reason', 'timeout', 'today', public._study_today(p_user, dday));
  end if;
  if not p_skip and gap > 0 then credit := gap; end if;

  in_class := public.is_class_time(s.grade, s.class_no, p_now - make_interval(secs => credit / 2.0));

  if credit > 0 then
    insert into public.study_daily (user_id, day, school_year, grade, class_no)
    values (p_user, dday, s.school_year, s.grade, s.class_no)
    on conflict (user_id, day) do nothing;
    select * into d from public.study_daily where user_id = p_user and day = dday for update;
    if in_class then
      update public.study_daily set class_seconds = class_seconds + credit where user_id = p_user and day = dday;
    else
      ranked := greatest(0, least(credit, 12 * 3600 - d.ranked_seconds));
      update public.study_daily set ranked_seconds = ranked_seconds + ranked, class_seconds = class_seconds + (credit - ranked)
       where user_id = p_user and day = dday;
      due := public.study_tokens_for(d.ranked_seconds + ranked);
      if due > d.tokens then
        for k in d.tokens + 1 .. due loop
          perform public.award_tokens(p_user, 1, 'study', dday::text || ':' || k);
        end loop;
        update public.study_daily set tokens = due where user_id = p_user and day = dday;
      end if;
    end if;
  end if;

  update public.study_sessions
     set last_beat_at = p_now,
         ranked_seconds = ranked_seconds + ranked,
         class_seconds = class_seconds + (credit - ranked),
         ended_at = case when p_end then p_now else null end
   where id = p_id;

  return jsonb_build_object('ended', p_end, 'in_class', public.is_class_time(s.grade, s.class_no, p_now),
                            'credited', credit, 'today', public._study_today(p_user, dday));
end $$;
revoke all on function public._beat_study(uuid, uuid, timestamptz, boolean, boolean) from public, anon, authenticated;

-- ───────────────────────── 과제 게시판 ─────────────────────────

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
      perform public.award_capped(t.author, 3, 'task_confirmed', p_id::text, 6);
    end if;
  end if;
  return t.confirm_count;
end $$;

-- ───────────────────────── 학생 공지 · 검토 ─────────────────────────

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
  if p_approve then perform public.award_capped(n.author, 20, 'notice_approved', p_id::text, 20); end if;
  perform public.award_capped(me, 2, 'review_done', 'notice:' || p_id, 10);
end $$;

create or replace function public.review_lost_photo(p_id bigint, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_reviewer() then raise exception '검토위원만 할 수 있어요' using errcode = '42501'; end if;
  update public.lost_items set photo_status = case when p_approve then 'approved' else 'rejected' end
   where id = p_id and photo_status = 'pending';
  if not found then raise exception '이미 처리된 사진이에요' using errcode = 'P0001'; end if;
  perform public.award_capped(auth.uid(), 2, 'review_done', 'photo:' || p_id, 10);
end $$;

-- ───────────────────────── 분실물 ─────────────────────────

alter table public.lost_items add column rewarded boolean not null default false;

-- 받았어요 → 도와준 학생 +10. 친구끼리 가짜 글로 토큰 주고받기를 막는 조건:
--   · 글을 올리고 10분이 지나야 보상, · 같은 두 학생 사이 보상은 30일에 1번, · 한 학생은 한 주에 2번(20)까지
drop function public.resolve_lost_item(bigint);
create function public.resolve_lost_item(p_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  x public.lost_items;
  finder uuid;
  owner uuid;
  week_got int;
  why text := null;
begin
  select * into x from public.lost_items where id = p_id for update;
  if not found or x.status <> 'open' or x.helper is null then raise exception '아직 받을 수 없는 글이에요' using errcode = 'P0001'; end if;
  if x.type = 'found' and me <> x.helper then raise exception '물건 주인만 받았다고 할 수 있어요' using errcode = 'P0001'; end if;
  if x.type = 'lost' and me <> x.author then raise exception '글쓴이만 받았다고 할 수 있어요' using errcode = 'P0001'; end if;
  finder := case when x.type = 'found' then x.author else x.helper end;
  owner := case when x.type = 'found' then x.helper else x.author end;

  perform pg_advisory_xact_lock(hashtext('ledger:' || finder::text));
  week_got := coalesce((select sum(delta) from public.token_ledger
                         where user_id = finder and reason = 'lost_found'
                           and (created_at at time zone 'Asia/Seoul')::date >= date_trunc('week', public.seoul_today())::date), 0);
  if now() - x.created_at < interval '10 minutes' then why := 'too_soon';
  elsif exists (select 1 from public.lost_items y
                 where y.id <> x.id and y.rewarded and y.resolved_at > now() - interval '30 days'
                   and ((y.author = x.author and y.helper = x.helper) or (y.author = x.helper and y.helper = x.author))) then why := 'same_pair';
  elsif week_got >= 20 then why := 'week_cap';
  end if;

  update public.lost_items set status = 'resolved', resolved_at = now(), rewarded = (why is null) where id = p_id;
  if why is null then perform public.award_tokens(finder, 10, 'lost_found', p_id::text); end if;
  return jsonb_build_object('rewarded', why is null, 'reason', why, 'owner', owner = me);
end $$;
grant execute on function public.resolve_lost_item(bigint) to authenticated;

-- ───────────────────────── 의견 ─────────────────────────

create or replace function public.admin_update_feedback(p_id bigint, p_status text, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
declare
  author uuid;
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  if p_status not in ('new', 'seen', 'done', 'wontfix') then raise exception '잘못된 상태예요' using errcode = 'P0001'; end if;
  update public.feedback set status = p_status, reply = nullif(btrim(coalesce(p_reply, '')), ''), updated_at = now()
   where id = p_id returning user_id into author;
  if not found then raise exception '없는 의견이에요' using errcode = 'P0001'; end if;
  if p_status = 'done' then perform public.award_tokens(author, 10, 'feedback_done', p_id::text); end if;
end $$;

create or replace function public.push_on_feedback()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'done' and old.status <> 'done' then
    perform public.push_to(new.user_id, 'mine', 'feedback:' || new.id, '보낸 의견이 반영됐어요 · +10 토큰', coalesce(new.reply, '고마워요!'), '/wallet');
  end if;
  return null;
end $$;

create or replace function public.push_on_notice()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'pending' and new.status = 'approved' then
    perform public.push_to(new.author, 'mine', 'notice:' || new.id, '공지가 게시됐어요', new.title, '/notice');
  elsif old.status = 'pending' and new.status = 'rejected' then
    perform public.push_to(new.author, 'mine', 'notice:' || new.id, '공지가 반려됐어요', coalesce(new.reject_reason, '') || ' · ' || new.title, '/notice');
  end if;
  return null;
end $$;

create or replace function public.push_on_task()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.confirmed_at is null and new.confirmed_at is not null then
    perform public.push_to(new.author, 'mine', 'task:' || new.id, '과제 글이 확인됐어요', new.subject || ' · 친구 2명이 확인했어요', '/tasks');
  end if;
  return null;
end $$;

create or replace function public.push_on_lost()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.helper is not null and new.helper is distinct from old.helper and new.status = 'open' then
    if new.type = 'found' then
      perform public.push_to(new.author, 'mine', 'lost-help:' || new.id || ':' || new.helper, '"' || new.item || '" 주인이 나타났어요',
        '전달 장소에서 주인에게 돌려주세요. 주인이 ''받았어요''를 누르면 토큰을 받아요', '/lost');
    else
      perform public.push_to(new.author, 'mine', 'lost-help:' || new.id || ':' || new.helper, '"' || new.item || '"을(를) 찾았다는 학생이 있어요',
        '전해 받은 뒤 ''받았어요''를 눌러 주세요', '/lost');
    end if;
  end if;
  if old.status = 'open' and new.status = 'resolved' and new.rewarded then
    perform public.push_to(case when new.type = 'found' then new.author else new.helper end, 'mine', 'lost-done:' || new.id,
      '+10 토큰을 받았어요', '"' || new.item || '"이(가) 주인에게 돌아갔어요. 고마워요!', '/wallet');
  end if;
  return null;
end $$;

-- ───────────────────────── 관리자: 학생 찾기 · 학적 정정 ─────────────────────────

-- 학번(5자리) 또는 닉네임으로 찾기. 실명·이메일은 관리자에게만.
drop function public.admin_find_user(text);
create function public.admin_find_user(p_query text)
returns table (user_id uuid, name text, student_no text, email text, role text, grade int, class_no int, nickname text, is_planner boolean, balance int)
language plpgsql stable security definer set search_path = public as $$
declare
  qy text := btrim(coalesce(p_query, ''));
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  return query
    select p.id, e.name, e.student_no, p.email, p.role, e.grade, e.class_no, p.nickname, p.is_planner,
           coalesce((select sum(l.delta) from public.token_ledger l where l.user_id = p.id), 0)::int
      from public.profiles p
      left join public.enrollments e on e.user_id = p.id and e.school_year = public.current_school_year()
     where (qy ~ '^[0-9]{5}$' and e.student_no = qy)
        or (qy !~ '^[0-9]{5}$' and char_length(qy) >= 2 and (lower(p.nickname) = lower(qy) or lower(p.email) = lower(qy)))
     limit 5;
end $$;

-- 학번·이름 정정(잘못 입력했거나 반이 바뀐 학생). 다른 계정이 쓰는 학번이면 거부.
create or replace function public.admin_fix_enrollment(p_user uuid, p_student_no text, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  no text := btrim(coalesce(p_student_no, ''));
  nm text := btrim(coalesce(p_name, ''));
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception '없는 계정이에요' using errcode = 'P0001'; end if;
  begin
    insert into public.enrollments (user_id, school_year, student_no, name)
    values (p_user, public.current_school_year(), no, nm)
    on conflict (user_id, school_year) do update set student_no = excluded.student_no, name = excluded.name;
  exception
    when unique_violation then raise exception '이 학번은 다른 계정이 쓰고 있어요. 그 계정의 학적을 먼저 지워 주세요' using errcode = 'P0001';
    when check_violation then raise exception '학번(5자리)이나 이름 형식이 올바르지 않아요' using errcode = 'P0001';
  end;
end $$;

-- 학적 지우기(남의 학번을 잘못 등록한 계정 등). 그 학생은 다음에 열 때 학번을 다시 입력한다.
create or replace function public.admin_release_enrollment(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  delete from public.enrollments where user_id = p_user and school_year = public.current_school_year();
  if not found then raise exception '올해 등록된 학적이 없어요' using errcode = 'P0001'; end if;
end $$;

grant execute on function public.admin_find_user(text) to authenticated;
grant execute on function public.admin_fix_enrollment(uuid, text, text) to authenticated;
grant execute on function public.admin_release_enrollment(uuid) to authenticated;

-- ───────────────────────── 정식 주소 ─────────────────────────
-- main 병합 후 알림 서버는 정식 주소를 쓴다(미리보기 주소는 배포마다 바뀔 수 있음)
update public.app_config set value = 'https://unjung-app.vercel.app' where key = 'app_url';
