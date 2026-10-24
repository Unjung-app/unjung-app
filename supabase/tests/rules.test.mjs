import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
// DB 규칙 검사: Supabase의 auth 스키마를 흉내 낸 PGlite에 마이그레이션을 모두 적용하고,
// '막혀야 하는 것은 막히고, 되어야 하는 것은 되는지' 확인한다. 기대와 다르면 실패.
let failed = 0;
const expect = (label, ok) => { if (!ok) { failed++; console.log('FAIL', label); } };
const db = new PGlite();
const q = async (sql, label) => { try { const r = await db.query(sql); if (label) console.log('ok  ', label, JSON.stringify(r.rows)); return { ok: true, rows: r.rows }; } catch (e) { if (label) console.log('deny', label + ':', e.message); return { ok: false, rows: [], err: e.message }; } };
// --- Supabase 흉내: auth 스키마, 역할, auth.uid()/auth.jwt()
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb $$;
  grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
`);
const dir = process.argv[2] ?? 'supabase/migrations';
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  try { await db.exec(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { console.log('MIGRATION ERROR', f, e.message); process.exit(1); }
}
await db.exec(`grant select on all tables in schema public to authenticated;`);
console.log('--- migration applied');
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', X = '33333333-3333-3333-3333-333333333333';
await q(`insert into auth.users values ('${A}','howon@unjung.hs.kr'),('${B}','friend@UNJUNG.hs.kr'),('${X}','someone@gmail.com')`);
await q(`select email, role from public.profiles order by email`, '프로필 자동 생성(외부 gmail 제외)');
const as = async (uid, email, sql, label) => {
  await db.exec(`reset role; select set_config('test.uid','${uid}',false), set_config('test.jwt','{"email":"${email}"}',false); set role authenticated;`);
  const r = await q(sql, label); await db.exec('reset role'); return r;
};
{ const r = await as(A, 'howon@unjung.hs.kr', `select public.register_enrollment('20818','이호원') as r`, 'A 학번 등록'); expect('A 학번 등록', r.ok); }
{ const r = await as(A, 'howon@unjung.hs.kr', `select public.register_enrollment('20818','이호원2')`, 'A 두 번째 등록(막혀야 함)'); expect('A 두 번째 등록(막혀야 함)', !r.ok); }
{ const r = await as(B, 'friend@UNJUNG.hs.kr', `select public.register_enrollment('20818','친구')`, 'B 같은 학번(막혀야 함)'); expect('B 같은 학번(막혀야 함)', !r.ok); }
{ const r = await as(B, 'friend@UNJUNG.hs.kr', `select public.register_enrollment('20918','친구')`, 'B 9반(막혀야 함)'); expect('B 9반(막혀야 함)', !r.ok); }
{ const r = await as(B, 'friend@UNJUNG.hs.kr', `select public.register_enrollment('10305','김친구')`, 'B 정상 등록'); expect('B 정상 등록', r.ok); }
{ const r = await as(X, 'someone@gmail.com', `select public.register_enrollment('30101','외부인')`, 'X 외부 계정(막혀야 함)'); expect('X 외부 계정(막혀야 함)', !r.ok); }
{ const r = await as(A, 'howon@unjung.hs.kr', `select student_no, name, grade, class_no, number from public.enrollments`, 'A가 볼 수 있는 학적(본인만)'); expect('A가 볼 수 있는 학적(본인만)', r.ok); }
{ const r = await as(A, 'howon@unjung.hs.kr', `update public.enrollments set name='해킹' where user_id='${A}' returning name`, 'A 이름 직접 수정(0행이어야 함)'); expect('A 이름 직접 수정(0행이어야 함)', !r.ok || r.rows.length === 0); }
{ const r = await as(A, 'howon@unjung.hs.kr', `select public.award_tokens('${A}', 999, 'hack', '1')`, 'A 토큰 셀프 지급(막혀야 함)'); expect('A 토큰 셀프 지급(막혀야 함)', !r.ok); }
{ const r = await as(A, 'howon@unjung.hs.kr', `select public.admin_set_role('${A}', 'admin')`, 'A 셀프 관리자(막혀야 함)'); expect('A 셀프 관리자(막혀야 함)', !r.ok); }
{ const r = await as(X, 'someone@gmail.com', `select count(*) from public.profiles`, 'X 외부 계정 프로필 조회(0이어야 함)'); expect('X 외부 계정 프로필 조회(0이어야 함)', r.ok && Number(r.rows[0]?.count) === 0); }
// 관리자 경로: 서버(소유자)가 A를 admin으로, 토큰 지급 중복 방지
await q(`update public.profiles set role='admin' where id='${A}'`);
{ const r = await as(A, 'howon@unjung.hs.kr', `select public.admin_set_role('${B}', 'reviewer')`, 'A(관리자)가 B를 검토위원으로'); expect('A(관리자)가 B를 검토위원으로', r.ok); }
{ const r = await q(`select public.award_tokens('${B}', 30, 'notice_approved', 'n1') a, public.award_tokens('${B}', 30, 'notice_approved', 'n1') b`, '같은 공지로 두 번 지급 → 두 번째 false'); expect('같은 공지로 두 번 지급 → 두 번째 false', r.ok && r.rows[0]?.a === true && r.rows[0]?.b === false); }
{ const r = await as(B, 'friend@UNJUNG.hs.kr', `select * from public.token_balances`, 'B 잔액'); expect('B 잔액', r.ok); }
{ const r = await as(B, 'friend@UNJUNG.hs.kr', `select email, role from public.profiles order by email`, 'B가 본 프로필(역할)'); expect('B가 본 프로필(역할)', r.ok); }
{ const r = await as(B, 'friend@UNJUNG.hs.kr', `select email from public.profiles`, 'B가 본 이메일(본인 것만)'); expect('B가 본 이메일(본인 것만)', r.ok); }
{ const r = await as(B, 'friend@UNJUNG.hs.kr', `select nickname, role from public.profile_cards order by role`, 'B가 본 카드(닉네임·역할만)'); expect('B가 본 카드(닉네임·역할만)', r.ok); }
{ const r = await as(X, 'someone@gmail.com', `select count(*) from public.profile_cards`, 'X 외부 계정 카드(0)'); expect('X 외부 계정 카드(0)', r.ok && Number(r.rows[0]?.count) === 0); }

await (async () => { const r = await as(B, 'friend@UNJUNG.hs.kr', `select email from public.profiles`); expect('다른 학생 이메일 비공개', r.rows.length === 1); })();

// ───────── M3 1주차: 출석 스트릭 · 상점 · 닉네임 ─────────
const CA = 'howon@unjung.hs.kr', CB = 'friend@UNJUNG.hs.kr';
const ci = async (day) => (await q(`select public._check_in('${B}', '${day}') r`)).rows[0]?.r;
const streakOf = async () => (await q(`select current, best, shields, last_day::text from public.streaks where user_id='${B}'`)).rows[0];
const bal = async (u) => Number((await q(`select coalesce(sum(delta),0)::int b from public.token_ledger where user_id='${u}'`)).rows[0]?.b);
const sql1 = async (uid, email, sql) => (await as(uid, email, sql));

{ const r = await as(B, CB, `select public._check_in('${B}', '2026-10-26')`, 'B가 _check_in 직접 호출(막혀야 함)'); expect('_check_in 직접 호출 차단', !r.ok); }
{ const r = await as(B, CB, `select public.award_capped('${B}', 50, 'study', 'x', 999)`, 'B가 award_capped 직접 호출(막혀야 함)'); expect('award_capped 직접 호출 차단', !r.ok); }

const before = await bal(B);
{ const r = await ci('2026-10-26'); expect('월 첫 출석 → 스트릭 1, +2', r?.streak === 1 && r?.tokens === 2); }
{ const r = await ci('2026-10-26'); expect('같은 날 두 번 → 토큰 0', r?.tokens === 0 && r?.first_today === false); }
await ci('2026-10-27');
{ const s = await streakOf(); expect('화 → 스트릭 2', s?.current === 2); }
await ci('2026-10-29'); // 수요일 빠짐, 보호권 없음
{ const s = await streakOf(); expect('수요일 빠지면 1부터 다시', s?.current === 1 && s?.best === 2); }
await ci('2026-10-30');
{ const r = await ci('2026-10-31'); expect('토요일 출석: +2, 스트릭은 그대로', r?.tokens === 2 && r?.streak === 2 && r?.school_day === false); }
await ci('2026-11-02');
{ const s = await streakOf(); expect('주말 건너뛰어도 이어짐 → 3', s?.current === 3); }
await q(`insert into public.days_off values ('2026-11-03', '재량휴업일')`);
await ci('2026-11-04');
{ const s = await streakOf(); expect('쉬는 날(11/3) 건너뛰어도 이어짐 → 4', s?.current === 4); }

// 상점: 보호권 사기
await q(`select public.award_tokens('${B}', 100, 'test_grant', 'g1')`);
{ const r = await as(B, CB, `select public.buy_item('s_shield') w`, 'B 보호권 구매'); expect('보호권 구매', r.ok && r.rows[0]?.w?.shields === 1); }
await ci('2026-11-06'); // 목(11/5) 빠짐 → 보호권 자동 사용
{ const s = await streakOf(); expect('보호권으로 이어짐 → 5, 보호권 0', s?.current === 5 && s?.shields === 0); }
await ci('2026-11-09');
{ const r = await ci('2026-11-10'); expect('7일 → 보너스 +10', r?.streak === 7 && r?.tokens === 12); }

{ const b0 = await bal(B); const r = await as(B, CB, `select public.buy_item('t_night')`, 'B 테마(150) 구매 — 잔액 부족이면 막혀야 함');
  expect('잔액보다 비싼 상품은 구매 불가', b0 < 150 ? !r.ok : r.ok); }
{ const r = await as(B, CB, `select public.buy_item('e_cat') w`, 'B 고양이 이모지 구매'); expect('이모지 구매', r.ok); }
{ const r = await as(B, CB, `select public.buy_item('e_cat')`, 'B 같은 이모지 다시(막혀야 함)'); expect('같은 상품 두 번 구매 불가', !r.ok); }
{ const r = await as(B, CB, `select public.equip_item('emoji', 'e_dog')`, 'B 안 산 이모지 장착(막혀야 함)'); expect('안 산 상품 장착 불가', !r.ok); }
{ const r = await as(B, CB, `select public.equip_item('emoji', 'e_cat') w`, 'B 고양이 장착'); expect('산 상품 장착', r.ok && r.rows[0]?.w?.equip?.emoji === 'e_cat'); }
{ const r = await as(B, CB, `select public.equip_item('theme', 'e_cat')`, 'B 이모지를 테마 칸에(막혀야 함)'); expect('종류가 다른 칸에 장착 불가', !r.ok); }
{ const r = await as(B, CB, `select public.buy_item('b_finals_2026')`, 'B 판매 기간 아닌 배지(막혀야 함)'); expect('판매 기간 밖 상품 불가', !r.ok); }
{ const r = await as(B, CB, `insert into public.inventory values ('${B}', 'e_crown') returning *`, 'B 인벤토리 직접 추가(막혀야 함)'); expect('인벤토리 직접 추가 불가', !r.ok); }
{ const r = await as(B, CB, `insert into public.token_ledger (user_id, delta, reason) values ('${B}', 500, 'hack') returning *`, 'B 원장 직접 쓰기(막혀야 함)'); expect('원장 직접 쓰기 불가', !r.ok); }
{ const r = await as(A, CA, `select count(*)::int n from public.inventory`, 'A가 본 인벤토리(본인 것만=0)'); expect('남의 인벤토리 비공개', r.ok && r.rows[0]?.n === 0); }
{ const r = await as(A, CA, `select count(*)::int n from public.streaks`, 'A가 본 스트릭(본인 것만=0)'); expect('남의 스트릭 비공개', r.ok && r.rows[0]?.n === 0); }
{ const r = await as(B, CB, `select count(*)::int n from public.banned_words`, 'B 금칙어 목록 조회(0)'); expect('금칙어 목록 비공개', r.ok && r.rows[0]?.n === 0); }
expect('잔액이 음수가 되지 않음', (await bal(B)) >= 0);
console.log('B 토큰 변화:', before, '→', await bal(B));

// 하루 상한
{ const r = await q(`select public.award_capped('${A}', 20, 'study', 's1', 30) a, public.award_capped('${A}', 20, 'study', 's2', 30) b, public.award_capped('${A}', 20, 'study', 's3', 30) c`);
  expect('하루 상한 30: 20 → 10 → 0', r.rows[0]?.a === 20 && r.rows[0]?.b === 10 && r.rows[0]?.c === 0); }

// 실제 앱 경로: check_in() (오늘 날짜)
{ const r = await as(A, CA, `select public.check_in() w`, 'A check_in()'); expect('check_in() 지갑 반환', r.ok && r.rows[0]?.w?.checked_today === true && typeof r.rows[0]?.w?.balance === 'number'); }
{ const r = await as(X, 'someone@gmail.com', `select public.check_in()`, 'X 외부 계정 출석(막혀야 함)'); expect('외부 계정 출석 불가', !r.ok); }

// 닉네임
{ const r = await as(A, CA, `select public.set_nickname('시발짱')`, '금칙어 닉네임(막혀야 함)'); expect('금칙어 닉네임 차단', /사용할 수 없는/.test(r.err ?? '')); }
{ const r = await as(A, CA, `select public.has_banned_word('씨 - 발 진짜') a, public.has_banned_word('오늘 돈까스 미쳤다') b`, '한줄평 금칙어 검사(기호·띄어쓰기 섞어도)'); expect('금칙어 우회 차단·정상 문장 통과', r.ok && r.rows[0]?.a === true && r.rows[0]?.b === false); }
{ const r = await as(A, CA, `select public.set_nickname('익명의2학년')`, '예약어 닉네임(막혀야 함)'); expect('예약어 차단', /사용할 수 없는/.test(r.err ?? '')); }
{ const r = await as(A, CA, `select public.set_nickname('a')`, '1글자(막혀야 함)'); expect('길이 규칙', !r.ok); }
{ const r = await as(A, CA, `select public.set_nickname('호원 짱')`, '공백 포함(막혀야 함)'); expect('허용 문자 규칙', !r.ok); }
{ const r = await as(A, CA, `select public.set_nickname('구름위') w`, 'A 닉네임 설정'); expect('닉네임 설정', r.ok && r.rows[0]?.w?.nickname === '구름위'); }
{ const r = await as(B, CB, `select public.set_nickname('구름위')`, 'B 같은 닉네임(막혀야 함)'); expect('닉네임 중복 불가', /이미 다른 학생/.test(r.err ?? '')); }
{ const r = await as(B, CB, `select public.set_nickname('Cloud_9') w`, 'B 닉네임 설정'); expect('B 닉네임 설정', r.ok); }
const C = '44444444-4444-4444-4444-444444444444'; await q(`insert into auth.users values ('${C}','third@unjung.hs.kr')`);
{ const r = await as(C, 'third@unjung.hs.kr', `select public.set_nickname('CLOUD_9')`, 'C 대소문자만 다른 중복(막혀야 함)'); expect('대소문자 무시 중복 불가', /이미 다른 학생/.test(r.err ?? '')); }
{ const r = await as(A, CA, `select public.set_nickname('구름아래')`, '30일 안에 변경(막혀야 함)'); expect('30일 변경 제한', /30일/.test(r.err ?? '')); }
{ const r = await as(A, CA, `update public.profiles set nickname='직접수정' where id='${A}' returning nickname`, '프로필 직접 수정(0행)'); expect('프로필 직접 수정 불가', !r.ok || r.rows.length === 0); }
{ const r = await as(B, CB, `select nickname, equip_emoji from public.profile_cards order by nickname`, 'B가 본 카드(꾸미기 포함)'); expect('카드에 꾸미기 보임', r.ok && r.rows.some((x) => x.equip_emoji === 'e_cat')); }
{ const r = await as(B, CB, `select public.admin_adjust_tokens('${B}', 999, '셀프')`, 'B 관리자 보정(막혀야 함)'); expect('관리자 보정은 관리자만', !r.ok); }
{ const r = await as(A, CA, `select public.admin_clear_nickname('${B}')`, 'A(관리자) B 닉네임 지우기'); expect('관리자 닉네임 지우기', r.ok); }

// ───────── M3 2주차: 급식 한줄평 · 반별 게시판 ─────────
const D = '55555555-5555-5555-5555-555555555555', E = '66666666-6666-6666-6666-666666666666';
const CD = 'd@unjung.hs.kr', CE = 'e@unjung.hs.kr', CC = 'third@unjung.hs.kr';
await q(`insert into auth.users values ('${D}','${CD}'),('${E}','${CE}')`);
await as(D, CD, `select public.register_enrollment('20801','김디디')`);
await as(E, CE, `select public.register_enrollment('20802','박이이')`);
const post = (u, day, code, body, at) => q(`select public._post_meal_review('${u}', '${day}', ${code}, '${body}', '${at}') r`);

{ const r = await as(A, CA, `select public._post_meal_review('${A}', '2026-10-26', 2, '맛있다', now())`, '학생이 _post_meal_review 직접(막혀야 함)'); expect('한줄평 본체 직접 호출 차단', !r.ok); }
{ const r = await post(A, '2026-10-26', 2, '돈까스가 바삭하고 소스가 진했다', '2026-10-26 12:00+09'); expect('2학년 12:00엔 아직 못 씀', !r.ok && /8시 40분/.test(r.err ?? '')); }
{ const r = await post(A, '2026-10-26', 2, '돈까스가 바삭하고 소스가 진했다', '2026-10-26 12:40+09'); expect('2학년 12:40 작성 +3', r.ok && r.rows[0]?.r?.tokens === 3); }
{ const r = await post(A, '2026-10-26', 2, '다시 생각해 보니 국이 짰다 그래도 좋음', '2026-10-26 13:00+09'); expect('같은 끼니 다시 쓰면 수정, 토큰 0', r.ok && r.rows[0]?.r?.tokens === 0); }
{ const r = await post(B, '2026-10-26', 2, '굿굿', '2026-10-27 08:30+09'); expect('다음 날 08:30까지 가능(10자 미만은 토큰 0)', r.ok && r.rows[0]?.r?.tokens === 0); }
{ const r = await post(D, '2026-10-26', 2, '오늘 급식 최고였다 진짜로', '2026-10-27 09:00+09'); expect('다음 날 08:40 지나면 불가', !r.ok); }
{ const r = await post(D, '2026-10-27', 2, '반찬이 시발 별로', '2026-10-27 12:40+09'); expect('금칙어 한줄평 차단', !r.ok && /부적절/.test(r.err ?? '')); }
{ const r = await post(C, '2026-10-27', 2, '학번 없는 사람 글입니다', '2026-10-27 12:40+09'); expect('학번 미등록은 못 씀', !r.ok && /학번/.test(r.err ?? '')); }
const rid = (await q(`select id from public.meal_reviews where user_id='${A}' and meal_date='2026-10-26'`)).rows[0]?.id;
{ const r = await as(A, CA, `select public.like_meal_review(${rid}, true)`, 'A 내 글 공감(막혀야 함)'); expect('내 글 공감 불가', !r.ok); }
{ const r = await as(B, CB, `select public.like_meal_review(${rid}, true) n`, 'B 공감'); expect('공감 +1', r.ok && r.rows[0]?.n === 1); }
{ const r = await as(B, CB, `select public.like_meal_review(${rid}, true) n`, 'B 공감 두 번'); expect('공감 중복 안 셈', r.ok && r.rows[0]?.n === 1); }
{ const r = await q(`select count(*)::int n from public.token_ledger where user_id='${A}' and reason='meal_like'`); expect('공감받은 작성자 +1', r.rows[0]?.n === 1); }
{ const r = await as(B, CB, `select public.like_meal_review(${rid}, false) n`, 'B 공감 취소'); expect('공감 취소', r.ok && r.rows[0]?.n === 0); }
{ const r = await as(B, CB, `select public.like_meal_review(${rid}, true) n`); const t = await q(`select count(*)::int n from public.token_ledger where user_id='${A}' and reason='meal_like'`); expect('공감 껐다 켜도 토큰은 한 번만', r.ok && t.rows[0]?.n === 1); }
{ const r = await as(B, CB, `select * from public.meal_review_feed`, 'B가 본 한줄평 피드'); expect('피드에 작성자 id 없음', r.ok && r.rows.length >= 2 && !('user_id' in r.rows[0]) && r.rows.some((x) => x.liked)); }
{ const r = await as(B, CB, `select user_id from public.meal_reviews`, 'B 원본 테이블(본인 것만)'); expect('원본 테이블은 본인 것만', r.ok && r.rows.every((x) => x.user_id === B)); }
{ const r = await as(A, CA, `select public.report_meal_review(${rid}, '')`, 'A 내 글 신고(막혀야 함)'); expect('내 글 신고 불가', !r.ok); }
for (const [u, c] of [[B, CB], [D, CD], [D, CD]]) await as(u, c, `select public.report_meal_review(${rid}, '욕설')`);
{ const r = await q(`select report_count, hidden from public.meal_reviews where id=${rid}`); expect('신고 2명(중복 무시) → 아직 보임', r.rows[0]?.report_count === 2 && r.rows[0]?.hidden === false); }
await as(E, CE, `select public.report_meal_review(${rid}, '')`);
{ const r = await as(B, CB, `select count(*)::int n from public.meal_review_feed where id=${rid}`); expect('신고 3명 → 다른 학생에게 숨김', r.rows[0]?.n === 0); }
{ const r = await as(A, CA, `select hidden from public.meal_review_feed where id=${rid}`); expect('숨겨진 글도 작성자 본인에겐 보임', r.rows[0]?.hidden === true); }
{ const r = await as(D, CD, `select count(*)::int n from public.meal_review_mod_queue`, 'D(일반) 신고 목록(0)'); expect('신고 목록은 검토위원만', r.rows[0]?.n === 0); }
{ const r = await as(B, CB, `select reasons from public.meal_review_mod_queue where id=${rid}`, 'B(검토위원) 신고 목록'); expect('검토위원은 신고 목록 봄', r.ok && r.rows.length === 1); }
{ const r = await as(D, CD, `select public.mod_set_meal_review_hidden(${rid}, false)`, 'D 숨김 해제(막혀야 함)'); expect('일반 학생 숨김 해제 불가', !r.ok); }
{ const r = await as(B, CB, `select public.mod_set_meal_review_hidden(${rid}, false)`, 'B(검토위원) 숨김 해제'); const f = await as(D, CD, `select count(*)::int n from public.meal_review_feed where id=${rid}`); expect('검토위원 복구 → 다시 보임', r.ok && f.rows[0]?.n === 1); }
{ await db.exec('reset role'); const r = await db.query(`set role anon; select count(*) from public.meal_review_feed`).then(() => ({ ok: true }), () => ({ ok: false })); await db.exec('reset role'); expect('비로그인(anon) 피드 접근 불가', !r.ok); }

// 반별 게시판: A·D·E = 2학년 8반, B = 1학년 3반, C = 학번 없음
const tomorrow = (await q(`select (public.seoul_today() + 1)::text d`)).rows[0].d;
{ const r = await as(C, CC, `select public.create_class_task('수학', 'homework', '${tomorrow}', '익힘책')`, 'C 학번 없이 글쓰기(막혀야 함)'); expect('학번 없으면 게시판 글 불가', !r.ok); }
{ const r = await as(A, CA, `select public.create_class_task('수학', 'homework', public.seoul_today() - 1, '어제 마감')`, '지난 날짜 마감(막혀야 함)'); expect('지난 마감일 불가', !r.ok); }
const tid = (await as(A, CA, `select public.create_class_task('수학Ⅱ', 'assessment', '${tomorrow}', '미적분 수행평가 3단원까지') id`, 'A 수행평가 등록')).rows[0]?.id;
expect('A 글 등록', !!tid);
{ const r = await as(B, CB, `select count(*)::int n from public.class_task_feed`, 'B(다른 반) 피드'); expect('다른 반 글은 안 보임', r.rows[0]?.n === 0); }
{ const r = await as(B, CB, `select public.confirm_class_task(${tid})`, 'B(다른 반) 확인(막혀야 함)'); expect('다른 반 확인 불가', !r.ok); }
{ const r = await as(B, CB, `select public.suggest_task_fix(${tid}, '날짜 틀림')`, 'B(다른 반) 정정 제안(막혀야 함)'); expect('다른 반 정정 제안 불가', !r.ok); }
{ const r = await as(D, CD, `select subject, author_nickname, mine from public.class_task_feed`, 'D(같은 반) 피드'); expect('같은 반은 보임, 작성자는 닉네임만', r.ok && r.rows.length === 1 && r.rows[0].author_nickname === '구름위' && r.rows[0].mine === false); }
{ const r = await as(A, CA, `select public.confirm_class_task(${tid})`, 'A 내 글 확인(막혀야 함)'); expect('내 글 확인 불가', !r.ok); }
{ const r = await as(D, CD, `select public.confirm_class_task(${tid}) n`); const r2 = await as(D, CD, `select public.confirm_class_task(${tid}) n`); expect('확인 1, 중복 안 셈', r.rows[0]?.n === 1 && r2.rows[0]?.n === 1); }
const t0 = await q(`select count(*)::int n from public.token_ledger where user_id='${A}' and reason='task_confirmed'`);
{ const r = await as(E, CE, `select public.confirm_class_task(${tid}) n`); const f = await as(D, CD, `select confirmed from public.class_task_feed where id=${tid}`); expect('2명 확인 → 확인됨', r.rows[0]?.n === 2 && f.rows[0]?.confirmed === true); }
{ const r = await q(`select count(*)::int n from public.token_ledger where user_id='${A}' and reason='task_confirmed'`); expect('확인됨 → 작성자 +5', t0.rows[0]?.n === 0 && r.rows[0]?.n === 1); }
{ const r = await as(D, CD, `select public.update_class_task(${tid}, '해킹', 'homework', '${tomorrow}', '')`, 'D 남의 글 수정(막혀야 함)'); expect('남의 글 수정 불가', !r.ok); }
{ const r = await as(A, CA, `select public.update_class_task(${tid}, '수학Ⅱ', 'assessment', '${tomorrow}', '미적분 수행평가 4단원까지')`, 'A 내용 수정'); const f = await as(D, CD, `select confirmed, confirm_count, i_confirmed from public.class_task_feed where id=${tid}`); expect('내용 바꾸면 확인 초기화', r.ok && f.rows[0]?.confirmed === false && f.rows[0]?.confirm_count === 0 && f.rows[0]?.i_confirmed === false); }
await as(D, CD, `select public.confirm_class_task(${tid})`); await as(E, CE, `select public.confirm_class_task(${tid})`);
{ const r = await q(`select count(*)::int n from public.token_ledger where user_id='${A}' and reason='task_confirmed'`); expect('다시 확인받아도 토큰은 한 번만', r.rows[0]?.n === 1); }
const sid = (await as(D, CD, `select public.suggest_task_fix(${tid}, '마감이 금요일이에요') id`, 'D 정정 제안')).rows[0]?.id;
{ const r = await as(A, CA, `select open_suggestions from public.class_task_feed where id=${tid}`); expect('작성자에게 정정 제안 1개', r.rows[0]?.open_suggestions === 1); }
{ const r = await as(B, CB, `select count(*)::int n from public.task_suggestion_feed`); expect('다른 반은 정정 제안 못 봄', r.rows[0]?.n === 0); }
{ const r = await as(D, CD, `select public.resolve_task_suggestion(${sid})`, 'D 제안 정리(막혀야 함)'); expect('제안 정리는 글 작성자만', !r.ok); }
{ const r = await as(A, CA, `select public.resolve_task_suggestion(${sid})`, 'A 제안 정리'); expect('작성자 제안 정리', r.ok); }
{ const r = await as(D, CD, `select public.delete_class_task(${tid})`, 'D 남의 글 삭제(막혀야 함)'); expect('남의 글 삭제 불가', !r.ok); }
{ const r = await as(A, CA, `select public.delete_class_task(${tid})`); const f = await as(D, CD, `select count(*)::int n from public.class_task_feed`); expect('삭제하면 피드에서 사라짐', r.ok && f.rows[0]?.n === 0); }
{ const r = await as(D, CD, `select count(*)::int n from public.class_tasks`, 'D 원본 테이블(본인 것만=0)'); expect('게시판 원본 테이블 직접 조회 불가', r.rows[0]?.n === 0); }


// ───────── M3 3주차: 집중 모드 공부 · 랭킹 ─────────
const start = async (u, at, subj = '') => (await q(`select public._start_study('${u}', '${subj}', '${at}') r`)).rows[0]?.r;
const beat = async (u, id, at, skip = false, end = false) => (await q(`select public._beat_study('${u}', '${id}', '${at}', ${skip}, ${end}) r`)).rows[0]?.r;
{ const r = await as(A, CA, `select public._beat_study('${A}', gen_random_uuid(), now(), false, false)`, '학생이 _beat_study 직접(막혀야 함)'); expect('공부 본체 직접 호출 차단', !r.ok); }
{ const r = await q(`select public._start_study('${C}', '', '2026-10-26 18:00+09')`); expect('학번 없으면 공부 시작 불가', !r.ok); }
let sA = await start(A, '2026-10-26 18:00:00+09', '수학');
expect('A 공부 시작', !!sA?.id && sA.in_class === false);
await beat(A, sA.id, '2026-10-26 18:01:00+09');
{ const r = await beat(A, sA.id, '2026-10-26 18:02:00+09'); expect('방과후 2분 → 랭킹 120초', r?.today?.ranked_seconds === 120 && r?.credited === 60); }
{ const r = await beat(A, sA.id, '2026-10-26 18:05:00+09'); expect('신호 3분 끊기면 세션 종료, 빈 시간 안 셈', r?.ended === true && r?.today?.ranked_seconds === 120); }
{ const r = await beat(A, sA.id, '2026-10-26 18:05:30+09'); expect('끝난 세션 신호는 무시', r?.ended === true && r?.reason === 'not_found'); }
// 수업 시간: 2교시(09:40~10:30)
const sD = await start(D, '2026-10-26 10:00:00+09');
expect('수업 시간에 시작하면 in_class', sD?.in_class === true);
{ const r = await beat(D, sD.id, '2026-10-26 10:01:00+09'); expect('수업 시간 공부는 랭킹 0, 수업 칸 60', r?.today?.ranked_seconds === 0 && r?.today?.class_seconds === 60); }
{ const r = await beat(D, sD.id, '2026-10-26 10:32:00+09'); expect('수업 중 31분 공백 → 종료', r?.ended === true); }
// 쉬는 시간(10:30~10:40)은 랭킹에 들어감
const sD2 = await start(D, '2026-10-26 10:31:00+09');
{ const r = await beat(D, sD2.id, '2026-10-26 10:32:00+09'); expect('쉬는 시간은 랭킹 반영', r?.today?.ranked_seconds === 60); }
// 3학년 점심(11:30~12:30)은 수업 아님, 1·2학년은 4교시
{ const r = await q(`select public.is_class_time(3, '2026-10-26 12:00+09') a, public.is_class_time(2, '2026-10-26 12:00+09') b, public.is_class_time(2, '2026-10-31 10:00+09') c, public.is_class_time(2, '2026-11-03 10:00+09') d`);
  expect('3학년 12:00 점심 / 2학년 12:00 수업 / 토요일·쉬는 날은 수업 아님', r.rows[0]?.a === false && r.rows[0]?.b === true && r.rows[0]?.c === false && r.rows[0]?.d === false); }
// 잠깐 떠났다 돌아오기(skip): 떠난 시간은 안 셈
const sA2 = await start(A, '2026-10-26 19:00:00+09');
{ const r = await beat(A, sA2.id, '2026-10-26 19:00:50+09', true); expect('돌아왔을 때 skip → 0초 인정', r?.credited === 0 && r?.today?.ranked_seconds === 120); }
// 새 세션을 시작하면 열린 세션은 닫힘
const sA3 = await start(A, '2026-10-26 20:00:00+09');
{ const r = await q(`select count(*)::int n from public.study_sessions where user_id='${A}' and ended_at is null`); expect('한 사람에 열린 세션 하나', r.rows[0]?.n === 1); }
for (let m = 1; m <= 20; m++) await beat(A, sA3.id, `2026-10-26 20:${String(m).padStart(2, '0')}:00+09`);
{ const r = await q(`select ranked_seconds, tokens from public.study_daily where user_id='${A}' and day='2026-10-26'`); expect('22분 → 토큰 2개', r.rows[0]?.ranked_seconds === 1320 && r.rows[0]?.tokens === 2); }
{ const r = await q(`select count(*)::int n from public.token_ledger where user_id='${A}' and reason='study' and ref_id like '2026-10-26:%'`); expect('공부 토큰 원장 2줄', r.rows[0]?.n === 2); }
{ const r = await beat(A, sA3.id, '2026-10-26 20:20:30+09', false, true); expect('종료', r?.ended === true); }
{ const r = await q(`select public._beat_study('${B}', '${sA3.id}', '2026-10-26 20:21:00+09', false, false) r`); expect('남의 세션에 신호 불가', r.rows[0]?.r?.reason === 'not_found'); }
{ const r = await as(B, CB, `select * from public.study_sessions`, 'B가 본 공부 세션(본인 것만)'); expect('남의 공부 기록 비공개', r.ok && r.rows.length === 0); }
// 하루 상한: 30토큰
await q(`update public.study_daily set ranked_seconds = 12*3600 - 30, tokens = 30 where user_id='${A}' and day='2026-10-26'`);
const sA4 = await start(A, '2026-10-26 21:00:00+09');
{ const r = await beat(A, sA4.id, '2026-10-26 21:01:00+09'); expect('하루 12시간 넘는 부분은 랭킹 제외', r?.today?.ranked_seconds === 12 * 3600 && r?.today?.tokens === 30); }

// 랭킹
await as(D, CD, `select public.set_ranking_hidden(true)`);
{ const r = await as(A, CA, `select public.ranking('study', 2, '2026-10-28') r`, 'A 2학년 공부 랭킹'); const k = r.rows[0]?.r;
  const c8 = k?.classes?.find((c) => c.class_no === 8);
  expect('랭킹: 반 8개, 우리 반 표시, 3명이라 참여 부족', k?.classes?.length === 8 && c8?.mine === true && c8?.members === 3 && c8?.eligible === false && c8?.rank === null);
  expect('랭킹: 주 시작은 월요일', k?.week_start === '2026-10-26');
  expect('랭킹: 1위 A(닉네임), D는 숨김', k?.top?.[0]?.nickname === '구름위' && k?.top?.[0]?.mine === true && k?.top?.some((t) => t.hidden && t.nickname === null && t.equip === null));
  expect('랭킹: 내 순위 1위', k?.me?.rank === 1);
  expect('랭킹 응답에 user_id·이름 없음', !JSON.stringify(k).includes(A) && !JSON.stringify(k).includes('이호원')); }
for (const [u, e, no] of [['77777777-7777-7777-7777-777777777771', 'f1@unjung.hs.kr', '20803'], ['77777777-7777-7777-7777-777777777772', 'f2@unjung.hs.kr', '20804']]) {
  await q(`insert into auth.users values ('${u}','${e}')`); await as(u, e, `select public.register_enrollment('${no}','친구')`);
}
{ const r = await as(A, CA, `select public.ranking('study', 2, '2026-10-26') r`); const c8 = r.rows[0]?.r?.classes?.find((c) => c.class_no === 8);
  expect('5명이 되면 반 순위 참여, 평균 = 합계÷5', c8?.eligible === true && c8?.rank === 1 && c8?.avg === Math.round(c8.total / 5)); }
{ const r = await as(B, CB, `select public.ranking('study', 2, '2026-10-26') r`); expect('다른 학년도 볼 수 있지만 내 순위 없음', r.ok && r.rows[0]?.r?.me === null); }
{ const r = await as(A, CA, `select public.ranking('tokens', 2, public.seoul_today()) r`, 'A 토큰 랭킹'); expect('토큰 랭킹(관리자 지급 제외)', r.ok && Array.isArray(r.rows[0]?.r?.top)); }
{ const r = await as(A, CA, `select public.ranking('hack', 2, public.seoul_today())`); expect('잘못된 랭킹 종류 거부', !r.ok); }
{ const r = await as(X, 'someone@gmail.com', `select public.ranking('study', 2, public.seoul_today())`); expect('외부 계정 랭킹 불가', !r.ok); }
{ await db.exec('reset role'); const r = await db.query(`set role anon; select public.study_live()`).then(() => ({ ok: true }), () => ({ ok: false })); await db.exec('reset role'); expect('비로그인 study_live 불가', !r.ok); }
{ const s = await as(E, CE, `select public.start_study('국어') r`, 'E 실제 시작(now)'); const l = await as(A, CA, `select public.study_live() r`); expect('지금 집중 중 1명', s.ok && l.rows[0]?.r?.all === 1 && l.rows[0]?.r?.g2 === 1); }


// ───────── 학교 데이터 동기화 · 시간표 기반 수업 시간 · 의견 보내기 ─────────
const SYNC = `select public.sync_school_data(2026, '2026-11-09', '2026-11-22',
  '[{"grade":2,"class_no":8,"day":"2026-11-09","period":1,"subject":"문학"},{"grade":2,"class_no":8,"day":"2026-11-09","period":6,"subject":"수학Ⅱ"},{"grade":2,"class_no":8,"day":"2026-11-10","period":7,"subject":"체육"}]'::jsonb,
  '[{"day":"2026-11-09","code":2,"dishes":["현미밥","돈까스","미역국"]}]'::jsonb,
  '2026-11-09', '2027-03-01', '[{"day":"2026-11-20","name":"재량휴업일","holiday":true},{"day":"2026-12-03","name":"2차 지필평가","holiday":false}]'::jsonb) r`;
{ const r = await as(A, CA, SYNC, '학생이 sync_school_data(막혀야 함)'); expect('동기화 함수는 서버 비밀키만', !r.ok); }
{ const r = await q(SYNC); expect('동기화 실행', r.ok && r.rows[0]?.r?.lessons === 3 && r.rows[0]?.r?.days_off_added === 1); }
{ const r = await q(SYNC); expect('다시 돌려도 중복 없음', r.ok && r.rows[0]?.r?.lessons === 3 && r.rows[0]?.r?.days_off_added === 0); }
{ const r = await q(`select public.is_class_time(2, 8, '2026-11-09 15:40+09') a, public.is_class_time(2, 8, '2026-11-09 14:40+09') b, public.is_class_time(2, 8, '2026-11-10 15:40+09') c, public.is_class_time(2, 3, '2026-11-09 15:40+09') d, public.is_class_time(2, 8, '2026-11-20 10:00+09') e`);
  const x = r.rows[0] ?? {};
  expect('시간표 기준 수업 시간: 7교시 없는 날 15:40은 수업 아님', x.a === false);
  expect('시간표 기준 수업 시간: 6교시 있는 날 14:40은 수업', x.b === true);
  expect('시간표 기준 수업 시간: 7교시 있는 날 15:40은 수업', x.c === true);
  expect('시간표 자료 없는 반은 1~7교시 전부 수업', x.d === true);
  expect('동기화된 재량휴업일은 수업 아님', x.e === false); }
{ const r = await as(B, CB, `select count(*)::int n from public.meals_cache`, 'B 급식 캐시 읽기'); expect('학교 데이터는 학생도 읽기 가능', r.rows[0]?.n === 1); }
{ const r = await as(B, CB, `insert into public.days_off values ('2026-12-24', '장난') returning *`, 'B 쉬는 날 직접 추가(막혀야 함)'); expect('쉬는 날 직접 추가 불가', !r.ok); }
{ const sA5 = await start(A, '2026-11-09 15:40:00+09'); expect('7교시 없는 날 방과후는 수업 아님(공부 세션)', sA5?.in_class === false); }
// 의견 보내기
{ const r = await as(B, CB, `select public.submit_feedback('bug', '급식 화면에서 금요일이 안 보여요', '/meal', '3.0.0', 'test') id`, 'B 버그 제보'); expect('의견 보내기', r.ok && !!r.rows[0]?.id); }
{ const r = await as(B, CB, `select public.submit_feedback('bug', '짧음', '', '', '')`); expect('5자 미만 거부', !r.ok); }
{ const r = await as(D, CD, `select count(*)::int n from public.feedback`); expect('남의 의견은 못 봄', r.rows[0]?.n === 0); }
{ const r = await as(D, CD, `select count(*)::int n from public.feedback_admin`); expect('관리자 목록은 관리자만(0)', r.rows[0]?.n === 0); }
const fid = (await as(A, CA, `select id, nickname, grade from public.feedback_admin`, 'A(관리자) 의견 목록')).rows[0]?.id;
{ const r = await as(D, CD, `select public.admin_update_feedback(${fid}, 'done', '고쳤어요')`); expect('일반 학생 상태 변경 불가', !r.ok); }
{ const r = await as(A, CA, `select public.admin_update_feedback(${fid}, 'done', '고쳤어요')`); await as(A, CA, `select public.admin_update_feedback(${fid}, 'done', '다시')`);
  const t = await q(`select count(*)::int n from public.token_ledger where user_id='${B}' and reason='feedback_done'`);
  const mine = await as(B, CB, `select status, reply from public.feedback`);
  expect('반영 완료 → 작성자 +5 (한 번만), 답변 보임', r.ok && t.rows[0]?.n === 1 && mine.rows[0]?.status === 'done' && mine.rows[0]?.reply === '다시'); }


// ───────── 게임 ─────────
const sg = async (u, game, at) => q(`select public._start_game('${u}', '${game}', '${at}') r`);
const ans1 = async (u, id, idx, choice, at) => (await q(`select public._answer_game('${u}', '${id}', ${idx}, ${choice}, '${at}') r`)).rows[0]?.r;
const fin = async (u, id, at) => q(`select public._finish_game('${u}', '${id}', '${at}') r`);
const keyOf = async (id) => (await q(`select questions from public.game_runs where id='${id}'`)).rows[0]?.questions ?? [];
const plusSec = (base, s) => new Date(new Date(base).getTime() + s * 1000).toISOString();
// 정답 목록(choices 번호)을 base 시각부터 step초 간격으로 차례로 답한다
const play = async (u, id, base, choices, step = 1) => { let last; for (let k = 0; k < choices.length; k++) last = await ans1(u, id, k, choices[k], plusSec(base, (k + 1) * step)); return last; };
{ const r = await as(A, CA, `select public._start_game('${A}', 'word', now())`, '학생이 _start_game 직접(막혀야 함)'); expect('게임 본체 직접 호출 차단', !r.ok); }
{ const r = await sg(A, 'word', '2026-11-09 09:00+09'); expect('수업 시간(1교시)엔 게임 시작 불가', !r.ok && /수업 시간/.test(r.err ?? '')); }
{ const r = await sg(A, 'word', '2026-11-09 15:40+09'); expect('7교시 없는 날 15:40은 게임 가능(첫 판 무료)', r.ok && r.rows[0]?.r?.cost === 0); }
const balA0 = await bal(A);
const T1 = '2026-11-09T09:00:00Z'; // 18:00 KST
const g1 = (await sg(A, 'math', T1)).rows[0]?.r;
expect('두 번째 판은 5토큰', g1?.cost === 5 && (await bal(A)) === balA0 - 5);
expect('앱에 보내는 문제엔 정답이 없음', Array.isArray(g1?.questions) && g1.questions.length === 40 && g1.questions.every((x) => !('a' in x) && x.choices.length === 4));
{ const key = await keyOf(g1.id); const okMath = key.every((x) => { const v = Function(`return ${x.q.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')}`)(); return Number(x.choices[x.a]) === v && new Set(x.choices).size === 4; });
  expect('암산 문제 40개 정답이 모두 맞음·보기 중복 없음', okMath); }
{ const key = await keyOf(g1.id);
  const first = await ans1(A, g1.id, 0, key[0].a, plusSec(T1, 1));
  expect('한 문제 답하면 바로 채점(정답 번호 공개)', first?.accepted === true && first?.correct === true && first?.answer === key[0].a && first?.score === 10);
  const skip = await ans1(A, g1.id, 5, 0, plusSec(T1, 2)); expect('순서 건너뛰기 거부', skip?.accepted === false && skip?.reason === 'order');
  const fast = await ans1(A, g1.id, 1, key[1].a, plusSec(T1, 1.1)); expect('0.35초 안에 연달아 답하면 거부', fast?.accepted === false && fast?.reason === 'too_fast');
  const choices = key.slice(1, 10).map((x) => x.a).concat([(key[10].a + 1) % 4, (key[11].a + 1) % 4]);
  let last; for (let k = 0; k < choices.length; k++) last = await ans1(A, g1.id, k + 1, choices[k], plusSec(T1, 2 + k));
  expect('채점: 10개 연속 정답 콤보 170점, 오답에 콤보 끊김', last?.score === 170 && last?.combo === 0);
  const late = await ans1(A, g1.id, 12, key[12].a, plusSec(T1, 63)); expect('제한 시간 지나면 안 받음', late?.accepted === false && late?.reason === 'over');
  const r = (await fin(A, g1.id, plusSec(T1, 64))).rows[0]?.r;
  expect('끝내기 결과: 170점 10개 맞음 2개 틀림, 첫 기록이라 보상 없음', r?.score === 170 && r?.correct === 10 && r?.wrong === 2 && r?.reward === 0 && r?.new_best === true && r?.review?.length === 12);
  const again = (await fin(A, g1.id, plusSec(T1, 70))).rows[0]?.r; expect('끝내기 다시 불러도 같은 결과', again?.score === 170 && again?.reward === 0); }
const T3 = '2026-11-09T09:10:00Z';
const g3 = (await sg(A, 'math', T3)).rows[0]?.r;
{ const key = await keyOf(g3.id); await play(A, g3.id, T3, key.slice(0, 20).map((x) => x.a)); const r = (await fin(A, g3.id, plusSec(T3, 30))).rows[0]?.r;
  expect('주간 최고 기록 경신 → +2', r?.new_best === true && r?.reward === 2 && r?.score === 370); }
const T4 = '2026-11-09T09:15:00Z';
const g4 = (await sg(A, 'math', T4)).rows[0]?.r;
{ const key = await keyOf(g4.id); await play(A, g4.id, T4, key.slice(0, 25).map((x) => x.a)); const r = (await fin(A, g4.id, plusSec(T4, 30))).rows[0]?.r;
  expect('같은 날 같은 게임 기록 경신 보상은 한 번만', r?.new_best === true && r?.reward === 0 && r?.score === 470); }
const T5 = '2026-11-09T09:20:00Z';
const g5 = (await sg(A, 'word', T5)).rows[0]?.r;
{ const key = await keyOf(g5.id); const words = (await q(`select word, meaning from public.game_words`)).rows; const dict = Object.fromEntries(words.map((w) => [w.word, w.meaning]));
  expect('영단어 문제 정답이 단어장 뜻과 일치', key.length === 40 && key.every((x) => x.choices[x.a] === dict[x.q] && new Set(x.choices).size === 4)); }
{ const r = await ans1(B, g5.id, 0, 0, plusSec(T5, 1)); expect('남의 게임에 답할 수 없음', r === undefined); }
await q(`insert into public.meals_cache values ('2026-11-10', 2, array['잡곡밥','제육볶음','된장국','깍두기']), ('2026-11-11', 2, array['카레라이스','치킨너겟','계란국'])`);
await q(`insert into public.class_lessons values (2026,2,8,'2026-11-11',1,'영어Ⅱ'),(2026,2,8,'2026-11-11',2,'화학Ⅰ'),(2026,2,8,'2026-11-11',3,'생명과학Ⅰ')`);
const g6 = (await sg(A, 'life', '2026-11-09 18:25+09')).rows[0]?.r;
{ const key = await keyOf(g6.id); expect('라이프 퀴즈: 동기화된 급식·시간표·학사일정 문제 포함', g6?.duration_s === 90 && key.length >= 8 && key.some((x) => /점심/.test(x.q) && /\//.test(x.q)) && key.some((x) => /우리 반/.test(x.q)) && key.some((x) => /지필평가/.test(x.q)) && key.every((x) => x.choices.length === 4)); }
for (let k = 0; k < 4; k++) await sg(A, 'word', `2026-11-09 19:0${k}+09`);
{ const r = await sg(A, 'word', '2026-11-09 19:30+09'); expect('하루 10판 제한', !r.ok && /10판/.test(r.err ?? '')); }
{ const r = await sg(A, 'word', '2026-11-10 18:00+09'); expect('다음 날 첫 판은 무료', r.ok && r.rows[0]?.r?.cost === 0); }
{ const r = await as(B, CB, `select count(*)::int n from public.game_runs`); const w = await as(B, CB, `select count(*)::int n from public.game_words`); expect('게임 기록·단어장(정답) 직접 조회 불가', r.rows[0]?.n === 0 && w.rows[0]?.n === 0); }
{ const r = await as(B, CB, `select public.game_ranking('math', '2026-11-09') r`, 'B 게임 랭킹'); const k = r.rows[0]?.r;
  expect('게임 랭킹: A 1위(470), 학년 표시, 계정 정보 없음', k?.top?.[0]?.score === 470 && k?.top?.[0]?.nickname === '구름위' && k?.top?.[0]?.grade === 2 && !JSON.stringify(k).includes(A) && k?.me === null); }
{ const r = await as(A, CA, `select public.game_status() r`); expect('게임 상태', r.ok && typeof r.rows[0]?.r?.plays_today === 'number'); }
// 주간 정산 (지난 주)
const TP = '2026-10-14T09:00:00Z';
const gp = (await sg(D, 'word', TP)).rows[0]?.r;
{ const key = await keyOf(gp.id); await play(D, gp.id, TP, key.slice(0, 5).map((x) => x.a)); await fin(D, gp.id, plusSec(TP, 20)); }
{ const r = await as(A, CA, `select public.settle_game_week('2026-10-12') r`); const r2 = await as(B, CB, `select public.settle_game_week('2026-10-12') r`);
  const t = await q(`select count(*)::int n from public.token_ledger where user_id='${D}' and reason='game_weekly'`);
  const badge = await q(`select count(*)::int n from public.inventory where user_id='${D}' and item_id='b_gameking'`);
  expect('주간 정산: 1위 +30·배지, 두 번 불러도 한 번만', r.rows[0]?.r?.paid === 1 && r2.rows[0]?.r?.paid === 0 && t.rows[0]?.n === 1 && badge.rows[0]?.n === 1); }
{ const r = await as(A, CA, `select public.settle_game_week(public.seoul_today()) r`); expect('이번 주는 아직 정산 안 함', r.rows[0]?.r?.settled === false); }
{ const r = await as(D, CD, `select public.buy_item('b_gameking')`); expect('게임왕 배지는 살 수 없음', !r.ok); }
{ const r = await as(D, CD, `select public.equip_item('badge', 'b_gameking') w`); expect('받은 게임왕 배지는 장착 가능', r.ok && r.rows[0]?.w?.equip?.badge === 'b_gameking'); }

console.log(failed ? `\n${failed}개 실패` : '\n모든 DB 규칙 검사 통과');
process.exit(failed ? 1 : 0);
