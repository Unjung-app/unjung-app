// GET /api/meal?from=20261026&to=20261030 → 그 기간의 조식·중식·석식
import { parseMeals } from '../src/lib/school';
import { fail, neis, ok, rangeParams } from './_neis';

export async function GET(request: Request) {
  try {
    const { from, to } = rangeParams(request);
    const rows = await neis('mealServiceDietInfo', { MLSV_FROM_YMD: from, MLSV_TO_YMD: to });
    return ok(parseMeals(rows));
  } catch (e) {
    return fail(e);
  }
}
