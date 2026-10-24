# 운중고 앱 v3

운중고 학생 전용 학교 앱. **iOS · Android 앱 + 웹을 한 코드로** 만든다.
Expo SDK 58 (React Native 0.88) · Expo Router · TypeScript · Vercel(웹 + 서버 함수)

## 구조

```
src/
  app/                 화면 주소(라우트). 파일 하나 = 화면 하나
    (tabs)/            하단 탭 화면들 (오늘·시간표·급식·…·전체)
    feature/[id].tsx   하단 탭에 없는 기능을 '전체'에서 열 때 (뒤로가기 있음)
    settings/          설정 (내 반, 하단 탭)
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

## 명령

```bash
npm start            # 개발 서버 (휴대폰 Expo Go로 QR 스캔)
npm run web          # 브라우저에서 실행
npm run check        # 타입 검사 + 웹 빌드 (PR 전에)
```

## 브랜치 규칙

- `lead/*` : 리드 에이전트 작업. PR → 대표 승인 → 병합
- `main`  : 배포 버전 (unjung-app.vercel.app)
