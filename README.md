# 운중고 학교 앱 (unjung-app)

운중고 학생이 **직접 제안하고 만드는** 학교 앱.
Next.js 16 (App Router) · Tailwind CSS v4 · JavaScript · Vercel 배포

- 실제 앱: https://unjung-app.vercel.app
- 참여 안내서: 대표가 공유한 「운중고 앱 참여 안내서」

## 시작하기 (설치 없이)

저장소 화면 초록색 **Code** → **Codespaces** → **Create codespace on main**
→ 브라우저에 VS Code가 열리고 앱이 자동으로 켜집니다.

## 참여원 명령

```bash
npm run work   # 작업 시작: 기능 고르기(0번 = 새 기능) + 최신 작업 받아오기
npm run new    # 내 아이디어로 새 기능 바로 만들기
npm run ai     # AI 채팅에 붙여넣을 내용(규칙 + 내 코드) 준비
npm run save   # 저장 → 최신 작업 합치기 → GitHub에 올리기 → PR 주소 안내
npm run check  # 막혔을 때: 환경·권한·브랜치·앱 실행 상태 점검
```

## 구조

```
app/
  <기능>/              기능 하나 = 폴더 하나 (참여원은 자기 기능 폴더 안에서 자유롭게)
    feature.json       기능 이름·설명·아이콘·만든 사람·상태 → 홈/메뉴에 자동 반영
    page.js            기능 첫 화면 (주소: /<기능>)
  layout.js · page.js · globals.css   공용 (대표)
components/ lib/ scripts/              공용 (대표)
.devcontainer/ .vscode/ .github/       Codespaces·자동 검사·양식 (대표)
```

- 홈·메뉴는 `npm run dev`/`build` 때 `scripts/gen-features.mjs`가 `feature.json`을 모아
  `lib/features.generated.js`(자동 생성, Git에 올리지 않음)로 만듭니다.
  → 기능을 추가해도 공용 파일을 고칠 필요가 없고, 그래서 충돌이 나지 않습니다.
- 하단 탭바 고정 메뉴 4개는 `lib/menu.js`의 `PRIMARY_TAB_KEYS`(대표)에서 정합니다.
- `feature.json`의 `status`: `idea`(아이디어) → `building`(만드는 중) → `ready`(사용 가능)

## 아이디어·도움

- 새 기능 아이디어: Issues → **💡 기능 아이디어** (허락 없이 바로 시작해도 됩니다)
- 10분 넘게 막히면: Issues → **🆘 도움 요청**

## PR이 올라오면

자동 검사(GitHub Actions)가 feature.json 형식 · 비밀 키 · 공용 파일 변경 · 빌드를 확인합니다.
학생 브랜치(`feat/**`)는 Vercel에 배포하지 않습니다(`vercel.json`, 무료 요금제 하루 100회 배포 한도 보호). 확인은 Codespaces 미리보기로 합니다.
**검토하는 대표에게:** PR의 주인은 만든 학생입니다. "고쳐"보다 "이건 어떻게 생각해?"로, 좋은 점 한 가지와 함께 남겨 주세요.
병합은 **Create a merge commit**으로 합니다. 수업 기간에는 PR 화면의 Update branch·Commit suggestion을 써도 되지만(학생 스크립트가 자동으로 합침), `.github/workflows/`는 바꾸지 마세요.

AI가 지켜야 할 규칙은 `AGENTS.md`에 있습니다.

## 디자인 규칙

- 색상: 남색 계열(`navy-50` ~ `navy-950`, `app/globals.css`의 `@theme`)
- 앱 폭: 최대 480px, 데스크톱에서는 가운데 정렬
- Tailwind v4에는 `tailwind.config.js`가 없습니다. 색·글꼴은 `app/globals.css`의 `@theme`에서 정합니다.
