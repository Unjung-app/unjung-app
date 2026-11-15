-- 11-12 호원 요청: 확인·승인이 필요한 일을 바로 알 수 있게
--  · my_todo(): 내 권한으로 처리할 일 개수(새 앱 의견 · 검토 대기 공지 · 숨겨진 한줄평 · 분실물 사진 · 신고된 건의 · 설문 신청 · 학번 정정 · 새 익명 건의)
--    → 홈 '처리할 일' 카드, 전체 탭 숫자 배지, 앱 아이콘 숫자 배지
--  · 새 익명 건의는 '마지막으로 본 때' 이후 올라온 것(mark_seen)
--  · 업무 알림 묶음 간격 30분 → 10분(같은 종류가 몰려도 10분에 한 번)
-- 여러 번 실행해도 안전

create table if not exists public.staff_seen (
  user_id uuid not null references public.profiles (id) on delete cascade,
  key     text not null check (key ~ '^[a-z_]{2,30}$'),
  seen_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.staff_seen enable row level security; -- 함수로만

create or replace function public.mark_seen(p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_user() then return; end if;
  insert into public.staff_seen (user_id, key, seen_at) values (auth.uid(), p_key, now())
  on conflict (user_id, key) do update set seen_at = now();
end $$;
revoke all on function public.mark_seen(text) from public, anon;
grant execute on function public.mark_seen(text) to authenticated;

create or replace function public.my_todo()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r text;
  admin boolean;
  reviewer boolean;
  planner boolean := public.is_planner();
  dev boolean := public.is_developer();
  out jsonb := '{}';
  n int;
begin
  if not public.is_school_user() then return '{}'; end if;
  select role into r from public.profiles where id = me;
  admin := r = 'admin';
  reviewer := r in ('reviewer', 'admin');

  if admin or dev then
    select count(*) into n from public.feedback f
     where f.status = 'new' and (admin or f.screen like 'game:%');
    out := out || jsonb_build_object('feedback', n);
  end if;
  if reviewer then
    out := out || jsonb_build_object(
      'notices', (select count(*) from public.notices where status = 'pending'),
      'lost_photos', (select count(*) from public.lost_items where photo_status = 'pending'),
      'meal_reports', (select count(*) from public.meal_review_mod_queue where hidden));
  end if;
  if planner then
    out := out || jsonb_build_object(
      'survey_requests', (select count(*) from public.surveys where status = 'requested'),
      'suggestion_reports', (select count(*) from public.suggestion_mod_queue),
      'suggestions_new', (select count(*) from public.suggestions s
                           where s.status = 'open'
                             and s.created_at > coalesce((select seen_at from public.staff_seen where user_id = me and key = 'suggestions'), now() - interval '7 days')));
  end if;
  if admin and to_regclass('public.enrollment_requests') is not null then
    execute 'select count(*) from public.enrollment_requests where status = ''pending''' into n;
    out := out || jsonb_build_object('enrollment', n);
  end if;
  return out || jsonb_build_object('total', (select coalesce(sum(v::int), 0) from jsonb_each_text(out) x(k, v)));
end $$;
revoke all on function public.my_todo() from public, anon;
grant execute on function public.my_todo() to authenticated;

-- 업무 알림: 같은 종류는 10분에 한 번(전에는 30분)
create or replace function public._push_staff(p_group text, p_event text, p_title text, p_body text, p_url text, p_game text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  bucket text := to_char(date_trunc('hour', now()) + floor(extract(minute from now()) / 10) * interval '10 minutes', 'YYYYMMDDHH24MI');
  u uuid;
begin
  for u in select distinct x from public._staff_users(p_group, p_game) x loop
    perform public.push_to(u, 'staff', p_event || ':' || bucket, p_title, p_body, p_url);
  end loop;
exception when others then
  raise notice '업무 알림 실패: %', sqlerrm; -- 알림이 실패해도 글쓰기는 그대로
end $$;
revoke all on function public._push_staff(text, text, text, text, text, text) from public, anon, authenticated;
