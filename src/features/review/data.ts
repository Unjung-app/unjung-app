import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isoToYmd, type Ymd } from '@/lib/date';
import type { NoticeKind, NoticeScope } from '@/features/notice/data';

// 검토위원 도구: 공지 승인·반려, 신고 처리(공지·한줄평), 분실물 사진 승인

export type QueueNotice = {
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
  status: 'pending' | 'approved' | 'hidden';
  report_count: number;
  created_at: string;
  author_nickname: string | null;
  author_grade: number | null;
  mine: boolean;
  reasons: string | null;
};
export type QueueReview = { id: number; meal_date: string; meal_code: number; grade: number; body: string; report_count: number; hidden: boolean; created_at: string; reasons: string | null };
export type QueuePhoto = { id: number; type: 'lost' | 'found'; item: string; place: string; photo_path: string; created_at: string };

type Result = { ok: true } | { ok: false; message: string };
const res = (error: { message: string } | null): Result => (error ? { ok: false, message: /[가-힣]/.test(error.message) ? error.message : '잠시 뒤 다시 시도해 주세요.' } : { ok: true });

/** 처리할 일 개수 (검토 대기 공지 + 신고된 글 + 사진) */
export function useReviewCount(enabled: boolean) {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    Promise.all([
      supabase.from('notice_review_queue').select('id', { count: 'exact', head: true }),
      supabase.from('meal_review_mod_queue').select('id', { count: 'exact', head: true }).eq('hidden', true),
      supabase.from('lost_photo_queue').select('id', { count: 'exact', head: true }),
    ]).then((rs) => alive && setN(rs.reduce((a, r) => a + (r.count ?? 0), 0)));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return n;
}

export function useReviewQueues(enabled: boolean) {
  const [notices, setNotices] = useState<QueueNotice[] | null>(null);
  const [reviews, setReviews] = useState<QueueReview[] | null>(null);
  const [photos, setPhotos] = useState<(QueuePhoto & { url: string | null })[] | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    const [n, r, p] = await Promise.all([
      supabase.from('notice_review_queue').select('*').order('created_at', { ascending: true }),
      supabase.from('meal_review_mod_queue').select('*').order('report_count', { ascending: false }).limit(50),
      supabase.from('lost_photo_queue').select('*').order('created_at', { ascending: true }),
    ]);
    setNotices(
      ((n.data as QueueNotice[]) ?? []).map((x) => ({
        ...x,
        event_date: x.event_date ? isoToYmd(x.event_date) : null,
        show_from: isoToYmd(x.show_from),
        show_until: isoToYmd(x.show_until),
      })),
    );
    setReviews((r.data as QueueReview[]) ?? []);
    const list = (p.data as QueuePhoto[]) ?? [];
    const signed = list.length
      ? await supabase.storage.from('lost-photos').createSignedUrls(list.map((x) => x.photo_path), 3600)
      : { data: [] as { signedUrl: string | null }[] };
    setPhotos(list.map((x, i) => ({ ...x, url: signed.data?.[i]?.signedUrl ?? null })));
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    notices,
    reviews,
    photos,
    reload: load,
    review: async (id: number, approve: boolean, reason: string) => {
      const { error } = await supabase.rpc('review_notice', { p_id: id, p_approve: approve, p_reason: reason });
      await load();
      return res(error);
    },
    showNotice: async (id: number, show: boolean) => {
      const { error } = await supabase.rpc('mod_notice', { p_id: id, p_show: show });
      await load();
      return res(error);
    },
    setReviewHidden: async (id: number, hidden: boolean) => {
      const { error } = await supabase.rpc('mod_set_meal_review_hidden', { p_id: id, p_hidden: hidden });
      await load();
      return res(error);
    },
    reviewPhoto: async (id: number, approve: boolean) => {
      const { error } = await supabase.rpc('review_lost_photo', { p_id: id, p_approve: approve });
      await load();
      return res(error);
    },
  };
}
