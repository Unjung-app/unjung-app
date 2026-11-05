// 토큰 보상 표(앱 문구용). 실제 지급은 서버(DB 함수)가 하며, 값을 바꿀 때는 DB 마이그레이션과 함께 바꾼다.
// 기준: supabase/migrations/20261113000000_m5_balance_admin.sql

export const REWARD = {
  checkIn: 2,
  streak7: 10,
  streak30: 30,
  mealReview: 3,
  mealLike: 1,
  mealLikeDailyCap: 5,
  /** 집중 모드: 처음 2시간은 10분마다 +1, 그 뒤 4시간까지 15분마다 +1 */
  studyDailyCap: 20,
  taskConfirmed: 3,
  taskDailyCap: 6,
  noticeApproved: 20,
  lostFound: 10,
  lostWeeklyCap: 20,
  review: 2,
  reviewDailyCap: 10,
  survey: 3,
  feedbackDone: 10,
  gameBest: 2,
  gameWeekly: [30, 20, 10] as const,
  gameFee: 5,
} as const;

/** 오늘 공부한 시간(초)으로 받은 공부 토큰 수 (서버 study_tokens_for와 같은 계산) */
export function studyTokensFor(seconds: number) {
  const s = Math.max(0, seconds);
  return Math.min(12, Math.floor(s / 600)) + Math.min(8, Math.floor(Math.max(0, s - 7200) / 900));
}

/** 다음 공부 토큰까지 남은 초 (하루 최대면 null) */
export function secondsToNextStudyToken(seconds: number) {
  const now = studyTokensFor(seconds);
  if (now >= REWARD.studyDailyCap) return null;
  const next = now < 12 ? (now + 1) * 600 : 7200 + (now - 12 + 1) * 900;
  return Math.max(0, next - seconds);
}
