import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { addDays, isoToYmd, ymdToIso, type Ymd } from '@/lib/date';

// 반별 수행평가·숙제 게시판 — 서버 피드(class_task_feed)는 우리 반 글만 준다.

export type TaskKind = 'assessment' | 'homework' | 'supplies' | 'exam';
export const KIND_LABEL: Record<TaskKind, string> = {
  assessment: '수행평가',
  homework: '숙제',
  supplies: '준비물',
  exam: '시험범위',
};
export const KINDS: TaskKind[] = ['assessment', 'homework', 'supplies', 'exam'];

export type ClassTask = {
  id: number;
  subject: string;
  kind: TaskKind;
  /** 'YYYYMMDD' (앱 날짜 형식으로 바꿔서 보관) */
  due: Ymd;
  body: string;
  confirm_count: number;
  confirmed: boolean;
  created_at: string;
  updated_at: string;
  mine: boolean;
  i_confirmed: boolean;
  author_nickname: string | null;
  open_suggestions: number;
};

export type Suggestion = { id: number; task_id: number; body: string; resolved: boolean; created_at: string; mine: boolean };

export type TaskDraft = { subject: string; kind: TaskKind; due: Ymd; body: string };

type Result = { ok: true } | { ok: false; message: string };
const friendly = (m?: string) => (m && /[가-힣]/.test(m) ? m : '잠시 뒤 다시 시도해 주세요.');

/** 우리 반 글: 30일 전 마감부터 앞으로 전부 */
export function useClassTasks(today: Ymd, enabled: boolean) {
  const [items, setItems] = useState<ClassTask[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return setItems(null);
    setRefreshing(true);
    const { data, error } = await supabase
      .from('class_task_feed')
      .select('*')
      .gte('due', ymdToIso(addDays(today, -30)))
      .order('due', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(300);
    setRefreshing(false);
    if (error) return setItems((prev) => prev ?? []);
    setItems(((data as (Omit<ClassTask, 'due'> & { due: string })[]) ?? []).map((t) => ({ ...t, due: isoToYmd(t.due) })));
  }, [today, enabled]);

  useEffect(() => {
    load();
    // 앱으로 돌아올 때마다 새로 받는다 (친구가 올린 글 반영)
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => sub.remove();
  }, [load]);

  const rpc = useCallback(
    async (fn: string, args: Record<string, unknown>): Promise<Result> => {
      const { error } = await supabase.rpc(fn, args);
      if (error) return { ok: false, message: friendly(error.message) };
      await load();
      return { ok: true };
    },
    [load],
  );

  return {
    items,
    refreshing,
    reload: load,
    create: (d: TaskDraft) => rpc('create_class_task', { p_subject: d.subject, p_kind: d.kind, p_due: ymdToIso(d.due), p_body: d.body }),
    update: (id: number, d: TaskDraft) =>
      rpc('update_class_task', { p_id: id, p_subject: d.subject, p_kind: d.kind, p_due: ymdToIso(d.due), p_body: d.body }),
    remove: (id: number) => rpc('delete_class_task', { p_id: id }),
    confirm: (id: number) => rpc('confirm_class_task', { p_id: id }),
    suggest: (id: number, body: string) => rpc('suggest_task_fix', { p_id: id, p_body: body }),
    resolve: (sid: number) => rpc('resolve_task_suggestion', { p_sid: sid }),
  };
}

export async function loadSuggestions(taskId: number): Promise<Suggestion[]> {
  const { data } = await supabase
    .from('task_suggestion_feed')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  return (data as Suggestion[]) ?? [];
}
