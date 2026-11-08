import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { useAuth } from '@/state/auth';
import { useWallet } from '@/state/wallet';
import { focus as F, radius, space } from '@/theme/tokens';
import { gameUrl } from './catalog';
import { finishHtmlGame, GAMES, isExtra, loadGame, saveGame, startGame, studyMinutesToday, useGameStatus, type FinishResult } from './data';

type Phase = 'intro' | 'starting' | 'playing' | 'result' | 'class';
type Msg = { unjung: 1; id?: number; type: string; data?: unknown };

/**
 * 학생이 만든 HTML 게임을 앱 안에서 연다(iframe).
 * 한 판의 흐름: [시작] → 서버가 판을 연다(수업 시간·하루 10판·토큰 확인) → 게임 → 게임이 점수를 보내면 기록
 * → 앱의 결과 화면(한 판 더 / 나가기). 게임 안의 '다시 하기'로 이어서 하지 못하게 결과 화면이 게임을 덮는다.
 * 앱 ↔ 게임 약속: docs/games/README.md, public/games/_template/index.html 의 '앱 연결 코드'
 */
export function HtmlPlayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = String(rawId ?? '');
  const info = GAMES[id];
  const { status: auth, enrollment } = useAuth();
  const { wallet, refresh } = useWallet();
  const ready = auth === 'ready';
  const { status, reload } = useGameStatus(ready);
  const [phase, setPhase] = useState<Phase>('intro');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(FinishResult & { cost: number }) | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const run = useRef<{ id: string; cost: number } | null>(null);
  const best = useRef(0);
  /** 게임이 점수를 hold로 보낸 판: 게임의 결과 화면을 두고, 게임이 'done'을 보내면 앱 결과 화면을 연다 */
  const held = useRef<{ show: (() => void) | null; done: boolean; busy: boolean }>({ show: null, done: false, busy: false });
  const lastShow = useRef<(() => void) | null>(null);

  const post = useCallback((m: Record<string, unknown>) => frame.current?.contentWindow?.postMessage({ unjung: 1, ...m }, '*'), []);

  // 수업 시간이 시작되면 멈추고 막는다
  useEffect(() => {
    if (phase === 'playing' && status?.in_class) {
      post({ type: 'pause' });
      setPhase('class');
    }
  }, [status?.in_class, phase, post]);

  // 게임 → 앱 메시지
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMsg = async (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const m = e.data as Msg;
      if (!m || m.unjung !== 1) return;
      const reply = (data: unknown) => m.id && post({ reply: m.id, data });
      if (m.type === 'ready') {
        post({ type: 'player', data: { nickname: wallet?.nickname ?? '', grade: enrollment?.grade ?? null } });
        reply(true);
      } else if (m.type === 'score') {
        const score = Number((m.data as { score?: number })?.score) || 0;
        const hold = (m.data as { hold?: boolean })?.hold === true;
        const r = run.current;
        if (!r) return reply({ best: best.current });
        run.current = null;
        held.current.busy = true;
        const res = await finishHtmlGame(r.id, score);
        if (res) best.current = Math.max(best.current, res.best);
        reply({ best: res?.best ?? Math.max(best.current, score) });
        if (res?.reward) refresh(res.score_reward ? `게임 점수 보상 +${res.score_reward}` : '이번 주 최고 기록 갱신');
        reload();
        const show = () => {
          setResult(res ? { ...res, cost: r.cost } : { score, best: Math.max(best.current, score), new_best: false, reward: 0, cost: r.cost });
          setPhase((p) => (p === 'playing' ? 'result' : p));
        };
        held.current.busy = false;
        lastShow.current = show;
        if (hold) {
          // 게임이 자기 결과 화면을 보여 주는 중 → '계속'(done)을 누르면 앱 결과 화면
          if (held.current.done) {
            held.current.done = false;
            show();
          } else held.current.show = show;
        } else {
          // 게임의 결과 화면을 잠깐 보여 준 뒤 앱 결과 화면으로 덮는다
          setTimeout(show, 1500);
        }
      } else if (m.type === 'done') {
        reply(true);
        if (held.current.show) {
          const f = held.current.show;
          held.current.show = null;
          f();
        } else if (held.current.busy) held.current.done = true; // 점수 기록이 아직 끝나지 않음 → 끝나면 바로 연다
        else lastShow.current?.(); // 이미 기록한 판이면 그 결과를 연다
      } else if (m.type === 'study') {
        reply(await studyMinutesToday());
      } else if (m.type === 'save') {
        reply(await saveGame(id, String(m.data ?? 'null')));
      } else if (m.type === 'load') {
        reply(await loadGame(id));
      } else if (m.type === 'exit') {
        router.back();
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [post, wallet?.nickname, enrollment?.grade, id, refresh, reload, router]);

  // 화면을 떠나면(뒤로 가기 등) 게임도 멈춘다
  useEffect(() => () => void post({ type: 'pause' }), [post]);

  const start = async () => {
    setError(null);
    setPhase('starting');
    const r = await startGame(id, isExtra(status) ? (status?.next_cost ?? undefined) : undefined);
    if (!r.ok) {
      setError(r.message);
      setPhase('intro');
      reload();
      return;
    }
    run.current = { id: r.data.id, cost: r.data.cost };
    held.current = { show: null, done: false, busy: false };
    lastShow.current = null;
    if (r.data.cost) refresh();
    reload();
    setResult(null);
    setFrameKey((k) => k + 1);
    setPhase('playing');
  };

  const exit = () => {
    post({ type: 'pause' });
    if (router.canGoBack()) router.back();
    else router.replace('/games');
  };

  if (!info) {
    return (
      <Center insetTop={insets.top}>
        <AppText variant="heading">없는 게임이에요</AppText>
        <Button label="게임 목록으로" onPress={exit} />
      </Center>
    );
  }

  const extra = isExtra(status);
  const doneAll = status?.next_cost === null;
  const totalMax = status?.max_total ?? status?.max_plays ?? 10;
  const costLabel = !status ? '' : doneAll ? `오늘 ${totalMax}판을 다 했어요` : extra
    ? `무료 ${status.max_plays}판을 다 썼어요 · 연장할수록 비싸져요 · 오늘 ${status.plays_today}/${totalMax}판 · 내 토큰 🪙 ${wallet?.balance ?? 0}`
    : `무료 · 점수에 따라 1~5토큰 · 오늘 ${status.plays_today}/${status.max_plays}판`;
  const playLabel = (base: string) => (doneAll ? `오늘 ${totalMax}판을 다 했어요` : extra ? `🪙 ${status?.next_cost}토큰으로 한 판 연장` : base);
  const showFrame = phase === 'playing' || phase === 'result' || phase === 'class';

  return (
    <View style={{ flex: 1, backgroundColor: F.bg }}>
      {/* 위: 나가기 · 게임 이름 */}
      <View style={{ paddingTop: insets.top, backgroundColor: F.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: space.sm, gap: space.sm }}>
          <Pressable accessibilityRole="button" accessibilityLabel="게임 나가기" onPress={exit} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <AppText color={F.ink} style={{ fontSize: 22, lineHeight: 26 }}>
              ✕
            </AppText>
          </Pressable>
          <AppText variant="bodyStrong" color={F.ink} numberOfLines={1} style={{ flex: 1 }}>
            {info.emoji} {info.title}
          </AppText>
          {status ? (
            <AppText variant="caption" color={F.sub} style={{ marginRight: space.sm }}>
              오늘 {status.plays_today}/{status.plays_today >= status.max_plays ? totalMax : status.max_plays}판
            </AppText>
          ) : null}
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {showFrame && Platform.OS === 'web'
          ? createElement('iframe', {
              key: frameKey,
              ref: frame,
              src: gameUrl(id),
              title: info.title,
              allow: 'vibrate; fullscreen',
              // 다른 출처처럼 격리: 게임 코드가 앱의 로그인 정보(저장소)에 손대지 못한다
              sandbox: 'allow-scripts',
              style: { border: 0, width: '100%', height: '100%', display: 'block', background: F.bg },
            })
          : null}

        {phase === 'intro' || phase === 'starting' ? (
          <Center>
            <AppText style={{ fontSize: 64, lineHeight: 76 }}>{info.emoji}</AppText>
            <AppText variant="title" color={F.ink} align="center">
              {info.title}
            </AppText>
            <AppText variant="body" color={F.sub} align="center">
              {info.desc}
            </AppText>
            <Card style={{ alignSelf: 'stretch', gap: 4, backgroundColor: F.surface }}>
              <AppText variant="label" color={F.accent}>
                조작법
              </AppText>
              <AppText variant="body" color={F.ink}>
                {info.how}
              </AppText>
              {info.by ? (
                <AppText variant="caption" color={F.sub}>
                  만든 사람 {info.by}
                </AppText>
              ) : null}
            </Card>
            {!ready ? (
              <AppText variant="body" color={F.sub} align="center">
                로그인하고 학번을 등록하면 할 수 있어요.
              </AppText>
            ) : status?.in_class ? (
              <AppText variant="bodyStrong" color={F.accent} align="center">
                📚 지금은 수업 시간이에요. 쉬는 시간에 만나요!
              </AppText>
            ) : (
              <>
                <Big label={phase === 'starting' ? '여는 중…' : playLabel('▶  시작')} disabled={phase === 'starting' || doneAll} onPress={start} />
                <AppText variant="caption" color={F.sub} align="center">
                  {costLabel}
                </AppText>
              </>
            )}
            {error ? (
              <AppText variant="label" color={F.danger} align="center">
                {error}
              </AppText>
            ) : null}
            {ready ? <GameFeedbackLink id={id} /> : null}
            {Platform.OS !== 'web' ? (
              <AppText variant="caption" color={F.sub} align="center">
                게임은 웹 앱(unjung-app.vercel.app)에서 열려요.
              </AppText>
            ) : null}
          </Center>
        ) : null}

        {phase === 'result' && result ? (
          <Overlay>
            <AppText variant="label" color={F.sub}>
              이번 판
            </AppText>
            <AppText color={F.ink} weight="bold" style={{ fontSize: 48, lineHeight: 58, fontVariant: ['tabular-nums'] }}>
              {result.score.toLocaleString()}점
            </AppText>
            <AppText variant="bodyStrong" color={result.new_best ? F.accent : F.sub}>
              {result.new_best && result.score > 0 ? '🎉 이번 주 최고 기록!' : `이번 주 내 최고 ${result.best.toLocaleString()}점`}
            </AppText>
            {result.reward ? (
              <AppText variant="label" color={F.live}>
                +{result.reward} 토큰
              </AppText>
            ) : null}
            <Big label={playLabel('한 판 더')} disabled={doneAll} onPress={start} />
            <Big label="나가기" secondary onPress={exit} />
            <GameFeedbackLink id={id} />
          </Overlay>
        ) : null}

        {phase === 'class' ? (
          <Overlay>
            <AppText style={{ fontSize: 48, lineHeight: 58 }}>📚</AppText>
            <AppText variant="heading" color={F.ink} align="center">
              수업 시간이 시작됐어요
            </AppText>
            <AppText variant="body" color={F.sub} align="center">
              게임은 쉬는 시간·점심시간·방과후에 할 수 있어요.
            </AppText>
            <Big label="나가기" onPress={exit} />
          </Overlay>
        ) : null}
      </View>
    </View>
  );
}

function Center({ children, insetTop = 0 }: { children: React.ReactNode; insetTop?: number }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl, paddingTop: insetTop + space.xl, width: '100%', maxWidth: 480, alignSelf: 'center' }}>{children}</View>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: F.scrim, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl }}>
      <View style={{ width: '100%', maxWidth: 420, alignItems: 'center', gap: space.md }}>{children}</View>
    </View>
  );
}

function Big({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label.replace('▶', '').trim()}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignSelf: 'stretch',
        minHeight: 56,
        borderRadius: radius.round,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: secondary ? (pressed ? F.line : F.surface) : F.accent,
        borderWidth: secondary ? 1 : 0,
        borderColor: F.line,
        opacity: disabled ? 0.5 : 1,
      })}>
      <AppText variant="bodyStrong" color={secondary ? F.ink : F.onAccent}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** 이 게임에 대한 의견(버그·아이디어) → 의견 화면. 개발자가 '게임 의견'으로 모아 본다 */
function GameFeedbackLink({ id }: { id: string }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="이 게임에 의견 보내기"
      onPress={() => router.push(`/feedback?from=game:${id}`)}
      style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md }}>
      <AppText variant="label" color={F.sub}>
        💬 이 게임에 의견 보내기 (버그·아이디어)
      </AppText>
    </Pressable>
  );
}
