// Vercel 서버 함수 공용 도우미 ('_'로 시작하는 파일은 주소가 생기지 않는다).
// NEIS 인증키는 Vercel 환경변수 NEIS_API_KEY 에만 둔다. 앱에는 절대 넣지 않는다.

import { neisRows } from '../src/lib/school';

const BASE = 'https://open.neis.go.kr/hub';
const OFFICE = process.env.NEIS_OFFICE_CODE || 'J10'; // 경기도교육청
const SCHOOL_NAME = '운중고등학교';

// 운중고 표준학교코드(2026-10-24 NEIS schoolInfo로 확인). 환경변수로 바꿀 수 있다.
let schoolCodeCache: string | null = process.env.NEIS_SCHOOL_CODE || '7530941';

async function neisGet(service: string, params: Record<string, string | number>) {
  const url = new URL(`${BASE}/${service}`);
  url.searchParams.set('Type', 'json');
  url.searchParams.set('pIndex', '1');
  // 인증키가 없으면 NEIS가 한 번에 5건까지만 준다
  url.searchParams.set('pSize', process.env.NEIS_API_KEY ? '1000' : '5');
  if (process.env.NEIS_API_KEY) url.searchParams.set('KEY', process.env.NEIS_API_KEY);
  url.searchParams.set('ATPT_OFCDC_SC_CODE', OFFICE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`NEIS HTTP ${res.status}`);
  return neisRows(await res.json(), service);
}

export async function schoolCode() {
  if (schoolCodeCache) return schoolCodeCache;
  const rows = await neisGet('schoolInfo', { SCHUL_NM: SCHOOL_NAME });
  const hit = rows.find((r) => r.SCHUL_NM === SCHOOL_NAME) ?? rows[0];
  if (!hit?.SD_SCHUL_CODE) throw new Error('운중고 학교 코드를 찾지 못함');
  schoolCodeCache = hit.SD_SCHUL_CODE;
  return schoolCodeCache;
}

export async function neis(service: string, params: Record<string, string | number>) {
  return neisGet(service, { SD_SCHUL_CODE: await schoolCode(), ...params });
}

const YMD = /^\d{8}$/;

export function rangeParams(request: Request, maxDays = 62) {
  const u = new URL(request.url);
  const from = u.searchParams.get('from') ?? '';
  const to = u.searchParams.get('to') ?? '';
  if (!YMD.test(from) || !YMD.test(to) || from > to) throw new BadRequest('from/to는 YYYYMMDD 형식');
  const span = (Date.UTC(+to.slice(0, 4), +to.slice(4, 6) - 1, +to.slice(6)) -
    Date.UTC(+from.slice(0, 4), +from.slice(4, 6) - 1, +from.slice(6))) / 86400000;
  if (span > maxDays) throw new BadRequest(`최대 ${maxDays}일까지 조회할 수 있음`);
  return { from, to, url: u };
}

export class BadRequest extends Error {}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

/** 성공 응답: CDN에 1시간 저장, 그 뒤 하루 동안은 옛 응답을 주면서 뒤에서 갱신 */
export function ok(items: unknown[]) {
  return Response.json(
    { items, source: 'neis', fetchedAt: new Date().toISOString() },
    { headers: { ...CORS, 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
  );
}

export function fail(e: unknown) {
  const status = e instanceof BadRequest ? 400 : 502;
  const message = e instanceof Error ? e.message : 'unknown error';
  return Response.json({ error: message }, { status, headers: { ...CORS, 'Cache-Control': 'no-store' } });
}
