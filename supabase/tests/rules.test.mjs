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
  create role anon nologin; create role authenticated nologin;
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

console.log(failed ? `\n${failed}개 실패` : '\n모든 DB 규칙 검사 통과');
process.exit(failed ? 1 : 0);
