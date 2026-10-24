import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { isoToYmd, ymdToIso, type Ymd } from '@/lib/date';

// 분실물: 글은 바로 게시, 사진은 검토위원 승인 뒤 공개. 연락처 대신 전달 장소로 연결.

export type LostType = 'lost' | 'found';
export type LostItem = {
  id: number;
  type: LostType;
  item: string;
  place: string;
  happened_on: Ymd;
  description: string;
  keep_at: string | null;
  photo_path: string | null;
  my_photo_status: 'none' | 'pending' | 'approved' | 'rejected' | null;
  status: 'open' | 'resolved';
  created_at: string;
  mine: boolean;
  i_responded: boolean;
  has_response: boolean;
  photoUrl?: string | null;
};

export const PLACES = ['교실', '복도', '급식실', '체육관', '운동장', '도서관', '화장실', '현관', '음악실·미술실', '과학실'];
export const KEEP_AT = ['학생회실', '교무실', '행정실', '내가 보관 중'];

type Result = { ok: true } | { ok: false; message: string };
const res = (error: { message: string } | null): Result =>
  error ? { ok: false, message: /[가-힣]/.test(error.message) ? error.message : '잠시 뒤 다시 시도해 주세요.' } : { ok: true };

export function useLostFeed(enabled: boolean) {
  const [items, setItems] = useState<LostItem[] | null>(null);
  const load = useCallback(async () => {
    if (!enabled) return setItems(null);
    const { data } = await supabase.from('lost_feed').select('*').order('created_at', { ascending: false }).limit(100);
    const list = ((data as LostItem[]) ?? []).map((x) => ({ ...x, happened_on: isoToYmd(x.happened_on) }));
    const paths = list.filter((x) => x.photo_path).map((x) => x.photo_path as string);
    let urls: Record<string, string> = {};
    if (paths.length) {
      const { data: s } = await supabase.storage.from('lost-photos').createSignedUrls(paths, 3600);
      urls = Object.fromEntries((s ?? []).filter((x) => x.signedUrl && x.path).map((x) => [x.path as string, x.signedUrl as string]));
    }
    setItems(list.map((x) => ({ ...x, photoUrl: x.photo_path ? urls[x.photo_path] ?? null : null })));
  }, [enabled]);
  useEffect(() => {
    load();
  }, [load]);

  const rpc = useCallback(
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
    respond: (id: number, on: boolean) => rpc('respond_lost_item', { p_id: id, p_on: on }),
    resolve: (id: number) => rpc('resolve_lost_item', { p_id: id }),
    close: (id: number) => rpc('close_lost_item', { p_id: id }),
  };
}

export type LostDraft = { type: LostType; item: string; place: string; happenedOn: Ymd; description: string; keepAt: string | null; photo: Blob | null };

export async function postLostItem(d: LostDraft, userId: string): Promise<Result> {
  let path: string | null = null;
  if (d.photo) {
    path = `${userId}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from('lost-photos').upload(path, d.photo, { contentType: 'image/jpeg', upsert: false });
    if (error) return { ok: false, message: '사진을 올리지 못했어요. 사진 없이 올리거나 잠시 뒤 다시 시도해 주세요.' };
  }
  const { error } = await supabase.rpc('post_lost_item', {
    p_type: d.type,
    p_item: d.item.trim(),
    p_place: d.place.trim(),
    p_happened_on: ymdToIso(d.happenedOn),
    p_description: d.description.trim(),
    p_keep_at: d.keepAt,
    p_photo_path: path,
  });
  return res(error);
}

/**
 * 웹: 사진 고르기 → 긴 변 1280px로 줄이고 JPEG로 다시 저장(이때 위치정보 등 EXIF가 지워진다) → 1MB 이하가 될 때까지 품질을 낮춘다.
 * 네이티브 앱은 아직 지원하지 않는다(PWA 우선).
 */
export function pickPhoto(): Promise<{ blob: Blob; preview: string } | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
        const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        let quality = 0.82;
        let blob: Blob | null = null;
        while (quality > 0.3) {
          blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
          if (blob && blob.size <= 1_000_000) break;
          quality -= 0.12;
        }
        if (!blob || blob.size > 1_000_000) return resolve(null);
        resolve({ blob, preview: URL.createObjectURL(blob) });
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}
