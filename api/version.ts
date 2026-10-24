// GET /api/version → 지금 배포된 앱의 빌드 번호(git 커밋). 앱이 자기 빌드 번호와 비교해 '새 버전' 배너를 띄운다.
export function GET() {
  return Response.json({ id: process.env.VERCEL_GIT_COMMIT_SHA ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}
