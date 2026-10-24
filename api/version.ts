// GET /api/version → 지금 배포된 앱의 빌드 번호(git 커밋). 앱이 자기 빌드 번호와 비교해 '새 버전' 배너를 띄운다.
// CDN에 1분 캐시(배포가 바뀌면 캐시도 새로): 학생 수천 명이 열어도 함수 실행은 거의 늘지 않는다.
export function GET() {
  return Response.json({ id: process.env.VERCEL_GIT_COMMIT_SHA ?? null }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' } });
}
