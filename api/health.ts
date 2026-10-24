// GET /api/health → 서버 상태 점검 (키 값은 절대 내보내지 않고 '있는지'만 알려 준다)
import { neis, schoolCode } from './_neis';

export async function GET() {
  const report: Record<string, unknown> = {
    region: process.env.VERCEL_REGION ?? 'unknown',
    hasNeisKey: !!process.env.NEIS_API_KEY,
    keyLength: process.env.NEIS_API_KEY?.length ?? 0,
    time: new Date().toISOString(),
  };
  try {
    const started = Date.now();
    report.schoolCode = await schoolCode();
    // 실제로 NEIS를 한 번 호출해 본다 (이번 달 학사일정, 1건이면 충분)
    const now = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
    const rows = await neis('SchoolSchedule', { AA_FROM_YMD: now.slice(0, 6) + '01', AA_TO_YMD: now.slice(0, 6) + '31' });
    report.sampleRows = rows.length;
    report.neisMs = Date.now() - started;
    report.neis = 'ok';
  } catch (e) {
    report.neis = 'fail';
    report.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    const cause = e instanceof Error ? (e as Error & { cause?: unknown }).cause : undefined;
    if (cause) report.cause = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
  }
  return Response.json(report, { headers: { 'Cache-Control': 'no-store' } });
}
