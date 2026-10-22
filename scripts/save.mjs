// npm run save — 내 기능 폴더의 변경을 저장(커밋)하고, 최신 main을 합친 뒤
// GitHub에 올리고 PR 화면 주소를 알려 줍니다.

import fs from "node:fs";
import {
  IN_CODESPACES, REPO_URL, title, say, ok, warn, fail, ask, doneAsking, git, gitLive,
  ensureRepoRoot, currentBranch, parseBranch, changedFiles, openBrowser, regenerateMenu,
  mergeInProgress, restoreLockfile, conflictedFiles, hasConflictMarkers, syncWithMain, syncWith, explainConflict, CONFLICT_FILE, prepareForSync, explainPushFailure,
} from "./common.mjs";
import { scanSecrets } from "./features.mjs";

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
  warn(`내 폴더 밖에서 바뀐 파일은 올라가지 않아요: ${others.join(", ")}`);
  say(`        내 화면에 필요한 파일이면 AI에게 "이 파일을 ${folder}_components/ 안으로 옮겨 줘"`);
  say("");
}

// ── 2. 비밀 값 간단 검사 ────────────────────────────────────
let weakFiles = [];
for (const f of mine) {
  if (!fs.existsSync(f)) continue; // 삭제된 파일
  const r = scanSecrets(fs.readFileSync(f, "utf8"));
  if (r.strong) {
    fail(`${f} 안에 API 키·토큰처럼 보이는 값이 있습니다. 올리지 않고 멈춥니다.\n  대표에게 이 파일을 보여 주세요.`);
  }
  if (r.weak) weakFiles.push(f);
}
if (weakFiles.length > 0) {
  warn("비밀번호나 키처럼 보이는 글이 있습니다:");
  weakFiles.forEach((f) => say(`        - ${f}`));
  say("        진짜 비밀번호·키라면 올리면 안 됩니다. 예시 글자(가짜)라면 괜찮아요.");
  const a = (await ask("  가짜 예시가 맞나요? 계속 올릴까요? (y = 예 / Enter = 멈춤): ")).toLowerCase();
  if (a !== "y" && a !== "yes" && a !== "예") {
    doneAsking();
    fail("멈췄습니다. 그 부분을 고친 뒤 다시 npm run save 하세요.");
  }
}

// ── 3. 커밋 ───────────────────────────────────────────────
if (mine.length > 0) {
  say(`  저장할 파일 ${mine.length}개: ${mine.map((f) => f.slice(folder.length)).join(", ")}`);
  let msg = await ask("  무엇을 했는지 한 줄로 (예: 급식 카드 화면 추가): ");
  doneAsking();
  if (!msg) msg = `${label} 작업`;
  git(["add", "--all", "--", folder]);
  git(["commit", "-m", `feat: ${msg}`, "--quiet"]);
  ok(`저장했어요: ${msg}`);
} else {
  doneAsking();
  say("  새로 바뀐 파일은 없어요.");
}

// ── 4. 최신 main 합치기 ─────────────────────────────────────
say("");
say("  최신 내용을 확인하고 올리는 중...");
if (!gitLive(["fetch", "origin", "--prune", "--quiet"])) {
  fail("GitHub에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 실행하세요. (저장한 내용은 안전합니다)");
}
prepareForSync(folder, { quiet: true }); // 폴더 밖 변경은 따로 보관 (합치다가 멈추지 않도록)
// GitHub 쪽 내 브랜치가 앞서 있으면(대표가 PR에서 고쳤거나 다른 컴퓨터에서 올림) 먼저 합칩니다.
if (syncWith(`origin/${branch}`) === "conflict" || syncWithMain() === "conflict") {
  explainConflict();
  process.exit(1);
}
regenerateMenu();

// ── 5. 올리기(push) ────────────────────────────────────────
// GitHub에 내 브랜치가 이미 있었는지 (없으면 = 처음이거나, 지난 PR이 합쳐져서 지워진 것 → 새 PR 필요)
const wasOnGitHub =
  git(["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${branch}`], { allowFail: true }).code === 0;
if (wasOnGitHub) {
  const ahead = git(["rev-list", "--count", `origin/${branch}..HEAD`]).out;
  if (ahead === "0") {
    say("");
    ok("이미 다 올라가 있어요. 할 일 끝!");
    process.exit(0);
  }
}
if (!gitLive(["push", "--quiet", "-u", "origin", branch])) {
  fail(explainPushFailure());
}
ok("GitHub에 올림");

// ── 6. PR 안내 ────────────────────────────────────────────
// 열린 PR이 있는지 GitHub에 물어봅니다 (실패하면 일반 안내)
async function findOpenPr() {
  if (!wasOnGitHub) return null;
  try {
    const owner = REPO_URL.split("/").slice(-2)[0];
    const api = REPO_URL.replace("https://github.com/", "https://api.github.com/repos/");
    const headers = { Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const res = await fetch(`${api}/pulls?state=open&head=${owner}:${encodeURIComponent(branch)}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return undefined;
    const list = await res.json();
    return list[0] || null;
  } catch {
    return undefined; // 모름
  }
}
const pr = await findOpenPr();
const url = `${REPO_URL}/compare/main...${branch}?expand=1`;
if (pr) {
  ok(`열려 있는 PR #${pr.number}에 자동으로 추가됐어요. 할 일 끝!`);
} else {
  title("한 단계 남았어요");
  say("  아래 주소를 Ctrl+클릭 → 초록색 [Create pull request]");
  say(`  ${url}`);
  if (pr === undefined) say("  (이미 있다고 나오면 그냥 닫으세요)");
  if (!IN_CODESPACES) openBrowser(url);
}
say("");
