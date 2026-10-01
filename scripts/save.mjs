// npm run save — 내 기능 폴더의 변경을 저장(커밋)하고 GitHub에 올린 뒤 PR 화면을 엽니다.

import fs from "node:fs";
import {
  REPO_URL, title, say, ok, warn, fail, ask, doneAsking, git, gitLive,
  ensureRepoRoot, currentBranch, parseBranch, changedFiles, openBrowser,
} from "./common.mjs";

ensureRepoRoot();

const branch = currentBranch();
const info = parseBranch(branch);
if (!info) fail(`지금 브랜치(${branch})는 내 기능 브랜치가 아닙니다. 먼저 'npm run work'를 실행하세요.`);
const folder = `app/${info.feature.key}/`;

title(`작업 저장 · ${info.feature.label}`);

// ── 1. 변경 파일 나누기: 내 폴더 안 / 밖 ───────────────────────
const changed = changedFiles();
const mine = changed.filter((f) => f.startsWith(folder));
const others = changed.filter((f) => !f.startsWith(folder) && f !== "ai-context.md");

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
  if (!msg) msg = `${info.feature.label} 작업`;
  git(["add", "--all", "--", folder]);
  git(["commit", "-m", `feat: ${msg}`]);
  ok(`저장(커밋): feat: ${msg}`);
} else {
  say("  내 폴더에 새로 바뀐 파일이 없습니다. (이미 저장한 작업만 올립니다)");
}

// ── 4. 올리기(push) ────────────────────────────────────────
const hasUpstream = git(["rev-parse", "--abbrev-ref", "@{u}"], { allowFail: true }).code === 0;
if (hasUpstream) {
  const ahead = git(["rev-list", "--count", "@{u}..HEAD"]).out;
  if (ahead === "0") {
    say("");
    ok("GitHub와 이미 같은 상태입니다. 올릴 것이 없습니다.");
    process.exit(0);
  }
}
say("");
say("  GitHub에 올리는 중... (처음이면 로그인 창이 뜰 수 있습니다)");
if (!gitLive(["push", "-u", "origin", branch])) {
  fail("GitHub에 올리지 못했습니다. 이 화면을 캡처해서 대표에게 보여 주세요.");
}
ok("GitHub에 올림");

// ── 5. PR 화면 열기 ────────────────────────────────────────
const url = `${REPO_URL}/compare/main...${branch}?expand=1`;
title("마지막 단계: 브라우저에서 PR 확인");
say("  브라우저에 PR 화면을 열었습니다.");
say("  · 처음이면  → 제목·내용 확인 후 [Create pull request] 클릭");
say("  · 이미 PR을 만들었으면 → 새로 만들 필요 없음. 방금 올린 내용이 자동으로 추가됨");
say("");
say(`  브라우저가 안 열리면 이 주소로 들어가세요:`);
say(`  ${url}`);
say("");
openBrowser(url);
