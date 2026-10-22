// npm run work — 작업 시작 준비를 한 번에 해 줍니다.
//  1) 이름 확인  2) 기능 고르기(이미 있는 기능 또는 내 새 아이디어)
//  3) 내 기능 브랜치로 이동 + 최신 main 자동 합치기  4) 부품 설치  5) 메뉴 갱신

import fs from "node:fs";
import {
  IN_CODESPACES, NAME_RE, title, say, ok, warn, fail, ask, doneAsking, git, gitLive, npmLive,
  ensureRepoRoot, currentBranch, parseBranch, changedFiles, suggestName, featuresAt,
  regenerateMenu, mergeInProgress, restoreLockfile, syncWithMain, explainConflict, prepareForSync,
} from "./common.mjs";
import { STATUSES } from "./features.mjs";
import { newFeature } from "./new.mjs";

ensureRepoRoot();
title("운중고 앱 · 작업 시작 준비");

// Node 버전 확인 (Next.js 16은 20.9 이상 필요)
const [maj, min] = process.versions.node.split(".").map(Number);
if (maj < 20 || (maj === 20 && min < 9)) {
  fail(`Node.js 버전이 낮습니다 (지금 ${process.versions.node}). nodejs.org에서 LTS 버전을 설치해 주세요.`);
}

if (mergeInProgress()) {
  explainConflict();
  fail("충돌 해결이 끝나지 않았습니다. 위 안내대로 고친 뒤 'npm run save'를 실행하세요.");
}

// ── 0. 최신 정보 받기 ────────────────────────────────────────
say("  GitHub에서 최신 정보를 받아오는 중...");
if (!gitLive(["fetch", "origin", "--prune", "--quiet"])) {
  fail("GitHub에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 실행하세요.");
}

const before = parseBranch(currentBranch());

// ── 1. 내 이름 ──────────────────────────────────────────────
const guess =
  before?.name ||
  suggestName(git(["config", "--local", "user.name"], { allowFail: true }).out) ||
  suggestName(process.env.GITHUB_USER);
let name;
while (!name) {
  const hint = guess ? ` [Enter = ${guess}]` : "";
  const a = (await ask(`\n  내 영문 이름 (소문자, 띄어쓰기 없이. 예: howon)${hint}: `)).toLowerCase();
  if (!a && guess) name = guess;
  else if (NAME_RE.test(a)) name = a;
  else say("  영어 소문자로 시작하고, 소문자·숫자만 2~20글자로 입력하세요.");
}

// 커밋에 남길 이메일 — Codespaces는 GitHub가 자동으로 설정하므로 묻지 않습니다.
if (!IN_CODESPACES) {
  const oldEmail = git(["config", "--local", "user.email"], { allowFail: true }).out;
  let email;
  while (!email) {
    const hint = oldEmail ? ` [Enter = ${oldEmail}]` : "";
    const a = await ask(`  GitHub에 등록된 내 이메일${hint}: `);
    if (!a && oldEmail) email = oldEmail;
    else if (/^\S+@\S+\.\S+$/.test(a)) email = a;
    else say("  이메일 형식으로 입력하세요. (GitHub → Settings → Emails 에서 확인)");
  }
  git(["config", "user.email", email]);
}
git(["config", "user.name", name]);

// ── 2. 기능 고르기 ──────────────────────────────────────────
const features = featuresAt("origin/main");
// 아직 main에 합쳐지지 않은 '내 새 기능'도 목록에 넣습니다.
const myRefs = git(["for-each-ref", "--format=%(refname:short)", "refs/heads/feat/", "refs/remotes/origin/feat/"], {
  allowFail: true,
}).out.split("\n").filter(Boolean);
for (const ref of myRefs) {
  const p = parseBranch(ref.replace(/^origin\//, ""));
  if (!p || p.name !== name || features.some((f) => f.slug === p.slug)) continue;
  const j = git(["show", `${ref}:app/${p.slug}/feature.json`], { allowFail: true });
  if (j.code !== 0) continue;
  try {
    const f = JSON.parse(j.out);
    features.push({ slug: p.slug, title: `${f.title || p.slug} (내 새 기능)`, status: "building", makers: f.makers || [name] });
  } catch {
    /* 무시 */
  }
}
// 지금 브랜치의 기능이 목록에 없으면(아직 한 번도 올리지 않은 새 기능) 이 컴퓨터의 파일에서 읽어 넣습니다.
if (before && before.name === name && !features.some((f) => f.slug === before.slug)) {
  try {
    const f = JSON.parse(fs.readFileSync(`app/${before.slug}/feature.json`, "utf8"));
    features.push({ slug: before.slug, title: `${f.title || before.slug} (내 새 기능)`, status: "building", makers: f.makers || [name] });
  } catch {
    /* 무시 */
  }
}
say("");
say("  어떤 기능을 작업할까요?");
say("    0. ✨ 새 기능 만들기 (내 아이디어로 시작)");
features.forEach((f, i) => {
  const who = f.makers.length ? ` · ${f.makers.join(", ")}` : "";
  say(`    ${i + 1}. ${f.title} [${STATUSES[f.status] || f.status}${who}]`);
});
const beforeIdx = before ? features.findIndex((f) => f.slug === before.slug) : -1;
let feature;
while (!feature) {
  const hint = beforeIdx >= 0 ? ` [Enter = ${beforeIdx + 1}]` : "";
  const a = await ask(`  번호${hint}: `);
  if (a === "0") {
    // 새 기능 만들기는 new.mjs 가 이어서 처리합니다.
    await newFeature({ name, fetched: true });
    process.exit(0);
  }
  if (!a && beforeIdx >= 0) feature = features[beforeIdx];
  else feature = features[Number(a) - 1];
  if (!feature) {
    say(`  0~${features.length} 중에서 입력하세요.`);
    continue;
  }
  // 다른 사람이 이미 만들고 있는 기능이면 한 번 확인합니다 (같은 파일을 함께 고치면 충돌이 나기 쉬움)
  const others = feature.makers.filter((m) => m !== name);
  if (feature.status !== "idea" && others.length > 0 && !feature.makers.includes(name)) {
    say("");
    say(`  '${feature.title}'은(는) ${others.join(", ")}이(가) 만들고 있어요.`);
    say("  같은 화면을 함께 고치면 충돌이 나기 쉬우니, 먼저 그 친구와 나눠서 할 부분을 이야기하세요.");
    const c = (await ask("  함께 만들기로 이야기했으면 y, 다른 번호를 고르려면 Enter: ")).toLowerCase();
    if (c !== "y" && c !== "예") feature = null;
  }
}
doneAsking();

// ── 3. 브랜치 준비 ─────────────────────────────────────────
const branch = `feat/${feature.slug}-${name}`;
const now = currentBranch();
restoreLockfile();
const dirty = changedFiles();
if (now !== branch && dirty.length > 0) {
  fail(
    `저장하지 않은 변경 파일이 ${dirty.length}개 있어 다른 기능으로 옮길 수 없습니다.\n` +
      `  지금 브랜치(${now})에서 'npm run save'로 먼저 저장하거나, 대표에게 물어보세요.`
  );
}

const exists = (ref) => git(["rev-parse", "--verify", "--quiet", ref], { allowFail: true }).code === 0;
const hasRemote = exists(`refs/remotes/origin/${branch}`);
const hasLocal = exists(`refs/heads/${branch}`);

if (hasRemote) {
  if (hasLocal) {
    if (now !== branch) git(["switch", branch]);
    if (!gitLive(["pull", "--ff-only", "--quiet", "origin", branch])) {
      fail("내 브랜치를 최신으로 맞추지 못했습니다. 이 화면을 캡처해서 대표에게 보여 주세요.");
    }
  } else {
    git(["switch", "--track", "-c", branch, `origin/${branch}`]);
  }
  ok(`GitHub에 있던 내 브랜치로 이동: ${branch}`);
} else if (hasLocal) {
  // GitHub에서는 지워졌다 = 보통 PR이 합쳐진 것. 내 폴더 내용이 main과 같으면 최신 main에서 새로 시작합니다.
  // (스쿼시 병합이었어도 지난 작업과 충돌하지 않도록)
  const same = git(["diff", "--quiet", "origin/main", branch, "--", `app/${feature.slug}`], { allowFail: true }).code === 0;
  if (same && changedFiles().length === 0) {
    if (now === branch) git(["switch", "--detach", "origin/main"]);
    git(["branch", "-D", branch]);
    git(["switch", "--no-track", "-c", branch, "origin/main"]);
    ok(`지난 작업은 이미 main에 들어갔습니다. 최신 main에서 새로 시작: ${branch}`);
  } else {
    if (now !== branch) git(["switch", branch]);
    ok(`이 컴퓨터에 있던 내 브랜치로 이동: ${branch}`);
  }
} else {
  git(["switch", "--no-track", "-c", branch, "origin/main"]);
  ok(`최신 main에서 새 브랜치를 만들었습니다: ${branch}`);
}

// 합치기 전에 저장 안 된 작업 정리 (내 폴더 = 자동 저장, 폴더 밖 = 따로 보관)
prepareForSync(`app/${feature.slug}/`);

// 다른 사람들이 그동안 main에 합친 작업을 내 브랜치에도 가져옵니다.
// (이걸 해야 내 화면에서도 다른 사람의 기능이 보이고, 나중에 충돌이 줄어듭니다)
if (syncWithMain() === "conflict") {
  explainConflict();
  process.exit(1);
}
ok("다른 사람들의 최신 작업을 받아왔습니다.");

// ── 4. 만든 사람 목록에 내 이름 올리기 ──────────────────────────
const metaFile = `app/${feature.slug}/feature.json`;
try {
  const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
  meta.makers = Array.isArray(meta.makers) ? meta.makers : [];
  let changed = false;
  if (!meta.makers.includes(name)) {
    meta.makers.push(name);
    changed = true;
  }
  if (!meta.status || meta.status === "idea") {
    meta.status = "building";
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2) + "\n", "utf8");
    git(["add", "--", metaFile]);
    git(["commit", "-m", `chore: ${feature.title} 만든 사람에 ${name} 추가`, "--quiet"]);
    ok(`'${feature.title}'의 만든 사람에 ${name} 추가 (저장하면 홈 화면에 표시됩니다)`);
  }
} catch {
  warn(`${metaFile} 을 읽지 못했습니다. 대표에게 알려 주세요.`);
}

// ── 5. 부품 설치 ───────────────────────────────────────────
say("");
say("  앱 실행에 필요한 부품을 확인하는 중... (처음엔 1~2분)");
if (!npmLive("install --no-audit --no-fund --loglevel=error")) {
  fail("npm install 중 문제가 생겼습니다. 이 화면을 캡처해서 대표에게 보여 주세요.");
}
restoreLockfile();
ok("부품 준비");
regenerateMenu();

title("준비 끝!");
say(`  기능     : ${feature.title}`);
say(`  브랜치   : ${branch}`);
say(`  내 폴더  : app/${feature.slug}/   ← 이 폴더 안의 파일만 고칩니다`);
say(`  내 화면  : (앱 주소)/${feature.slug}`);
say("");
say("  다음: npm run ai  → AI에게 무엇을 만들고 싶은지 이야기하기");
say("");
