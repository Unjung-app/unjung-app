// 참여원용 도우미 스크립트들이 함께 쓰는 기능 모음.
// 대표만 수정합니다.

import fs from "node:fs";
import { spawnSync } from "node:child_process";
import readline from "node:readline";
import { stdin, stdout } from "node:process";

export const REPO_URL = "https://github.com/Unjung-app/unjung-app";

// 기능 목록은 각 기능 폴더의 feature.json 에서 읽습니다 (scripts/features.mjs).
// GitHub Codespaces(브라우저 개발 환경) 안에서 실행 중인지
export const IN_CODESPACES = !!process.env.CODESPACES;

// 네트워크가 멈췄을 때 git 이 끝없이 기다리지 않도록 (20초 동안 거의 안 움직이면 실패 처리)
process.env.GIT_HTTP_LOW_SPEED_LIMIT ??= "1000";
process.env.GIT_HTTP_LOW_SPEED_TIME ??= "20";
// 점검용 git 명령이 로그인 창을 띄우지 않도록 쓰는 환경
export const NO_PROMPT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" };

const isWin = process.platform === "win32";

// ── 화면 출력 ──────────────────────────────────────────────
export const say = (msg = "") => console.log(msg);
export const ok = (msg) => console.log(`  [완료] ${msg}`);
export const warn = (msg) => console.log(`  [주의] ${msg}`);
const isTTY = !!process.stdout.isTTY;
const paint = (code, s) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
export function fail(msg) {
  console.log("");
  console.log(paint("41;97;1", "  ■ 여기서 멈췄어요 ■  ") + "  아래 글을 읽어 주세요.");
  console.log(paint("31;1", `  [멈춤] ${msg}`));
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

// npm 명령 실행. 성공하면 조용히, 실패하면 마지막 출력만 보여 줍니다.
export function npmLive(command) {
  const r = spawnSync(`npm ${command}`, { encoding: "utf8", shell: true, maxBuffer: 20 * 1024 * 1024 });
  if (r.status !== 0) {
    const out = `${r.stdout || ""}${r.stderr || ""}`.trim().split("\n").slice(-15).join("\n");
    console.log(out);
  }
  return r.status === 0;
}

// ── 현재 상태 ─────────────────────────────────────────────
export function ensureRepoRoot() {
  const r = git(["rev-parse", "--show-toplevel"], { allowFail: true });
  if (r.code !== 0) fail("unjung-app 폴더 안에서 실행해 주세요. (cd unjung-app)");
  process.chdir(r.out);
}

export const currentBranch = () => git(["rev-parse", "--abbrev-ref", "HEAD"]).out;

// feat/meal-review-howon → { slug: "meal-review", name: "howon" }
// (기능 이름에는 하이픈이 들어갈 수 있고, 사람 이름에는 들어가지 않습니다)
export function parseBranch(branch) {
  const m = /^feat\/([a-z][a-z0-9-]+)-([a-z][a-z0-9]+)$/.exec(branch || "");
  return m ? { slug: m[1], name: m[2] } : null;
}

// 사람 이름 규칙: 영어 소문자로 시작, 소문자·숫자 2~20글자
export const NAME_RE = /^[a-z][a-z0-9]{1,19}$/;

// GitHub 아이디 등에서 이름 후보 만들기 (예: "25035-Lang" → "lang25035")
export function suggestName(raw) {
  if (!raw) return "";
  const s = String(raw).toLowerCase().replace(/[^a-z0-9]/g, "");
  const letters = s.replace(/[0-9]/g, "");
  const digits = s.replace(/[a-z]/g, "");
  const name = (letters + digits).slice(0, 20);
  return NAME_RE.test(name) ? name : "";
}

// 어떤 커밋(예: origin/main)에 들어 있는 기능 목록 읽기 (파일을 바꾸지 않고)
export function featuresAt(ref) {
  const r = git(["ls-tree", "-d", "--name-only", `${ref}:app`], { allowFail: true });
  if (r.code !== 0) return [];
  const list = [];
  for (const slug of r.out.split("\n").filter(Boolean)) {
    const j = git(["show", `${ref}:app/${slug}/feature.json`], { allowFail: true });
    if (j.code !== 0) continue;
    try {
      const f = JSON.parse(j.out);
      list.push({ slug, title: f.title || slug, status: f.status || "idea", makers: f.makers || [], order: f.order ?? 1000 });
    } catch {
      /* 깨진 파일은 건너뜀 */
    }
  }
  return list.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ko"));
}

// 기능 목록(메뉴) 다시 만들기 — 브랜치를 옮기거나 기능을 추가한 뒤 호출
export function regenerateMenu() {
  spawnSync("node", ["scripts/gen-features.mjs"], { stdio: "ignore" });
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

// ── 편집기에서 파일 열기 (VS Code / Codespaces) ─────────────────
export function openInEditor(file) {
  const r = spawnSync("code", [file], { stdio: "ignore", shell: isWin });
  return r.status === 0;
}

// ── 최신 main 합치기 + 충돌 도우미 ───────────────────────────────
// 충돌은 "같은 파일의 같은 부분을 두 사람이 다르게 고쳤을 때" 생깁니다.
// 이때 Git은 멈추고 두 사람의 코드를 파일 안에 함께 남겨 둡니다.
// 아래 함수는 그 내용을 AI에게 보낼 요청문(conflict-help.md)으로 만들어 줍니다.
export const CONFLICT_FILE = "conflict-help.md";
const MARKER_RE = /^(<<<<<<<|>>>>>>>)( |$)/m;

export const mergeInProgress = () =>
  git(["rev-parse", "-q", "--verify", "MERGE_HEAD"], { allowFail: true }).code === 0;

export const conflictedFiles = () =>
  git(["diff", "--name-only", "--diff-filter=U"], { allowFail: true }).out.split("\n").filter(Boolean);

export function hasConflictMarkers(file) {
  try {
    return MARKER_RE.test(fs.readFileSync(file, "utf8"));
  } catch {
    return false;
  }
}

function writeConflictHelp(files) {
  let t = "";
  t += "내 학교 앱 프로젝트(Next.js 16 App Router + JavaScript + Tailwind CSS v4)에서 Git 충돌이 났어.\n";
  t += "아래 파일 안의 <<<<<<< 와 >>>>>>> 사이에 두 사람의 코드가 함께 들어 있어.\n";
  t += "(======= 위쪽이 내 코드, 아래쪽이 GitHub에 먼저 올라가 있던 코드야. 다른 사람이나 대표가 고친 코드일 수 있어.)\n\n";
  t += "다음 규칙대로 도와줘.\n";
  t += "1. 기본은 **두 사람의 기능을 모두 살리는 것**이야.\n";
  t += "2. 어느 한쪽 코드가 사라져야만 한다면, 고치기 전에 무엇이 사라지는지 쉬운 말로 설명하고 나에게 먼저 물어봐.\n";
  t += "3. 답할 때는 충돌 표시(<<<<<<<, =======, >>>>>>>)가 하나도 없는 **파일 전체 코드**를 파일 경로와 함께 줘.\n";
  t += "4. 무엇을 어떻게 합쳤는지 3줄 이내로 요약해 줘.\n\n";
  for (const f of files) {
    let body = "";
    try {
      body = fs.readFileSync(f, "utf8");
    } catch {
      body = "(파일을 읽지 못함)";
    }
    t += `## ${f}\n\n\`\`\`\n${body.trimEnd()}\n\`\`\`\n\n`;
  }
  fs.writeFileSync(CONFLICT_FILE, t, "utf8");
}

// 두 버전의 feature.json 을 합치기: 내용은 main 쪽 기준, 만든 사람은 양쪽 모두, 상태는 더 진행된 쪽
function autoMergeFeatureJson(file) {
  const read = (stage) => {
    const r = git(["show", `:${stage}:${file}`], { allowFail: true });
    try {
      return r.code === 0 ? JSON.parse(r.out) : null;
    } catch {
      return null;
    }
  };
  const ours = read(2);
  const theirs = read(3);
  if (!ours || !theirs) return false;
  const rank = { idea: 0, building: 1, ready: 2 };
  const merged = { ...ours, ...theirs };
  merged.makers = [...new Set([...(theirs.makers || []), ...(ours.makers || [])])];
  merged.status = (rank[ours.status] ?? 0) > (rank[theirs.status] ?? 0) ? ours.status : theirs.status;
  fs.writeFileSync(file, JSON.stringify(merged, null, 2) + "\n", "utf8");
  return true;
}

// 최신 main을 내 브랜치에 합칩니다. 결과: "ok" | "conflict"
// (먼저 git fetch origin 이 되어 있어야 합니다)
export function syncWithMain() {
  return syncWith("origin/main");
}

// ref(예: origin/main, origin/feat/meal-howon)의 내용을 내 브랜치에 합칩니다. 결과: "ok" | "conflict"
// (GitHub에서 대표가 내 PR에 [Update branch]·[Commit suggestion] 등을 눌러 브랜치가 앞서 있을 때도 씀)
export function syncWith(ref) {
  if (git(["rev-parse", "--verify", "--quiet", ref], { allowFail: true }).code !== 0) return "ok";
  const behind = git(["rev-list", "--count", `HEAD..${ref}`], { allowFail: true }).out;
  if (behind === "0" || behind === "") return "ok";
  const r = git(["merge", "--no-edit", ref], { allowFail: true });
  if (r.code === 0) return "ok";
  let files = conflictedFiles();
  if (files.length === 0) {
    git(["merge", "--abort"], { allowFail: true });
    fail(`최신 작업(${ref})을 합치지 못했습니다. 이 화면을 캡처해서 대표에게 보여 주세요.\n\n${r.err || r.out}`);
  }
  // feature.json 충돌(만든 사람 목록 등)은 사람이 고칠 필요 없이 자동으로 합칩니다.
  for (const f of files.filter((f) => /^app\/[^/]+\/feature\.json$/.test(f))) {
    if (autoMergeFeatureJson(f)) git(["add", "--", f]);
  }
  files = conflictedFiles();
  if (files.length === 0) {
    git(["commit", "--no-edit", "--quiet"]);
    return "ok";
  }
  writeConflictHelp(files);
  return "conflict";
}

// 충돌이 났을 때 화면 안내
export function explainConflict() {
  const files = conflictedFiles();
  say("");
  warn("'충돌'이 났어요. 다른 사람과 같은 곳을 고친 것뿐, 망가진 게 아니에요.");
  say(`  충돌난 파일: ${files.join(", ")}`);
  say("");
  say(`   1) 열린 ${CONFLICT_FILE} 탭에서 Ctrl+A → Ctrl+C → AI 채팅에 붙여넣기`);
  say("   2) AI가 준 코드로 그 파일을 통째로 바꾸기");
  say("   3) 미리보기에서 두 사람 기능이 다 되는지 확인 → npm run save");
  say("  (AI가 '한쪽 코드를 지워야 한다'고 하면 먼저 대표에게 물어보세요)");
  say("");
  if (!openInEditor(CONFLICT_FILE)) say(`  (${CONFLICT_FILE} 파일을 VS Code에서 직접 열어 주세요)`);
}

// npm install 이 컴퓨터마다 package-lock.json 을 조금씩 바꾸는 일이 있어,
// 학생 작업과 상관없는 이 변경은 되돌립니다. (부품 목록은 대표만 바꿉니다)
export function restoreLockfile() {
  git(["checkout", "--", "package-lock.json"], { allowFail: true });
}

// 최신 main을 합치기 전에 정리합니다.
//  - 내 폴더의 저장 안 된 변경 → '자동 저장' 커밋 (합치다가 덮어써지지 않도록)
//  - 내 폴더 밖의 변경 → 따로 보관(stash). 어차피 올라가지 않는 파일들입니다.
export function prepareForSync(folder, { quiet = false } = {}) {
  restoreLockfile();
  const changed = changedFiles();
  const mine = changed.filter((f) => f.startsWith(folder));
  const others = changed.filter((f) => !f.startsWith(folder));
  if (others.length > 0) {
    const r = git(
      ["stash", "push", "--include-untracked", "-m", `폴더 밖 변경 자동 보관 (${folder})`, "--", ...others],
      { allowFail: true }
    );
    if (r.code === 0 && !quiet) {
      warn(`내 폴더 밖에서 바뀐 파일은 따로 보관했어요 (올라가지 않아요): ${others.join(", ")}`);
    } else if (r.code !== 0) {
      warn("내 폴더 밖의 변경을 보관하지 못했습니다. 이 화면을 대표에게 보여 주세요.");
    }
  }
  if (mine.length > 0) {
    git(["add", "--all", "--", folder]);
    git(["commit", "-m", "feat: (자동 저장) 작업 중", "--quiet"]);
    ok("저장 안 된 작업을 안전하게 보관했어요.");
  }
}

// push(올리기)가 실패했을 때 이유를 알아내서 쉬운 말로 알려 줍니다.
export function explainPushFailure() {
  const r = spawnSync("git", ["push", "--dry-run", "origin", "HEAD"], {
    encoding: "utf8",
    timeout: 30000,
    env: NO_PROMPT_ENV,
  });
  const t = `${r.stderr || ""}${r.stdout || ""}`;
  if (/403|denied|not have permission|Permission to|Authentication failed/i.test(t)) {
    return "이 저장소에 올릴 권한이 없습니다.\n  대표에게 'Unjung-app 조직에 내 GitHub 아이디가 들어가 있는지(초대 수락 포함)' 확인해 달라고 하세요.";
  }
  if (/could not resolve|unable to access|timed out|Failed to connect|Connection/i.test(t)) {
    return "GitHub 연결이 끊겼습니다. 잠시 뒤 다시 npm run save 하세요. (저장한 내용은 안전합니다)";
  }
  if (/rejected|non-fast-forward|fetch first/i.test(t)) {
    return "GitHub에 있는 내 브랜치가 이 컴퓨터보다 앞서 있습니다.\n  npm run save 를 한 번 더 실행하세요. (GitHub의 내용을 자동으로 합친 뒤 올립니다)";
  }
  return "GitHub에 올리지 못했습니다. 이 화면을 캡처해서 대표에게 보여 주세요.";
}
