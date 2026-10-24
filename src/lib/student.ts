// 운중고 학번: 학년(1) + 반(2) + 번호(2). 예) 20818 = 2학년 8반 18번
export const CLASSES_PER_GRADE = 8;

export type StudentNo = { grade: 1 | 2 | 3; classNo: number; number: number };

export function parseStudentNo(raw: string): StudentNo | null {
  const s = raw.trim();
  if (!/^[1-3]\d{4}$/.test(s)) return null;
  const grade = Number(s[0]) as 1 | 2 | 3;
  const classNo = Number(s.slice(1, 3));
  const number = Number(s.slice(3, 5));
  if (classNo < 1 || classNo > CLASSES_PER_GRADE || number < 1 || number > 40) return null;
  return { grade, classNo, number };
}
