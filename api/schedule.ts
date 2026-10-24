// GET /api/schedule?from=20261001&to=20261231 → 학사일정
import { parseSchedule } from '../src/lib/school';
import { fail, neis, ok, rangeParams } from './_neis';

export async function GET(request: Request) {
  try {
    const { from, to } = rangeParams(request, 200);
    const rows = await neis('SchoolSchedule', { AA_FROM_YMD: from, AA_TO_YMD: to });
    return ok(parseSchedule(rows));
  } catch (e) {
    return fail(e);
  }
}
