// 학교 데이터의 공통 형식 + NEIS 응답 해석기.
// 서버(api/)와 앱이 같이 쓴다. 네트워크 코드는 없고 순수 함수만 둔다(테스트하기 쉽게).

export type MealType = '조식' | '중식' | '석식';

export type Dish = { name: string; allergens: number[] };

export type Meal = { date: string; type: MealType; dishes: Dish[]; kcal: number | null };

export type Lesson = { date: string; period: number; subject: string; room: string | null };

export type SchoolEvent = { date: string; name: string; holiday: boolean };

export type ApiResult<T> = { items: T[]; source: 'neis' | 'sample'; fetchedAt: string };

export const ALLERGENS: Record<number, string> = {
  1: '난류', 2: '우유', 3: '메밀', 4: '땅콩', 5: '대두', 6: '밀', 7: '고등어', 8: '게', 9: '새우',
  10: '돼지고기', 11: '복숭아', 12: '토마토', 13: '아황산류', 14: '호두', 15: '닭고기', 16: '쇠고기',
  17: '오징어', 18: '조개류', 19: '잣',
};

const MEAL_TYPE: Record<string, MealType> = { '1': '조식', '2': '중식', '3': '석식' };

type Row = Record<string, string | undefined>;

/** NEIS 응답 { <service>: [ {head}, {row:[...]} ] } 에서 row 배열만 꺼낸다. 데이터 없음(INFO-200)은 빈 배열. */
export function neisRows(json: unknown, service: string): Row[] {
  if (!json || typeof json !== 'object') throw new Error('NEIS: 응답이 JSON이 아님');
  const obj = json as Record<string, unknown>;
  const top = obj.RESULT as { CODE?: string; MESSAGE?: string } | undefined;
  if (top?.CODE) {
    if (top.CODE === 'INFO-200') return [];
    throw new Error(`NEIS ${top.CODE}: ${top.MESSAGE ?? ''}`);
  }
  const blocks = obj[service];
  if (!Array.isArray(blocks)) throw new Error(`NEIS: ${service} 블록 없음`);
  const head = (blocks[0] as { head?: Array<Record<string, unknown>> })?.head;
  const result = head?.find((h) => 'RESULT' in h)?.RESULT as { CODE?: string; MESSAGE?: string } | undefined;
  if (result?.CODE && result.CODE !== 'INFO-000') throw new Error(`NEIS ${result.CODE}: ${result.MESSAGE ?? ''}`);
  const rows = (blocks[1] as { row?: Row[] })?.row;
  return Array.isArray(rows) ? rows : [];
}

/** '닭강정 (1.5.6.13.15)' → { name: '닭강정', allergens: [1,5,6,13,15] } */
export function parseDish(raw: string): Dish | null {
  let text = raw.replace(/&amp;/g, '&').trim();
  let allergens: number[] = [];
  // 끝에 붙은 알레르기 번호: '(1.5.6)' 또는 괄호 없이 ' 1.5.6.' / ' 2.'
  const m = text.match(/\s*(?:\(\s*((?:\d{1,2}\s*\.\s*)*\d{1,2})\s*\.?\s*\)|\s((?:\d{1,2}\.)+\d{0,2}))\s*$/);
  if (m) {
    allergens = (m[1] ?? m[2] ?? '')
      .split('.')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 19);
    text = text.slice(0, m.index).trim();
  }
  text = text.replace(/^[*★☆#@]+|[*★☆#@]+$/g, '').replace(/\s{2,}/g, ' ').trim();
  if (!text) return null;
  return { name: text, allergens: [...new Set(allergens)] };
}

export function parseMeals(rows: Row[]): Meal[] {
  return rows
    .map((r) => {
      const dishes = (r.DDISH_NM ?? '')
        .split(/<br\s*\/?>/i)
        .map(parseDish)
        .filter((d): d is Dish => d !== null);
      const kcal = parseFloat((r.CAL_INFO ?? '').replace(/[^\d.]/g, ''));
      return {
        date: r.MLSV_YMD ?? '',
        type: MEAL_TYPE[r.MMEAL_SC_CODE ?? ''] ?? '중식',
        dishes,
        kcal: Number.isFinite(kcal) ? Math.round(kcal) : null,
      };
    })
    .filter((m) => /^\d{8}$/.test(m.date) && m.dishes.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || order(a.type) - order(b.type));
}

const order = (t: MealType) => (t === '조식' ? 0 : t === '중식' ? 1 : 2);

export function parseTimetable(rows: Row[]): Lesson[] {
  const seen = new Set<string>();
  const out: Lesson[] = [];
  for (const r of rows) {
    const date = r.ALL_TI_YMD ?? '';
    const period = Number(r.PERIO);
    const subject = (r.ITRT_CNTNT ?? '').replace(/^[-\s]+/, '').trim();
    if (!/^\d{8}$/.test(date) || !Number.isInteger(period) || !subject) continue;
    const key = `${date}-${period}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ date, period, subject, room: r.CLRM_NM?.trim() || null });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period);
}

export function parseSchedule(rows: Row[]): SchoolEvent[] {
  return rows
    .map((r) => ({
      date: r.AA_YMD ?? '',
      name: (r.EVENT_NM ?? '').trim(),
      holiday: (r.SBTR_DD_SC_NM ?? '').includes('휴업'),
    }))
    .filter((e) => /^\d{8}$/.test(e.date) && e.name && e.name !== '토요휴업일')
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** 시험처럼 D-day를 크게 보여 줄 만한 일정인지 */
export function isMajorEvent(e: SchoolEvent) {
  return /고사|평가|시험|수능|모의|방학|축제|체육대회|수학여행/.test(e.name);
}
