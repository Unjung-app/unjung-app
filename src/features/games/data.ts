import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { addDays, appHidden, mondayOf, seoulNow, ymdToIso } from '@/lib/date';
import type { Equip } from '@/state/wallet';

export type { GameId } from './catalog';
export { GAMES, GAME_IDS } from './catalog';
import type { GameId } from './catalog';

export type GameStatus = {
  plays_today: number;
  max_plays: number;
  max_total?: number;
  next_cost: number | null;
  in_class: boolean;
  score_tokens_today?: number;
  best: Partial<Record<GameId, number>> | null;
};

/** 무료 판을 다 써서 다음 판이 토큰 연장인지 */
export const isExtra = (s: GameStatus | null | undefined) => !!s && s.plays_today >= s.max_plays && s.next_cost !== null;

export type StartResult = { id: string; game: GameId; duration_s: number; cost: number; plays_today: number };
export type FinishResult = { score: number; best: number; new_best: boolean; reward: number; score_reward?: number };
export type GameRanking = {
  top: { rank: number; score: number; grade: number; mine: boolean; nickname: string | null; hidden: boolean; equip: Partial<Equip> | null }[];
  me: { score: number; rank: number } | null;
  players: number;
  week_start: string;
  week_end: string;
};

const friendly = (m?: string) => (m && /[가-힣]/.test(m) ? m : '잠시 뒤 다시 시도해 주세요.');

export function useGameStatus(enabled: boolean) {
  const [status, setStatus] = useState<GameStatus | null>(null);
  const load = useCallback(async () => {
    if (!enabled) return;
    const { data } = await supabase.rpc('game_status');
    if (data) setStatus(data as GameStatus);
  }, [enabled]);
  useEffect(() => {
    load();
    const t = setInterval(() => !appHidden() && load(), 60_000); // 수업 시작·끝을 따라가도록
    return () => clearInterval(t);
  }, [load]);
  return { status, reload: load };
}

export function useGameRanking(game: GameId, enabled: boolean) {
  const [data, setData] = useState<GameRanking | null>(null);
  const load = useCallback(async () => {
    if (!enabled) return;
    const { data: d } = await supabase.rpc('game_ranking', { p_game: game, p_week_start: ymdToIso(mondayOf(seoulNow().ymd)) });
    if (d) setData(d as GameRanking);
  }, [game, enabled]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);
  return { data, reload: load };
}

/** 지난주 게임 랭킹 정산(1~3위 토큰·1위 배지). 서버가 한 번만 지급하므로 아무나 불러도 된다. */
export async function settleLastWeek() {
  await supabase.rpc('settle_game_week', { p_week_start: ymdToIso(addDays(mondayOf(seoulNow().ymd), -7)) });
}

/** extraCost: 무료 10판을 다 쓴 뒤 연장할 때 화면에 보여 준 가격. 서버 가격과 다르면 시작하지 않는다. */
export async function startGame(game: GameId, extraCost?: number): Promise<{ ok: true; data: StartResult } | { ok: false; message: string }> {
  const { data, error } = extraCost === undefined
    ? await supabase.rpc('start_game', { p_game: game })
    : await supabase.rpc('start_game', { p_game: game, p_cost: extraCost });
  if (error || !data) return { ok: false, message: friendly(error?.message) };
  return { ok: true, data: data as StartResult };
}

export async function finishHtmlGame(id: string, score: number): Promise<FinishResult | null> {
  const { data, error } = await supabase.rpc('finish_html_game', { p_id: id, p_score: Math.max(0, Math.floor(score) || 0) });
  return error ? null : (data as FinishResult);
}

/** 이어하기 저장. 성공하면 true. 게임 저장(UnjungGame.save, 10KB) + localStorage 대신 저장(50KB)을 한 칸에 담는다 */
export async function saveGame(game: GameId, data: string): Promise<boolean> {
  if (typeof data !== 'string' || data.length > 70000) return false;
  const { error } = await supabase.rpc('save_game', { p_game: game, p_data: data });
  return !error;
}

/** 오늘 스터디 윗미 공부 시간(분) — 게임이 공부 보상에 쓴다(UnjungGame.getStudyMinutes) */
export async function studyMinutesToday(): Promise<number> {
  const { data, error } = await supabase.rpc('my_study_dashboard');
  if (error) return 0;
  const sec = Number((data as { today?: { total_seconds?: number } } | null)?.today?.total_seconds) || 0;
  return Math.floor(sec / 60);
}

export async function loadGame(game: GameId): Promise<string | null> {
  const { data, error } = await supabase.rpc('load_game', { p_game: game });
  return error ? null : ((data as string | null) ?? null);
}

/* ---------------- 게임 제출함(개발자가 붙여 넣어 제출 → 관리자 승인) ---------------- */
export type GameMeta = { title?: string; emoji?: string; desc?: string; tag?: string; how?: string; by?: string };
export type LiveBuild = { id: string; game: string; meta: GameMeta; author_name: string | null; updated_at: string };
export type BuildRow = {
  id: string; game: string; status: 'pending' | 'live' | 'old' | 'rejected'; meta: GameMeta; note: string | null;
  author_name: string | null; mine: boolean; size: number; reject_reason: string | null; created_at: string; reviewed_at: string | null;
};

let liveCache: { at: number; rows: LiveBuild[] } | null = null;
export async function liveBuilds(force = false): Promise<LiveBuild[]> {
  if (!force && liveCache && Date.now() - liveCache.at < 5 * 60_000) return liveCache.rows;
  const { data, error } = await supabase.rpc('live_game_builds');
  if (error) return liveCache?.rows ?? [];
  liveCache = { at: Date.now(), rows: (data as LiveBuild[]) ?? [] };
  return liveCache.rows;
}
/** 반영된 게임 목록. null = 아직 불러오는 중 */
export function useLiveBuilds(enabled: boolean) {
  const [rows, setRows] = useState<LiveBuild[] | null>(liveCache?.rows ?? null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    liveBuilds().then((r) => alive && setRows(r));
    return () => { alive = false; };
  }, [enabled]);
  return rows;
}

/** 게임 코드(반영본은 기기에 보관해 다시 받지 않는다) */
export async function buildHtml(id: string): Promise<string | null> {
  const key = 'ujgame:' + id;
  try { const c = localStorage.getItem(key); if (c) return c; } catch { /* */ }
  const { data, error } = await supabase.rpc('game_build_html', { p_id: id });
  if (error || typeof data !== 'string') return null;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith('ujgame:') && k !== key) localStorage.removeItem(k); }
    localStorage.setItem(key, data);
  } catch { /* 기기 저장 공간 부족 → 다음에 다시 받음 */ }
  return data;
}

export async function submitBuild(game: string, html: string, meta: GameMeta, note: string) {
  const { data, error } = await supabase.rpc('submit_game_build', { p_game: game, p_html: html, p_meta: meta, p_note: note });
  return error ? { ok: false as const, message: error.message } : { ok: true as const, id: data as string };
}
export async function listBuilds(): Promise<BuildRow[] | null> {
  const { data, error } = await supabase.rpc('game_builds_list');
  return error ? null : ((data as BuildRow[]) ?? []);
}
export async function reviewBuild(id: string, ok: boolean, reason = '') {
  const { error } = await supabase.rpc('review_game_build', { p_id: id, p_ok: ok, p_reason: reason });
  liveCache = null;
  return error ? error.message : null;
}
export async function unpublishBuild(game: string) {
  const { error } = await supabase.rpc('unpublish_game_build', { p_game: game });
  liveCache = null;
  return error ? error.message : null;
}

/** 미리 플레이할 코드(제출 전·검토 중). 화면 사이에 잠깐 들고 있는다 */
export const preview: { html: string | null; title: string } = { html: null, title: '' };
