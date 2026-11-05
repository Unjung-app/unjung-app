// 화면에서 쓰는 학교 데이터 훅 모음
import { useMemo } from 'react';
import { addDays, mondayOf } from '@/lib/date';
import { useRemote } from '@/lib/api';
import type { Lesson, Meal, SchoolEvent } from '@/lib/school';
import type { MyClass } from '@/state/prefs';
import { sampleMeals, sampleSchedule, sampleTimetable } from './samples';
import { roomLabel, splitTags } from './timetable/subjects';

/** 화면용 수업: '[보강]' 같은 표시는 tags로 떼고, 자기 교실 번호는 숨긴다 */
export type ClassLesson = Lesson & { tags: string[] };

export function useWeekMeals(anyDayInWeek: string) {
  const monday = mondayOf(anyDayInWeek);
  return useRemote<Meal>(`/api/meal?from=${monday}&to=${addDays(monday, 6)}`, () => sampleMeals(monday));
}

export function useWeekTimetable(anyDayInWeek: string, myClass: MyClass | null) {
  const monday = mondayOf(anyDayInWeek);
  const path = myClass
    ? `/api/timetable?grade=${myClass.grade}&class=${myClass.classNo}&from=${monday}&to=${addDays(monday, 4)}`
    : null;
  const remote = useRemote<Lesson>(path, () => sampleTimetable(monday));
  const items = useMemo<ClassLesson[]>(
    () =>
      remote.items.map((l) => {
        const { name, tags } = splitTags(l.subject);
        return { ...l, subject: name, tags, room: roomLabel(l.room, myClass?.classNo) };
      }),
    [remote.items, myClass?.classNo],
  );
  return { ...remote, items };
}

/** 오늘부터 약 3개월 일정 */
export function useUpcomingSchedule(today: string) {
  return useRemote<SchoolEvent>(`/api/schedule?from=${today}&to=${addDays(today, 120)}`, () => sampleSchedule(today));
}
