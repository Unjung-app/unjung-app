type WritingSection = 'A' | 'B';

// 2026년 11월 9~13일 변동 시간표. 나이스 과목명과 위치가 일치한 칸만 등록한다.
// 키는 일자-교시. 4반 목3, 8반 화4·화7은 A/B 배정을 확인하지 못했다.
const sectionsByClass: Record<number, Record<string, WritingSection>> = {
  1: { '10-3': 'A', '13-4': 'A', '09-1': 'B', '10-7': 'B' },
  2: { '09-1': 'A', '12-2': 'A', '10-3': 'B', '13-4': 'B' },
  3: { '09-7': 'A', '12-3': 'A', '09-4': 'B', '10-4': 'B' },
  4: { '13-2': 'A', '09-7': 'B', '10-6': 'B' },
  5: { '09-4': 'A', '10-6': 'A', '09-6': 'B', '12-6': 'B' },
  6: { '09-3': 'A', '12-6': 'A', '11-3': 'B', '13-1': 'B' },
  7: { '11-3': 'A', '13-1': 'A', '12-2': 'B', '13-2': 'B' },
  8: { '11-1': 'A', '09-3': 'B' },
};

export function writingSection(date: string, period: number, subject: string, classNo: number) {
  if (date < '20261109' || date > '20261113' || subject.replace(/\s+/g, '') !== '독서와작문') return;
  return sectionsByClass[classNo]?.[`${date.slice(-2)}-${period}`];
}

export function lessonSubject(lesson: { subject: string; writingSection?: WritingSection }) {
  return lesson.writingSection ? `독작${lesson.writingSection}` : lesson.subject;
}
