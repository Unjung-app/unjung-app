import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { supabase } from '@/lib/supabase';

// 집중 모드 공부 세션.
//  · 시간은 서버가 센다: 앱은 1분마다 신호(beat)만 보낸다. 서버는 신호 간격(90초 이하)만큼만 인정.
//  · 다른 앱·다른 화면으로 가면 바로 일시정지(신호 중단). 60초 안에 돌아오면 이어서(떠난 시간은 빼고),
//    넘으면 세션을 끝낸다.
//  · 공부하는 동안 화면이 꺼지지 않게 한다(Wake Lock).

export type StudyToday = { day: string; ranked_seconds: number; class_seconds: number; tokens: number; week_ranked_seconds: number };
export type Phase = 'idle' | 'starting' | 'running' | 'away' | 'stopping';

const BEAT_MS = 60_000;
const AWAY_LIMIT_MS = 60_000;
const WAKE_TAG = 'unjung-study';

const friendly = (m?: string) => (m && /[가-힣]/.test(m) ? m : '잠시 뒤 다시 시도해 주세요.');

export function useStudySession(enabled: boolean) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [today, setToday] = useState<StudyToday | null>(null);
  const [inClass, setInClass] = useState(false);
  const [elapsed, setElapsed] = useState(0); // 이번 세션에서 화면을 켜고 있던 초 (표시용)
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const id = useRef<string | null>(null);
  const beatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const awayAt = useRef<number | null>(null);
  const runningSince = useRef<number | null>(null);
  const banked = useRef(0);

  const applyResult = useCallback((r: { ended?: boolean; reason?: string; in_class?: boolean; today?: StudyToday } | null) => {
    if (!r) return;
    if (r.today) setToday(r.today);
    if (typeof r.in_class === 'boolean') setInClass(r.in_class);
  }, []);

  const loadToday = useCallback(async () => {
    if (!enabled) return;
    const { data } = await supabase.rpc('my_study_today');
    if (data) setToday(data as StudyToday);
  }, [enabled]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const clearTimers = () => {
    if (beatTimer.current) clearInterval(beatTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    beatTimer.current = null;
    tickTimer.current = null;
  };

  const pauseClock = () => {
    if (runningSince.current !== null) banked.current += Math.floor((Date.now() - runningSince.current) / 1000);
    runningSince.current = null;
  };

  const runClock = () => {
    runningSince.current = Date.now();
    if (tickTimer.current) clearInterval(tickTimer.current);
    tickTimer.current = setInterval(() => {
      const live = runningSince.current !== null ? Math.floor((Date.now() - runningSince.current) / 1000) : 0;
      setElapsed(banked.current + live);
    }, 1000);
  };

  const finish = useCallback(
    async (message: string | null) => {
      clearTimers();
      pauseClock();
      deactivateKeepAwake(WAKE_TAG).catch(() => {});
      const sid = id.current;
      id.current = null;
      awayAt.current = null;
      setPhase('stopping');
      if (sid) {
        const { data } = await supabase.rpc('stop_study', { p_id: sid });
        applyResult(data);
      }
      setPhase('idle');
      setNotice(message);
    },
    [applyResult],
  );

  const beat = useCallback(
    async (skip = false) => {
      const sid = id.current;
      if (!sid) return;
      const { data, error: e } = await supabase.rpc('beat_study', { p_id: sid, p_skip: skip });
      if (e) return; // 일시적인 네트워크 오류: 다음 신호에서 다시
      applyResult(data);
      if (data?.ended) {
        clearTimers();
        pauseClock();
        deactivateKeepAwake(WAKE_TAG).catch(() => {});
        id.current = null;
        setPhase('idle');
        setNotice('신호가 끊겨서 세션이 끝났어요. 다시 시작해 주세요.');
      }
    },
    [applyResult],
  );

  const startBeating = useCallback(() => {
    if (beatTimer.current) clearInterval(beatTimer.current);
    beatTimer.current = setInterval(() => beat(false), BEAT_MS);
  }, [beat]);

  const start = useCallback(
    async (subject: string) => {
      setError(null);
      setNotice(null);
      setPhase('starting');
      const { data, error: e } = await supabase.rpc('start_study', { p_subject: subject });
      if (e || !data?.id) {
        setPhase('idle');
        setError(friendly(e?.message));
        return;
      }
      id.current = data.id;
      applyResult(data);
      banked.current = 0;
      setElapsed(0);
      activateKeepAwakeAsync(WAKE_TAG).catch(() => {});
      runClock();
      startBeating();
      setPhase('running');
    },
    [applyResult, startBeating],
  );

  const stop = useCallback(() => finish('수고했어요! 오늘 기록에 더했어요.'), [finish]);

  // 화면을 떠남(다른 앱·다른 탭) → 일시정지
  const leave = useCallback(() => {
    if (!id.current || awayAt.current !== null) return;
    awayAt.current = Date.now();
    clearTimers();
    pauseClock();
    setPhase('away');
  }, []);

  // 돌아옴 → 60초 안이면 이어서(떠난 시간은 서버가 세지 않게 skip), 넘었으면 종료
  const back = useCallback(async () => {
    if (!id.current || awayAt.current === null) return;
    const away = Date.now() - awayAt.current;
    awayAt.current = null;
    if (away > AWAY_LIMIT_MS) {
      await finish(`앱을 ${Math.round(away / 1000)}초 동안 떠나 있어서 세션이 끝났어요. 떠나기 전까지는 기록됐어요.`);
      return;
    }
    await beat(true);
    if (!id.current) return;
    activateKeepAwakeAsync(WAKE_TAG).catch(() => {});
    runClock();
    startBeating();
    setPhase('running');
  }, [beat, finish, startBeating]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') back();
      else leave();
    });
    return () => sub.remove();
  }, [back, leave]);

  // 화면을 아예 벗어나면(언마운트) 세션 종료
  useEffect(
    () => () => {
      if (id.current) {
        const sid = id.current;
        id.current = null;
        clearTimers();
        deactivateKeepAwake(WAKE_TAG).catch(() => {});
        supabase.rpc('stop_study', { p_id: sid }).then(
          () => {},
          () => {},
        );
      }
    },
    [],
  );

  return { phase, today, inClass, elapsed, notice, error, start, stop, end: finish, leave, back, reloadToday: loadToday, dismissNotice: () => setNotice(null) };
}

/** 지금 집중 중인 인원 (30초마다) */
export function useStudyLive(enabled: boolean) {
  const [live, setLive] = useState<{ all: number; g1: number; g2: number; g3: number } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () =>
      supabase.rpc('study_live').then(({ data }) => {
        if (alive && data) setLive(data);
      });
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [enabled]);
  return live;
}

/** 3725 → '1시간 2분' */
export function durationLabel(seconds: number) {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h === 0) return `${m}분`;
  return m % 60 ? `${h}시간 ${m % 60}분` : `${h}시간`;
}

/** 3725 → '1:02:05', 125 → '02:05' */
export function clockLabel(seconds: number) {
  const s = seconds % 60;
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}
