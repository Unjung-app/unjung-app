// npm run new — 내 아이디어로 새 기능을 시작합니다.
//  1) 기능 이름·설명·주소·아이콘 묻기  2) 최신 main에서 내 브랜치 만들기
//  3) app/<주소>/ 폴더에 feature.json + 첫 화면(page.js) 만들기  4) 메뉴 갱신
// (npm run work 에서 0번을 골라도 여기로 옵니다)

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import {
  IN_CODESPACES, NAME_RE, REPO_URL, title, say, ok, fail, ask, doneAsking, git, gitLive, npmLive,
  ensureRepoRoot, changedFiles, suggestName, featuresAt, regenerateMenu, mergeInProgress, restoreLockfile,
} from "./common.mjs";
import { SLUG_RE, ICON_NAMES } from "./features.mjs";

export async function newFeature(opts = {}) {
  ensureRepoRoot();
  title("운중고 앱 · 새 기능 만들기");

  if (mergeInProgress()) fail("충돌 해결이 끝나지 않았습니다. 먼저 'npm run save'로 마무리하세요.");
  restoreLockfile();
  const dirty = changedFiles();
  if (dirty.length > 0) {
    fail(`저장하지 않은 변경 파일이 ${dirty.length}개 있습니다. 먼저 'npm run save'로 저장하세요.`);
  }

  if (!opts.fetched) {
    say("  GitHub에서 최신 정보를 받아오는 중...");
    if (!gitLive(["fetch", "origin", "--prune", "--quiet"])) {
      fail("GitHub에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 실행하세요.");
    }
  }

  // ── 이름 ──────────────────────────────────────────────────
  let name = opts.name;
  if (!name) {
    const guess =
      suggestName(git(["config", "--local", "user.name"], { allowFail: true }).out) ||
      suggestName(process.env.GITHUB_USER);
    while (!name) {
      const hint = guess ? ` [Enter = ${guess}]` : "";
      const a = (await ask(`\n  내 영문 이름 (소문자, 예: howon)${hint}: `)).toLowerCase();
      if (!a && guess) name = guess;
      else if (NAME_RE.test(a)) name = a;
      else say("  영어 소문자로 시작하고, 소문자·숫자만 2~20글자로 입력하세요.");
    }
    git(["config", "user.name", name]);
    if (!IN_CODESPACES && !git(["config", "user.email"], { allowFail: true }).out) {
      let email;
      while (!email) {
        const a = await ask("  GitHub에 등록된 내 이메일: ");
        if (/^\S+@\S+\.\S+$/.test(a)) email = a;
        else say("  이메일 형식으로 입력하세요. (GitHub → Settings → Emails 에서 확인)");
      }
      git(["config", "user.email", email]);
    }
  }

  // ── 기능 정보 ──────────────────────────────────────────────
  say("");
  say("  만들고 싶은 기능을 알려 주세요. (나중에 feature.json 에서 언제든 바꿀 수 있어요)");
  let featTitle = "";
  while (!featTitle) {
    featTitle = (await ask("  기능 이름 (한글 가능, 예: 점심 신청곡): ")).slice(0, 30);
  }
  const desc = (await ask("  한 줄 설명 (Enter = 건너뛰기): ")).slice(0, 60);

  const taken = new Set(featuresAt("origin/main").map((f) => f.slug));
  const remoteBranches = git(["branch", "-r", "--format=%(refname:short)"], { allowFail: true }).out.split("\n");
  let slug = "";
  while (!slug) {
    const a = (await ask("  주소로 쓸 영어 이름 (소문자·숫자·하이픈, 예: music-request): ")).toLowerCase();
    if (!SLUG_RE.test(a)) {
      say("  영어 소문자로 시작하고, 소문자·숫자·하이픈(-)만 2~30글자로 입력하세요.");
    } else if (taken.has(a) || fs.existsSync(`app/${a}`)) {
      say("  이미 있는 기능 이름입니다. 다른 이름을 쓰거나, 그 기능에 함께하려면 npm run work 에서 고르세요.");
    } else if (remoteBranches.some((b) => b.startsWith(`origin/feat/${a}-`))) {
      say("  누군가 같은 이름으로 이미 만들고 있어요. 다른 이름을 쓰거나 그 사람과 이야기해 보세요.");
    } else {
      slug = a;
    }
  }

  say(`  아이콘: 이모지 한 개를 붙여넣거나, 이 중 하나를 쓰세요: ${ICON_NAMES.join(", ")}`);
  const iconIn = await ask("  아이콘 (Enter = ✨): ");
  const icon = iconIn || "✨";
  doneAsking();

  // ── 브랜치 + 파일 만들기 ────────────────────────────────────
  const branch = `feat/${slug}-${name}`;
  if (git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { allowFail: true }).code === 0) {
    fail(`이 컴퓨터에 ${branch} 브랜치가 이미 있습니다. npm run work 에서 그 기능을 고르세요.`);
  }
  git(["switch", "--no-track", "-c", branch, "origin/main"]);
  ok(`최신 main에서 새 브랜치를 만들었습니다: ${branch}`);

  fs.mkdirSync(`app/${slug}`, { recursive: true });
  const meta = { title: featTitle, short: featTitle.slice(0, 6), desc, icon, status: "building", makers: [name] };
  fs.writeFileSync(`app/${slug}/feature.json`, JSON.stringify(meta, null, 2) + "\n", "utf8");

  const iconShown = ICON_NAMES.includes(icon) ? "✨" : icon;
  const page = `// '${featTitle}' 기능의 첫 화면입니다.
  // 이 폴더(app/${slug}/) 안이라면 무엇이든 AI와 함께 마음껏 바꿔도 됩니다.

  export default function Page() {
    return (
      <div className="px-5 py-8">
        <p className="text-4xl">{${JSON.stringify(iconShown)}}</p>
        <h2 className="mt-3 text-xl font-bold text-navy-900">{${JSON.stringify(featTitle)}}</h2>
        <p className="mt-2 text-sm text-navy-500">{${JSON.stringify(desc || "아직 설명이 없어요.")}}</p>
        <p className="mt-6 rounded-xl bg-navy-50 p-4 text-sm leading-relaxed text-navy-700">
          아직 빈 화면이에요. npm run ai 를 실행하고, AI에게 이 화면에 무엇이 보였으면
          좋겠는지 이야기해 보세요.
        </p>
      </div>
    );
  }
  `;
  fs.writeFileSync(`app/${slug}/page.js`, page, "utf8");
  ok(`app/${slug}/ 폴더와 첫 화면을 만들었습니다.`);

  if (!fs.existsSync("node_modules")) {
    say("  앱 실행에 필요한 부품을 설치하는 중... (1~2분)");
    if (!npmLive("install --no-audit --no-fund --loglevel=error")) {
      fail("npm install 중 문제가 생겼습니다. 이 화면을 캡처해서 대표에게 보여 주세요.");
    }
  }
  restoreLockfile();
  regenerateMenu();

  title("새 기능 준비 끝!");
  say(`  기능     : ${featTitle}`);
  say(`  내 폴더  : app/${slug}/`);
  say(`  내 화면  : (앱 주소)/${slug}   ← 홈 화면 '만드는 중'에도 나타납니다`);
  say("");
  say("  다음: npm run ai  → AI에게 무엇을 만들고 싶은지 이야기하기");
  say("  (선택) 다른 사람도 볼 수 있게 아이디어를 올려 두세요:");
  say(`        ${REPO_URL}/issues/new?template=idea.yml`);
  say("");
}

// 'npm run new' 으로 직접 실행했을 때
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await newFeature();
}
