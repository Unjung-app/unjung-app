// npm run save — 내 기능 폴더의 변경을 저장(커밋)하고, 최신 main을 합친 뒤
// GitHub에 올리고 PR 화면 주소를 알려 줍니다.

import fs from "node:fs";
import {
  IN_CODESPACES, REPO_URL, title, say, ok, warn, fail, ask, doneAsking, git, gitLive,
  ensureRepoRoot, currentBranch, parseBranch, changedFiles, openBrowser, regenerateMenu,
  mergeInProgress, restoreLockfile, conflictedFiles, hasConflictMarkers, syncWithMain, explainConflict, CONFLICT_FILE,
} from "./common.mjs";

ensureRepoRoot();

const branch = currentBranch();
const info = parseBranch(branch);
if (!info) fail(`지금 브랜치(${branch})는 내 기능 브랜치가 아닙니다. 먼저 'npm run work'를 실행하세요.`);
const folder = `app/${info.slug}/`;
let label = info.slug;
try {
  label = JSON.parse(fs.readFileSync(`${folder}feature.json`, "utf8")).title || label;
} catch {
  /* 무시 */
}

title(`작업 저장 · ${label}`);

// ── 0. 충돌 해결 마무리 ────────────────────────────────────
if (mergeInProgress()) {
  const files = conflictedFiles();
  const still = files.filter(hasConflictMarkers);
  if (still.length > 0) {
    warn("아직 충돌 표시(<<<<<<< ======= >>>>>>>)가 남아 있는 파일이 있습니다:");
    still.forEach((f) => say(`        - ${f}`));
    explainConflict();
    process.exit(1);
  }
  git(["add", "--", ...files]);
  git(["commit", "--no-edit", "--quiet"]);
  try {
    fs.unlinkSync(CONFLICT_FILE);
  } catch {
    /* 없으면 그만 */
  }
  ok("충돌 해결을 저장했습니다.");
}

// ── 1. 변경 파일 나누기: 내 폴더 안 / 밖 ───────────────────────
restoreLockfile();
const changed = changedFiles();
const mine = changed.filter((f) => f.startsWith(folder));
const others = changed.filter((f) => !f.startsWith(folder));

if (others.length > 0) {
  warn("내 폴더 밖에서 바뀐 파일이 있습니다. 이 파일들은 올라가지 않습니다:");
  others.forEach((f) => say(`        - ${f}`));
  say("        (일부러 바꾼 게 아니라면 무시해도 됩니다. 꼭 필요하면 대표에게 요청하세요.)");
  say("");
}

// ── 2. 비밀 값 간단 검사 ────────────────────────────────────
const SECRET = [
  /eyJhbGciOi[A-Za-z0-9_-]{20,}/, // Supabase 등 토큰
  /sk-[A-Za-z0-9_-]{20,}/, // OpenAI 등 키
  /ghp_[A-Za-z0-9]{20,}/, // GitHub 토큰
  /(api[_-]?key|secret|password)\s*[:=]\s*["'][^"']{8,}["']/i,
];
for (const f of mine) {
  if (!fs.existsSync(f)) continue; // 삭제된 파일
  const body = fs.readFileSync(f, "utf8");
  if (SECRET.some((re) => re.test(body))) {
    fail(`${f} 안에 비밀 키처럼 보이는 값이 있습니다. 올리지 않고 멈춥니다.\n  대표에게 이 파일을 보여 주세요.`);
  }
}

// ── 3. 커밋 ───────────────────────────────────────────────
if (mine.length > 0) {
  say(`  저장할 파일 (${mine.length}개):`);
  mine.forEach((f) => say(`        + ${f}`));
  say("");
  let msg = await ask("  무엇을 했는지 한 줄로 적어 주세요 (예: 오늘 급식 카드 화면 추가): ");
  doneAsking();
  if (!msg) msg = `${label} 작업`;
  git(["add", "--all", "--", folder]);
  git(["commit", "-m", `feat: ${msg}`, "--quiet"]);
  ok(`저장(커밋): feat: ${msg}`);
} else {
  doneAsking();
  say("  내 폴더에 새로 바뀐 파일이 없습니다. (이미 저장한 작업만 올립니다)");
}

// ── 4. 최신 main 합치기 ─────────────────────────────────────
say("");
say("  다른 사람들의 최신 작업을 받아오는 중...");
if (!gitLive(["fetch", "origin", "--quiet"])) {
  fail("GitHub에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 실행하세요. (저장한 내용은 안전합니다)");
}
if (syncWithMain() === "conflict") {
  explainConflict();
  process.exit(1);
}
regenerateMenu();

// ── 5. 올리기(push) ────────────────────────────────────────
const hasUpstream = git(["rev-parse", "--abbrev-ref", "@{u}"], { allowFail: true }).code === 0;
if (hasUpstream) {
  const ahead = git(["rev-list", "--count", "@{u}..HEAD"]).out;
  if (ahead === "0") {
    say("");
    ok("GitHub와 이미 같은 상태입니다. 올릴 것이 없습니다.");
    process.exit(0);
  }
}
say("  GitHub에 올리는 중... (처음이면 로그인 창이 뜰 수 있습니다)");
if (!gitLive(["push", "--quiet", "-u", "origin", branch])) {
  fail("GitHub에 올리지 못했습니다. 이 화면을 캡처해서 대표에게 보여 주세요.");
}
ok("GitHub에 올림");

// ── 6. PR 화면 ────────────────────────────────────────────
const url = `${REPO_URL}/compare/main...${branch}?expand=1`;
title("마지막 단계: PR 확인");
say("  아래 주소를 열어 주세요." + (IN_CODESPACES ? " (Ctrl 누른 채로 클릭)" : " (브라우저가 자동으로 열립니다)"));
say(`  ${url}`);
say("");
say("  · 처음이면  → 제목·내용 확인 후 [Create pull request] 클릭");
say("  · 이미 PR을 만들었으면 → 새로 만들 필요 없음. 방금 올린 내용이 자동으로 추가됨");
say("");
if (!IN_CODESPACES) openBrowser(url);
