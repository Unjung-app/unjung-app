// npm run ai — AI 채팅창에 붙여넣을 내용을 만들어 클립보드에 복사합니다.
// 내용 = 프로젝트 규칙(AGENTS.md) + 내 기능 정보 + 내 기능 폴더의 현재 코드 전체

import fs from "node:fs";
import path from "node:path";
import {
  title, say, ok, warn, fail, ensureRepoRoot, currentBranch, parseBranch, copyFileToClipboard,
} from "./common.mjs";

ensureRepoRoot();

const info = parseBranch(currentBranch());
if (!info) fail("내 기능 브랜치가 아닙니다. 먼저 'npm run work'를 실행하세요.");
const { feature } = info;
const folder = path.join("app", feature.key);

// 내 기능 폴더 안의 코드 파일 모으기
const TEXT_EXT = new Set([".js", ".jsx", ".mjs", ".css", ".json", ".md"]);
function collect(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return collect(p);
    return TEXT_EXT.has(path.extname(d.name)) ? [p] : [];
  });
}
const files = collect(folder).sort();

const rules = fs.readFileSync("AGENTS.md", "utf8");
const slash = (p) => p.split(path.sep).join("/");

let text = "";
text += "아래는 내가 참여하는 학교 앱 프로젝트의 규칙과 내 작업 파일이야.\n";
text += "규칙을 반드시 지켜 줘. 다 읽었으면 \"준비됐어\"라고만 답하고, 내 요청을 기다려 줘.\n\n";
text += "────────────────────────────────────────\n";
text += rules.trim() + "\n";
text += "────────────────────────────────────────\n\n";
text += "# 지금 내 작업\n\n";
text += `- 내 기능: ${feature.label}\n`;
text += `- 내가 수정할 수 있는 폴더: \`${slash(folder)}/\` (이 밖은 수정 금지)\n`;
text += `- 확인 주소: http://localhost:3000/${feature.key}\n\n`;
text += `# 내 폴더의 현재 코드 (${files.length}개 파일)\n\n`;
for (const f of files) {
  const body = fs.readFileSync(f, "utf8");
  const ext = path.extname(f).slice(1);
  text += `## ${slash(f)}\n\n\`\`\`${ext}\n${body.trimEnd()}\n\`\`\`\n\n`;
}

const outFile = path.resolve("ai-context.md");
fs.writeFileSync(outFile, text, "utf8");

title("AI에게 보낼 내용 준비 완료");
say(`  내 기능 : ${feature.label} (${slash(folder)}/, 파일 ${files.length}개)`);
say(`  글자 수 : 약 ${text.length.toLocaleString()}자`);
say("");
if (copyFileToClipboard(outFile)) {
  ok("클립보드에 복사했습니다.");
  say("");
  say("  1) AI 채팅을 새로 시작하고   2) Ctrl+V (맥은 Cmd+V)로 붙여넣어 보내세요.");
  say("  3) AI가 '준비됐어'라고 하면, 만들고 싶은 것을 요청하세요.");
} else {
  warn("자동 복사가 안 되는 환경입니다. 아래 파일을 열어 전체 복사하거나 채팅에 업로드하세요.");
}
say("");
say(`  (같은 내용이 파일로도 저장됨: ai-context.md)`);
say("  코드를 고친 뒤 새 채팅을 시작할 때는 이 명령을 다시 실행하세요.");
say("");
