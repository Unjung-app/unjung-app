import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type GalleryPost = { id: number; author: string; title: string; body: string; event_date: string; photos: string[]; youtube: string | null; created_at: string };

const friendly = (m?: string) => (m && /[가-힣]/.test(m) ? m : '잠시 뒤 다시 시도해 주세요.');

export const photoUrl = (path: string) => supabase.storage.from('gallery').getPublicUrl(path).data.publicUrl;
export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youtubeEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`;

export function useGallery(enabled: boolean, limit = 30) {
  const [items, setItems] = useState<GalleryPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!enabled) return;
    const { data, error: e } = await supabase.from('gallery_posts').select('id,author,title,body,event_date,photos,youtube,created_at').order('event_date', { ascending: false }).order('id', { ascending: false }).limit(limit);
    if (e) setError('불러오지 못했어요.');
    else {
      setError(null);
      setItems((data as GalleryPost[]) ?? []);
    }
  }, [enabled, limit]);
  useEffect(() => {
    load();
  }, [load]);
  return { items, error, reload: load };
}

export function useIsComm(enabled: boolean) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    supabase.rpc('is_comm').then(({ data }) => setOn(data === true));
  }, [enabled]);
  return on;
}

/** 사진들을 올리고 경로를 돌려준다(하나라도 실패하면 오류) */
export async function uploadPhotos(uid: string, blobs: Blob[], onProgress?: (done: number) => void): Promise<{ ok: true; paths: string[] } | { ok: false; message: string }> {
  const stamp = Date.now();
  const paths: string[] = [];
  for (let i = 0; i < blobs.length; i++) {
    const path = `${uid}/${stamp}-${i}.jpg`;
    const { error } = await supabase.storage.from('gallery').upload(path, blobs[i], { contentType: 'image/jpeg', upsert: false });
    if (error) return { ok: false, message: `${i + 1}번째 사진을 올리지 못했어요. 다시 시도해 주세요.` };
    paths.push(path);
    onProgress?.(i + 1);
  }
  return { ok: true, paths };
}

export async function postGallery(p: { title: string; body: string; eventDate: string; photos: string[]; youtube: string }) {
  const { data, error } = await supabase.rpc('post_gallery', { p_title: p.title, p_body: p.body, p_event_date: p.eventDate, p_photos: p.photos, p_youtube: p.youtube || null });
  return error ? { ok: false as const, message: friendly(error.message) } : { ok: true as const, id: data as number };
}

export async function deleteGallery(id: number) {
  const { error } = await supabase.rpc('delete_gallery', { p_id: id });
  return error ? friendly(error.message) : null;
}
