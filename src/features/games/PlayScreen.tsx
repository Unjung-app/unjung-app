import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { useWallet } from '@/state/wallet';
import { color, MAX_APP_WIDTH, radius, space } from '@/theme/tokens';
import { answerGame, finishGame, GAMES, startGame, useGameStatus, type FinishResult, type GameId, type Question } from './data';

type Phase = 'ready' | 'countdown' | 'playing' | 'finishing' | 'done';

function buzz(kind: 'ok' | 'bad') {
  try {
    if (Platform.OS === 'web') globalThis.navigator?.vibrate?.(kind === 'bad' ? 60 : 12);
    else if (kind === 'bad') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    else Haptics.selectionAsync().catch(() => {});
  } catch {
    // 진동이 안 되는 기기
  }
}

/** 게임 한 판: 준비 → 3·2·1 → 풀기(한 문제씩 서버 채점) → 결과 */
export function PlayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = (['word', 'math', 'life'].includes(id ?? '') ? id : 'word') as GameId;
  const meta = GAMES[game];
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refresh } = useWallet();
  const { status, reload } = useGameStatus(true);

  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<{ id: string; duration: number; questions: Question[] } | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [reveal, setReveal] = useState<{ answer: number; correct: boolean } | null>(null);
  const [remaining, setRemaining] = useState(meta.seconds);
  const [result, setResult] = useState<FinishResult | null>(null);
  const startedAt = useRef(0);
  const busy = useRef(false);
  const finished = useRef(false);

  const finish = useCallback(async () => {
    if (!run || finished.current) return;
    finished.current = true;
    setPhase('finishing');
    const r = await finishGame(run.id);
    setResult(r);
    setPhase('done');
    reload();
    refresh(r?.reward ? '이번 주 최고 기록 경신!' : undefined);
  }, [run, reload, refresh]);

  // 남은 시간
  useEffect(() => {
    if (phase !== 'playing' || !run) return;
    const t = setInterval(() => {
      const left = Math.max(0, run.duration - (Date.now() - startedAt.current) / 1000);
      setRemaining(left);
      if (left <= 0) finish();
    }, 200);
    return () => clearInterval(t);
  }, [phase, run, finish]);

  // 3·2·1 → 시작(이때 토큰이 빠지고 서버 시계가 돈다)
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count > 0) {
      const t = setTimeout(() => setCount((c) => c - 1), 700);
      return () => clearTimeout(t);
    }
    (async () => {
      const r = await startGame(game);
      if (!r.ok) {
        setError(r.message);
        setPhase('ready');
        reload();
        return;
      }
      startedAt.current = Date.now();
      finished.current = false;
      setRun({ id: r.data.id, duration: r.data.duration_s, questions: r.data.questions });
      setRemaining(r.data.duration_s);
      setIndex(0);
      setScore(0);
      setCombo(0);
      setPicked(null);
      setReveal(null);
      setPhase('playing');
      refresh();
    })();
  }, [phase, count, game, reload, refresh]);

  const choose = async (choice: number) => {
    if (!run || busy.current || phase !== 'playing' || reveal) return;
    busy.current = true;
    setPicked(choice);
    const r = await answerGame(run.id, index, choice);
    if (!r) {
      busy.current = false;
      setPicked(null);
      return;
    }
    if (!r.accepted) {
      busy.current = false;
      setPicked(null);
      if (r.reason === 'over') finish();
      else if (r.reason === 'order') setIndex(r.index);
      return;
    }
    buzz(r.correct ? 'ok' : 'bad');
    setReveal({ answer: r.answer, correct: r.correct });
    setScore(r.score);
    setCombo(r.combo);
    setTimeout(
      () => {
        setReveal(null);
        setPicked(null);
        busy.current = false;
        if (r.index >= run.questions.length) finish();
        else setIndex(r.index);
      },
      r.correct ? 280 : 750,
    );
  };

  const q = run?.questions[index];
  const shell = (children: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: color.navy, paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md }}>
      <View style={{ flex: 1, width: '100%', maxWidth: MAX_APP_WIDTH, alignSelf: 'center', paddingHorizontal: space.xl, gap: space.lg }}>{children}</View>
    </View>
  );

  // ───────── 준비 ─────────
  if (phase === 'ready') {
    const cost = status?.next_cost;
    const blocked = status?.in_class || cost === null;
    return shell(
      <>
        <Pressable accessibilityRole="button" accessibilityLabel="게임 목록으로" onPress={() => router.back()} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}>
          <Icon name="chevronLeft" size={26} color={color.onNavy} />
        </Pressable>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.lg }}>
          <AppText style={{ fontSize: 64, lineHeight: 76 }}>{meta.emoji}</AppText>
          <AppText variant="display" color={color.onNavy} align="center">
            {meta.title}
          </AppText>
          <AppText variant="body" color={color.onNavySub} align="center">
            {meta.desc}
          </AppText>
          <View style={{ backgroundColor: color.navyRaised, borderRadius: radius.card, padding: space.lg, gap: 6, alignSelf: 'stretch' }}>
            <AppText variant="caption" color={color.onNavyMuted}>
              ⏱ {meta.seconds}초 · 문제당 10점 + 콤보 보너스(최대 +10)
            </AppText>
            <AppText variant="caption" color={color.onNavyMuted}>
              💡 {meta.tip}
            </AppText>
            <AppText variant="caption" color={color.onNavyMuted}>
              🏆 이번 주 내 최고 {status?.best?.[game] ?? 0}점 · 넘기면 +2 토큰
            </AppText>
          </View>
        </View>
        {error ? (
          <AppText variant="label" weight="regular" color={color.accent} align="center">
            {error}
          </AppText>
        ) : null}
        {status?.in_class ? (
          <AppText variant="label" color={color.accent} align="center">
            📚 지금은 수업 시간이라 게임이 잠겨 있어요
          </AppText>
        ) : null}
        <Button
          label={!status ? '불러오는 중…' : cost === null ? '오늘은 10판을 다 했어요' : cost === 0 ? '시작하기 · 오늘 첫 판 무료' : `시작하기 · 🪙 ${cost}토큰`}
          variant="soft"
          disabled={!status || !!blocked}
          style={{ backgroundColor: color.accent, minHeight: 56 }}
          onPress={() => {
            setError(null);
            setCount(3);
            setPhase('countdown');
          }}
        />
      </>,
    );
  }

  // ───────── 3·2·1 ─────────
  if (phase === 'countdown') {
    return shell(
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <AppText style={{ fontSize: 96, lineHeight: 110 }} color={color.accent} weight="bold" accessibilityLiveRegion="assertive">
          {count > 0 ? count : '시작!'}
        </AppText>
      </View>,
    );
  }

  // ───────── 결과 ─────────
  if (phase === 'done' || phase === 'finishing') {
    return shell(
      <ScrollView contentContainerStyle={{ gap: space.lg, paddingBottom: space.xl }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', gap: space.sm, paddingTop: space.xl }}>
          <AppText variant="label" color={color.onNavyMuted}>
            {meta.emoji} {meta.title}
          </AppText>
          <AppText style={{ fontSize: 64, lineHeight: 72 }} color={color.onNavy} weight="bold">
            {result?.score ?? score}
          </AppText>
          <AppText variant="body" color={color.onNavySub}>
            {phase === 'finishing' ? '채점하는 중…' : `맞힘 ${result?.correct ?? 0} · 틀림 ${result?.wrong ?? 0}`}
          </AppText>
          {result?.new_best ? <Badge label="🎉 이번 주 내 최고 기록!" /> : <Badge label={`이번 주 최고 ${result?.best ?? 0}점`} tone="muted" />}
        </View>
        {result?.review?.some((r) => !r.ok) ? (
          <Card style={{ gap: space.sm }}>
            <AppText variant="heading">틀린 문제 다시 보기</AppText>
            {result.review
              .filter((r) => !r.ok)
              .slice(0, 12)
              .map((r, i) => (
                <View key={i} style={{ gap: 2, borderTopWidth: i ? 1 : 0, borderTopColor: color.lineSoft, paddingTop: i ? space.sm : 0 }}>
                  <AppText variant="bodyStrong">{r.q}</AppText>
                  <AppText variant="caption" color={color.success}>
                    정답: {r.answer}
                  </AppText>
                  {r.mine ? (
                    <AppText variant="caption" color={color.danger}>
                      내 답: {r.mine}
                    </AppText>
                  ) : null}
                </View>
              ))}
          </Card>
        ) : null}
        <Button
          label={status?.next_cost === null ? '오늘은 10판을 다 했어요' : status?.next_cost ? `한 판 더 · 🪙 ${status.next_cost}토큰` : '한 판 더'}
          variant="soft"
          disabled={phase === 'finishing' || status?.next_cost === null || status?.in_class}
          style={{ backgroundColor: color.accent, minHeight: 52 }}
          onPress={() => {
            setResult(null);
            setRun(null);
            setCount(3);
            setPhase('countdown');
          }}
        />
        <Button label="게임 목록으로" variant="ghostOnNavy" onPress={() => router.back()} />
      </ScrollView>,
    );
  }

  // ───────── 풀기 ─────────
  const pct = run ? remaining / run.duration : 1;
  const grid = game === 'math';
  return shell(
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <AppText variant="heading" color={color.onNavy} style={{ fontVariant: ['tabular-nums'] }}>
          ⏱ {Math.ceil(remaining)}
        </AppText>
        <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: color.navyTrack, overflow: 'hidden' }}>
          <View style={{ width: `${pct * 100}%`, height: 8, backgroundColor: pct < 0.2 ? color.danger : color.accent }} />
        </View>
        <AppText variant="heading" color={color.accent} style={{ fontVariant: ['tabular-nums'] }}>
          {score}점
        </AppText>
      </View>
      <View style={{ height: 24, alignItems: 'center' }}>
        {combo >= 2 ? (
          <AppText variant="label" color={color.accent}>
            🔥 {combo} 콤보!
          </AppText>
        ) : null}
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <AppText
          align="center"
          color={color.onNavy}
          weight="bold"
          style={{ fontSize: game === 'life' ? 22 : 40, lineHeight: game === 'life' ? 32 : 50 }}
          accessibilityLiveRegion="polite">
          {q?.q ?? ''}
        </AppText>
        {game === 'word' ? (
          <AppText variant="caption" color={color.onNavyMuted} align="center">
            뜻을 고르세요
          </AppText>
        ) : null}
      </View>
      <View style={{ flexDirection: grid ? 'row' : 'column', flexWrap: 'wrap', gap: space.sm }}>
        {(q?.choices ?? []).map((c, i) => {
          const isAnswer = reveal && reveal.answer === i;
          const isWrongPick = reveal && !reveal.correct && picked === i;
          const bg = isAnswer ? color.success : isWrongPick ? color.danger : picked === i ? color.navyRaised : color.surface;
          const fg = isAnswer || isWrongPick ? color.onNavy : picked === i ? color.onNavy : color.ink;
          return (
            <Pressable
              key={`${index}-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`보기 ${i + 1}: ${c}`}
              onPress={() => choose(i)}
              style={({ pressed }) => ({
                width: grid ? '48.5%' : '100%',
                minHeight: grid ? 72 : 56,
                borderRadius: radius.control,
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: bg,
                opacity: pressed && !reveal ? 0.85 : 1,
              })}>
              <AppText weight="semibold" color={fg} align="center" style={{ fontSize: grid ? 24 : 17, lineHeight: grid ? 30 : 24 }}>
                {c}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption" color={color.onNavyMuted} align="center">
        {index + 1} / {run?.questions.length ?? 0}
      </AppText>
    </>,
  );
}
