import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { addDays, ymdToIso, type Ymd } from '@/lib/date';
import type { MealType } from '@/lib/school';

// 급식 한줄평 — 서버(meal_review_feed)가 작성자를 지운 목록을 준다. 화면에는 '익명의 n학년'만.

export type MealReview = {
  id: number;
  meal_date: string;
  meal_code: number;
  grade: number;
  body: string;
  like_count: number;
  hidden: boolean;
  created_at: string;
  updated_at: string;
  mine: boolean;
  liked: boolean;
  reported: boolean;
};

export const MEAL_CODE: Record<MealType, 1 | 2 | 3> = { 조식: 1, 중식: 2, 석식: 3 };

type Result = { ok: true; tokens?: number } | { ok: false; message: string };
const friendly = (m?: string) => (m && /[가-힣]/.test(m) ? m : '잠시 뒤 다시 시도해 주세요.');

/** 작성 가능 시간 (서버 규칙과 같다): 끼니 시작 ~ 다음 날 08:40 */
export function reviewWindow(mealYmd: Ymd, code: number, grade: number | null, nowYmd: Ymd, nowMinutes: number) {
  const start = code === 1 ? 7 * 60 : code === 3 ? 17 * 60 + 30 : grade === 3 ? 11 * 60 + 30 : 12 * 60 + 30;
  const startLabel = `${Math.floor(start / 60)}:${String(start % 60).padStart(2, '0')}`;
  if (mealYmd === nowYmd) return nowMinutes >= start ? { open: true as const } : { open: false as const, reason: `${startLabel}부터 쓸 수 있어요` };
  if (mealYmd === addDays(nowYmd, -1) && nowMinutes < 8 * 60 + 40) return { open: true as const };
  if (mealYmd > nowYmd) return { open: false as const, reason: '그날 먹고 나서 쓸 수 있어요' };
  return { open: false as const, reason: '작성 시간이 지났어요 (다음 날 아침 8:40까지)' };
}

export function useMealReviews(mealYmd: Ymd, code: number, enabled: boolean) {
  const [items, setItems] = useState<MealReview[] | null>(null);
  const date = ymdToIso(mealYmd);

  const load = useCallback(async () => {
    if (!enabled) return setItems(null);
    const { data, error } = await supabase
      .from('meal_review_feed')
      .select('*')
      .eq('meal_date', date)
      .eq('meal_code', code)
      .order('created_at', { ascending: false })
      .limit(200);
    setItems(error ? [] : ((data as MealReview[]) ?? []));
  }, [date, code, enabled]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  const post = useCallback(
    async (body: string): Promise<Result> => {
      const { data, error } = await supabase.rpc('post_meal_review', { p_date: date, p_code: code, p_body: body });
      if (error) return { ok: false, message: friendly(error.message) };
      await load();
      return { ok: true, tokens: (data as { tokens: number })?.tokens ?? 0 };
    },
    [date, code, load],
  );

  const remove = useCallback(
    async (id: number): Promise<Result> => {
      const { error } = await supabase.rpc('delete_meal_review', { p_id: id });
      if (error) return { ok: false, message: friendly(error.message) };
      await load();
      return { ok: true };
    },
    [load],
  );

  // 공감은 화면에 바로 반영하고(낙관적 업데이트), 서버 숫자로 맞춘다
  const like = useCallback(async (id: number, on: boolean) => {
    setItems((list) => list?.map((r) => (r.id === id ? { ...r, liked: on, like_count: r.like_count + (on ? 1 : -1) } : r)) ?? list);
    const { data, error } = await supabase.rpc('like_meal_review', { p_id: id, p_on: on });
    setItems((list) =>
      list?.map((r) => (r.id === id ? (error ? { ...r, liked: !on, like_count: r.like_count + (on ? -1 : 1) } : { ...r, like_count: data as number }) : r)) ?? list,
    );
  }, []);

  const report = useCallback(
    async (id: number, reason: string): Promise<Result> => {
      const { error } = await supabase.rpc('report_meal_review', { p_id: id, p_reason: reason });
      if (error) return { ok: false, message: friendly(error.message) };
      setItems((list) => list?.map((r) => (r.id === id ? { ...r, reported: true } : r)) ?? list);
      return { ok: true };
    },
    [],
  );

  return { items, reload: load, post, remove, like, report };
}

/** 홈 화면용: 그날 점심 공감 1위 한줄평 */
export function useTopReview(mealYmd: Ymd, code: number, enabled: boolean) {
  const [top, setTop] = useState<MealReview | null>(null);
  const date = ymdToIso(mealYmd);
  useEffect(() => {
    let alive = true;
    if (!enabled) {
      setTop(null);
      return;
    }
    supabase
      .from('meal_review_feed')
      .select('*')
      .eq('meal_date', date)
      .eq('meal_code', code)
      .eq('hidden', false)
      .order('like_count', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .then(({ data }) => alive && setTop(((data as MealReview[]) ?? [])[0] ?? null));
    return () => {
      alive = false;
    };
  }, [date, code, enabled]);
  return top;
}
