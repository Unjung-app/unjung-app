// 업데이트 소식(학생에게 보이는 '이번에 바뀐 것'). 메인 앱에 업데이트를 올릴 때마다
// app.json의 version을 올리고, 맨 위에 새 항목을 추가한다. 학생이 알아들을 말로, 한 줄씩.

export type ChangeEntry = { version: string; date: string; title: string; items: string[] };

export const CHANGELOG: ChangeEntry[] = [
  {
    version: '1.1.0',
    date: '2026-11-09',
    title: '업데이트 소식 · 학생회 업무 알림',
    items: [
      '📰 업데이트하면 무엇이 바뀌었는지 홈에서 알려 드려요 (전체 → 업데이트 소식에서 다시 보기)',
      '🔔 학생자치회·검토위원·게임 개발자에게 처리할 일 알림: 새 건의, 내 게임 의견, 검토할 공지 등 (알림 설정에서 끌 수 있어요)',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-11-08',
    title: '운중고 스마트 스쿨 출시!',
    items: [
      '📅 내 반·선택과목 시간표, 🍱 급식과 한줄평, 📆 학사일정 달력',
      '⏱️ 스터디 윗미 공부 타이머와 그룹 순위',
      '🎮 운중고 학생 개발자가 만든 게임과 주간 랭킹',
      '🏫 학생 공지 · 운중 보이스(설문·익명 건의) · 행사 사진 · 분실물',
      '🪙 출석·공부·참여로 토큰 모으고 꾸미기',
    ],
  },
];

/** '1.10.0' > '1.9.0' 처럼 버전 비교 */
export function newer(a: string, b: string) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
}
