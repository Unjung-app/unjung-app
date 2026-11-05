import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { ApiResult } from './school';

// 웹은 같은 주소의 /api, 앱은 배포된 서버 주소를 쓴다. EXPO_PUBLIC_API_BASE로 바꿀 수 있다.
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? (Platform.OS === 'web' ? '' : 'https://unjung-app.vercel.app');

const memory = new Map<string, ApiResult<unknown>>();

async function fetchApi<T>(path: string): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as ApiResult<T>;
    if (!Array.isArray(body?.items)) throw new Error('잘못된 응답');
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export type RemoteState<T> = {
  items: T[];
  /** neis = 실데이터, cache = 예전에 받아 둔 실데이터, sample = 예시 */
  source: 'neis' | 'cache' | 'sample' | 'loading';
  refreshing: boolean;
  refresh: () => void;
};

/**
 * 서버 데이터 훅. 순서: 메모리 → 기기 저장본(바로 보여 줌) → 서버(도착하면 교체).
 * 서버도 저장본도 없으면 예시 데이터를 쓰고 source='sample'로 알려 준다.
 */
export function useRemote<T>(path: string | null, sample: () => T[]): RemoteState<T> {
  const [state, setState] = useState<{ items: T[]; source: RemoteState<T>['source'] }>(() => {
    const hit = path ? (memory.get(path) as ApiResult<T> | undefined) : undefined;
    return hit ? { items: hit.items, source: 'neis' } : { items: [], source: 'loading' };
  });
  const [refreshing, setRefreshing] = useState(false);
  const sampleRef = useRef(sample);
  sampleRef.current = sample;

  const load = useCallback(
    async (force: boolean) => {
      if (!path) {
        setState({ items: sampleRef.current(), source: 'sample' });
        return;
      }
      const key = `api:${path}`;
      if (!force && memory.has(path)) {
        setState({ items: (memory.get(path) as ApiResult<T>).items, source: 'neis' });
        return;
      }
      let cached: ApiResult<T> | null = null;
      try {
        const raw = await AsyncStorage.getItem(key);
        cached = raw ? (JSON.parse(raw) as ApiResult<T>) : null;
        if (cached && !force) setState({ items: cached.items, source: 'cache' });
      } catch {}
      try {
        const fresh = await fetchApi<T>(path);
        memory.set(path, fresh);
        setState({ items: fresh.items, source: 'neis' });
        AsyncStorage.setItem(key, JSON.stringify(fresh)).catch(() => {});
      } catch {
        setState(cached ? { items: cached.items, source: 'cache' } : { items: sampleRef.current(), source: 'sample' });
      }
    },
    [path],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load(true).finally(() => setRefreshing(false));
  }, [load]);

  return { ...state, refreshing, refresh };
}
