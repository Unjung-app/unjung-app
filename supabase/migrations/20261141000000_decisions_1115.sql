-- 11-15 호원 결정
--  · #89 반 대항 순위: 반 평균을 '이번 주에 앱을 쓴 학생 수'로 나눈다(전에는 학번을 등록한 학생 전체)
--  · #102 #103 꾸미기 환불: 산 지 24시간 안, 한 번도 직접 끼지 않은 상품만 산 값 그대로 돌려준다(보호권·배지 제외)
--    상점은 사자마자 자동으로 끼워 주므로 그 자동 착용은 '낀 것'으로 치지 않는다. 환불하면 벗겨진다
--    환불은 token_ledger에 reason 'admin'(note '꾸미기 환불')으로 넣어 '이번 주 모은 토큰' 순위에 잡히지 않게 한다
--  · #98 앱 의견에 '질문' 종류 추가(답변만 하고 토큰은 주지 않음)
-- 여러 번 실행해도 안전

alter table public.inventory add column if not exists ever_equipped boolean not null default false;

alter table public.feedback drop constraint if exists feedback_kind_check;
alter table public.feedback add constraint feedback_kind_check check (kind in ('bug', 'idea', 'question', 'other'));

create or replace function public.ranking(p_kind text, p_grade int, p_week_start date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  ws date := date_trunc('week', p_week_start)::date;
  we date := date_trunc('week', p_week_start)::date + 6;
  yr int := public.current_school_year();
  me uuid := auth.uid();
  result jsonb;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if p_kind not in ('study', 'tokens') or p_grade not between 1 and 3 then
    raise exception '잘못된 요청이에요' using errcode = 'P0001';
  end if;

  with members as (
    select e.user_id, e.class_no from public.enrollments e where e.school_year = yr and e.grade = p_grade
  ),
  -- 이번 주에 앱을 한 번이라도 쓴 학생(출석·공부 등 토큰 기록이 있거나 공부 기록이 있음)
  active as (
    select m.user_id from members m
     where exists (select 1 from public.token_ledger l where l.user_id = m.user_id
                    and (l.created_at at time zone 'Asia/Seoul')::date between ws and we)
        or exists (select 1 from public.study_daily d where d.user_id = m.user_id and d.day between ws and we)
  ),
  scores as (
    select m.user_id, m.class_no,
           case when p_kind = 'study' then
             coalesce((select sum(d.ranked_seconds) from public.study_daily d
                        where d.user_id = m.user_id and d.day between ws and we), 0)
           else
             coalesce((select sum(l.delta) from public.token_ledger l
                        where l.user_id = m.user_id and l.delta > 0 and l.reason <> 'admin'
                          and (l.created_at at time zone 'Asia/Seoul')::date between ws and we), 0)
           end::bigint as score
      from members m
  ),
  -- 반 평균 = 반 합계 ÷ 이번 주에 앱을 쓴 학생 수(학생 의견 #89: 깔고 안 쓰는 학생 때문에 평균이 깎이지 않게). 5명 미만이면 순위 제외
  classes as (
    select c.class_no,
           count(s.user_id)::int as members,
           coalesce(sum(s.score), 0)::bigint as total,
           case when count(s.user_id) > 0 then round(coalesce(sum(s.score), 0)::numeric / count(s.user_id))::bigint else 0 end as avg,
           count(s.user_id) >= 5 as eligible
      from generate_series(1, 8) as c(class_no)
      left join scores s on s.class_no = c.class_no and s.user_id in (select user_id from active)
     group by c.class_no
  ),
  ranked_classes as (
    select *, case when eligible then rank() over (partition by eligible order by avg desc) end as rank from classes
  ),
  top as (
    select s.user_id, s.score, rank() over (order by s.score desc) as rank
      from scores s where s.score > 0
     order by s.score desc limit 10
  )
  select jsonb_build_object(
    'kind', p_kind, 'grade', p_grade, 'week_start', ws, 'week_end', we,
    'classes', (select jsonb_agg(jsonb_build_object(
                  'class_no', class_no, 'members', members, 'total', total, 'avg', avg, 'eligible', eligible, 'rank', rank,
                  'mine', exists (select 1 from members m where m.user_id = me and m.class_no = rc.class_no))
                  order by eligible desc, avg desc, class_no) from ranked_classes rc),
    'top', coalesce((select jsonb_agg(jsonb_build_object(
                  'rank', t.rank, 'score', t.score, 'mine', t.user_id = me,
                  'nickname', case when p.hide_in_ranking then null else p.nickname end,
                  'hidden', p.hide_in_ranking or p.nickname is null,
                  'equip', case when p.hide_in_ranking then null else jsonb_build_object(
                     'emoji', p.equip_emoji, 'name_color', p.equip_color, 'theme', p.equip_theme, 'badge', p.equip_badge) end)
                  order by t.rank, t.score desc) from top t join public.profiles p on p.id = t.user_id), '[]'::jsonb),
    'me', (select jsonb_build_object(
              'score', s.score,
              'rank', case when s.score > 0 then (select count(*) from scores x where x.score > s.score) + 1 end,
              'of', (select count(*) from scores x where x.score > 0))
             from scores s where s.user_id = me),
    'participants', (select count(*) from scores where score > 0)
  ) into result;
  return result;
end $$;

create or replace function public.equip_item(p_kind text, p_item text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if p_kind not in ('emoji', 'name_color', 'theme', 'badge') then
    raise exception '장착할 수 없는 종류예요' using errcode = 'P0001';
  end if;
  if p_item is not null and not exists (
    select 1 from public.inventory i join public.shop_items s on s.id = i.item_id
     where i.user_id = me and i.item_id = p_item and s.kind = p_kind) then
    raise exception '가지고 있지 않은 상품이에요' using errcode = 'P0001';
  end if;
  update public.profiles set
    equip_emoji = case when p_kind = 'emoji' then p_item else equip_emoji end,
    equip_color = case when p_kind = 'name_color' then p_item else equip_color end,
    equip_theme = case when p_kind = 'theme' then p_item else equip_theme end,
    equip_badge = case when p_kind = 'badge' then p_item else equip_badge end
  where id = me;
  -- 한 번이라도 직접 낀 상품은 환불할 수 없다(상점에서 사자마자 자동으로 끼워지는 것은 치지 않음: 산 지 1분 안)
  if p_item is not null then
    update public.inventory set ever_equipped = true where user_id = me and item_id = p_item and acquired_at < now() - interval '1 minute';
  end if;
  return public.my_wallet();
end $$;

-- 환불할 수 있는 상품(상점 화면에 '환불' 버튼)
create or replace function public.my_refundables()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('item', i.item_id, 'until', i.acquired_at + interval '24 hours', 'price', s.price) order by i.acquired_at), '[]')
    from public.inventory i join public.shop_items s on s.id = i.item_id
   where i.user_id = auth.uid() and public.is_school_user()
     and i.acquired_at > now() - interval '24 hours' and not i.ever_equipped
     and s.kind in ('emoji', 'name_color', 'theme')
$$;
revoke all on function public.my_refundables() from public, anon;
grant execute on function public.my_refundables() to authenticated;

create or replace function public.refund_item(p_item text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  paid int;
  nm text;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('ledger:' || me::text));
  if not exists (select 1 from jsonb_array_elements(public.my_refundables()) x where x ->> 'item' = p_item) then
    raise exception '환불은 산 지 24시간 안, 한 번도 직접 끼지 않은 상품만 할 수 있어요' using errcode = 'P0001';
  end if;
  -- 실제로 낸 값(가격이 바뀌었을 수 있어 구매 기록에서 찾는다)
  select -l.delta, l.note into paid, nm from public.token_ledger l
   where l.user_id = me and l.reason = 'shop' and l.ref_id = p_item order by l.created_at desc limit 1;
  if paid is null or paid <= 0 then raise exception '구매 기록을 찾을 수 없어요' using errcode = 'P0001'; end if;
  delete from public.inventory where user_id = me and item_id = p_item;
  -- 사자마자 자동으로 끼워져 있던 것이면 벗긴다
  update public.profiles set
    equip_emoji = case when equip_emoji = p_item then null else equip_emoji end,
    equip_color = case when equip_color = p_item then null else equip_color end,
    equip_theme = case when equip_theme = p_item then null else equip_theme end
  where id = me;
  insert into public.token_ledger (user_id, delta, reason, ref_id, note)
  values (me, paid, 'admin', 'refund:' || p_item || ':' || extract(epoch from now())::bigint, '꾸미기 환불: ' || coalesce(nm, p_item));
  return public.my_wallet();
end $$;
revoke all on function public.refund_item(text) from public, anon;
grant execute on function public.refund_item(text) to authenticated;

create or replace function public.submit_feedback(p_kind text, p_body text, p_screen text, p_app_version text, p_device text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  b text := btrim(coalesce(p_body, ''));
  rid bigint;
  bonus int := 0;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if p_kind not in ('bug', 'idea', 'question', 'other') then raise exception '종류를 골라 주세요' using errcode = 'P0001'; end if;
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

create or replace function public.admin_update_feedback(p_id bigint, p_status text, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
declare
  author uuid;
  admin boolean := public.is_admin();
begin
  if not (admin or public.is_developer()) then raise exception '관리자·개발자만 할 수 있어요' using errcode = '42501'; end if;
  if p_status not in ('new', 'seen', 'done', 'wontfix') then raise exception '잘못된 상태예요' using errcode = 'P0001'; end if;
  if not admin then
    if p_status not in ('new', 'seen') then raise exception '반영 완료·보류는 관리자만 할 수 있어요' using errcode = '42501'; end if;
    if not exists (select 1 from public.feedback where id = p_id and screen like 'game:%') then
      raise exception '개발자는 게임 의견만 처리할 수 있어요' using errcode = '42501';
    end if;
  end if;
  update public.feedback set status = p_status, reply = nullif(btrim(coalesce(p_reply, '')), ''), updated_at = now()
   where id = p_id returning user_id into author;
  if not found then raise exception '없는 의견이에요' using errcode = 'P0001'; end if;
  -- 질문에 답한 것은 '반영'이 아니라서 토큰을 주지 않는다
  if p_status = 'done' and coalesce((select kind from public.feedback where id = p_id), '') <> 'question' then
    perform public.award_tokens(author, 10, 'feedback_done', p_id::text);
  end if;
end $$;
