// 일과표(교시별 시작·끝 시각).
// TODO(호원 확인): 운중고 실제 일과표로 교체. 지금 값은 일반적인 고등학교 기준 가정치다.

export type Period = { period: number; start: number; end: number };

const t = (h: number, m: number) => h * 60 + m;

export const BELL: Period[] = [
  { period: 1, start: t(8, 40), end: t(9, 30) },
  { period: 2, start: t(9, 40), end: t(10, 30) },
  { period: 3, start: t(10, 40), end: t(11, 30) },
  { period: 4, start: t(11, 40), end: t(12, 30) },
  { period: 5, start: t(13, 30), end: t(14, 20) },
  { period: 6, start: t(14, 30), end: t(15, 20) },
  { period: 7, start: t(15, 30), end: t(16, 20) },
];

export const LUNCH = { start: t(12, 30), end: t(13, 30) };

export const BELL_IS_PROVISIONAL = true;

export type DayPhase =
  | { kind: 'before'; next: Period }
  | { kind: 'class'; current: Period; remaining: number }
  | { kind: 'break'; next: Period; minutesUntil: number }
  | { kind: 'lunch'; next: Period; minutesUntil: number }
  | { kind: 'after' };

/** 지금 시각(분)이 하루 중 어디인지. lastPeriod = 그날 마지막 교시 */
export function phaseAt(minutes: number, lastPeriod: number): DayPhase {
  const day = BELL.filter((p) => p.period <= lastPeriod);
  if (day.length === 0) return { kind: 'after' };
  if (minutes < day[0].start) return { kind: 'before', next: day[0] };
  for (let i = 0; i < day.length; i++) {
    const p = day[i];
    if (minutes >= p.start && minutes < p.end) return { kind: 'class', current: p, remaining: p.end - minutes };
    const next = day[i + 1];
    if (next && minutes >= p.end && minutes < next.start) {
      const inLunch = minutes >= LUNCH.start && minutes < LUNCH.end;
      return { kind: inLunch ? 'lunch' : 'break', next, minutesUntil: next.start - minutes };
    }
  }
  return { kind: 'after' };
}
