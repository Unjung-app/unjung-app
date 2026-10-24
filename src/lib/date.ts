// 날짜는 기기 시간대와 상관없이 항상 한국 시간 기준으로 계산한다.
// 내부 표현: 'YYYYMMDD' 문자열 (NEIS와 같은 형식)

export type Ymd = string;

const DOW = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function seoulNow(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const y = get('year');
  const m = get('month');
  const d = get('day');
  return { y, m, d, ymd: toYmd(y, m, d), minutes: get('hour') * 60 + get('minute') };
}

export function toYmd(y: number, m: number, d: number): Ymd {
  return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
}

export function parseYmd(ymd: Ymd) {
  return { y: Number(ymd.slice(0, 4)), m: Number(ymd.slice(4, 6)), d: Number(ymd.slice(6, 8)) };
}

/** 달력 계산은 UTC 자정 기준 Date로 해서 시간대 영향을 없앤다 */
function utc(ymd: Ymd) {
  const { y, m, d } = parseYmd(ymd);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): Ymd {
  return toYmd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function addDays(ymd: Ymd, n: number): Ymd {
  const t = utc(ymd);
  t.setUTCDate(t.getUTCDate() + n);
  return fromUtc(t);
}

/** 0=일 … 6=토 */
export function dayOfWeek(ymd: Ymd) {
  return utc(ymd).getUTCDay();
}

export function weekdayLabel(ymd: Ymd) {
  return DOW[dayOfWeek(ymd)];
}

/** 그 주 월요일 */
export function mondayOf(ymd: Ymd): Ymd {
  const dow = dayOfWeek(ymd);
  return addDays(ymd, dow === 0 ? -6 : 1 - dow);
}

export function isWeekend(ymd: Ymd) {
  const dow = dayOfWeek(ymd);
  return dow === 0 || dow === 6;
}

export function diffDays(from: Ymd, to: Ymd) {
  return Math.round((utc(to).getTime() - utc(from).getTime()) / 86400000);
}

/** '10월 26일 월요일' */
export function longLabel(ymd: Ymd) {
  const { m, d } = parseYmd(ymd);
  return `${m}월 ${d}일 ${weekdayLabel(ymd)}요일`;
}

/** '10/26 (월)' */
export function shortLabel(ymd: Ymd) {
  const { m, d } = parseYmd(ymd);
  return `${m}/${d} (${weekdayLabel(ymd)})`;
}

export function dDayLabel(today: Ymd, target: Ymd) {
  const n = diffDays(today, target);
  if (n === 0) return 'D-DAY';
  return n > 0 ? `D-${n}` : `D+${-n}`;
}

/** 학년도·학기: 3~8월 1학기, 9~2월 2학기 (1·2월은 전년도 학년도) */
export function schoolTerm(ymd: Ymd) {
  const { y, m } = parseYmd(ymd);
  if (m >= 3 && m <= 8) return { year: y, semester: 1 as const };
  return { year: m <= 2 ? y - 1 : y, semester: 2 as const };
}

export function hhmm(minutes: number) {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/** 서버 시각(ISO 문자열) → '10월 26일 08:41' (한국 시간) */
export function stampLabel(iso: string) {
  const t = seoulNow(new Date(iso));
  return `${t.m}월 ${t.d}일 ${hhmm(t.minutes)}`;
}

/** 서버 시각 + n일이 아직 안 지났으면 그날의 'M월 D일'(한국 시간), 지났으면 null */
export function untilLabel(iso: string, days: number, now: Date = new Date()) {
  const until = new Date(new Date(iso).getTime() + days * 86400000);
  if (until.getTime() <= now.getTime()) return null;
  const t = seoulNow(until);
  return `${t.m}월 ${t.d}일`;
}

/** 'YYYYMMDD' ↔ 'YYYY-MM-DD' (DB date 형식) */
export function ymdToIso(ymd: Ymd) {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}
export function isoToYmd(iso: string): Ymd {
  return iso.slice(0, 10).replace(/-/g, '');
}

/** 앱이 화면 뒤로 가 있으면 true(웹). 주기적인 새로고침을 이때는 건너뛴다(서버 부하·배터리 절약) */
export function appHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}
