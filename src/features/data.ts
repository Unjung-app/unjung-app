// 화면에서 쓰는 학교 데이터 훅 모음
import { addDays, mondayOf } from '@/lib/date';
import { useRemote } from '@/lib/api';
import type { Lesson, Meal, SchoolEvent } from '@/lib/school';
import type { MyClass } from '@/state/prefs';
import { sampleMeals, sampleSchedule, sampleTimetable } from './samples';

export function useWeekMeals(anyDayInWeek: string) {
  const monday = mondayOf(anyDayInWeek);
  return useRemote<Meal>(`/api/meal?from=${monday}&to=${addDays(monday, 6)}`, () => sampleMeals(monday));
}

export function useWeekTimetable(anyDayInWeek: string, myClass: MyClass | null) {
  const monday = mondayOf(anyDayInWeek);
  const path = myClass
    ? `/api/timetable?grade=${myClass.grade}&class=${myClass.classNo}&from=${monday}&to=${addDays(monday, 4)}`
    : null;
  return useRemote<Lesson>(path, () => sampleTimetable(monday));
}

/** 오늘부터 약 3개월 일정 */
export function useUpcomingSchedule(today: string) {
  return useRemote<SchoolEvent>(`/api/schedule?from=${today}&to=${addDays(today, 120)}`, () => sampleSchedule(today));
}
