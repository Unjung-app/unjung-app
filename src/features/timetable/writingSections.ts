import type { Lesson } from '@/lib/school';

type WritingSection = 'A' | 'B';

// 2026년 11월 9~13일 변동 시간표. 키는 일자-교시.
const sectionsByClass: Record<number, Record<string, WritingSection>> = {
  1: { '10-3': 'A', '13-4': 'A', '09-1': 'B', '10-7': 'B' },
  2: { '09-1': 'A', '12-2': 'A', '10-3': 'B', '13-4': 'B' },
  3: { '09-7': 'A', '12-3': 'A', '09-4': 'B', '10-4': 'B' },
  4: { '10-4': 'A', '13-2': 'A', '09-7': 'B', '10-6': 'B' },
  5: { '09-4': 'A', '10-6': 'A', '09-6': 'B', '12-6': 'B' },
  6: { '09-3': 'A', '12-6': 'A', '11-3': 'B', '13-1': 'B' },
  7: { '11-3': 'A', '13-1': 'A', '12-2': 'B', '13-2': 'B' },
  8: { '10-7': 'A', '11-1': 'A', '09-3': 'B', '12-3': 'B' },
};

// 나이스가 변경 전 시간표를 반환할 때만 두 수업을 교환한다.
export function applyWritingChanges(lessons: Lesson[], classNo: number): Lesson[] {
  if (classNo !== 4 && classNo !== 8) return lessons;

  const tuesday = lessons.find((lesson) => lesson.date === '20261110' && lesson.period === 4);
  const thursday = lessons.find((lesson) => lesson.date === '20261112' && lesson.period === 3);
  if (!tuesday || !thursday) return lessons;

  const original = classNo === 4 ? thursday : tuesday;
  const destination = classNo === 4 ? tuesday : thursday;
  const expected = classNo === 4 ? '영어Ⅱ' : '진로활동';
  if (original.subject.replace(/\s+/g, '') !== '독서와작문' || destination.subject.replace(/\s+/g, '') !== expected) {
    return lessons;
  }

  return lessons.map((lesson) => {
    if (lesson === original) return { ...destination, date: original.date, period: original.period };
    if (lesson === destination) return { ...original, date: destination.date, period: destination.period };
    return lesson;
  });
}

export function writingSection(date: string, period: number, subject: string, classNo: number) {
  if (date < '20261109' || date > '20261113' || subject.replace(/\s+/g, '') !== '독서와작문') return;
  return sectionsByClass[classNo]?.[`${date.slice(-2)}-${period}`];
}

export function lessonSubject(lesson: { subject: string; writingSection?: WritingSection }) {
  return lesson.writingSection ? `독작${lesson.writingSection}` : lesson.subject;
}
