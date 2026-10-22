// 기능 목록 읽기 — app/<기능>/feature.json 파일들을 모아 검사합니다.
// 홈 화면·메뉴(gen-features.mjs)와 도우미 스크립트(new/work/save/ai)가 함께 씁니다.
// 대표만 수정합니다.

import fs from "node:fs";
import path from "node:path";

// components/Icon.js 에 들어 있는 아이콘 이름. 이 밖의 값은 이모지 한 글자로 씁니다.
export const ICON_NAMES = [
  "home", "meal", "calendar", "sports", "voice", "book", "bell", "star", "quiz", "timer", "grid",
];

export const STATUSES = {
  idea: "아이디어",
  building: "만드는 중",
  ready: "사용 가능",
};

// 주소로 쓰이는 폴더 이름: 영어 소문자·숫자·하이픈, 2~30글자
export const SLUG_RE = /^[a-z][a-z0-9-]{1,29}$/;

// app/ 안에서 기능 폴더가 아닌 것 (Next.js 예약 이름 등)
const RESERVED = new Set(["api", "makers"]);

function isEmoji(s) {
  return typeof s === "string" && s.length > 0 && s.length <= 8 && /\p{Extended_Pictographic}/u.test(s);
}

// 한 기능 폴더의 feature.json 을 읽고, 문제가 있으면 errors 에 쉬운 말로 적습니다.
export function readFeature(root, slug) {
  const file = path.join(root, "app", slug, "feature.json");
  const where = `app/${slug}/feature.json`;
  const errors = [];
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return { feature: null, errors: [`${where}: JSON 형식이 깨졌습니다 (${e.message})`] };
  }

  if (!SLUG_RE.test(slug)) errors.push(`${where}: 폴더 이름은 영어 소문자·숫자·하이픈만 씁니다`);
  if (!raw.title || typeof raw.title !== "string") errors.push(`${where}: "title"(기능 이름)이 필요합니다`);
  if (raw.status && !STATUSES[raw.status]) {
    errors.push(`${where}: "status"는 ${Object.keys(STATUSES).join(" / ")} 중 하나여야 합니다`);
  }
  const icon = raw.icon || "grid";
  if (!ICON_NAMES.includes(icon) && !isEmoji(icon)) {
    errors.push(`${where}: "icon"은 ${ICON_NAMES.join(", ")} 중 하나이거나 이모지 한 개여야 합니다`);
  }
  if (raw.makers && !Array.isArray(raw.makers)) errors.push(`${where}: "makers"는 ["이름", "이름"] 모양이어야 합니다`);

  const feature = {
    slug,
    title: String(raw.title || slug),
    short: String(raw.short || raw.title || slug).slice(0, 6),
    desc: String(raw.desc || ""),
    icon,
    status: STATUSES[raw.status] ? raw.status : "idea",
    makers: Array.isArray(raw.makers) ? raw.makers.map(String) : [],
    order: Number.isFinite(raw.order) ? raw.order : 1000,
  };
  return { feature, errors };
}

// 모든 기능 읽기. 순서: order → 이름
export function readFeatures(root = process.cwd()) {
  const appDir = path.join(root, "app");
  const features = [];
  const errors = [];
  for (const d of fs.readdirSync(appDir, { withFileTypes: true })) {
    if (!d.isDirectory() || RESERVED.has(d.name) || d.name.startsWith("_") || d.name.startsWith("(")) continue;
    if (!fs.existsSync(path.join(appDir, d.name, "feature.json"))) continue;
    const r = readFeature(root, d.name);
    errors.push(...r.errors);
    if (r.feature) features.push(r.feature);
  }
  features.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ko"));
  return { features, errors };
}
