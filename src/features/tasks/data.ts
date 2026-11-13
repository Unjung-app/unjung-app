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
  /** 사진(비공개 저장소 경로)과 화면에 쓸 임시 주소 */
  photo_path?: string | null;
  photoUrl?: string | null;
  /** 같은 학년 다른 반에 공유한 반 번호들 */
  share_classes?: number[];
  /** 글을 올린 반 */
  from_class?: number;
};

export type Suggestion = { id: number; task_id: number; body: string; resolved: boolean; created_at: string; mine: boolean };

export type TaskDraft = {
  subject: string;
  kind: TaskKind;
  due: Ymd;
  body: string;
  /** 같은 수업을 듣는 다른 반(같은 학년) */
  share?: number[];
  /** 새로 고른 사진(올릴 때 서버로) */
  photo?: Blob | null;
  /** 고칠 때 기존 사진 빼기 */
  removePhoto?: boolean;
};

const BUCKET = 'task-photos';

async function uploadPhoto(blob: Blob): Promise<string | null> {
  const uid = (await supabase.auth.getSession()).data.session?.user.id;
  if (!uid) return null;
  const path = `${uid}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  return error ? null : path;
}

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
    const list = ((data as (Omit<ClassTask, 'due'> & { due: string })[]) ?? []).map((t) => ({ ...t, due: isoToYmd(t.due) }));
    // 사진은 비공개 저장소라 1시간짜리 임시 주소를 한 번에 받는다
    const paths = list.filter((t) => t.photo_path).map((t) => t.photo_path as string);
    let urls: Record<string, string> = {};
    if (paths.length) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
      urls = Object.fromEntries((signed ?? []).filter((x) => x.signedUrl && x.path).map((x) => [x.path as string, x.signedUrl as string]));
    }
    setItems(list.map((t) => ({ ...t, photoUrl: t.photo_path ? urls[t.photo_path] ?? null : null })));
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
    create: async (d: TaskDraft): Promise<Result> => {
      let path: string | null = null;
      if (d.photo) {
        path = await uploadPhoto(d.photo);
        if (!path) return { ok: false, message: '사진을 올리지 못했어요. 사진 없이 올리거나 잠시 뒤 다시 시도해 주세요.' };
      }
      const r = await rpc('create_class_task', { p_subject: d.subject, p_kind: d.kind, p_due: ymdToIso(d.due), p_body: d.body, p_photo_path: path, p_share: d.share ?? [] });
      if (!r.ok && path) await supabase.storage.from(BUCKET).remove([path]);
      return r;
    },
    update: async (id: number, d: TaskDraft, oldPath?: string | null): Promise<Result> => {
      let path: string | null = null;
      const change = !!d.photo || !!d.removePhoto;
      if (d.photo) {
        path = await uploadPhoto(d.photo);
        if (!path) return { ok: false, message: '사진을 올리지 못했어요. 잠시 뒤 다시 시도해 주세요.' };
      }
      const r = await rpc('update_class_task', {
        p_id: id,
        p_subject: d.subject,
        p_kind: d.kind,
        p_due: ymdToIso(d.due),
        p_body: d.body,
        p_photo_path: path,
        p_photo_change: change,
        p_share: d.share ?? [],
      });
      if (!r.ok && path) await supabase.storage.from(BUCKET).remove([path]);
      if (r.ok && change && oldPath) await supabase.storage.from(BUCKET).remove([oldPath]); // 바뀐 사진의 옛 파일 정리
      return r;
    },
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
