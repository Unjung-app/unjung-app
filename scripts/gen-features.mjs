// npm run dev / npm run build 직전에 자동으로 실행됩니다.
// app/*/feature.json 을 모아 lib/features.generated.js 를 만듭니다.
// (이 파일은 자동 생성물이라 GitHub에 올리지 않습니다 → 기능을 추가해도 공용 파일 충돌이 없습니다)
//
// 옵션: --strict  문제가 있는 feature.json 이 있으면 실패 (자동 검사용)

import fs from "node:fs";
import path from "node:path";
import { readFeatures } from "./features.mjs";

const strict = process.argv.includes("--strict");
const root = process.cwd();
const { features, errors } = readFeatures(root);

if (errors.length) {
  console.log("");
  console.log("  [주의] feature.json 에 고칠 점이 있습니다:");
  errors.forEach((e) => console.log(`    - ${e}`));
  console.log("");
  if (strict) process.exit(1);
}

const out = path.join(root, "lib", "features.generated.js");
const body =
  "// 자동 생성 파일입니다. 직접 고치지 마세요. (scripts/gen-features.mjs 가 만듦)\n" +
  `export const FEATURES = ${JSON.stringify(features, null, 2)};\n`;

// 내용이 같으면 다시 쓰지 않음 (개발 서버가 불필요하게 새로고침되지 않도록)
const prev = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
if (prev !== body) fs.writeFileSync(out, body, "utf8");
console.log(`  [완료] 기능 ${features.length}개를 메뉴에 등록했습니다.`);
