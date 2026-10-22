// npm run check — 내 작업 환경을 한 번에 점검합니다.
// 막혔을 때 이 결과를 캡처해서 대표에게 보여 주면, 원인을 바로 찾을 수 있어요.

import fs from "node:fs";
import net from "node:net";
import { spawnSync } from "node:child_process";
import {
  IN_CODESPACES, title, say, git, ensureRepoRoot, currentBranch, parseBranch, changedFiles,
  mergeInProgress, restoreLockfile, NO_PROMPT_ENV,
} from "./common.mjs";
import { readFeatures } from "./features.mjs";

ensureRepoRoot();
title("운중고 앱 · 작업 환경 점검");

const rows = [];
const good = (label, detail = "") => rows.push({ ok: true, label, detail });
const bad = (label, detail, fix) => rows.push({ ok: false, label, detail, fix });

// 1. 환경
good("개발 환경", IN_CODESPACES ? "GitHub Codespaces" : `내 컴퓨터 (${process.platform})`);

// 2. Node.js
const [maj, min] = process.versions.node.split(".").map(Number);
if (maj > 20 || (maj === 20 && min >= 9)) good("Node.js", process.versions.node);
else bad("Node.js", `${process.versions.node} (낮음)`, "nodejs.org에서 LTS 버전을 설치하세요. (Codespaces는 해당 없음)");

// 3. 부품
if (fs.existsSync("node_modules/next")) good("앱 부품(node_modules)", "설치됨");
else bad("앱 부품(node_modules)", "없음", "npm run work 를 실행하면 설치됩니다.");

// 4. GitHub 연결
const ls = spawnSync("git", ["ls-remote", "--heads", "origin", "main"], {
  encoding: "utf8",
  timeout: 20000,
  env: NO_PROMPT_ENV,
});
if (ls.status === 0) good("GitHub 연결", "정상");
else bad("GitHub 연결", "실패", "인터넷 연결을 확인하세요. 학교 와이파이가 막혀 있으면 대표에게 알려 주세요.");

// 5. 올리기 권한 (실제로 올리지는 않고 시험만)
if (ls.status === 0) {
  const p = spawnSync("git", ["push", "--dry-run", "origin", "HEAD:refs/heads/permission-check-only"], {
    encoding: "utf8",
    timeout: 30000,
    env: NO_PROMPT_ENV,
  });
  const t = `${p.stderr || ""}${p.stdout || ""}`;
  if (p.status === 0) good("올리기 권한", "있음");
  else if (/403|denied|not have permission|Permission to|Authentication failed/i.test(t)) {
    bad("올리기 권한", "없음", "대표에게 Unjung-app 조직 초대(수락 여부)와 Write 권한을 확인해 달라고 하세요.");
  } else bad("올리기 권한", "확인 실패", t.trim().split("\n").slice(-1)[0] || "대표에게 이 화면을 보여 주세요.");
}

// 6. 이름
const name = git(["config", "user.name"], { allowFail: true }).out;
if (name) good("커밋 이름", name);
else bad("커밋 이름", "없음", "npm run work 를 실행하면 설정됩니다.");

// 7. 브랜치·내 기능
const branch = currentBranch();
const info = parseBranch(branch);
if (info && fs.existsSync(`app/${info.slug}/feature.json`)) good("내 기능", `app/${info.slug}/  (브랜치 ${branch})`);
else if (info) bad("내 기능", `app/${info.slug}/ 폴더가 없음`, "npm run work 로 기능을 다시 고르세요.");
else bad("내 기능", `지금 브랜치: ${branch}`, "npm run work 를 실행해서 기능을 고르세요.");

// 8. 저장 상태
if (mergeInProgress()) {
  bad("충돌 해결", "진행 중", "conflict-help.md 안내대로 고친 뒤 npm run save 하세요.");
} else {
  restoreLockfile();
  const n = changedFiles().length;
  good("저장 안 된 파일", n === 0 ? "없음" : `${n}개 (npm run save 로 올릴 수 있어요)`);
}

// 9. feature.json 형식
const { errors } = readFeatures(process.cwd());
if (errors.length === 0) good("feature.json 형식", "정상");
else bad("feature.json 형식", errors[0], "AI에게 이 문장을 보여 주고 고쳐 달라고 하세요.");

// 10. 앱 실행 중인지 (3000번 포트가 열려 있는지만 확인 — 첫 화면 준비가 느려도 오판하지 않게)
const running = await new Promise((resolve) => {
  const sock = net.connect({ port: 3000, host: "127.0.0.1" });
  const done = (v) => {
    sock.destroy();
    resolve(v);
  };
  sock.setTimeout(3000, () => done(false));
  sock.once("connect", () => done(true));
  sock.once("error", () => done(false));
});
if (running) good("앱 실행(3000번)", "켜져 있음");
else bad("앱 실행(3000번)", "꺼져 있음", "새 터미널을 열어 npm run dev 를 입력하고, 그 터미널은 닫지 마세요.");

// ── 결과 ─────────────────────────────────────────────────
say("");
for (const r of rows) {
  say(`  ${r.ok ? "✅" : "❌"} ${r.label} : ${r.detail}`);
  if (!r.ok) say(`       → ${r.fix}`);
}
const problems = rows.filter((r) => !r.ok).length;
say("");
if (problems === 0) say("  모두 정상이에요! 이제 npm run ai 로 AI와 만들어 보세요.");
else say(`  고칠 것 ${problems}개. 위의 → 안내를 따라 해 보고, 안 되면 이 화면을 대표에게 보여 주세요.`);
say("");
