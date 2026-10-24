// 운중고 일과표 (2026-10-24 호원 제공)
// 1·2학년: 4교시 11:40–12:30 → 점심 12:30–13:30
// 3학년:   점심 11:30–12:30 → 4교시 12:30–13:20

export type Period = { period: number; start: number; end: number };

const t = (h: number, m: number) => h * 60 + m;

const COMMON_HEAD: Period[] = [
  { period: 1, start: t(8, 40), end: t(9, 30) },
  { period: 2, start: t(9, 40), end: t(10, 30) },
  { period: 3, start: t(10, 40), end: t(11, 30) },
];

const COMMON_TAIL: Period[] = [
  { period: 5, start: t(13, 30), end: t(14, 20) },
  { period: 6, start: t(14, 30), end: t(15, 20) },
  { period: 7, start: t(15, 30), end: t(16, 20) },
];

const BELLS: Record<1 | 2 | 3, { periods: Period[]; lunch: { start: number; end: number } }> = {
  1: { periods: [...COMMON_HEAD, { period: 4, start: t(11, 40), end: t(12, 30) }, ...COMMON_TAIL], lunch: { start: t(12, 30), end: t(13, 30) } },
  2: { periods: [...COMMON_HEAD, { period: 4, start: t(11, 40), end: t(12, 30) }, ...COMMON_TAIL], lunch: { start: t(12, 30), end: t(13, 30) } },
  3: { periods: [...COMMON_HEAD, { period: 4, start: t(12, 30), end: t(13, 20) }, ...COMMON_TAIL], lunch: { start: t(11, 30), end: t(12, 30) } },
};

/** 학년별 교시표. 학년을 모르면 1·2학년 기준 */
export function bellFor(grade: number | null | undefined) {
  return BELLS[(grade === 3 ? 3 : grade === 1 ? 1 : 2) as 1 | 2 | 3];
}

export type DayPhase =
  | { kind: 'before'; next: Period }
  | { kind: 'class'; current: Period; remaining: number }
  | { kind: 'break'; next: Period; minutesUntil: number }
  | { kind: 'lunch'; next: Period; minutesUntil: number }
  | { kind: 'after' };

/** 지금 시각(분)이 하루 중 어디인지. lastPeriod = 그날 마지막 교시 */
export function phaseAt(minutes: number, lastPeriod: number, grade: number | null | undefined): DayPhase {
  const { periods, lunch } = bellFor(grade);
  const day = periods.filter((p) => p.period <= lastPeriod);
  if (day.length === 0) return { kind: 'after' };
  if (minutes < day[0].start) return { kind: 'before', next: day[0] };
  for (let i = 0; i < day.length; i++) {
    const p = day[i];
    if (minutes >= p.start && minutes < p.end) return { kind: 'class', current: p, remaining: p.end - minutes };
    const next = day[i + 1];
    if (next && minutes >= p.end && minutes < next.start) {
      const inLunch = minutes >= lunch.start && minutes < lunch.end;
      return { kind: inLunch ? 'lunch' : 'break', next, minutesUntil: next.start - minutes };
    }
  }
  return { kind: 'after' };
}

/** 점심시간이 끝났는가 (홈에서 점심/저녁 카드를 바꿀 때) */
export function lunchOver(minutes: number, grade: number | null | undefined) {
  return minutes >= bellFor(grade).lunch.end;
}
