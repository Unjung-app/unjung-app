// PR 자동 검사 (GitHub Actions가 실행합니다. 학생은 실행할 필요 없음)
// 사용: node scripts/check-pr.mjs <비교 기준 커밋>
//  - 실패(빨간 X): feature.json 이 깨짐, 비밀 키처럼 보이는 값이 새로 들어감
//  - 알림(통과는 함): 공용 파일을 바꿈 → 대표가 꼭 봐야 함 / 여러 기능 폴더를 한꺼번에 바꿈

import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { readFeatures, scanSecrets } from "./features.mjs";

const base = process.argv[2] || "origin/main";
const sh = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 }).trim();

const changed = sh(["diff", "--name-only", `${base}...HEAD`]).split("\n").filter(Boolean);
const featureOf = (f) => /^app\/([^/_(][^/]*)\//.exec(f)?.[1];
// 기능 폴더 안의 파일인가? (그 폴더에 feature.json 이 있으면 기능 폴더)
const isFeatureFile = (f) => !!featureOf(f) && fs.existsSync(`app/${featureOf(f)}/feature.json`);

const shared = changed.filter((f) => !isFeatureFile(f));
const touchedFeatures = [...new Set(changed.filter(isFeatureFile).map(featureOf))];

// 새로 추가된 줄에서 비밀 값 찾기
const added = sh(["diff", "-U0", `${base}...HEAD`])
  .split("\n")
  .filter((l) => l.startsWith("+") && !l.startsWith("+++"));
const strongSecrets = added.filter((l) => scanSecrets(l).strong);
const weakSecrets = added.filter((l) => !scanSecrets(l).strong && scanSecrets(l).weak);

const { errors } = readFeatures(process.cwd());

let failed = false;
const lines = ["## 운중고 앱 자동 검사", ""];
const note = (kind, msg) => {
  lines.push(`- ${kind} ${msg}`);
  const level = kind === "❌" ? "error" : kind === "⚠️" ? "warning" : "notice";
  console.log(`::${level}::${msg}`);
};

if (errors.length) {
  failed = true;
  errors.forEach((e) => note("❌", e));
} else note("✅", "feature.json 형식 정상");

if (strongSecrets.length) {
  failed = true;
  note("❌", `API 키·토큰처럼 보이는 값이 ${strongSecrets.length}줄 있습니다. 키는 코드에 넣지 말고 대표에게 문의하세요.`);
} else note("✅", "비밀 키 없음");
if (weakSecrets.length) {
  note("⚠️", `비밀번호처럼 보이는 글이 ${weakSecrets.length}줄 있습니다. 가짜 예시인지 확인해 주세요.`);
}

if (shared.length) {
  note("⚠️", `공용 파일을 바꿉니다 (대표 확인 필요): ${shared.join(", ")}`);
} else note("✅", "공용 파일은 바꾸지 않음");

if (touchedFeatures.length > 1) {
  note("⚠️", `기능 폴더 ${touchedFeatures.length}개를 한꺼번에 바꿉니다: ${touchedFeatures.join(", ")}`);
} else if (touchedFeatures.length === 1) {
  note("✅", `바뀐 기능: ${touchedFeatures[0]}`);
}

lines.push("", "_앱이 실제로 만들어지는지(빌드)는 다음 단계에서 따로 검사합니다._");
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
console.log(lines.join("\n"));
process.exit(failed ? 1 : 0);
