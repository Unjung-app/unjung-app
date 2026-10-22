// app/*/feature.json 을 모아 lib/features.generated.js 를 만듭니다.
// (자동 생성물이라 GitHub에 올리지 않습니다 → 기능을 추가해도 공용 파일 충돌이 없습니다)
//
// 언제 실행되나?
//  - next.config.mjs 가 불러올 때마다 (npm run dev / build, next dev / build 어느 쪽이든)
//  - 개발 중에는 feature.json 이 바뀌면 자동으로 다시 만듦 (next.config.mjs 의 감시 기능)
//  - 직접 실행: node scripts/gen-features.mjs [--strict]  (--strict: 문제가 있으면 실패)

import fs from "node:fs";
import path from "node:path";
import { readFeatures, isMain } from "./features.mjs";

export function generateFeatures({ root = process.cwd(), strict = false, quiet = false } = {}) {
  const { features, errors } = readFeatures(root);
  if (errors.length) {
    console.log("");
    console.log("  [주의] feature.json 에 고칠 점이 있습니다:");
    errors.forEach((e) => console.log(`    - ${e}`));
    console.log("");
    if (strict) throw new Error("feature.json 오류 때문에 멈춥니다.");
  }
  const out = path.join(root, "lib", "features.generated.js");
  const body =
    "// 자동 생성 파일입니다. 직접 고치지 마세요. (scripts/gen-features.mjs 가 만듦)\n" +
    `export const FEATURES = ${JSON.stringify(features, null, 2)};\n`;
  const prev = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
  if (prev !== body) fs.writeFileSync(out, body, "utf8"); // 같으면 다시 쓰지 않음(불필요한 새로고침 방지)
  if (!quiet) console.log(`  [완료] 기능 ${features.length}개를 메뉴에 등록했습니다.`);
  return { features, errors };
}

// 직접 실행했을 때
if (isMain(import.meta.url)) {
  try {
    generateFeatures({ strict: process.argv.includes("--strict") });
  } catch (e) {
    console.log(`  [멈춤] ${e.message}`);
    process.exit(1);
  }
}
