import fs from "node:fs";
import path from "node:path";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants.js";
import { generateFeatures } from "./scripts/gen-features.mjs";

export default function config(phase) {
  // 기능 목록(메뉴) 만들기 — 빌드 때는 feature.json 이 깨져 있으면 실패해서 알려 줍니다.
  generateFeatures({ strict: phase === PHASE_PRODUCTION_BUILD, quiet: true });

  // 개발 중에는 feature.json 이 바뀌면 메뉴를 다시 만듭니다.
  if (phase === PHASE_DEVELOPMENT_SERVER && !globalThis.__unjungFeatureWatch) {
    globalThis.__unjungFeatureWatch = true;
    try {
      let timer;
      fs.watch(path.join(process.cwd(), "app"), { recursive: true }, (_e, file) => {
        if (!file || !String(file).endsWith("feature.json")) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          try {
            generateFeatures({ quiet: true });
          } catch {
            /* 개발 중에는 경고만 */
          }
        }, 200);
      });
    } catch {
      /* 감시가 안 되는 환경이면 다음 실행 때 반영 */
    }
  }

  /** @type {import('next').NextConfig} */
  return {
    // GitHub Codespaces 미리보기 주소에서 개발 서버(자동 새로고침)에 접속할 수 있게 허용
    allowedDevOrigins: ["*.app.github.dev"],
  };
}
