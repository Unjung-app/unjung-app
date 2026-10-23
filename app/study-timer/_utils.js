// 여러 화면에서 같이 쓰는 작은 도우미 함수들이에요.

// 숫자를 두 자리로 만들기 (5 → "05")
function pad(n) {
  return String(n).padStart(2, "0");
}

// 초 → "01:23:45"
export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

// 초 → "1시간 20분", "15분", "40초"
export function formatShort(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (s === 0) return "0분";
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  if (m > 0) return `${m}분`;
  return `${s}초`;
}

// 날짜 → "2026-10-23" (기록을 날짜별로 묶을 때 써요)
export function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// "2026-10-23" → "오늘", "어제", "10월 21일 (수)"
export function dateLabel(key) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (key === todayKey(today)) return "오늘";
  if (key === todayKey(yesterday)) return "어제";

  const [y, m, d] = key.split("-").map(Number);
  const day = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${day})`;
}

// 저장한 시각 → "오후 3:24"
export function clockLabel(timestamp) {
  return new Date(timestamp).toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// 겹치지 않는 아이디 만들기
export function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}