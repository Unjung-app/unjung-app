import { useCallback, useEffect, useRef, useState } from 'react';
import { appHidden, type Ymd } from '@/lib/date';
import { supabase } from '@/lib/supabase';

// 스터디 윗미 서버 데이터. 모두 로그인한 학생 전용 함수(RPC)라 예시 데이터 대신 '불러오지 못함' 상태를 보여 준다.

export type Subject = { id: number; name: string; color: string; sort: number };
export type MyGroup = { id: number; name: string; ends_on: string; live: number; members: number };
export type Dashboard = {
  today: { day: string; ranked_seconds: number; class_seconds: number; tokens: number; total_seconds: number };
  week_total_seconds: number;
  subjects: Subject[];
  by_subject: Record<string, number>;
  groups: MyGroup[];
  manager: boolean;
};
export type GroupInfo = {
  id: number;
  name: string;
  description: string;
  grade: number | null;
  capacity: number;
  starts_on: string;
  ends_on: string;
  closed: boolean;
  members: number;
  joined: boolean;
  can_join: boolean;
};
export type BoardMember = {
  mine: boolean;
  nickname: string | null;
  equip: { emoji: string | null; name_color: string | null; badge: string | null };
  live: boolean;
  today_seconds: number;
  period_seconds: number;
  days: number;
};
export type Board = {
  id: number;
  name: string;
  description: string;
  grade: number | null;
  capacity: number;
  starts_on: string;
  ends_on: string;
  today: string;
  manager: boolean;
  joined: boolean;
  members: BoardMember[];
};
export type AdminMember = {
  user_id: string;
  name: string | null;
  student_no: string | null;
  nickname: string | null;
  joined_at: string;
  live: boolean;
  today_seconds: number;
  period_seconds: number;
  days: number;
  by_day: Record<string, number>;
};
export type AdminBoard = {
  id: number;
  name: string;
  grade: number | null;
  password: string;
  capacity: number;
  starts_on: string;
  ends_on: string;
  today: string;
  days: string[];
  members: AdminMember[];
};

/** 서버 오류 문구: 한국어로 온 것만 그대로 보여 준다 */
export const friendly = (m?: string) => (m && /[가-힣]/.test(m) ? m : '잠시 뒤 다시 시도해 주세요.');

/** '2026-11-09' → '20261109' */
export const isoDayToYmd = (d: string): Ymd => d.replace(/-/g, '');

/** RPC 하나를 불러오고, 화면이 보일 때 일정 간격으로 다시 부른다(0이면 한 번만) */
function useRpc<T>(fn: string, args: Record<string, unknown> | undefined, enabled: boolean, pollMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(args ?? {});
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const { data: d, error: e } = await supabase.rpc(fn, JSON.parse(key));
    if (!alive.current) return;
    setLoading(false);
    if (e) setError(friendly(e.message));
    else {
      setError(null);
      setData(d as T);
    }
  }, [fn, key, enabled]);

  useEffect(() => {
    alive.current = true;
    load();
    if (!pollMs) return () => void (alive.current = false);
    const t = setInterval(() => !appHidden() && load(), pollMs);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [load, pollMs]);

  return { data, error, loading, reload: load };
}

export const useDashboard = (enabled: boolean, pollMs = 0) => useRpc<Dashboard>('my_study_dashboard', undefined, enabled, pollMs);
export const useGroupList = (enabled: boolean) => useRpc<GroupInfo[]>('study_group_list', undefined, enabled);
export const useGroupBoard = (id: number, enabled: boolean) => useRpc<Board>('study_group_board', { p_id: id }, enabled && id > 0, 30_000);
export const useGroupAdmin = (id: number, enabled: boolean) => useRpc<AdminBoard>('study_group_admin', { p_id: id }, enabled && id > 0, 60_000);

/** 성공하면 null, 실패하면 보여 줄 문구 */
export async function call(fn: string, args: Record<string, unknown>): Promise<string | null> {
  const { error } = await supabase.rpc(fn, args);
  return error ? friendly(error.message) : null;
}

/** 3725 → '1:02:05' (시간이 없어도 '0:02:05'로, 열품타처럼 항상 시:분:초) */
export function hms(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const two = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(s / 3600)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`;
}

/** 3725 → '1시간 2분', 59 → '0분' */
export function hm(seconds: number) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const h = Math.floor(m / 60);
  if (!h) return `${m}분`;
  return m % 60 ? `${h}시간 ${m % 60}분` : `${h}시간`;
}
