# 운중고 스마트 캠퍼스 (unjung-app)

운중고등학교 학생 전용 스마트 캠퍼스 앱.
**Next.js 16 (App Router) + Tailwind CSS v4 + JavaScript**

현재는 전체 틀만 잡은 단계로, 9개 기능 페이지는 모두 "준비 중" 화면입니다.

## 실행 방법

```bash
npm install     # 처음 한 번만 (1~2분)
npm run dev     # http://localhost:3000
```

> **중요 — 이 폴더에서만 실행하세요.**
> `unjung-app-local` 이라는 이름의 폴더가 여러 개 있으면 엉뚱한 폴더에서 서버가 돌아
> "코드를 고쳤는데 화면이 안 바뀐다"는 문제가 생깁니다.
> 터미널에서 `npm run dev` 를 치기 전에 프롬프트 경로가
> `...\Documents\InCloud_project\unjung-app-local` 인지 꼭 확인하세요.

## 폴더 구조

```
app/
  layout.js          공통 레이아웃 (헤더 + 하단 탭바)
  globals.css        전역 스타일 + 디자인 토큰(@theme)  ← 색상·글꼴은 여기
  page.js            홈 (9개 기능 바로가기)
  meal/              1. 급식 정보
  timetable/         2. 시간표 · 학사일정
  sports/            3. 교내 스포츠 허브
  voice/             4. 운중 보이스
  library/           5. 도서관 장서 검색
  notice/            6. 통합 공지
  meal-review/       7. 급식 메뉴 평가
  quiz/              8. 학업 연계 미니게임
  study/             9. 전학년 공부시간 경쟁

components/          ← 공용. 참여원은 건드리지 않습니다
  AppHeader.js       상단 헤더 (홈이면 앱 이름, 하위 페이지면 뒤로가기 + 제목)
  BottomNav.js       하단 탭바 + '더보기' 전체 메뉴 시트
  ComingSoon.js      "○○ 기능 준비 중입니다" 공통 화면
  Icon.js            인라인 SVG 아이콘 모음

lib/                 ← 공용. 참여원은 건드리지 않습니다
  menu.js            9개 메뉴 정의 (한 곳에서 관리)
```

## 참여원 작업 규칙

- 자기 담당 폴더(`app/<기능>/`) **안에서만** 작업합니다.
- `components/`, `lib/`, `app/layout.js`, `app/globals.css` 는 **공용이라 건드리지 않습니다.**
  (바꿔야 할 일이 생기면 대표에게 이야기)
- 자기 폴더 안에 컴포넌트가 더 필요하면 `app/<기능>/_components/` 를 만들어 쓰세요.
  `_` 로 시작하는 폴더는 라우트가 생기지 않습니다.

## 자주 하는 수정

| 하고 싶은 것 | 고칠 파일 |
| --- | --- |
| 메뉴 이름 · 순서 · 설명 바꾸기 | `lib/menu.js` |
| 하단 탭바에 고정할 4개 메뉴 바꾸기 | `lib/menu.js` 의 `PRIMARY_TAB_KEYS` |
| 색상 테마 바꾸기 | `app/globals.css` 의 `@theme` → `--color-navy-*` |
| 글꼴 바꾸기 | `app/globals.css` 의 `@theme` → `--font-sans` |
| 아이콘 추가 · 변경 | `components/Icon.js` |

> Tailwind v4 에는 **`tailwind.config.js` 가 없습니다.** 색상·글꼴은 전부
> `app/globals.css` 의 `@theme` 블록에서 정합니다. 인터넷에서 v3 기준 설명
> (`tailwind.config.js` 에 색을 추가하라는 글)을 보고 따라 하면 적용되지 않으니 주의하세요.

## 기능 채워 넣는 법

각 기능 페이지(예: `app/meal/page.js`)에서 `<ComingSoon ... />` 을 지우고
실제 화면 코드를 넣으면 됩니다. 헤더·탭바는 `app/layout.js` 가 자동으로 붙여줍니다.

## 디자인 규칙

- 색상: 남색·파랑 계열 (`navy-50` ~ `navy-950`)
- 앱 폭: 최대 480px (`max-w-app`) 고정, 데스크톱에서는 가운데 정렬
- 글꼴: Pretendard → 기기 기본 한글 UI 글꼴 순서 (외부 폰트를 내려받지 않음)
