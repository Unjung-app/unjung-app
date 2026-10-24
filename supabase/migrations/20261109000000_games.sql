-- 운중고 앱 v3 — 게임 3종 (호원 결정 10-24)
--  ① 영단어 러시(60초) ② 암산 챌린지(60초) ③ 운중 라이프 퀴즈(90초: 급식·학사일정·우리 반 시간표·일과표·앱 규칙)
--  · 문제와 정답은 서버가 만들고, 앱에는 정답 없이 보낸다. 채점도 서버가 한다(점수 조작 불가).
--  · 비용: 하루 첫 판 무료, 이후 판당 5토큰, 하루 최대 10판. 수업 시간(우리 반 실제 시간표)에는 시작 불가.
--  · 보상: 이번 주 내 최고 기록을 넘기면 +2(게임별 하루 1번), 주간 학교 전체 1~3위 +30/+20/+10, 1위는 '주간 게임왕' 배지.
--  · 게임 랭킹은 게임 화면 안에서만 보인다(다른 랭킹과 분리).

-- ───────────────────────── 단어장 (고교 기본 어휘, 직접 작성) ─────────────────────────

create table public.game_words (
  id       int generated always as identity primary key,
  word     text not null unique,
  meaning  text not null
);

insert into public.game_words (word, meaning) values
('abandon','버리다'),('ability','능력'),('absorb','흡수하다'),('abstract','추상적인'),('abundant','풍부한'),
('accept','받아들이다'),('access','접근'),('accompany','동반하다'),('accomplish','성취하다'),('accurate','정확한'),
('achieve','달성하다'),('acquire','얻다, 습득하다'),('adapt','적응하다'),('adequate','충분한'),('adjust','조정하다'),
('admire','존경하다'),('admit','인정하다'),('adopt','채택하다'),('advantage','이점'),('affect','영향을 미치다'),
('aggressive','공격적인'),('alter','바꾸다'),('alternative','대안'),('ambiguous','모호한'),('analyze','분석하다'),
('ancient','고대의'),('anxiety','불안'),('apparent','명백한'),('appreciate','감사하다, 진가를 알다'),('approach','접근하다'),
('appropriate','적절한'),('approve','승인하다'),('arrange','배열하다'),('artificial','인공의'),('aspect','측면'),
('assess','평가하다'),('assign','배정하다'),('assume','가정하다'),('attach','붙이다'),('attempt','시도하다'),
('attitude','태도'),('attract','끌어들이다'),('authority','권위'),('available','이용 가능한'),('avoid','피하다'),
('aware','알고 있는'),('barrier','장벽'),('behavior','행동'),('benefit','이익'),('bias','편견'),
('boundary','경계'),('brief','짧은'),('burden','부담'),('capable','~할 수 있는'),('capacity','수용력'),
('category','범주'),('cease','멈추다'),('challenge','도전'),('character','성격, 등장인물'),('circumstance','상황'),
('claim','주장하다'),('collapse','붕괴하다'),('colleague','동료'),('combine','결합하다'),('commit','저지르다, 전념하다'),
('community','공동체'),('compare','비교하다'),('compete','경쟁하다'),('complex','복잡한'),('component','구성 요소'),
('concentrate','집중하다'),('concept','개념'),('conclude','결론을 내리다'),('conduct','수행하다'),('conflict','갈등'),
('consequence','결과'),('conserve','보존하다'),('consider','고려하다'),('consistent','일관된'),('constant','끊임없는'),
('construct','건설하다'),('consume','소비하다'),('contain','포함하다'),('contemporary','현대의'),('context','맥락'),
('contrast','대조'),('contribute','기여하다'),('convenient','편리한'),('convince','설득하다'),('cooperate','협력하다'),
('crucial','결정적인'),('curious','호기심 많은'),('decline','감소하다, 거절하다'),('dedicate','헌신하다'),('define','정의하다'),
('demand','요구하다'),('demonstrate','증명하다'),('deny','부인하다'),('depend','의존하다'),('describe','묘사하다'),
('deserve','~할 자격이 있다'),('desire','욕구'),('destroy','파괴하다'),('determine','결정하다'),('develop','개발하다'),
('device','장치'),('devote','바치다'),('diverse','다양한'),('domestic','국내의, 가정의'),('dominate','지배하다'),
('eager','열망하는'),('efficient','효율적인'),('eliminate','제거하다'),('emerge','나타나다'),('emotion','감정'),
('emphasize','강조하다'),('encourage','격려하다'),('enormous','거대한'),('ensure','보장하다'),('environment','환경'),
('equivalent','동등한'),('essential','필수적인'),('establish','설립하다'),('estimate','추정하다'),('evaluate','평가하다'),
('evidence','증거'),('evolve','진화하다'),('exaggerate','과장하다'),('examine','조사하다'),('exceed','초과하다'),
('exclude','제외하다'),('expand','확장하다'),('expert','전문가'),('explore','탐험하다'),('expose','노출시키다'),
('factor','요인'),('feature','특징'),('flexible','유연한'),('focus','집중하다'),('former','이전의'),
('fundamental','근본적인'),('generate','만들어 내다'),('genuine','진짜의'),('gradual','점진적인'),('guarantee','보장하다'),
('habit','습관'),('hesitate','망설이다'),('identify','확인하다'),('ignore','무시하다'),('illustrate','설명하다'),
('immediate','즉각적인'),('impact','영향'),('imply','암시하다'),('impose','부과하다'),('improve','향상시키다'),
('include','포함하다'),('indicate','나타내다'),('individual','개인'),('influence','영향'),('inherit','물려받다'),
('initial','처음의'),('innovation','혁신'),('insight','통찰력'),('inspire','영감을 주다'),('instance','사례'),
('intend','의도하다'),('interpret','해석하다'),('investigate','조사하다'),('involve','포함하다, 관련시키다'),('isolate','고립시키다'),
('maintain','유지하다'),('major','주요한'),('manufacture','제조하다'),('meaningful','의미 있는'),('mental','정신의'),
('method','방법'),('minimize','최소화하다'),('modify','수정하다'),('motivate','동기를 부여하다'),('negative','부정적인'),
('neglect','무시하다, 방치하다'),('numerous','수많은'),('objective','목표, 객관적인'),('obtain','얻다'),('obvious','분명한'),
('occupy','차지하다'),('occur','발생하다'),('opportunity','기회'),('oppose','반대하다'),('organize','조직하다'),
('participate','참여하다'),('perceive','인식하다'),('permanent','영구적인'),('persuade','설득하다'),('phenomenon','현상'),
('potential','잠재력'),('precise','정밀한'),('predict','예측하다'),('prefer','선호하다'),('preserve','보존하다'),
('prevent','막다'),('previous','이전의'),('principle','원리'),('priority','우선순위'),('proceed','나아가다'),
('profound','심오한'),('promote','촉진하다'),('proper','적절한'),('propose','제안하다'),('protect','보호하다'),
('pursue','추구하다'),('rare','드문'),('rational','이성적인'),('recognize','알아보다'),('recover','회복하다'),
('reduce','줄이다'),('reflect','반영하다, 반사하다'),('reject','거절하다'),('relevant','관련 있는'),('reluctant','꺼리는'),
('remarkable','놀라운'),('remove','제거하다'),('represent','나타내다, 대표하다'),('require','필요로 하다'),('resemble','닮다'),
('resist','저항하다'),('resolve','해결하다'),('resource','자원'),('respond','반응하다'),('restore','복원하다'),
('restrict','제한하다'),('reveal','드러내다'),('rigid','엄격한'),('sacrifice','희생'),('significant','중요한'),
('similar','비슷한'),('sincere','진실한'),('solid','단단한'),('specific','구체적인'),('stable','안정된'),
('strategy','전략'),('substitute','대체하다'),('sufficient','충분한'),('suggest','제안하다'),('superior','우월한'),
('suppose','가정하다'),('survive','살아남다'),('sustain','지속시키다'),('temporary','일시적인'),('tend','경향이 있다'),
('theory','이론'),('tolerate','참다'),('transform','변형시키다'),('transmit','전송하다'),('trigger','유발하다'),
('ultimate','궁극적인'),('undergo','겪다'),('unique','독특한'),('valid','유효한'),('vary','다르다, 변하다'),
('vast','광대한'),('verify','확인하다'),('visible','보이는'),('vital','필수적인'),('voluntary','자발적인'),
('vulnerable','취약한'),('wander','돌아다니다'),('widespread','널리 퍼진'),('withdraw','철회하다'),('witness','목격하다');

-- 1위 배지(판매하지 않음, 주간 게임왕에게만 지급)
insert into public.shop_items (id, kind, name, value, price, active, sort)
values ('b_gameking', 'badge', '주간 게임왕', '게임왕 👑', 1000, false, 399);

-- ───────────────────────── 기록 ─────────────────────────

create table public.game_runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  game         text not null check (game in ('word', 'math', 'life')),
  grade        smallint not null,
  class_no     smallint not null,
  started_at   timestamptz not null,
  finished_at  timestamptz,
  duration_s   int not null,
  questions    jsonb not null,           -- 정답(a) 포함. 학생에게는 정답을 뺀 것만 보낸다
  cost         int not null default 0,
  answers      jsonb not null default '[]',  -- 푼 순서대로 [{c: 고른 번호, ok: 정답 여부}]
  combo        int not null default 0,
  score        int not null default 0,
  last_answer_at timestamptz
);
create index game_runs_by_user on public.game_runs (user_id, started_at desc);
create index game_runs_by_game on public.game_runs (game, started_at) where score > 0;

-- ───────────────────────── 문제 만들기 ─────────────────────────

-- 4지선다 하나: 정답 + 오답 3개를 섞는다. a = 정답 위치
create or replace function public._mc(p_q text, p_correct text, p_wrong text[])
returns jsonb language plpgsql volatile as $$
declare
  opts text[];
begin
  select array_agg(x order by random()) into opts
    from (select p_correct as x
          union all
          (select w from (select distinct w from unnest(p_wrong) w where w is not null and w <> p_correct) d order by random() limit 3)) t;
  if array_length(opts, 1) < 4 then return null; end if;
  return jsonb_build_object('q', p_q, 'choices', to_jsonb(opts), 'a', array_position(opts, p_correct) - 1);
end $$;

create or replace function public._q_word(n int)
returns jsonb language sql volatile as $$
  select coalesce(jsonb_agg(x) filter (where x is not null), '[]')
    from (select public._mc(w.word, w.meaning,
                   array(select o.meaning from public.game_words o where o.id <> w.id order by random() limit 6)) as x
            from (select * from public.game_words order by random() limit n) w) t
$$;

create or replace function public._q_math(n int)
returns jsonb language plpgsql volatile as $$
declare
  out jsonb := '[]';
  i int; a int; b int; c int; ans int; q text; item jsonb;
begin
  for i in 0 .. n - 1 loop
    if i < 6 then            -- 두 자리 덧셈·뺄셈
      a := 10 + floor(random() * 90); b := 10 + floor(random() * 90);
      if random() < 0.5 then ans := a + b; q := a || ' + ' || b; else
        if a < b then c := a; a := b; b := c; end if; ans := a - b; q := a || ' − ' || b; end if;
    elsif i < 12 then        -- 곱셈
      a := 3 + floor(random() * 17); b := 3 + floor(random() * 7); ans := a * b; q := a || ' × ' || b;
    elsif i < 18 then        -- 나눗셈(나누어떨어짐)
      b := 3 + floor(random() * 10); ans := 3 + floor(random() * 17); a := b * ans; q := a || ' ÷ ' || b;
    else                     -- 섞어서
      a := 2 + floor(random() * 12); b := 2 + floor(random() * 9); c := 10 + floor(random() * 80);
      if random() < 0.5 then ans := a * b + c; q := a || ' × ' || b || ' + ' || c; else ans := a * b - c; q := a || ' × ' || b || ' − ' || c; end if;
    end if;
    item := public._mc(q, ans::text,
             array[(ans + 1)::text, (ans - 1)::text, (ans + 10)::text, (ans - 10)::text, (ans + 2)::text, (ans + b)::text]);
    if item is not null then out := out || jsonb_build_array(item); end if;
  end loop;
  return out;
end $$;

-- 학교생활 퀴즈: 동기화된 학교 데이터(급식·학사일정·우리 반 시간표)로 만들고, 모자라면 일과표·앱 규칙 문제로 채운다
create or replace function public._q_life(p_grade int, p_class int, p_now timestamptz)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  today date := (p_now at time zone 'Asia/Seoul')::date;
  dow text[] := array['월', '화', '수', '목', '금', '토', '일'];
  out jsonb := '[]';
  r record;
  item jsonb;
  dlabel text;
begin
  -- 급식: 그날 점심에 나온/나올 메뉴
  for r in select m.day, m.dishes from public.meals_cache m
            where m.code = 2 and m.day between today - 3 and today + 7 order by random() limit 4 loop
    dlabel := extract(month from r.day) || '/' || extract(day from r.day) || '(' || dow[extract(isodow from r.day)::int] || ')';
    item := public._mc(dlabel || (case when r.day < today then ' 점심에 나온' when r.day = today then ' 오늘 점심' else ' 점심에 나올' end) || ' 메뉴는?',
              (select d from unnest(r.dishes) d where d !~ '밥$|김치$|깍두기$' order by random() limit 1),
              array(select distinct d from public.meals_cache m2, unnest(m2.dishes) d
                     where m2.code = 2 and m2.day <> r.day and d <> all (r.dishes) and d !~ '밥$|김치$|깍두기$' limit 12));
    if item is not null and item->>'a' is not null then out := out || jsonb_build_array(item); end if;
  end loop;

  -- 학사일정 D-day
  for r in select e.day, e.name from public.school_events e
            where e.day > today and e.day <= today + 120 and not e.holiday order by random() limit 3 loop
    item := public._mc('''' || r.name || '''까지 며칠 남았을까요?', 'D-' || (r.day - today),
              array['D-' || (r.day - today + 1), 'D-' || (r.day - today - 1), 'D-' || (r.day - today + 7), 'D-' || greatest(1, r.day - today - 7), 'D-' || (r.day - today + 3)]);
    if item is not null then out := out || jsonb_build_array(item); end if;
  end loop;

  -- 우리 반 시간표
  for r in select l.day, l.period, l.subject from public.class_lessons l
            where l.grade = p_grade and l.class_no = p_class and l.day between today and today + 10 order by random() limit 4 loop
    dlabel := extract(month from r.day) || '/' || extract(day from r.day) || '(' || dow[extract(isodow from r.day)::int] || ')';
    item := public._mc(dlabel || ' 우리 반 ' || r.period || '교시 과목은?', r.subject,
              array(select distinct l2.subject from public.class_lessons l2
                     where l2.grade = p_grade and l2.class_no = p_class and l2.subject <> r.subject limit 8));
    if item is not null then out := out || jsonb_build_array(item); end if;
  end loop;

  -- 일과표·앱 규칙 (늘 있는 문제)
  out := out || jsonb_build_array(
    public._mc(case when p_grade = 3 then '3학년 점심시간은 몇 시에 시작할까요?' else '1·2학년 점심시간은 몇 시에 시작할까요?' end,
               case when p_grade = 3 then '11:30' else '12:30' end, array['11:30', '12:30', '12:40', '13:00', '11:40']),
    public._mc('1교시는 몇 시에 시작할까요?', '8:40', array['8:30', '8:50', '9:00', '8:20']),
    public._mc('5교시는 몇 시에 시작할까요?', '13:30', array['13:20', '13:40', '13:00', '14:00']),
    public._mc('7교시가 끝나는 시각은?', '16:20', array['16:10', '16:30', '16:00', '15:50']),
    public._mc('수업 한 교시는 몇 분일까요?', '50분', array['45분', '40분', '55분', '60분']),
    public._mc('운중고 앱에서 급식 한줄평(10자 이상)을 쓰면 받는 토큰은?', '3개', array['1개', '5개', '10개', '2개']),
    public._mc('연속 출석 7일을 채우면 받는 보너스 토큰은?', '10개', array['5개', '7개', '20개', '3개']),
    public._mc('집중 모드로 몇 분 공부하면 토큰 1개를 받을까요?', '10분', array['5분', '15분', '30분', '20분']),
    public._mc('반별 게시판 글은 같은 반 친구 몇 명이 확인하면 작성자가 토큰을 받을까요?', '2명', array['1명', '3명', '5명', '4명']),
    public._mc('닉네임은 며칠에 한 번 바꿀 수 있을까요?', '30일', array['7일', '14일', '100일', '60일']),
    public._mc('반 대항 랭킹에 들어가려면 앱에 등록한 학생이 몇 명 이상이어야 할까요?', '5명', array['3명', '10명', '1명', '8명']));

  return (select jsonb_agg(x order by random()) from jsonb_array_elements(out) x where x is not null and x <> 'null'::jsonb);
end $$;

revoke all on function public._q_word(int) from public, anon, authenticated;
revoke all on function public._q_math(int) from public, anon, authenticated;
revoke all on function public._q_life(int, int, timestamptz) from public, anon, authenticated;

-- ───────────────────────── 시작 · 끝내기 (본체: 시각을 인자로) ─────────────────────────

create or replace function public._game_plays_today(p_user uuid, p_now timestamptz)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.game_runs
   where user_id = p_user and (started_at at time zone 'Asia/Seoul')::date = (p_now at time zone 'Asia/Seoul')::date
$$;

create or replace function public._start_game(p_user uuid, p_game text, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e public.enrollments := public.enrollment_of(p_user);
  plays int;
  fee int;
  bal int;
  qs jsonb;
  dur int := case when p_game = 'life' then 90 else 60 end;
  rid uuid := gen_random_uuid();
begin
  if e.user_id is null then raise exception '학번을 먼저 등록해 주세요' using errcode = 'P0001'; end if;
  if p_game not in ('word', 'math', 'life') then raise exception '없는 게임이에요' using errcode = 'P0001'; end if;
  if public.is_class_time(e.grade, e.class_no, p_now) then
    raise exception '수업 시간에는 게임을 할 수 없어요. 쉬는 시간이나 방과후에 만나요!' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('ledger:' || p_user::text));
  plays := public._game_plays_today(p_user, p_now);
  if plays >= 10 then raise exception '오늘은 10판을 다 했어요. 내일 또 만나요!' using errcode = 'P0001'; end if;
  fee := case when plays = 0 then 0 else 5 end;
  if fee > 0 then
    select coalesce(sum(delta), 0) into bal from public.token_ledger where user_id = p_user;
    if bal < fee then raise exception '토큰이 부족해요 (한 판에 %개)', fee using errcode = 'P0001'; end if;
    insert into public.token_ledger (user_id, delta, reason, ref_id, note) values (p_user, -fee, 'game', rid::text, p_game);
  end if;

  qs := case p_game when 'word' then public._q_word(40) when 'math' then public._q_math(40) else public._q_life(e.grade, e.class_no, p_now) end;
  insert into public.game_runs (id, user_id, game, grade, class_no, started_at, duration_s, questions, cost)
  values (rid, p_user, p_game, e.grade, e.class_no, p_now, dur, qs, fee);

  return jsonb_build_object(
    'id', rid, 'game', p_game, 'duration_s', dur, 'cost', fee, 'plays_today', plays + 1,
    'questions', (select jsonb_agg(x - 'a') from jsonb_array_elements(qs) x));
end $$;

-- 한 문제 답하기: 서버가 바로 채점해서 맞았는지·정답·점수를 돌려준다 (앱은 정답을 미리 모른다)
--  · 순서대로만(p_index = 지금까지 푼 수), 제한 시간 안에만, 직전 답과 0.35초 이상 간격일 때만 받는다
create or replace function public._answer_game(p_user uuid, p_id uuid, p_index int, p_choice int, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  g public.game_runs;
  n int;
  ok boolean;
  a int;
begin
  select * into g from public.game_runs where id = p_id and user_id = p_user for update;
  if not found then raise exception '없는 게임이에요' using errcode = 'P0001'; end if;
  n := jsonb_array_length(g.answers);
  if g.finished_at is not null or p_now > g.started_at + make_interval(secs => g.duration_s + 2) or n >= jsonb_array_length(g.questions) then
    return jsonb_build_object('accepted', false, 'reason', 'over', 'score', g.score, 'index', n);
  end if;
  if p_index <> n then
    return jsonb_build_object('accepted', false, 'reason', 'order', 'score', g.score, 'index', n);
  end if;
  if p_now < coalesce(g.last_answer_at, g.started_at) + interval '350 milliseconds' then
    return jsonb_build_object('accepted', false, 'reason', 'too_fast', 'score', g.score, 'index', n);
  end if;
  a := (g.questions->n->>'a')::int;
  ok := p_choice = a;
  if ok then
    g.combo := g.combo + 1;
    g.score := g.score + 10 + least(g.combo - 1, 5) * 2;
  else
    g.combo := 0;
  end if;
  update public.game_runs
     set answers = answers || jsonb_build_array(jsonb_build_object('c', p_choice, 'ok', ok)),
         combo = g.combo, score = g.score, last_answer_at = p_now
   where id = p_id;
  return jsonb_build_object('accepted', true, 'correct', ok, 'answer', a, 'score', g.score, 'combo', g.combo, 'index', n + 1);
end $$;

-- 끝내기: 결과 정리 + 이번 주 내 최고 기록을 넘기면 +2 (게임별 하루 1번). 여러 번 불러도 같은 결과.
create or replace function public._finish_game(p_user uuid, p_id uuid, p_now timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  g public.game_runs;
  ok int;
  bad int;
  prev_best int;
  reward int := 0;
  ws date;
begin
  select * into g from public.game_runs where id = p_id and user_id = p_user for update;
  if not found then raise exception '없는 게임이에요' using errcode = 'P0001'; end if;
  select count(*) filter (where (x->>'ok')::boolean), count(*) filter (where not (x->>'ok')::boolean)
    into ok, bad from jsonb_array_elements(g.answers) x;

  ws := date_trunc('week', (g.started_at at time zone 'Asia/Seoul')::date)::date;
  select max(score) into prev_best from public.game_runs
   where user_id = p_user and game = g.game and id <> p_id and finished_at is not null
     and started_at < g.started_at
     and (started_at at time zone 'Asia/Seoul')::date between ws and ws + 6;

  if g.finished_at is null then
    update public.game_runs set finished_at = p_now where id = p_id;
    if prev_best is not null and g.score > prev_best then
      if public.award_tokens(p_user, 2, 'game_best', g.game || ':' || (p_now at time zone 'Asia/Seoul')::date) then reward := 2; end if;
    end if;
  end if;

  return jsonb_build_object('score', g.score, 'correct', ok, 'wrong', bad,
                            'best', greatest(coalesce(prev_best, 0), g.score), 'new_best', prev_best is null or g.score > prev_best,
                            'reward', reward,
                            'review', (select jsonb_agg(jsonb_build_object(
                                         'q', g.questions->k->>'q',
                                         'answer', g.questions->k->'choices'->>((g.questions->k->>'a')::int),
                                         'mine', g.questions->k->'choices'->>((g.answers->k->>'c')::int),
                                         'ok', (g.answers->k->>'ok')::boolean) order by k)
                                       from generate_series(0, jsonb_array_length(g.answers) - 1) k));
end $$;

revoke all on function public._game_plays_today(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public._start_game(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public._answer_game(uuid, uuid, int, int, timestamptz) from public, anon, authenticated;
revoke all on function public._finish_game(uuid, uuid, timestamptz) from public, anon, authenticated;

create or replace function public.start_game(p_game text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  return public._start_game(auth.uid(), p_game, now());
end $$;

create or replace function public.answer_game(p_id uuid, p_index int, p_choice int)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  return public._answer_game(auth.uid(), p_id, p_index, p_choice, clock_timestamp());
end $$;

create or replace function public.finish_game(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  return public._finish_game(auth.uid(), p_id, now());
end $$;

-- 게임 화면 첫 정보: 오늘 몇 판, 다음 판 비용, 수업 중인지, 이번 주 내 최고 기록
create or replace function public.game_status()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  plays int;
  ws date := date_trunc('week', public.seoul_today())::date;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  plays := public._game_plays_today(me, now());
  return jsonb_build_object(
    'plays_today', plays, 'max_plays', 10, 'next_cost', case when plays = 0 then 0 when plays >= 10 then null else 5 end,
    'in_class', public.my_class_time_now(),
    'best', (select jsonb_object_agg(game, best) from (
               select game, max(score) as best from public.game_runs
                where user_id = me and score > 0 and (started_at at time zone 'Asia/Seoul')::date >= ws group by game) b));
end $$;

-- 게임 랭킹(게임별, 학교 전체, 주간 최고 기록). 게임 화면에서만 쓴다.
create or replace function public.game_ranking(p_game text, p_week_start date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  ws date := date_trunc('week', p_week_start)::date;
  me uuid := auth.uid();
  res jsonb;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if p_game not in ('word', 'math', 'life') then raise exception '없는 게임이에요' using errcode = 'P0001'; end if;
  with best as (
    select distinct on (user_id) user_id, grade, score, coalesce(finished_at, started_at) as finished_at
      from public.game_runs
     where game = p_game and score > 0 and (started_at at time zone 'Asia/Seoul')::date between ws and ws + 6
     order by user_id, score desc, finished_at asc
  ),
  ranked as (select *, rank() over (order by score desc) as rank, row_number() over (order by score desc, finished_at asc) as rn from best)
  select jsonb_build_object(
    'game', p_game, 'week_start', ws, 'week_end', ws + 6,
    'top', coalesce((select jsonb_agg(jsonb_build_object(
              'rank', r.rank, 'score', r.score, 'grade', r.grade, 'mine', r.user_id = me,
              'nickname', case when p.hide_in_ranking then null else p.nickname end,
              'hidden', p.hide_in_ranking or p.nickname is null,
              'equip', case when p.hide_in_ranking then null else jsonb_build_object(
                 'emoji', p.equip_emoji, 'name_color', p.equip_color, 'theme', p.equip_theme, 'badge', p.equip_badge) end)
              order by r.rn) from ranked r join public.profiles p on p.id = r.user_id where r.rn <= 10), '[]'),
    'me', (select jsonb_build_object('score', r.score, 'rank', r.rank) from ranked r where r.user_id = me),
    'players', (select count(*) from best)
  ) into res;
  return res;
end $$;

-- 지난 주 정산: 게임별 학교 1~3위 +30/+20/+10, 1위는 '주간 게임왕' 배지. 누가 불러도 한 번만 지급된다.
create or replace function public.settle_game_week(p_week_start date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ws date := date_trunc('week', p_week_start)::date;
  g text;
  r record;
  paid int := 0;
begin
  if not public.is_school_user() then raise exception '학교 계정으로 로그인해 주세요' using errcode = '42501'; end if;
  if ws + 6 >= public.seoul_today() then return jsonb_build_object('settled', false, 'reason', 'week_not_over'); end if;
  foreach g in array array['word', 'math', 'life'] loop
    for r in
      select user_id, row_number() over (order by score desc, finished_at asc) as place from (
        select distinct on (user_id) user_id, score, coalesce(finished_at, started_at) as finished_at from public.game_runs
         where game = g and score > 0 and (started_at at time zone 'Asia/Seoul')::date between ws and ws + 6
         order by user_id, score desc, finished_at asc) b
      order by place limit 3
    loop
      if public.award_tokens(r.user_id, (array[30, 20, 10])[r.place], 'game_weekly', g || ':' || ws || ':' || r.place) then paid := paid + 1; end if;
      if r.place = 1 then
        insert into public.inventory (user_id, item_id) values (r.user_id, 'b_gameking') on conflict do nothing;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('settled', true, 'paid', paid);
end $$;

-- ───────────────────────── 권한(RLS) ─────────────────────────

alter table public.game_words enable row level security;
alter table public.game_runs enable row level security;
-- 단어장은 정답표라서 학생이 직접 읽을 수 없다. 내 게임 기록도 정답이 들어 있어 직접 조회는 막고 함수로만.

revoke all on function public.game_status() from public, anon;
revoke all on function public.game_ranking(text, date) from public, anon;
revoke all on function public.settle_game_week(date) from public, anon;
grant execute on function public.start_game(text) to authenticated;
grant execute on function public.answer_game(uuid, int, int) to authenticated;
grant execute on function public.finish_game(uuid) to authenticated;
grant execute on function public.game_status() to authenticated;
grant execute on function public.game_ranking(text, date) to authenticated;
grant execute on function public.settle_game_week(date) to authenticated;
