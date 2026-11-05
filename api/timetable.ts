// GET /api/timetable?grade=2&class=8&from=20261026&to=20261030 → 반 시간표
import { parseTimetable } from '../src/lib/school';
import { schoolTerm } from '../src/lib/date';
import { BadRequest, fail, neis, ok, rangeParams } from './_neis';

export async function GET(request: Request) {
  try {
    const { from, to, url } = rangeParams(request, 14);
    const grade = Number(url.searchParams.get('grade'));
    const classNo = Number(url.searchParams.get('class'));
    if (![1, 2, 3].includes(grade) || !Number.isInteger(classNo) || classNo < 1 || classNo > 20) {
      throw new BadRequest('grade(1~3)와 class(1~20)가 필요함');
    }
    const { year, semester } = schoolTerm(from);
    const rows = await neis('hisTimetable', {
      AY: year,
      SEM: semester,
      GRADE: grade,
      CLASS_NM: classNo,
      TI_FROM_YMD: from,
      TI_TO_YMD: to,
    });
    return ok(parseTimetable(rows));
  } catch (e) {
    return fail(e);
  }
}
