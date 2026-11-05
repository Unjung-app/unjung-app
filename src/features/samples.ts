// 서버에 연결되지 않았을 때 쓰는 예시 데이터. 날짜는 '이번 주'에 맞춰 만든다.
// 급식 예시 메뉴(실데이터를 못 받을 때 보여 주는 예시)
import { addDays, isWeekend, mondayOf } from '@/lib/date';
import type { Lesson, Meal, SchoolEvent } from '@/lib/school';

const MENUS = [
  ['현미밥', '북어국', '닭강정', '마카로니샐러드', '깍두기'],
  ['흑미밥', '김치콩나물국', '돼지고기장조림', '어묵볶음', '배추김치'],
  ['오므라이스', '미소된장국', '소떡소떡', '양상추샐러드', '피클'],
  ['보리밥', '부대찌개', '고등어구이', '도토리묵무침', '배추김치'],
  ['짜장밥', '짬뽕국', '탕수육', '단무지', '배추김치'],
];

export function sampleMeals(monday: string): Meal[] {
  return MENUS.map((names, i) => ({
    date: addDays(monday, i),
    type: '중식' as const,
    dishes: names.map((name) => ({ name, allergens: [] })),
    kcal: 780 + i * 17,
  }));
}

const WEEK = [
  ['국어', '물리학Ⅰ', '수학Ⅱ', '영어Ⅱ', '화학Ⅰ', '체육', '진로'],
  ['수학Ⅱ', '영어Ⅱ', '문학', '생명과학Ⅰ', '음악', '물리학Ⅰ', '자율'],
  ['영어Ⅱ', '수학Ⅱ', '화학Ⅰ', '문학', '체육', '동아리', '동아리'],
  ['문학', '생명과학Ⅰ', '영어Ⅱ', '수학Ⅱ', '물리학Ⅰ', '정보'],
  ['화학Ⅰ', '문학', '수학Ⅱ', '영어Ⅱ', '미술', '자율'],
];

export function sampleTimetable(monday: string): Lesson[] {
  return WEEK.flatMap((day, i) =>
    day.map((subject, p) => ({ date: addDays(monday, i), period: p + 1, subject, room: null })),
  );
}

export function sampleSchedule(today: string): SchoolEvent[] {
  const monday = mondayOf(today);
  const next = (n: number) => {
    let d = addDays(monday, n);
    while (isWeekend(d)) d = addDays(d, 1);
    return d;
  };
  return [
    { date: next(9), name: '진로 체험의 날', holiday: false },
    { date: next(16), name: '학생자치회 정기회의', holiday: false },
    { date: next(30), name: '2학기 2차 지필평가', holiday: false },
    { date: next(44), name: '겨울방학식', holiday: false },
  ];
}
