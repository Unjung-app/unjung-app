import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { diffDays, seoulNow, type Ymd } from '@/lib/date';
import { supabase } from '@/lib/supabase';

// 운중 보이스: 학생회(기획행정부) 설문 + 학생 건의(익명, 기획행정부 '확인' 표시)

type Result = { ok: true } | { ok: false; message: string };
const friendly = (m?: string) => (m && /[가-힣]/.test(m) ? m : '잠시 뒤 다시 시도해 주세요.');
const res = (error: { message: string } | null): Result => (error ? { ok: false, message: friendly(error.message) } : { ok: true });

// ───────── 설문 ─────────

export type SurveyResults = 'after_vote' | 'after_close' | 'planner_only';
export const RESULTS_LABEL: Record<SurveyResults, string> = {
  after_vote: '참여하면 바로',
  after_close: '마감 후',
  planner_only: '기획행정부만',
};

export type SurveyItem = {
  id: number;
  title: string;
  description: string;
  scope_grade: number | null;
  results: SurveyResults;
  closes_at: string;
  is_open: boolean;
  responded: boolean;
  response_count: number;
  question_count: number;
  can_see_results: boolean;
};

export type QuestionKind = 'single' | 'multi' | 'text';
export type SurveyQuestion = {
  id: number;
  ord: number;
  kind: QuestionKind;
  prompt: string;
  options: string[];
  required: boolean;
  counts: number[] | null;
  answered: number | null;
  texts: string[] | null;
};
export type SurveyDetail = Omit<SurveyItem, 'question_count'> & {
  questions: SurveyQuestion[];
  by_grade: Record<string, number> | null;
};

export function useSurveyFeed(enabled: boolean) {
  const [items, setItems] = useState<SurveyItem[] | null>(null);
  const load = useCallback(async () => {
    if (!enabled) return setItems(null);
    const { data } = await supabase.from('survey_feed').select('*').order('closes_at', { ascending: false }).limit(50);
    const list = (data as SurveyItem[]) ?? [];
    // 열린 설문(마감 가까운 순) → 끝난 설문(최근 순)
    const open = list.filter((s) => s.is_open).sort((a, b) => a.closes_at.localeCompare(b.closes_at));
    setItems([...open, ...list.filter((s) => !s.is_open)]);
  }, [enabled]);
  useEffect(() => {
    load();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => sub.remove();
  }, [load]);
  return { items, reload: load };
}

export function useSurvey(id: number, enabled: boolean) {
  const [data, setData] = useState<SurveyDetail | null | 'missing'>(null);
  /** 내가 고른 보기(질문 id → 보기 번호들). 결과에서 '✓ 내 선택'으로 보여 준다. */
  const [mine, setMine] = useState<Record<number, number[]>>({});
  const load = useCallback(async () => {
    if (!enabled || !id) return;
    const { data: d, error } = await supabase.rpc('get_survey', { p_id: id });
    if (error || !d) return setData('missing');
    const detail = d as SurveyDetail;
    setData(detail);
    if (detail.responded) {
      const { data: a } = await supabase
        .from('survey_answers')
        .select('question_id,choices')
        .in('question_id', detail.questions.map((q) => q.id));
      setMine(Object.fromEntries(((a as { question_id: number; choices: number[] }[]) ?? []).map((x) => [x.question_id, x.choices])));
    }
  }, [id, enabled]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, mine, reload: load };
}

export type Answer = { q: number; choices?: number[]; text?: string };

export async function submitSurvey(id: number, answers: Answer[]): Promise<Result> {
  const { error } = await supabase.rpc('submit_survey', { p_id: id, p_answers: answers });
  return res(error);
}

export type QuestionDraft = { key: string; kind: QuestionKind; prompt: string; options: string[]; required: boolean };
export type SurveyDraft = {
  title: string;
  description: string;
  scopeGrade: 1 | 2 | 3 | null;
  days: number;
  results: SurveyResults;
  questions: QuestionDraft[];
};

export async function createSurvey(d: SurveyDraft): Promise<{ ok: true; id: number } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('create_survey', {
    p_title: d.title.trim(),
    p_description: d.description.trim(),
    p_scope_grade: d.scopeGrade,
    p_days: d.days,
    p_results: d.results,
    p_questions: d.questions.map((q) => ({
      kind: q.kind,
      prompt: q.prompt.trim(),
      options: q.kind === 'text' ? [] : q.options.map((o) => o.trim()).filter(Boolean),
      required: q.required,
    })),
  });
  return error ? { ok: false, message: friendly(error.message) } : { ok: true, id: Number(data) };
}

export async function closeSurvey(id: number, del: boolean): Promise<Result> {
  const { error } = await supabase.rpc('close_survey', { p_id: id, p_delete: del });
  return res(error);
}

// ───────── 건의 ─────────

export type SuggestionCategory = 'facility' | 'meal' | 'event' | 'study' | 'etc';
export const CATEGORIES: SuggestionCategory[] = ['facility', 'meal', 'event', 'study', 'etc'];
export const CATEGORY_LABEL: Record<SuggestionCategory, string> = { facility: '시설', meal: '급식', event: '행사', study: '학습', etc: '기타' };
export const CATEGORY_EMOJI: Record<SuggestionCategory, string> = { facility: '🏫', meal: '🍱', event: '🎪', study: '📚', etc: '💬' };

export type Suggestion = {
  id: number;
  category: SuggestionCategory;
  title: string;
  body: string;
  author_grade: number | null;
  like_count: number;
  created_at: string;
  checked: boolean;
  checked_at: string | null;
  mine: boolean;
  liked: boolean;
  reported: boolean;
};

export type ModSuggestion = {
  id: number;
  category: SuggestionCategory;
  title: string;
  body: string;
  author_grade: number | null;
  status: 'open' | 'hidden';
  report_count: number;
  created_at: string;
  reasons: string | null;
};

export function useSuggestionFeed(enabled: boolean) {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const load = useCallback(async () => {
    if (!enabled) return setItems(null);
    const { data } = await supabase.from('suggestion_feed').select('*').order('created_at', { ascending: false }).limit(200);
    setItems((data as Suggestion[]) ?? []);
  }, [enabled]);
  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(
    async (fn: string, args: Record<string, unknown>) => {
      const { error } = await supabase.rpc(fn, args);
      await load();
      return res(error);
    },
    [load],
  );

  return {
    items,
    reload: load,
    like: (id: number, on: boolean) => {
      // 누르자마자 숫자가 바뀌게(서버 결과로 다시 맞춘다)
      setItems((xs) => xs && xs.map((x) => (x.id === id ? { ...x, liked: on, like_count: Math.max(0, x.like_count + (on ? 1 : -1)) } : x)));
      return act('like_suggestion', { p_id: id, p_on: on });
    },
    report: (id: number, reason: string) => act('report_suggestion', { p_id: id, p_reason: reason }),
    withdraw: (id: number) => act('withdraw_suggestion', { p_id: id }),
    check: (id: number, on: boolean) => act('check_suggestion', { p_id: id, p_on: on }),
  };
}

export function useSuggestionModQueue(enabled: boolean) {
  const [items, setItems] = useState<ModSuggestion[] | null>(null);
  const load = useCallback(async () => {
    if (!enabled) return setItems(null);
    const { data } = await supabase.from('suggestion_mod_queue').select('*').order('created_at', { ascending: false });
    setItems((data as ModSuggestion[]) ?? []);
  }, [enabled]);
  useEffect(() => {
    load();
  }, [load]);
  const mod = useCallback(
    async (id: number, show: boolean) => {
      const { error } = await supabase.rpc('mod_suggestion', { p_id: id, p_show: show });
      await load();
      return res(error);
    },
    [load],
  );
  return { items, reload: load, mod };
}

export async function postSuggestion(category: SuggestionCategory, title: string, body: string): Promise<Result> {
  const { error } = await supabase.rpc('post_suggestion', { p_category: category, p_title: title.trim(), p_body: body.trim() });
  return res(error);
}

/** 설문 마지막 날(한국 시간). 서버의 closes_at은 마지막 날 다음 자정이다. */
export function lastDayOf(closesAt: string): Ymd {
  return seoulNow(new Date(Date.parse(closesAt) - 60_000)).ymd;
}

/** '오늘 마감' / 'D-3' / '마감됨' */
export function closesLabel(closesAt: string, isOpen: boolean, today: Ymd) {
  if (!isOpen) return '마감됨';
  const n = diffDays(today, lastDayOf(closesAt));
  return n <= 0 ? '오늘 마감' : `D-${n}`;
}
