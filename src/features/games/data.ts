import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { addDays, mondayOf, seoulNow, ymdToIso } from '@/lib/date';
import type { Equip } from '@/state/wallet';

export type GameId = 'word' | 'math' | 'life';

export const GAMES: Record<GameId, { title: string; emoji: string; desc: string; tag: string; seconds: number; tip: string }> = {
  word: {
    title: '영단어 러시',
    emoji: '🔤',
    desc: '60초 동안 고교 필수 영단어 뜻 맞히기',
    tag: '학업',
    seconds: 60,
    tip: '연속으로 맞히면 콤보 보너스! 한 번 틀리면 콤보가 끊겨요.',
  },
  math: {
    title: '암산 챌린지',
    emoji: '➗',
    desc: '60초 사칙연산, 맞힐수록 어려워져요',
    tag: '학업',
    seconds: 60,
    tip: '덧셈·뺄셈 → 곱셈 → 나눗셈 → 섞어서. 빠르고 정확하게!',
  },
  life: {
    title: '운중 라이프 퀴즈',
    emoji: '🏫',
    desc: '우리 학교 급식·학사일정·우리 반 시간표 퀴즈',
    tag: '학교생활',
    seconds: 90,
    tip: '이번 주 급식, 다가오는 일정, 우리 반 시간표에서 문제가 나와요. 앱을 잘 볼수록 유리해요!',
  },
};
export const GAME_IDS: GameId[] = ['word', 'math', 'life'];

export type GameStatus = {
  plays_today: number;
  max_plays: number;
  next_cost: number | null;
  in_class: boolean;
  best: Partial<Record<GameId, number>> | null;
};

export type Question = { q: string; choices: string[] };
export type StartResult = { id: string; game: GameId; duration_s: number; cost: number; plays_today: number; questions: Question[] };
export type AnswerResult =
  | { accepted: true; correct: boolean; answer: number; score: number; combo: number; index: number }
  | { accepted: false; reason: 'over' | 'order' | 'too_fast'; score: number; index: number };
export type FinishResult = {
  score: number;
  correct: number;
  wrong: number;
  best: number;
  new_best: boolean;
  reward: number;
  review: { q: string; answer: string; mine: string | null; ok: boolean }[] | null;
};
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
    const t = setInterval(load, 60_000); // 수업 시작·끝을 따라가도록
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

export async function answerGame(id: string, index: number, choice: number): Promise<AnswerResult | null> {
  const { data, error } = await supabase.rpc('answer_game', { p_id: id, p_index: index, p_choice: choice });
  return error ? null : (data as AnswerResult);
}

export async function finishGame(id: string): Promise<FinishResult | null> {
  const { data, error } = await supabase.rpc('finish_game', { p_id: id });
  return error ? null : (data as FinishResult);
}
