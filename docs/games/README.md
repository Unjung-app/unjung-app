# 새 게임 체계 (HTML 게임) — 작업 메모

호원 결정(11-05): 기존 학습형 게임(영단어·암산·운중 라이프 퀴즈)은 **재미 중심의 새 게임으로 전부 교체**한다.
앱 개발 참여자 대부분이 게임을 만든다. 각자 생성형 AI로 **HTML 파일 하나**를 만들어 호원에게 내고, 호원이 리드 에이전트에게 넘기면 검토 후 앱에 넣는다.
수업 시간에는 계속 막는다(쉬는 시간·점심은 허용).

- 참여자 가이드(Docs): https://claude.ai/artifact/1sPNn8pNtnk1esyc4eDXhb
- 템플릿: `public/games/_template/index.html` → https://unjung-app.vercel.app/games/_template/index.html
- 제출: 11/8(일) 22:00까지 호원에게 카톡/이메일. 늦게 낸 것은 다음 업데이트 때 넣는다.
- 보상(11-06 변경, `20261119_game_score_rewards.sql`): 학생 게임은 무료·하루 10판, 판마다 그 게임 이번 주 기록 대비 상위 비율로 1~5토큰(기록 5판 미만이면 2), 게임 점수 보상 하루 최대 30, 주간 최고 +2·주간 1~3위 보상은 유지.

## 게임 파일 규칙 (참여자에게 안내한 것)

1. 파일 하나. 외부 라이브러리·이미지·글꼴 금지(이모지·캔버스·인라인 데이터만)
2. 세로 폰(360~430px)에서 터치로 플레이. 한 판 1~5분
3. 끝나면 `UnjungGame.submitScore(정수)`. 높을수록 좋은 점수
4. 템플릿의 "앱 연결 코드" 블록은 고치지 않는다
5. `UnjungGame.onPause`가 오면 멈춘다
6. 실명, 욕설, 선정·혐오 내용, 도박 구조 금지. 선생님을 적으로 쓰지 않는다

## 앱 연결 코드(브리지) 약속

- 게임은 `<iframe src="/games/<id>/index.html?unjung=1">` 안에서 열린다.
- 게임 → 앱: `postMessage({ unjung: 1, id, type, data })`
  - `ready`: 로드 완료
  - `score {score}`: 점수 제출
  - `save <string>`: 이어하기 저장(10KB까지)
  - `load`: 저장 불러오기
  - `exit`: 앱으로 돌아가기
- 앱 → 게임: `{ unjung: 1, reply: id, data }`로 요청에 답한다.
  - 앱이 먼저 보내는 것: `{ unjung: 1, type: 'player', data: { nickname, grade } }`, `{ unjung: 1, type: 'pause' }`
- 앱 밖(브라우저·AI 미리보기)에서는 같은 함수가 localStorage로 흉내 낸다(연습 모드).

## 앱 쪽 구현 (11-06 완료)

- 게임 목록: `src/features/games/catalog.ts` (id → 제목·이모지·소개·장르·만든 사람·조작법)
- 게임 화면: `src/features/games/HtmlPlayScreen.tsx` — `/game/<id>`
  - 시작을 누르면 서버 `start_game`(수업 시간·하루 10판·토큰) → iframe(sandbox=allow-scripts, 앱 저장소 접근 불가)
  - 게임이 점수를 보내면 `finish_html_game` → 앱 결과 화면(한 판 더 / 나가기)이 게임을 덮는다
  - 수업이 시작되면 pause를 보내고 막는다(game_status 60초 폴링)
- DB: `20261116000000_html_games.sql` — 게임 id 형식만 검사(새 게임마다 SQL 불필요), 3초 미만·1시간 초과 판은 0점, 점수 상한 1천만, 이어하기 저장 `save_game`/`load_game`

## 새 게임 넣는 순서

1. 받은 파일 검토: 외부 요청(script src·fetch·CDN), 앱 연결 코드가 템플릿과 같은지, `submitScore`·`onPause`, 부적절한 내용
2. `public/games/<id>/index.html`로 복사(연결 코드가 다르면 템플릿 블록으로 바꿔 넣기)
3. `catalog.ts`에 등록 → Playwright로 390×844에서 시작~게임 오버, 콘솔 오류 확인 → PR → 합치기

## 처음 세운 계획 (1~4는 11-06에 완료)

1. **앱 쪽 게임 호스트 화면**
   - `src/app/game/[id].tsx`를 HTML 게임용으로 바꾼다.
   - iframe을 띄우고, 위 브리지를 처리하고, 수업 시간에는 막는다.
   - 화면이 가려지면 pause를 보내고, 수업이 시작되면 pause를 보낸 뒤 막는 화면을 띄운다.
   - 기존 `game_status`의 수업 판정을 재사용한다.
2. **게임 목록 등록부** `src/features/games/catalog.ts`
   - 항목: id, 이름, 한 줄 소개, 장르, 만든 사람, 이모지, 점수 단위, 점수 상한(조작 방지)
   - 화면은 GamesScreen을 새로 만든다.
3. **DB 마이그레이션**
   - `game_runs.game` check 제약을 풀거나 새 표 `html_game_scores`(user, game, score, played_at)와 `html_game_saves`(user, game, data ≤10KB)를 만든다.
   - RPC `submit_html_game(game, score, duration_s)`: 상한·최소 플레이 시간을 검사하고, 수업 시간에는 거부한다.
   - 주간 랭킹 RPC. 보상은 기존 게임 체계 그대로(판 수 제한·주간 랭킹 보상)를 HTML 게임에 맞춰 옮긴다.
4. **기존 학습형 게임 3종 제거**: 화면, 오늘의 미션 '무료 게임' 연결, 지갑 설명 문구.
5. **제출된 게임 검토 순서**
   - 규칙 위반, 외부 요청(fetch/script src), `eval`, 무한 루프를 확인한다.
   - Playwright로 390×844 화면에서 시작부터 게임 오버까지 돌려 보고 콘솔 오류를 본다.
   - `public/games/<id>/index.html`에 넣고 등록부에 추가한다.
