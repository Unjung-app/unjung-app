// GET /api/health → 서버 상태 점검 (키 값은 절대 내보내지 않고 '있는지'만 알려 준다)
import { schoolCode } from './_neis';

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
