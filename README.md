# 운중고 스마트 스쿨 (v1.0.0)

운중고 학생 전용 학교 앱. **iOS · Android 앱 + 웹을 한 코드로** 만든다.
Expo SDK 58 (React Native 0.88) · Expo Router · TypeScript · Vercel(웹 + 서버 함수)

## 구조

```
src/
  app/                 화면 주소(라우트). 파일 하나 = 화면 하나
    (tabs)/            하단 탭 화면들 (오늘·시간표·급식·…·전체)
    feature/[id].tsx   하단 탭에 없는 기능을 '전체'에서 열 때 (뒤로가기 있음)
    settings/          설정 (내 반, 하단 탭)
    lab/[slug].tsx     실험실 기능 화면
  lab/                 실험실(베타) — 참여원 기능. 폴더(meta.json + index.tsx)만 추가하면
                       '전체 → 실험실'에 자동 등록. 운영 사이트에서는 관리자에게만 보임
  features/            기능별 화면과 로직
    registry.ts        기능 목록 ← 새 기능은 여기에 한 줄 추가
    screens.tsx        기능 id → 화면 연결
  components/ui/       공용 디자인 부품 (AppText, Card, Button, Icon, …)
  theme/tokens.ts      색·간격·글자 크기 (디자인 시안 A)
  lib/                 날짜(한국 시간), 서버 호출, NEIS 응답 해석
  state/prefs.tsx      개인 설정 (하단 탭 구성, 내 반) — 기기에 저장
api/                   Vercel 서버 함수 (NEIS 호출 + 캐싱, 인증키 보관)
```

## 하단 탭

`오늘`(고정) + 학생이 고른 기능 최대 3개 + `전체`(고정). 설정 → 하단 탭에서 바꾼다.
모든 기능은 숨은 탭으로 등록돼 있어서, 설정을 바꿔도 앱이 다시 시작되지 않는다.

## 데이터

| 주소 | 내용 | NEIS 서비스 |
|---|---|---|
| `/api/meal?from&to` | 급식(조·중·석식, 알레르기, 열량) | mealServiceDietInfo |
| `/api/timetable?grade&class&from&to` | 반 시간표 | hisTimetable |
| `/api/schedule?from&to` | 학사일정 | SchoolSchedule |

- 서버 응답은 CDN에 1시간 저장(이후 하루 동안 옛 응답을 주며 뒤에서 갱신).
- 앱은 받은 데이터를 기기에 저장해 두고, 오프라인이면 저장본을 보여 준다.
- 서버도 저장본도 없으면 **예시 데이터**를 쓰고 화면 위에 노란 안내를 띄운다.

### Vercel 환경변수

| 이름 | 필수 | 설명 |
|---|---|---|
| `NEIS_API_KEY` | 권장 | 없으면 NEIS가 한 번에 5건만 준다 |
| `NEIS_SCHOOL_CODE` | 선택 | 비우면 학교 이름으로 자동 조회 |
| `SUPABASE_SECRET_KEY` | 필수 | 학교 데이터 동기화·알림 발송(서버 전용, 앱에 넣지 않음) |
| `VAPID_PRIVATE_KEY` | 필수 | 웹 푸시 비밀 키(공개 키는 `src/lib/pushKey.ts`) |
| `CRON_SECRET` | 선택 | Vercel Cron 호출 확인용 |

## 서버(DB)

- Supabase: `supabase/migrations/*.sql`을 이름 순서대로 SQL 편집기에서 적용한다.
- DB 규칙 검사: `npm run test:db` (PGlite로 권한·토큰·악용 방지 규칙을 확인, CI에서도 실행)
- 토큰 보상 표: DB `20261113000000_m5_balance_admin.sql` ↔ 앱 `src/lib/rewards.ts` (함께 바꾼다)
- 알림 발송 주소: DB `app_config.app_url` (지금 `https://unjung-app.vercel.app`)

## 명령

```bash
npm start            # 개발 서버 (휴대폰 Expo Go로 QR 스캔)
npm run web          # 브라우저에서 실행
npm run check        # 타입 검사 + 웹 빌드 (PR 전에)
npm run test:db      # DB 규칙 검사
```

## 참여원(학생 개발팀)

안내서: `/guide.html` (앱 주소 뒤에 붙여 열기). Codespaces + Copilot으로 4단계.

```bash
npm run work         # 할 일 고르기 (0 = 실험실 새 기능, 실험실 이어 하기, 정식 기능 고치기)
npm run save         # 저장·제출 (브랜치 feat/<기능>-<이름> → PR)
npm run doctor       # 막혔을 때 점검
npm run ai           # Copilot 대신 웹 AI 채팅용 맥락 파일 만들기
npm run app          # 앱 실행 (웹, 8081) — Codespaces에서는 자동 실행
```

- Copilot 규칙: `.github/copilot-instructions.md` · 요청 양식: `.github/prompts/` (`/feature`, `/improve`)
- 참여원 스크립트: `scripts/participant/` · 환경: `.devcontainer/`, `.vscode/tasks.json`
- 실험실 기능을 정식 기능으로 올릴 때는 리드가 `features/registry.ts` 절차로 옮긴다.

## 브랜치 규칙

- `lead/*` : 리드 에이전트 작업. PR → 대표 승인 → 병합
- `feat/*` : 참여원 작업 (`npm run save`가 만듦). Vercel 미리보기 배포는 끔
- `main`  : 배포 버전 (unjung-app.vercel.app)

## 2학년 개인 시간표

- `20261114000000_personal_timetable.sql`을 Supabase에 적용한 뒤 앱을 배포한다.
- `timetable_configs`에 2026학년도 2학기 A~D·교양·예술 과목과 1~8반 배치가 들어 있다.
  새로운 학기는 별도 행으로 등록한다. 다른 학기까지 이 배치를 자동 연장하지 않는다.
- 학적이 등록된 2학년은 시간표를 처음 열면 6개 과목을 선택한다.
  `timetable_choices`에 계정·학년도·학기별로 저장하며 ‘과목 재설정’으로 변경한다.
- 기존 NEIS 조회·캐시·로그인은 유지한다. 시간표 탭의 주간/하루 화면에서만
  기존 수업 칸의 과목명을 반영하고 교실은 숨긴다. 빈 날의 수업을 새로 만들지 않으며,
  보강 등 태그가 붙은 수업과 자율·진로·동아리 등 특별활동은 유지한다.
- DB 적용 전이나 연결 실패 시 안내와 기존 반 시간표를 표시한다.
- 검증: `npm run check`, `npm run test:db`, `npm run test:timetable`.
