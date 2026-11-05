// 작업 대상(= 고칠 수 있는 폴더) 목록.
//  - 정식 기능: src/features/<id>/   (목록은 src/features/registry.ts)
//  - 실험실 기능: src/lab/<이름>/     (meta.json + index.tsx, 참여원이 새로 만드는 기능)
// 도우미 스크립트(work/new/save/ai/doctor)가 함께 씁니다. 대표만 수정합니다.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 실험실 폴더 이름: 영어 소문자·숫자·하이픈, 2~30글자
export const SLUG_RE = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,29}$/;
// 실험실 이름으로 쓰면 안 되는 것 (앱 주소와 겹침)
export const RESERVED = new Set([
  "api", "lab", "feature", "admin", "settings", "login", "onboarding", "review", "shop", "wallet",
  "feedback", "game", "lost", "notice", "voice", "example", "more", "index",
]);

export const folderOf = (t) => (t.kind === "lab" ? `src/lab/${t.slug}/` : `src/features/${t.slug}/`);

// registry.ts 내용에서 정식 기능 목록 뽑기
export function parseRegistry(src) {
  const out = [];
  const re = /\{\s*id:\s*'([a-z][a-z0-9-]*)',\s*title:\s*'([^']+)'[^}]*status:\s*'(live|soon)'/g;
  let m;
  while ((m = re.exec(src))) out.push({ kind: "core", slug: m[1], title: m[2], status: m[3], makers: [] });
  return out;
}

export function parseLabMeta(slug, text) {
  try {
    const j = JSON.parse(text);
    if (!j || typeof j.title !== "string") return null;
    return {
      kind: "lab",
      slug,
      title: j.title,
      desc: j.desc || "",
      emoji: j.emoji || "🧪",
      status: j.status === "ready" ? "ready" : "building",
      makers: Array.isArray(j.makers) ? j.makers.map(String) : [],
    };
  } catch {
    return null;
  }
}

// 지금 폴더(작업 중인 파일) 기준 목록과 문제점
export function readTargets(root = process.cwd()) {
  const errors = [];
  let core = [];
  try {
    core = parseRegistry(fs.readFileSync(path.join(root, "src/features/registry.ts"), "utf8"));
  } catch {
    errors.push("src/features/registry.ts 를 읽지 못했습니다");
  }
  const labs = [];
  const labDir = path.join(root, "src/lab");
  if (fs.existsSync(labDir)) {
    for (const d of fs.readdirSync(labDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const metaFile = path.join(labDir, d.name, "meta.json");
      if (!fs.existsSync(metaFile)) continue;
      const where = `src/lab/${d.name}`;
      if (!SLUG_RE.test(d.name)) errors.push(`${where}: 폴더 이름은 영어 소문자·숫자·하이픈만 씁니다`);
      const t = parseLabMeta(d.name, fs.readFileSync(metaFile, "utf8"));
      if (!t) errors.push(`${where}/meta.json: JSON 형식이 깨졌거나 "title"이 없습니다`);
      else labs.push(t);
      if (!fs.existsSync(path.join(labDir, d.name, "index.tsx"))) errors.push(`${where}/index.tsx 가 없습니다`);
    }
  }
  return { core, labs, errors };
}

// 이 파일이 'node 파일이름' 으로 직접 실행됐는지 (Windows 대소문자·심볼릭 링크 대비)
export function isMain(metaUrl) {
  if (!process.argv[1]) return false;
  const norm = (p) => {
    let r = p;
    try {
      r = fs.realpathSync(p);
    } catch {
      /* 그대로 */
    }
    return process.platform === "win32" ? r.toLowerCase() : r;
  };
  return norm(path.resolve(process.argv[1])) === norm(fileURLToPath(metaUrl));
}

// 비밀 값 찾기 — strong: 실제 키 모양(올리면 안 됨) / weak: 비밀번호처럼 보이는 글(확인 필요)
const STRONG_SECRET = [
  /eyJhbGciOi[A-Za-z0-9_-]{20,}/, // JWT·Supabase 비밀 토큰
  /\bsb_secret_[A-Za-z0-9_-]{10,}/, // Supabase 비밀 키 (공개 키 sb_publishable_ 는 괜찮음)
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bghp_[A-Za-z0-9]{20,}/,
  /\bAIza[0-9A-Za-z_-]{30,}/,
];
const WEAK_SECRET = /(api[_-]?key|secret|password)\s*[:=]\s*["'][A-Za-z0-9_\-+/=.]{8,}["']/i;
export function scanSecrets(text) {
  return { strong: STRONG_SECRET.some((re) => re.test(text)), weak: WEAK_SECRET.test(text) };
}
