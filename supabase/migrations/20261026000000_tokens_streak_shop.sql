-- 운중고 앱 v3 — M3 1주차: 토큰 엔진 · 출석 스트릭 · 닉네임 · 꾸미기 상점
-- 원칙(M3 명세 0장)
--  1) 토큰은 서버 함수만 지급한다. 학생이 부를 수 있는 함수는 '행동'(출석, 구매)뿐이고, 지급량은 서버가 정한다.
--  2) 같은 이유로 두 번 받을 수 없다(token_ledger 고유키). 하루 상한은 award_capped 로 건다.
--  3) 날짜는 한국 시간. 잔액은 0 아래로 내려가지 않는다(구매 때 잠금 후 확인).

-- ───────────────────────── 공용 ─────────────────────────

create or replace function public.seoul_today()
returns date language sql stable as $$ select (now() at time zone 'Asia/Seoul')::date $$;

-- 학교 쉬는 날(공휴일·방학·재량휴업). 주말은 따로 넣지 않아도 쉬는 날로 본다. 관리자가 관리.
create table public.days_off (
  day    date primary key,
  label  text not null default ''
);

create or replace function public.is_school_day(d date)
returns boolean language sql stable as $$
  select extract(isodow from d) < 6 and not exists (select 1 from public.days_off where day = d)
$$;

-- 금칙어(닉네임·한줄평 공용). 학생은 목록을 볼 수 없고 검사 결과만 받는다.
create table public.banned_words (word text primary key);

create or replace function public.normalize_text(t text)
returns text language sql immutable as $$
  select regexp_replace(lower(coalesce(t, '')), '[^가-힣ㄱ-ㅎㅏ-ㅣa-z0-9]', '', 'g')
$$;

create or replace function public.has_banned_word(t text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.banned_words b where position(b.word in public.normalize_text(t)) > 0)
$$;

insert into public.banned_words (word) values
  -- 욕설·비하
  ('씨발'), ('시발'), ('ㅅㅂ'), ('ㅆㅂ'), ('병신'), ('븅신'), ('ㅂㅅ'), ('좆'), ('존나'), ('지랄'), ('ㅈㄹ'),
  ('개새'), ('새끼'), ('꺼져'), ('닥쳐'), ('애미'), ('애비'), ('느금'), ('니미'), ('엠창'), ('등신'), ('씹'),
  ('fuck'), ('shit'), ('bitch'),
  -- 성적 표현
  ('섹스'), ('야동'), ('보지'), ('자지'), ('sex'), ('porn'),
  -- 사칭 방지(예약어)
  ('관리자'), ('운영자'), ('검토위원'), ('선생님'), ('교장'), ('교감'), ('학생회장'), ('admin'), ('익명'), ('운중고');

-- ───────────────────────── 토큰 원장 보강 ─────────────────────────

alter table public.token_ledger add column note text;

-- 하루 상한이 있는 지급. 실제로 지급한 양을 돌려준다. (다른 서버 함수 전용)
create or replace function public.award_capped(p_user uuid, p_delta int, p_reason text, p_ref text, p_daily_cap int)
returns int language plpgsql security definer set search_path = public as $$
declare
  got int;
  give int;
begin
  perform pg_advisory_xact_lock(hashtext('ledger:' || p_user::text));
  select coalesce(sum(delta), 0) into got
    from public.token_ledger
   where user_id = p_user and reason = p_reason
     and (created_at at time zone 'Asia/Seoul')::date = public.seoul_today();
  give := least(p_delta, p_daily_cap - got);
  if give <= 0 then return 0; end if;
  if public.award_tokens(p_user, give, p_reason, p_ref) then return give; end if;
  return 0;
end $$;

revoke all on function public.award_capped(uuid, int, text, text, int) from public, anon, authenticated;

-- 관리자: 잘못 지급된 토큰 회수·보정 (기록은 남는다)
create or replace function public.admin_adjust_tokens(p_user uuid, p_delta int, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  insert into public.token_ledger (user_id, delta, reason, ref_id, note)
  values (p_user, p_delta, 'admin', gen_random_uuid()::text, nullif(btrim(p_note), ''));
end $$;

-- ───────────────────────── 꾸미기 상점 ─────────────────────────

create table public.shop_items (
  id          text primary key,
  kind        text not null check (kind in ('emoji', 'name_color', 'theme', 'badge', 'shield')),
  name        text not null,
  value       text not null,          -- 이모지 글자 / 색·테마 키(앱 tokens.ts) / 배지 문구
  price       int  not null check (price between 1 and 1000),
  sold_from   date,                   -- 시즌 한정 상품의 판매 기간
  sold_until  date,
  active      boolean not null default true,
  sort        int not null default 0
);

create table public.inventory (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  item_id      text not null references public.shop_items (id),
  acquired_at  timestamptz not null default now(),
  primary key (user_id, item_id)
);

insert into public.shop_items (id, kind, name, value, price, sort) values
  ('e_fire', 'emoji', '불꽃', '🔥', 30, 1), ('e_star', 'emoji', '별', '⭐', 30, 2), ('e_moon', 'emoji', '달', '🌙', 30, 3),
  ('e_cloud', 'emoji', '구름', '☁️', 30, 4), ('e_clover', 'emoji', '네잎클로버', '🍀', 30, 5), ('e_cat', 'emoji', '고양이', '🐱', 30, 6),
  ('e_dog', 'emoji', '강아지', '🐶', 30, 7), ('e_bear', 'emoji', '곰', '🐻', 30, 8), ('e_rabbit', 'emoji', '토끼', '🐰', 30, 9),
  ('e_fox', 'emoji', '여우', '🦊', 30, 10), ('e_penguin', 'emoji', '펭귄', '🐧', 30, 11), ('e_whale', 'emoji', '고래', '🐳', 30, 12),
  ('e_unicorn', 'emoji', '유니콘', '🦄', 30, 13), ('e_pizza', 'emoji', '피자', '🍕', 30, 14), ('e_riceball', 'emoji', '주먹밥', '🍙', 30, 15),
  ('e_donut', 'emoji', '도넛', '🍩', 30, 16), ('e_coffee', 'emoji', '커피', '☕', 30, 17), ('e_headphone', 'emoji', '헤드폰', '🎧', 30, 18),
  ('e_game', 'emoji', '게임', '🎮', 30, 19), ('e_basketball', 'emoji', '농구공', '🏀', 30, 20), ('e_soccer', 'emoji', '축구공', '⚽', 30, 21),
  ('e_palette', 'emoji', '팔레트', '🎨', 30, 22), ('e_books', 'emoji', '책', '📚', 30, 23), ('e_pencil', 'emoji', '연필', '✏️', 30, 24),
  ('e_bulb', 'emoji', '전구', '💡', 30, 25), ('e_rocket', 'emoji', '로켓', '🚀', 30, 26), ('e_rainbow', 'emoji', '무지개', '🌈', 30, 27),
  ('e_blossom', 'emoji', '벚꽃', '🌸', 30, 28), ('e_strawberry', 'emoji', '딸기', '🍓', 30, 29), ('e_crown', 'emoji', '왕관', '👑', 30, 30),
  ('c_sky', 'name_color', '하늘', 'sky', 50, 101), ('c_mint', 'name_color', '민트', 'mint', 50, 102),
  ('c_coral', 'name_color', '코랄', 'coral', 50, 103), ('c_violet', 'name_color', '바이올렛', 'violet', 50, 104),
  ('c_gold', 'name_color', '골드', 'gold', 50, 105), ('c_rose', 'name_color', '로즈', 'rose', 50, 106),
  ('c_ocean', 'name_color', '오션', 'ocean', 50, 107), ('c_forest', 'name_color', '포레스트', 'forest', 50, 108),
  ('t_dawn', 'theme', '새벽', 'dawn', 150, 201), ('t_sunset', 'theme', '노을', 'sunset', 150, 202),
  ('t_forest', 'theme', '숲', 'forest', 150, 203), ('t_sakura', 'theme', '벚꽃길', 'sakura', 150, 204),
  ('t_ocean', 'theme', '바다', 'ocean', 150, 205), ('t_night', 'theme', '운중의 밤', 'night', 150, 206),
  ('s_shield', 'shield', '스트릭 보호권', '🛡️', 40, 401);

insert into public.shop_items (id, kind, name, value, price, sold_from, sold_until, sort) values
  ('b_pioneer', 'badge', '1기 개척자', '1기 개척자', 100, null, '2026-12-31', 301),
  ('b_finals_2026', 'badge', '2학기 기말 전사', '기말 전사', 100, '2026-11-23', '2026-12-20', 302);

-- 장착한 꾸미기 (다른 학생에게 보이는 것)
alter table public.profiles
  add column equip_emoji text references public.shop_items (id),
  add column equip_color text references public.shop_items (id),
  add column equip_theme text references public.shop_items (id),
  add column equip_badge text references public.shop_items (id),
  add column hide_in_ranking boolean not null default false,
  add column nickname_changed_at timestamptz;

-- ───────────────────────── 출석 스트릭 ─────────────────────────

create table public.check_ins (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  day      date not null,
  primary key (user_id, day)
);

create table public.streaks (
  user_id   uuid primary key references public.profiles (id) on delete cascade,
  current   int not null default 0,
  best      int not null default 0,
  last_day  date,                                         -- 스트릭에 센 마지막 '학교 가는 날'
  shields   int not null default 0 check (shields between 0 and 2)
);

-- 지갑 한 번에 보기 (앱 첫 화면·지갑 화면)
create or replace function public.my_wallet()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'balance', coalesce((select sum(delta) from public.token_ledger where user_id = p.id), 0),
    'week_earned', coalesce((
      select sum(delta) from public.token_ledger
       where user_id = p.id and delta > 0 and reason <> 'admin'
         and (created_at at time zone 'Asia/Seoul')::date >= date_trunc('week', public.seoul_today())::date), 0),
    'streak', coalesce(s.current, 0),
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

-- 출석 처리 본체 (테스트에서 날짜를 바꿔 부를 수 있게 날짜를 인자로 받는다. 학생은 직접 못 부름)
--  · 하루 첫 출석 +2 (주말 포함)
--  · 스트릭은 '학교 가는 날'만 센다. 주말·쉬는 날은 빠져도 끊기지 않는다.
--  · 빠진 학교 날만큼 보호권이 있으면 자동으로 써서 이어 준다. 모자라면 1부터 다시.
--  · 스트릭이 7의 배수가 되는 날 +10
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
    end if;
  end if;

  return jsonb_build_object(
    'day', p_day, 'first_today', first_today, 'school_day', school,
    'tokens', got, 'streak', s.current, 'shields', s.shields, 'shield_used', used);
end $$;

revoke all on function public._check_in(uuid, date) from public, anon, authenticated;

-- 앱이 열릴 때 부른다. 출석 결과 + 지갑 전체를 돌려준다.
create or replace function public.check_in()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
begin
  if not public.is_school_user() or not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501';
  end if;
  r := public._check_in(auth.uid(), public.seoul_today());
  return public.my_wallet() || jsonb_build_object('checkin', r);
end $$;

-- ───────────────────────── 상점 함수 ─────────────────────────

create or replace function public.buy_item(p_item text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  it public.shop_items;
  bal int;
  held int;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('ledger:' || me::text));

  select * into it from public.shop_items
   where id = p_item and active
     and (sold_from is null or public.seoul_today() >= sold_from)
     and (sold_until is null or public.seoul_today() <= sold_until);
  if not found then raise exception '지금은 살 수 없는 상품이에요' using errcode = 'P0001'; end if;

  if it.kind = 'shield' then
    insert into public.streaks (user_id) values (me) on conflict do nothing;
    select shields into held from public.streaks where user_id = me for update;
    if held >= 2 then raise exception '스트릭 보호권은 2개까지 가질 수 있어요' using errcode = 'P0001'; end if;
  elsif exists (select 1 from public.inventory where user_id = me and item_id = it.id) then
    raise exception '이미 가지고 있어요' using errcode = 'P0001';
  end if;

  select coalesce(sum(delta), 0) into bal from public.token_ledger where user_id = me;
  if bal < it.price then
    raise exception '토큰이 부족해요 (%개 더 필요해요)', it.price - bal using errcode = 'P0001';
  end if;

  insert into public.token_ledger (user_id, delta, reason, ref_id, note)
  values (me, -it.price, 'shop', case when it.kind = 'shield' then 'shield:' || gen_random_uuid()::text else it.id end, it.name);

  if it.kind = 'shield' then
    update public.streaks set shields = shields + 1 where user_id = me;
  else
    insert into public.inventory (user_id, item_id) values (me, it.id);
  end if;
  return public.my_wallet();
end $$;

-- 장착·해제 (p_item 이 null 이면 해제)
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
  return public.my_wallet();
end $$;

-- ───────────────────────── 닉네임 ─────────────────────────
-- 2~10자, 한글·영문·숫자·_ 만, 금칙어·예약어 불가, 다른 학생과 겹치면 불가, 30일에 한 번 변경(첫 설정은 언제나)

alter table public.profiles drop constraint if exists profiles_nickname_check;
alter table public.profiles add constraint profiles_nickname_format check (nickname ~ '^[가-힣A-Za-z0-9_]{2,10}$');
create unique index profiles_nickname_unique on public.profiles (lower(nickname));

-- 예전 함수(반환형 void)를 지우고 지갑을 돌려주는 새 함수로 바꾼다
drop function if exists public.set_nickname(text);

create or replace function public.set_nickname(p_nickname text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n text := btrim(coalesce(p_nickname, ''));
  cur public.profiles;
  next_ok timestamptz;
begin
  if not public.is_school_user() then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  select * into cur from public.profiles where id = me for update;
  if cur.nickname is not null and cur.nickname = n then return public.my_wallet(); end if;
  if n !~ '^[가-힣A-Za-z0-9_]{2,10}$' then
    raise exception '닉네임은 한글·영문·숫자·_ 로 2~10자예요' using errcode = 'P0001';
  end if;
  if public.has_banned_word(n) then
    raise exception '사용할 수 없는 단어가 들어 있어요' using errcode = 'P0001';
  end if;
  if cur.nickname is not null and cur.nickname_changed_at is not null
     and cur.nickname_changed_at > now() - interval '30 days' then
    next_ok := cur.nickname_changed_at + interval '30 days';
    raise exception '닉네임은 30일에 한 번 바꿀 수 있어요 (%부터 가능)',
      to_char(next_ok at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일"') using errcode = 'P0001';
  end if;
  begin
    update public.profiles set nickname = n, nickname_changed_at = now() where id = me;
  exception when unique_violation then
    raise exception '이미 다른 학생이 쓰는 닉네임이에요' using errcode = 'P0001';
  end;
  return public.my_wallet();
end $$;

create or replace function public.set_ranking_hidden(p_hidden boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_user() then raise exception '로그인이 필요해요' using errcode = '42501'; end if;
  update public.profiles set hide_in_ranking = coalesce(p_hidden, false) where id = auth.uid();
  return public.my_wallet();
end $$;

-- 관리자: 부적절한 닉네임 지우기 (학생은 바로 새로 정할 수 있다)
create or replace function public.admin_clear_nickname(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  update public.profiles set nickname = null, nickname_changed_at = null where id = p_user;
end $$;

-- 관리자: 쉬는 날 등록·삭제
create or replace function public.admin_set_day_off(p_day date, p_label text, p_off boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  if p_off then
    insert into public.days_off (day, label) values (p_day, coalesce(p_label, ''))
    on conflict (day) do update set label = excluded.label;
  else
    delete from public.days_off where day = p_day;
  end if;
end $$;

-- 다른 학생에게 보이는 카드: 닉네임·역할 + 장착한 꾸미기 (이메일·실명·학번은 없음)
create or replace view public.profile_cards as
  select id, nickname, role, equip_emoji, equip_color, equip_theme, equip_badge, hide_in_ranking
    from public.profiles where public.is_school_user();
revoke all on public.profile_cards from public, anon;
grant select on public.profile_cards to authenticated;

-- ───────────────────────── 권한(RLS) ─────────────────────────

alter table public.days_off enable row level security;
alter table public.banned_words enable row level security;
alter table public.shop_items enable row level security;
alter table public.inventory enable row level security;
alter table public.check_ins enable row level security;
alter table public.streaks enable row level security;

create policy days_off_read on public.days_off for select using (public.is_school_user());
create policy shop_items_read on public.shop_items for select using (public.is_school_user());
create policy inventory_read_own on public.inventory for select using (user_id = auth.uid());
create policy check_ins_read_own on public.check_ins for select using (user_id = auth.uid());
create policy streaks_read_own on public.streaks for select using (user_id = auth.uid());
-- banned_words: 정책 없음 = 학생은 읽을 수 없음

revoke all on function public.has_banned_word(text) from public, anon;
grant execute on function public.has_banned_word(text) to authenticated;
grant execute on function public.my_wallet() to authenticated;
grant execute on function public.check_in() to authenticated;
grant execute on function public.buy_item(text) to authenticated;
grant execute on function public.equip_item(text, text) to authenticated;
grant execute on function public.set_nickname(text) to authenticated;
grant execute on function public.set_ranking_hidden(boolean) to authenticated;
grant execute on function public.admin_adjust_tokens(uuid, int, text) to authenticated;
grant execute on function public.admin_clear_nickname(uuid) to authenticated;
grant execute on function public.admin_set_day_off(date, text, boolean) to authenticated;
