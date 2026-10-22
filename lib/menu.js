// 앱 전체에서 공용으로 쓰는 기능 메뉴.
// 기능 목록은 각 기능 폴더의 feature.json 에서 자동으로 만들어집니다 (scripts/gen-features.mjs).
// → 새 기능을 추가할 때 이 파일을 고칠 필요가 없습니다.

import { FEATURES } from "./features.generated";

export const STATUS_LABEL = {
  idea: "아이디어",
  building: "만드는 중",
  ready: "사용 가능",
};

export const MENU = FEATURES.map((f) => ({
  key: f.slug,
  href: `/${f.slug}`,
  label: f.title,
  short: f.short,
  icon: f.icon,
  desc: f.desc,
  status: f.status,
  makers: f.makers,
}));

// 하단 탭바에 고정으로 노출할 주요 메뉴 (나머지는 '더보기'에서). 대표가 정합니다.
export const PRIMARY_TAB_KEYS = ["meal", "timetable", "notice", "study"];

export const PRIMARY_TABS = PRIMARY_TAB_KEYS.map((key) =>
  MENU.find((item) => item.key === key)
).filter(Boolean);

export function findMenuByHref(href) {
  return MENU.find((item) => href === item.href || href.startsWith(item.href + "/"));
}
