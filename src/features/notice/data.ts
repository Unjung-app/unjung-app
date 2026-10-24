import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { isoToYmd, ymdToIso, type Ymd } from '@/lib/date';

// 학생 공지: 학생이 올리고 → 검토위원이 승인하면 → 범위(전체/학년/반)에 맞는 학생에게 게시

export type NoticeKind = 'event' | 'club' | 'council' | 'recruit' | 'etc';
export type NoticeScope = 'all' | 'grade' | 'class';
export const KIND_LABEL: Record<NoticeKind, string> = { event: '행사', club: '동아리', council: '학생회', recruit: '모집', etc: '기타' };
export const KIND_EMOJI: Record<NoticeKind, string> = { event: '🎉', club: '🧩', council: '🏛️', recruit: '📣', etc: '📌' };
export const KINDS: NoticeKind[] = ['event', 'club', 'council', 'recruit', 'etc'];

export type Notice = {
  id: number;
  kind: NoticeKind;
  title: string;
  body: string;
  event_date: Ymd | null;
  scope: NoticeScope;
  scope_grade: number | null;
  scope_class: number | null;
  show_from: Ymd;
  show_until: Ymd;
  created_at: string;
  author_nickname: string | null;
  author_grade: number | null;
  mine: boolean;
  reported: boolean;
};

export type MyNotice = {
  id: number;
  kind: NoticeKind;
  title: string;
  status: 'pending' | 'approved' | 'rejected' | 'hidden' | 'withdrawn';
  reject_reason: string | null;
  show_from: Ymd;
  show_until: Ymd;
  created_at: string;
};

export type NoticeDraft = {
  kind: NoticeKind;
  title: string;
  body: string;
  eventDate: Ymd | null;
  scope: NoticeScope;
  showFrom: Ymd;
  days: number;
};

type Result = { ok: true } | { ok: false; message: string };
const friendly = (m?: string) => (m && /[가-힣]/.test(m) ? m : '잠시 뒤 다시 시도해 주세요.');
const dates = <T extends { event_date?: string | null; show_from: string; show_until: string }>(x: T): T => ({
  ...x,
  event_date: x.event_date ? isoToYmd(x.event_date) : null,
  show_from: isoToYmd(x.show_from),
  show_until: isoToYmd(x.show_until),
});

export function scopeLabel(n: Pick<Notice, 'scope' | 'scope_grade' | 'scope_class'>) {
  if (n.scope === 'grade') return `${n.scope_grade}학년만`;
  if (n.scope === 'class') return `${n.scope_grade}학년 ${n.scope_class}반만`;
  return '전체';
}

export function useNoticeFeed(enabled: boolean) {
  const [items, setItems] = useState<Notice[] | null>(null);
  const load = useCallback(async () => {
    if (!enabled) return setItems(null);
    const { data } = await supabase.from('notice_feed').select('*').order('reviewed_at', { ascending: false }).limit(100);
    setItems(((data as Notice[]) ?? []).map(dates));
  }, [enabled]);
  useEffect(() => {
    load();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => sub.remove();
  }, [load]);
  return { items, reload: load };
}

export function useMyNotices(enabled: boolean) {
  const [items, setItems] = useState<MyNotice[] | null>(null);
  const load = useCallback(async () => {
    if (!enabled) return setItems(null);
    const { data } = await supabase
      .from('notices')
      .select('id,kind,title,status,reject_reason,show_from,show_until,created_at')
      .neq('status', 'withdrawn')
      .order('created_at', { ascending: false })
      .limit(20);
    setItems(((data as MyNotice[]) ?? []).map(dates));
  }, [enabled]);
  useEffect(() => {
    load();
  }, [load]);
  return { items, reload: load };
}

export async function submitNotice(d: NoticeDraft): Promise<Result> {
  const { error } = await supabase.rpc('submit_notice', {
    p_kind: d.kind,
    p_title: d.title.trim(),
    p_body: d.body.trim(),
    p_event_date: d.eventDate ? ymdToIso(d.eventDate) : null,
    p_scope: d.scope,
    p_show_from: ymdToIso(d.showFrom),
    p_show_days: d.days,
  });
  return error ? { ok: false, message: friendly(error.message) } : { ok: true };
}

export async function withdrawNotice(id: number): Promise<Result> {
  const { error } = await supabase.rpc('withdraw_notice', { p_id: id });
  return error ? { ok: false, message: friendly(error.message) } : { ok: true };
}

export async function reportNotice(id: number, reason: string): Promise<Result> {
  const { error } = await supabase.rpc('report_notice', { p_id: id, p_reason: reason });
  return error ? { ok: false, message: friendly(error.message) } : { ok: true };
}
