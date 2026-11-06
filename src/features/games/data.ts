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
  next_cost: number | null;
  in_class: boolean;
  score_tokens_today?: number;
  best: Partial<Record<GameId, number>> | null;
};

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

export async function startGame(game: GameId): Promise<{ ok: true; data: StartResult } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('start_game', { p_game: game });
  if (error || !data) return { ok: false, message: friendly(error?.message) };
  return { ok: true, data: data as StartResult };
}

export async function finishHtmlGame(id: string, score: number): Promise<FinishResult | null> {
  const { data, error } = await supabase.rpc('finish_html_game', { p_id: id, p_score: Math.max(0, Math.floor(score) || 0) });
  return error ? null : (data as FinishResult);
}

/** 이어하기 저장(게임별 10KB). 성공하면 true */
export async function saveGame(game: GameId, data: string): Promise<boolean> {
  if (typeof data !== 'string' || data.length > 10000) return false;
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
