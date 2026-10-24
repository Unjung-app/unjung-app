# 운중고 앱 v3 — AI 작업 규칙

이 저장소에서 일하는 모든 AI(Claude Code, Codex, 웹 채팅 AI)가 따른다.

## 목표

운중고 학생들이 **매일 여는 앱**. 판단이 갈리면 "학생이 더 자주, 더 빨리 쓰게 되는가"로 정한다.

## 스택 (바꾸려면 대표와 먼저 합의)

- Expo SDK 58 · React Native 0.88 · Expo Router · **TypeScript**
- 서버: Vercel 함수(`api/`). 이후 로그인·DB는 Supabase.
- Expo는 SDK마다 API가 바뀐다. Expo·RN API를 쓰기 전에 `node_modules`의 타입 정의나
  https://docs.expo.dev/versions/v58.0.0/ 를 확인한다. 기억에 의존하지 않는다.
- 패키지 추가는 `node_modules/expo/bundledNativeModules.json`의 버전을 따른다.
  Expo Go에 없는 네이티브 모듈은 개발 빌드가 필요하므로 꼭 필요할 때만 쓴다.

## 코드 규칙

- 글자는 `AppText`, 색·간격은 `theme/tokens.ts`만 쓴다. 화면에 색 코드를 직접 쓰지 않는다.
- 새 기능: `features/registry.ts`에 등록 → `features/<id>/` 화면 → `features/screens.tsx` 연결
  → `src/app/(tabs)/<id>.tsx` 라우트 + `(tabs)/_layout.tsx`는 registry를 자동으로 읽는다.
- 날짜·시각은 `lib/date.ts`(한국 시간 기준)만 쓴다. `new Date()`로 날짜를 직접 계산하지 않는다.
- 서버 데이터는 `useRemote`로 받는다. 실패해도 화면이 비지 않게 예시 데이터를 주고,
  예시일 때는 `SampleNotice`를 보여 준다.
- 누를 수 있는 것은 최소 44×44, `accessibilityRole`·`accessibilityLabel`을 단다.
- 비밀 키는 코드·앱에 넣지 않는다. 서버 함수의 환경변수로만.
- 학생 개인정보는 최소한만 다룬다. 실명·학번을 예시 데이터에 쓰지 않는다.

## 작업 흐름

- `lead/*` 브랜치에서 작업 → `npm run check` 통과 → PR. `main`에 직접 올리지 않는다.
- PR 설명: 무엇을 바꿨나(3줄) · 미리보기에서 확인할 것 · 결정이 필요한 것.
