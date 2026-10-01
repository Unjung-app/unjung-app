// npm run work — 작업 시작 준비를 한 번에 해 줍니다.
//  1) 내 기능과 영문 이름을 묻고  2) 커밋에 남길 이름·이메일을 설정하고
//  3) 내 기능 브랜치로 이동(없으면 최신 main에서 새로 만듦)  4) npm install

import {
  FEATURES, title, say, ok, warn, fail, ask, doneAsking, git, gitLive, npmLive,
  ensureRepoRoot, currentBranch, parseBranch, changedFiles,
} from "./common.mjs";

ensureRepoRoot();
title("운중고 앱 · 작업 시작 준비");

// Node 버전 확인 (Next.js 16은 20.9 이상 필요)
const [maj, min] = process.versions.node.split(".").map(Number);
if (maj < 20 || (maj === 20 && min < 9)) {
  fail(`Node.js 버전이 낮습니다 (지금 ${process.versions.node}). nodejs.org에서 LTS 버전을 설치해 주세요.`);
}

// ── 1. 기능 고르기 ──────────────────────────────────────────
const before = parseBranch(currentBranch());

say("");
say("  내가 맡은 기능의 번호를 입력하세요.");
FEATURES.forEach((f, i) => say(`    ${i + 1}. ${f.label.padEnd(12, "　")} (app/${f.key})`));
let feature;
while (!feature) {
  const hint = before ? ` [Enter = ${FEATURES.indexOf(before.feature) + 1}]` : "";
  const a = await ask(`  번호${hint}: `);
  if (!a && before) feature = before.feature;
  else feature = FEATURES[Number(a) - 1];
  if (!feature) say("  1~9 중에서 입력하세요.");
}

// ── 2. 영문 이름 ────────────────────────────────────────────
let name;
while (!name) {
  const hint = before ? ` [Enter = ${before.name}]` : "";
  const a = (await ask(`  내 영문 이름 (소문자, 띄어쓰기 없이. 예: howon)${hint}: `)).toLowerCase();
  if (!a && before) name = before.name;
  else if (/^[a-z][a-z0-9]{1,19}$/.test(a)) name = a;
  else say("  영어 소문자와 숫자만, 2~20글자로 입력하세요.");
}

// ── 3. 커밋에 남길 이름·이메일 (이 컴퓨터의 이 폴더에만 적용) ──────────
const oldEmail = git(["config", "--local", "user.email"], { allowFail: true }).out;
let email;
while (!email) {
  const hint = oldEmail ? ` [Enter = ${oldEmail}]` : "";
  const a = await ask(`  GitHub에 등록된 내 이메일${hint}: `);
  if (!a && oldEmail) email = oldEmail;
  else if (/^\S+@\S+\.\S+$/.test(a)) email = a;
  else say("  이메일 형식으로 입력하세요. (GitHub → Settings → Emails 에서 확인)");
}
doneAsking();
git(["config", "user.name", name]);
git(["config", "user.email", email]);
ok(`커밋 작성자: ${name} <${email}>`);

// ── 4. 브랜치 준비 ─────────────────────────────────────────
const branch = `feat/${feature.key}-${name}`;
say("");
say("  GitHub에서 최신 정보를 받아오는 중...");
if (!gitLive(["fetch", "origin", "--prune"])) {
  fail("GitHub에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 실행하세요.");
}

const now = currentBranch();
const dirty = changedFiles();
if (now !== branch && dirty.length > 0) {
  fail(
    `저장하지 않은 변경 파일이 ${dirty.length}개 있어 브랜치를 옮길 수 없습니다.\n` +
      `  지금 브랜치(${now})에서 'npm run save'로 먼저 저장하거나, 대표에게 물어보세요.`
  );
}

const hasRemote = git(["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${branch}`], { allowFail: true }).code === 0;
const hasLocal = git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { allowFail: true }).code === 0;

if (hasRemote) {
  // GitHub에 내 브랜치가 있다 → 그 브랜치로 이동하고 최신 상태로
  if (hasLocal) {
    git(["switch", branch]);
    if (!gitLive(["pull", "--ff-only", "origin", branch])) {
      fail("내 브랜치를 최신으로 맞추지 못했습니다. 이 화면을 캡처해서 대표에게 보여 주세요.");
    }
  } else {
    git(["switch", "--track", "-c", branch, `origin/${branch}`]);
  }
  ok(`GitHub에 있던 내 브랜치로 이동: ${branch}`);
} else if (hasLocal) {
  // 이 컴퓨터에만 있다 → 이미 병합되어 GitHub에서 지워졌는지 확인
  const diff = git(["diff", "--quiet", "origin/main", branch, "--", `app/${feature.key}`], { allowFail: true });
  if (diff.code === 0) {
    // 내용이 main과 같다 = 이미 병합 완료 → 최신 main에서 새로 시작
    if (now === branch) git(["switch", "--detach", "origin/main"]);
    git(["branch", "-D", branch]);
    git(["switch", "--no-track", "-c", branch, "origin/main"]);
    ok(`지난 작업은 이미 main에 들어갔습니다. 최신 main에서 새로 시작: ${branch}`);
  } else {
    git(["switch", branch]);
    warn(`아직 GitHub에 올리지 않은 작업이 있는 브랜치입니다: ${branch}`);
    warn("작업이 끝나면 꼭 'npm run save'로 올려 주세요.");
  }
} else {
  // 처음 시작 → 최신 main에서 새 브랜치
  git(["switch", "--no-track", "-c", branch, "origin/main"]);
  ok(`최신 main에서 새 브랜치를 만들었습니다: ${branch}`);
}

// ── 5. 부품 설치 ───────────────────────────────────────────
say("");
say("  앱 실행에 필요한 부품을 설치하는 중... (처음엔 1~2분)");
if (!npmLive("install --no-audit --no-fund")) {
  fail("npm install 중 문제가 생겼습니다. 이 화면을 캡처해서 대표에게 보여 주세요.");
}
ok("부품 설치");

title("준비 끝!");
say(`  브랜치   : ${branch}`);
say(`  내 폴더  : app/${feature.key}/   ← 이 폴더 안의 파일만 고칩니다`);
say("");
say("  다음에 할 일");
say("    npm run dev    → 앱 실행 (브라우저에서 http://localhost:3000/" + feature.key + ")");
say("    npm run ai     → AI에게 붙여넣을 내용을 복사");
say("    npm run save   → 작업 저장 + GitHub에 올리기 + PR 화면 열기");
say("");
