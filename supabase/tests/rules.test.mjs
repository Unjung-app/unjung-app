import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
// DB 규칙 검사: Supabase의 auth 스키마를 흉내 낸 PGlite에 마이그레이션을 모두 적용하고,
// '막혀야 하는 것은 막히고, 되어야 하는 것은 되는지' 확인한다. 기대와 다르면 실패.
let failed = 0;
const expect = (label, ok) => { if (!ok) { failed++; console.log('FAIL', label); } };
const db = new PGlite();
const q = async (sql, label) => { try { const r = await db.query(sql); if (label) console.log('ok  ', label, JSON.stringify(r.rows)); return { ok: true, rows: r.rows }; } catch (e) { if (label) console.log('deny', label + ':', e.message); return { ok: false, rows: [] }; } };
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
console.log(failed ? `\n${failed}개 실패` : '\n모든 DB 규칙 검사 통과');
process.exit(failed ? 1 : 0);
