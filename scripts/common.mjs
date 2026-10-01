// 참여원용 도우미 스크립트들이 함께 쓰는 기능 모음.
// 대표만 수정합니다.

import { spawnSync } from "node:child_process";
import readline from "node:readline";
import { stdin, stdout } from "node:process";

export const REPO_URL = "https://github.com/Unjung-app/unjung-app";

export const FEATURES = [
  { key: "meal", label: "급식 정보" },
  { key: "timetable", label: "시간표 · 학사일정" },
  { key: "sports", label: "교내 스포츠 허브" },
  { key: "voice", label: "운중 보이스" },
  { key: "library", label: "도서관 장서 검색" },
  { key: "notice", label: "통합 공지" },
  { key: "meal-review", label: "급식 메뉴 평가" },
  { key: "quiz", label: "학업 연계 미니게임" },
  { key: "study", label: "전학년 공부시간 경쟁" },
];

const isWin = process.platform === "win32";

// ── 화면 출력 ──────────────────────────────────────────────
export const say = (msg = "") => console.log(msg);
export const ok = (msg) => console.log(`  [완료] ${msg}`);
export const warn = (msg) => console.log(`  [주의] ${msg}`);
export function fail(msg) {
  console.log("");
  console.log(`  [멈춤] ${msg}`);
  console.log("");
  process.exit(1);
}
export function title(msg) {
  console.log("");
  console.log("=".repeat(56));
  console.log(`  ${msg}`);
  console.log("=".repeat(56));
}

// ── git 실행 ──────────────────────────────────────────────
// 결과를 돌려받는 실행 (화면에 안 보임)
export function git(args, { allowFail = false } = {}) {
  const r = spawnSync("git", args, { encoding: "utf8" });
  if (r.error) fail("Git이 설치되어 있지 않은 것 같습니다. Git을 먼저 설치해 주세요.");
  if (r.status !== 0 && !allowFail) {
    fail(`git ${args.join(" ")} 실행 중 문제가 생겼습니다.\n\n${(r.stderr || r.stdout).trim()}`);
  }
  return { code: r.status, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

// 진행 상황을 화면에 그대로 보여주는 실행 (로그인 창, push 진행률 등)
export function gitLive(args) {
  const r = spawnSync("git", args, { stdio: "inherit" });
  return r.status === 0;
}

export function npmLive(command) {
  const r = spawnSync(`npm ${command}`, { stdio: "inherit", shell: true });
  return r.status === 0;
}

// ── 현재 상태 ─────────────────────────────────────────────
export function ensureRepoRoot() {
  const r = git(["rev-parse", "--show-toplevel"], { allowFail: true });
  if (r.code !== 0) fail("unjung-app 폴더 안에서 실행해 주세요. (cd unjung-app)");
  process.chdir(r.out);
}

export const currentBranch = () => git(["rev-parse", "--abbrev-ref", "HEAD"]).out;

// feat/meal-review-howon → { feature: "meal-review", name: "howon" }
export function parseBranch(branch) {
  const m = /^feat\/(.+)-([a-z0-9]+)$/.exec(branch);
  if (!m) return null;
  const feature = FEATURES.find((f) => f.key === m[1]);
  return feature ? { feature, name: m[2] } : null;
}

// 저장(커밋)하지 않은 변경 파일 목록
export function changedFiles() {
  // -z: 파일 이름을 따옴표·이스케이프 없이 NUL 문자로 구분해서 받음 (한글 파일명 대비)
  const r = spawnSync("git", ["status", "--porcelain", "-uall", "-z"], { encoding: "utf8" });
  const parts = (r.stdout || "").split("\0").filter(Boolean);
  const files = [];
  for (let i = 0; i < parts.length; i++) {
    const code = parts[i].slice(0, 2);
    files.push(parts[i].slice(3));
    if (code.includes("R") || code.includes("C")) i++; // 이름 변경은 원래 이름이 한 칸 더 붙음
  }
  return files;
}

// ── 입력 받기 ─────────────────────────────────────────────
// 한 줄씩 입력받기. 여러 줄을 한꺼번에 붙여넣어도 순서대로 하나씩 쓰입니다.
let rl;
let closed = false;
const lines = [];
const waiters = [];
export function ask(question) {
  if (!rl) {
    rl = readline.createInterface({ input: stdin, terminal: false });
    rl.on("line", (l) => (waiters.length ? waiters.shift()(l) : lines.push(l)));
    rl.on("close", () => {
      closed = true;
      waiters.splice(0).forEach((w) => w(""));
    });
  }
  if (closed && !lines.length) fail("입력이 끝났습니다. 명령을 다시 실행해 주세요.");
  stdout.write(question);
  return new Promise((resolve) => {
    if (lines.length) resolve(lines.shift());
    else waiters.push(resolve);
  }).then((a) => a.trim());
}
// 더 이상 입력받을 일이 없을 때 호출 (안 하면 프로그램이 끝나지 않음)
export function doneAsking() {
  rl?.close();
}

// ── 브라우저 열기 / 클립보드 복사 ─────────────────────────────
export function openBrowser(url) {
  if (isWin) spawnSync("rundll32", ["url.dll,FileProtocolHandler", url]);
  else if (process.platform === "darwin") spawnSync("open", [url]);
  else spawnSync("xdg-open", [url]);
}

export function copyFileToClipboard(filePath) {
  if (isWin) {
    const r = spawnSync("powershell", [
      "-NoProfile",
      "-Command",
      `Set-Clipboard -Value (Get-Content -Raw -Encoding UTF8 -LiteralPath '${filePath}')`,
    ]);
    return r.status === 0;
  }
  if (process.platform === "darwin") {
    const r = spawnSync("sh", ["-c", `pbcopy < "${filePath}"`]);
    return r.status === 0;
  }
  return false;
}
