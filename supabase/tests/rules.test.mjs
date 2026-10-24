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
console.log(failed ? `\n${failed}개 실패` : '\n모든 DB 규칙 검사 통과');
process.exit(failed ? 1 : 0);
