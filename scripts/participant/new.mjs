// npm run new — 내 아이디어로 새 기능을 시작합니다.
//  1) 기능 이름·설명·주소 묻기  2) 최신 main에서 내 브랜치 만들기
//  3) src/lab/<주소>/ 폴더에 meta.json + 첫 화면(index.tsx) 만들기 → 앱 '전체 → 실험실'에 자동 등록
// (npm run work 에서 0번을 골라도 여기로 옵니다)

import fs from "node:fs";
import {
  IN_CODESPACES, NAME_RE, REPO_URL, title, say, ok, fail, ask, doneAsking, git, gitLive, npmLive,
  ensureRepoRoot, changedFiles, parseBranch, suggestName, targetsAt, mergeInProgress, restoreLockfile, parkStrayChanges,
} from "./common.mjs";
import { SLUG_RE, RESERVED, isMain } from "./targets.mjs";

export async function newFeature(opts = {}) {
  ensureRepoRoot();
  title("운중고 앱 · 새 기능 만들기 (실험실)");

  if (mergeInProgress()) fail("충돌 해결이 끝나지 않았습니다. 먼저 'npm run save'로 마무리하세요.");
  parkStrayChanges();
  restoreLockfile();
  const dirty = changedFiles();
  if (dirty.length > 0) {
    fail(`저장하지 않은 변경 파일이 ${dirty.length}개 있습니다. 먼저 'npm run save'로 저장하세요.`);
  }

  if (!opts.fetched) {
    say("  준비하는 중...");
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
  say("  만들고 싶은 기능을 알려 주세요.");
  let featTitle = "";
  while (!featTitle) {
    featTitle = (await ask("  기능 이름 (한글 가능, 예: 점심 신청곡): ")).slice(0, 30);
  }
  const desc = (await ask("  한 줄 설명 (Enter = 건너뛰기): ")).slice(0, 60);

  const all = targetsAt("origin/main");
  const taken = new Set([...all.core, ...all.labs].map((f) => f.slug));
  const remoteBranches = git(["branch", "-r", "--format=%(refname:short)"], { allowFail: true }).out.split("\n");
  let slug = "";
  while (!slug) {
    const a = (await ask("  주소로 쓸 영어 이름 (예: music-request): ")).toLowerCase();
    if (!SLUG_RE.test(a)) {
      say("  영어 소문자로 시작하고, 소문자·숫자·하이픈(-)만 2~30글자로 입력하세요.");
    } else if (RESERVED.has(a)) {
      say("  이 이름은 앱에서 이미 쓰고 있어요. 다른 이름을 써 주세요.");
    } else if (taken.has(a) || fs.existsSync(`src/lab/${a}`)) {
      say("  이미 있는 기능 이름입니다. 다른 이름을 쓰거나, 그 기능에 함께하려면 npm run work 에서 고르세요.");
    } else if (remoteBranches.some((b) => parseBranch(b.replace(/^origin\//, ""))?.slug === a)) {
      say("  누군가 같은 이름으로 이미 만들고 있어요. 다른 이름을 쓰거나 그 사람과 이야기해 보세요.");
    } else {
      slug = a;
    }
  }

  doneAsking();

  // ── 브랜치 + 파일 만들기 ────────────────────────────────────
  const branch = `feat/${slug}-${name}`;
  if (git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { allowFail: true }).code === 0) {
    fail(`이 컴퓨터에 ${branch} 브랜치가 이미 있습니다. npm run work 에서 그 기능을 고르세요.`);
  }
  git(["switch", "--no-track", "-c", branch, "origin/main"]);

  const dir = `src/lab/${slug}`;
  fs.mkdirSync(dir, { recursive: true });
  const meta = { title: featTitle, desc, emoji: "✨", makers: [name], status: "building" };
  fs.writeFileSync(`${dir}/meta.json`, JSON.stringify(meta, null, 2) + "\n", "utf8");
  const page = `// '${featTitle}' 기능의 첫 화면입니다.
// 이 폴더(src/lab/${slug}/) 안이라면 무엇이든 AI와 함께 마음껏 바꿔도 됩니다.
// 참고할 예시: src/lab/example/index.tsx
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { color } from '@/theme/tokens';

export default function ${"Lab" + slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("")}() {
  return (
    <Screen topInset={false}>
      <Card>
        <AppText variant="title">{${JSON.stringify(featTitle)}}</AppText>
        <AppText variant="body" color={color.inkMuted}>
          {${JSON.stringify(desc || "아직 설명이 없어요.")}}
        </AppText>
      </Card>
      <AppText variant="caption" color={color.inkMuted}>
        아직 빈 화면이에요. Copilot 채팅에서 /feature 를 입력하고, 이 화면에 무엇이 보였으면 좋겠는지 이야기해 보세요.
      </AppText>
    </Screen>
  );
}
`;
  fs.writeFileSync(`${dir}/index.tsx`, page, "utf8");
  git(["add", "--", dir]);
  git(["commit", "-m", `feat(lab): 새 기능 시작 — ${featTitle}`, "--quiet"]);
  ok(`${dir}/ 폴더를 만들었어요.`);

  if (!fs.existsSync("node_modules")) {
    say("  앱 부품을 설치하는 중... (1~2분)");
    if (!npmLive("install --no-audit --no-fund --loglevel=error")) {
      fail("npm install 중 문제가 생겼습니다. 이 화면을 캡처해서 대표에게 보여 주세요.");
    }
  }
  restoreLockfile();

  title("새 기능 준비 끝!");
  say(`  내 기능   : ${featTitle}`);
  say(`  내 화면   : 미리보기 새로고침 → 전체 → 실험실 → "${featTitle}"`);
  say(`  고칠 폴더 : src/lab/${slug}/`);
  say("");
  say("  다음 → Copilot 채팅(Ctrl+Alt+I)에서 /feature");
  say("        (Copilot을 못 쓰면 npm run ai)");
  say("");
}

// 'npm run new' 으로 직접 실행했을 때
if (isMain(import.meta.url)) {
  await newFeature();
}
