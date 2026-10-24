// 매일 새벽(Vercel Cron)에 NEIS 학교 데이터를 Supabase로 옮긴다.
//  · 반별 시간표(이번 주·다음 주): 수업 시간 판정(공부 랭킹·게임 잠금)과 '운중 라이프 퀴즈'에 쓴다.
//  · 급식(2주): 라이프 퀴즈
//  · 학사일정(150일): 쉬는 날(출석 스트릭·수업 시간) + 라이프 퀴즈 D-day
// 필요한 환경변수: SUPABASE_SECRET_KEY(서버 전용, 앱에 절대 넣지 않음). CRON_SECRET은 선택.
// Vercel Cron은 정식(production) 배포에서만 돈다. 그래서 앱이 열릴 때도 이 주소를 한 번 부르고,
// 여기서 '마지막 동기화가 6시간 안이면 건너뛰기'로 스스로 횟수를 제한한다(누가 불러도 NEIS를 과하게 부르지 않음).
import { parseMeals, parseTimetable } from '../../src/lib/school';
import { addDays, mondayOf, schoolTerm, seoulNow } from '../../src/lib/date';
import { splitTags } from '../../src/features/timetable/subjects';
import { neis } from '../_neis';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uikvrgjqcktzcshvaxdj.supabase.co';
const iso = (ymd: string) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

// 너무 많은 NEIS 동시 요청을 피하려고 4개씩 나눠 보낸다
async function inBatches<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

const MIN_GAP_HOURS = 6;

async function lastSyncAt(key: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sync_log?select=ran_at&order=ran_at.desc&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as { ran_at: string }[];
  return rows[0] ? new Date(rows[0].ran_at).getTime() : null;
}

export async function GET(request: Request) {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return json(503, { error: 'SUPABASE_SECRET_KEY 환경변수가 없어요' });
  const secret = process.env.CRON_SECRET;
  const fromCron = !!secret && request.headers.get('authorization') === `Bearer ${secret}`;

  try {
    if (!fromCron) {
      const last = await lastSyncAt(key);
      if (last && Date.now() - last < MIN_GAP_HOURS * 3600_000) return json(200, { skipped: true, last: new Date(last).toISOString() });
    }

    const today = seoulNow().ymd;
    const from = mondayOf(today);
    const to = addDays(from, 13);
    const { year, semester } = schoolTerm(today);

    // 1) 반별 시간표: 3개 학년 × 8반
    const classes = [1, 2, 3].flatMap((grade) => [1, 2, 3, 4, 5, 6, 7, 8].map((classNo) => ({ grade, classNo })));
    const lessonSets = await inBatches(classes, 4, async ({ grade, classNo }) => {
      const rows = await neis('hisTimetable', { AY: year, SEM: semester, GRADE: grade, CLASS_NM: classNo, TI_FROM_YMD: from, TI_TO_YMD: to });
      return parseTimetable(rows).map((l) => ({ grade, class_no: classNo, day: iso(l.date), period: l.period, subject: splitTags(l.subject).name.slice(0, 30) }));
    });
    const lessons = lessonSets.flat().filter((l) => l.period >= 1 && l.period <= 10 && l.subject);

    // 2) 급식
    const meals = parseMeals(await neis('mealServiceDietInfo', { MLSV_FROM_YMD: from, MLSV_TO_YMD: to })).map((m) => ({
      day: iso(m.date),
      code: m.type === '조식' ? 1 : m.type === '석식' ? 3 : 2,
      dishes: m.dishes.map((d) => d.name).slice(0, 15),
    }));

    // 3) 학사일정 (원본 행에서 휴업일·공휴일 구분)
    const evTo = addDays(today, 150);
    const evRows = await neis('SchoolSchedule', { AA_FROM_YMD: today, AA_TO_YMD: evTo });
    const events = evRows
      .map((r) => ({ day: r.AA_YMD ?? '', name: (r.EVENT_NM ?? '').trim(), kind: r.SBTR_DD_SC_NM ?? '' }))
      .filter((e) => /^\d{8}$/.test(e.day) && e.name && e.name !== '토요휴업일')
      .map((e) => ({ day: iso(e.day), name: e.name.slice(0, 40), holiday: /휴업|공휴/.test(e.kind) }));

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sync_school_data`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_school_year: year,
        p_from: iso(from),
        p_to: iso(to),
        p_lessons: lessons,
        p_meals: meals,
        p_events_from: iso(today),
        p_events_to: iso(evTo),
        p_events: events,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return json(502, { error: 'supabase', status: res.status, body });
    return json(200, { ok: true, range: [from, to], lessons: lessons.length, meals: meals.length, events: events.length, db: body });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message ?? e) });
  }
}
