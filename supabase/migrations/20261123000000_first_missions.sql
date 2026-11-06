-- 출시 기념 '첫걸음 미션' (호원 제안 11-06): 앱의 여러 기능을 한 번씩 써 보게 하는 1회성 미션.
--  · 미션마다 실제 기록이 있어야 완료(누르기만 해서는 못 받음). 저장 공간을 많이 쓰는 기능(공지·분실물·사진·건의)은 넣지 않는다.
--  · 미션 하나 +5, 모두 끝내면 +20. 출시 이벤트 기간에만 받을 수 있다(기간은 app_config 'launch_event'). 부스트 2배는 붙지 않는다.

create or replace function public._first_mission_status(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_array(
    jsonb_build_object('id', 'nickname', 'done', exists (select 1 from public.profiles where id = p_user and nickname is not null)),
    jsonb_build_object('id', 'push',     'done', exists (select 1 from public.push_subscriptions where user_id = p_user)),
    jsonb_build_object('id', 'meal',     'done', exists (select 1 from public.meal_reviews where user_id = p_user)),
    jsonb_build_object('id', 'study',    'done', exists (select 1 from public.study_daily where user_id = p_user and ranked_seconds + class_seconds >= 600)),
    jsonb_build_object('id', 'group',    'done', exists (select 1 from public.study_group_members where user_id = p_user)),
    jsonb_build_object('id', 'game',     'done', exists (select 1 from public.game_runs where user_id = p_user and finished_at is not null)),
    jsonb_build_object('id', 'survey',   'done', exists (select 1 from public.survey_responses where user_id = p_user)),
    jsonb_build_object('id', 'shop',     'done', exists (select 1 from public.inventory where user_id = p_user)),
    jsonb_build_object('id', 'feedback', 'done', exists (select 1 from public.feedback where user_id = p_user))
  )
$$;
revoke all on function public._first_mission_status(uuid) from public, anon, authenticated;

-- 내 첫걸음 미션: 각 미션 완료·보상 여부, 이벤트 진행 중인지
create or replace function public.first_missions()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  got text[];
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  select coalesce(array_agg(ref_id), '{}') into got from public.token_ledger where user_id = me and reason in ('first_mission', 'first_mission_all');
  return jsonb_build_object(
    'active', public._launch_active(),
    'reward', 5,
    'bonus', 20,
    'bonus_claimed', 'all' = any (got),
    'missions', (select jsonb_agg(m || jsonb_build_object('claimed', (m->>'id') = any (got))) from jsonb_array_elements(public._first_mission_status(me)) m));
end $$;
revoke all on function public.first_missions() from public, anon;
grant execute on function public.first_missions() to authenticated;

-- 끝낸 미션 보상을 한꺼번에 받기. 받은 토큰 수를 돌려준다
create or replace function public.claim_first_missions()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m jsonb;
  total int := 0;
  n int := 0;
  all_done boolean := true;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if (public.enrollment_of(me)).user_id is null then raise exception '학번을 먼저 등록해 주세요' using errcode = 'P0001'; end if;
  if not public._launch_active() then raise exception '첫걸음 미션은 출시 이벤트 기간에만 받을 수 있어요' using errcode = 'P0001'; end if;
  for m in select * from jsonb_array_elements(public._first_mission_status(me)) loop
    if (m->>'done')::boolean then
      if public.award_tokens(me, 5, 'first_mission', m->>'id') then total := total + 5; n := n + 1; end if;
    else
      all_done := false;
    end if;
  end loop;
  if all_done and public.award_tokens(me, 20, 'first_mission_all', 'all') then total := total + 20; end if;
  return jsonb_build_object('tokens', total, 'missions', n, 'all_done', all_done);
end $$;
revoke all on function public.claim_first_missions() from public, anon;
grant execute on function public.claim_first_missions() to authenticated;
