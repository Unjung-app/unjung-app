-- 11-09 학생 의견 #44: 의견은 하루 10개까지, 한국 시각 밤 12시에 다시 센다(전에는 보낸 시각부터 24시간·5개)
-- 여러 번 실행해도 안전
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
  if (select count(*) from public.feedback where user_id = me and (created_at at time zone 'Asia/Seoul')::date = public.seoul_today()) >= 10 then
    raise exception '하루에 10개까지 보낼 수 있어요 · 밤 12시에 다시 열려요' using errcode = 'P0001';
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
