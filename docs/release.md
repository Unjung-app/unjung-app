# 테스트 서버와 업데이트 절차 (11-09 호원 결정)

학생들이 쓰는 메인 앱은 업데이트 때만 한 번에 바뀐다. 그 사이 개발은 테스트 서버에서 한다.

| | 메인(실서비스) | 테스트 서버 |
|---|---|---|
| 브랜치 | `main` | `dev` |
| 주소 | https://unjung-app.vercel.app | https://unjung-app-git-dev-unjung-app.vercel.app |
| DB | Supabase `uikvrgjqcktzcshvaxdj` | Supabase 테스트 프로젝트(따로) |
| Vercel 환경변수 | Production | Preview |

테스트 서버는 DB가 따로라서, 토큰·랭킹·글을 마음껏 시험해도 실제 학생 데이터에 영향이 없다.

## 평소 개발
1. `lead/<작업>` 브랜치에서 작업 → `npm run check`
2. `dev`로 PR → 검사 통과 → 합치기 → 테스트 서버에 자동 배포
3. DB 변경이 있으면 새 마이그레이션 파일을 **테스트 DB**의 SQL 편집기에서 실행
4. 테스트 서버에서 확인(관리자·개발자 계정으로 직접 써 보기)

## 업데이트(학기 중 수시, 게임 교체는 학기당 1~2회)
1. `app.json`의 `version`을 올린다(작은 수정 1.1.1, 기능 추가 1.2.0)
2. `src/features/updates/changelog.ts` 맨 위에 학생이 알아들을 말로 바뀐 점을 적는다 → 앱 홈에 '업데이트 소식' 카드로 뜬다
3. 지난 업데이트 뒤 새로 생긴 마이그레이션을 **메인 DB**에 실행(테스트 DB에서 이미 확인한 같은 파일)
4. `dev` → `main` PR 하나(제목: `업데이트 v1.2.0`) → 합치면 메인 앱에 반영
5. 학생 의견 결과 코드가 있으면 의견 관리 ② 결과 붙여넣기

## 급한 버그(hotfix)
`main`에 바로 PR → 합치기 → `main`을 `dev`에 합친다. changelog에 한 줄(1.1.1) 추가.

## 테스트 DB 처음 만들기(한 번만)
`supabase/migrations/*.sql`을 이름 순서대로 모두 실행하고, 마지막에 테스트 주소로 바꾼다:
`update public.app_config set value = 'https://unjung-app-git-dev-unjung-app.vercel.app' where key = 'app_url';`
