// 앱 전체에서 공용으로 쓰는 9개 기능 메뉴 정의.
// 여기만 고치면 홈 그리드 · 하단 탭바 · 더보기 시트가 모두 함께 바뀝니다.

export const MENU = [
  {
    key: "meal",
    href: "/meal",
    label: "급식 정보",
    short: "급식",
    icon: "meal",
    desc: "오늘·이번 주 식단과 영양 정보",
  },
  {
    key: "timetable",
    href: "/timetable",
    label: "시간표 · 학사일정",
    short: "시간표",
    icon: "calendar",
    desc: "내 반 시간표와 학교 일정",
  },
  {
    key: "sports",
    href: "/sports",
    label: "교내 스포츠 허브",
    short: "스포츠",
    icon: "sports",
    desc: "반 대항전 일정과 경기 결과",
  },
  {
    key: "voice",
    href: "/voice",
    label: "운중 보이스",
    short: "보이스",
    icon: "voice",
    desc: "학생 건의와 학교 응답",
  },
  {
    key: "library",
    href: "/library",
    label: "도서관 장서 검색",
    short: "도서관",
    icon: "book",
    desc: "장서 검색과 대출 현황",
  },
  {
    key: "notice",
    href: "/notice",
    label: "통합 공지",
    short: "공지",
    icon: "bell",
    desc: "학교·학년·학급 공지 모아보기",
  },
  {
    key: "meal-review",
    href: "/meal-review",
    label: "급식 메뉴 평가",
    short: "평가",
    icon: "star",
    desc: "오늘 급식 별점과 한 줄 평",
  },
  {
    key: "quiz",
    href: "/quiz",
    label: "학업 연계 미니게임",
    short: "퀴즈",
    icon: "quiz",
    desc: "수업 내용으로 푸는 짧은 퀴즈",
  },
  {
    key: "study",
    href: "/study",
    label: "전학년 공부시간 경쟁",
    short: "공부",
    icon: "timer",
    desc: "공부시간 기록과 학년별 순위",
  },
];

// 하단 탭바에 고정으로 노출할 주요 메뉴 (나머지는 '더보기'에서)
export const PRIMARY_TAB_KEYS = ["meal", "timetable", "notice", "study"];

export const PRIMARY_TABS = PRIMARY_TAB_KEYS.map((key) =>
  MENU.find((item) => item.key === key)
);

export function findMenuByHref(href) {
  return MENU.find((item) => item.href === href);
}
