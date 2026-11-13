import type { ClassLesson } from '@/features/data';
import { dayOfWeek, schoolTerm } from '@/lib/date';

export type SubjectGroup = { id: string; label: string; subjects: string[]; slots: Record<string, [number, number][]> };
export type Choices = Record<string, string>;
export function completeChoices(groups: SubjectGroup[], choices: Choices) {
  return groups.length === 6 && groups.every((g) => g.subjects.includes(choices[g.id]));
}

/** 조회·캐시는 그대로 두고 실제 수업이 있는 칸의 과목명만 개인화한다. 보강 등 특수 수업은 보존한다. */
export function personalize(lessons: ClassLesson[], groups: SubjectGroup[], choices: Choices, classNo: number, year: number, semester: number) {
  return lessons.map((lesson) => {
    const term = schoolTerm(lesson.date);
    if (term.year !== year || term.semester !== semester || lesson.writingSection || lesson.tags.length || /자율|자치|진로|동아리|창의적체험|행사|휴업|휴일/.test(lesson.subject)) return lesson;
    const group = groups.find((g) => g.slots[String(classNo)]?.some(([day, period]) => day === dayOfWeek(lesson.date) && period === lesson.period));
    if (!group || !choices[group.id]) return lesson;
    return { ...lesson, subject: choices[group.id], room: null };
  });
}
