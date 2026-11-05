// 과목 이름 다루기: 주간 표용 줄임말, [보강] 같은 표시 분리.
// 줄임말은 2026-10 운중고 NEIS 시간표에 실제로 나온 과목명 기준.

const SHORT: Record<string, string> = {
  '독서와작문': '독작',
  '화학반응의세계': '화학반응',
  '로봇과공학세계': '로봇공학',
  '미술감상과비평': '미술감상',
  '음악감상과비평': '음악감상',
  '현대사회와윤리': '현사윤',
  '역학과에너지': '역학',
  '스포츠문화': '스포츠',
  '스포츠생활': '스포츠',
  '자율·자치활동': '자율',
  '자율활동': '자율',
  '진로활동': '진로',
  '동아리활동': '동아리',
  '일본어회화': '일본어',
  '사회문제탐구': '사회탐구',
  '인공지능수학': 'AI수학',
  '생활과과학': '생활과학',
  '영어독해와작문': '영독작',
  '화법과작문': '화작',
  '언어와매체': '언매',
  '사회·문화': '사문',
  '생활과윤리': '생윤',
  '윤리와사상': '윤사',
  '고전과윤리': '고전윤리',
  '문학개론': '문학개론',
  '확률과통계': '확통',
  '한국지리': '한지',
  '세계지리': '세지',
  '동아시아사': '동아사',
  '정치와법': '정법',
  '창의적체험활동': '창체',
};

/** '[보강]언어와 매체' → { name: '언어와 매체', tags: ['보강'] } */
export function splitTags(raw: string) {
  const tags: string[] = [];
  const name = raw.replace(/\[([^\]]+)\]\s*/g, (_, t: string) => {
    tags.push(t.trim());
    return '';
  });
  return { name: name.trim(), tags };
}

/** 주간 표의 좁은 칸에 맞춘 이름. 규칙이 없으면 공백만 뺀다. */
export function shortSubject(raw: string) {
  const { name } = splitTags(raw);
  const key = name.replace(/\s+/g, '');
  if (SHORT[key]) return SHORT[key];
  const m = key.match(/^(생명과학|물리학|지구과학|미적분|확률과통계)(.*)$/);
  if (m) return ({ 생명과학: '생명', 물리학: '물리', 지구과학: '지구', 미적분: '미적', 확률과통계: '확통' } as Record<string, string>)[m[1]] + m[2];
  return key;
}

/** 교실 이름이 반 번호와 같으면(=자기 교실) 굳이 보여 줄 필요가 없다 */
export function roomLabel(room: string | null, classNo: number | undefined) {
  if (!room) return null;
  if (classNo !== undefined && room.trim() === String(classNo)) return null;
  return room;
}
