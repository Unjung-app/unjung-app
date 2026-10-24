import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useWeekTimetable } from '@/features/data';
import { useNow, useOpenFeature } from '@/features/hooks';
import { useAuth } from '@/state/auth';
import { usePrefs } from '@/state/prefs';
import { useWallet } from '@/state/wallet';
import { color, radius, space } from '@/theme/tokens';
import { REWARD, secondsToNextStudyToken, studyTokensFor } from '@/lib/rewards';
import { clockLabel, durationLabel, useStudyLive, useStudySession } from './session';

const RING = 220;
const STROKE = 14;
/** 30분마다 '아직 공부 중인가요?'를 묻고(진동), 5분 안에 답이 없으면 세션을 끝낸다(화면만 켜 두고 자리를 비우는 것 방지) */
const CHECK_EVERY_S = 30 * 60;
const CHECK_WAIT_S = 300;

export function StudyScreen({ inStack = false }: { inStack?: boolean }) {
  const router = useRouter();
  const now = useNow();
  const openFeature = useOpenFeature();
  const { status, enrollment } = useAuth();
  const { myClass } = usePrefs();
  const { refresh: refreshWallet } = useWallet();
  const ready = status === 'ready';
  const s = useStudySession(ready);
  const live = useStudyLive(ready);
  const [subject, setSubject] = useState('');
  const [asking, setAsking] = useState(false);
  const confirmedAt = useRef(0);

  // 공부 토큰이 늘면(10분마다) 지갑을 새로 받아 '+1 토큰' 알림을 띄운다
  const seenTokens = useRef<number | null>(null);
  useEffect(() => {
    const t = s.today?.tokens;
    if (t === undefined) return;
    if (seenTokens.current !== null && t > seenTokens.current) refreshWallet('집중 모드 10분 달성');
    seenTokens.current = t;
  }, [s.today?.tokens, refreshWallet]);

  // 자리 비움 확인: 세션 시작 때 기준을 잡고, 30분마다 묻는다
  useEffect(() => {
    if (s.phase === 'idle') {
      confirmedAt.current = 0;
      setAsking(false);
      return;
    }
    if (s.phase !== 'running') return;
    if (!asking && s.elapsed - confirmedAt.current >= CHECK_EVERY_S) {
      setAsking(true);
      try {
        (globalThis.navigator as Navigator | undefined)?.vibrate?.([200, 100, 200]);
      } catch {
        // 진동이 안 되는 기기
      }
    }
    if (asking && s.elapsed - confirmedAt.current >= CHECK_EVERY_S + CHECK_WAIT_S) {
      setAsking(false);
      s.end('5분 동안 확인이 없어서 세션을 끝냈어요. 그 전까지는 기록됐어요.').then(() => refreshWallet());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.elapsed, s.phase, asking]);

  // 이 화면을 벗어나면 일시정지, 돌아오면 이어서 (다른 탭으로 옮겨도 마찬가지)
  useFocusEffect(
    useCallback(() => {
      s.back();
      return () => s.leave();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [s.back, s.leave]),
  );

  const tt = useWeekTimetable(now.ymd, myClass);
  const subjects = useMemo(() => {
    const set = new Set<string>();
    for (const l of tt.items) if (l.subject && !/자율|동아리|창체/.test(l.subject)) set.add(l.subject);
    return ['자습', ...[...set].slice(0, 9)];
  }, [tt.items]);

  if (status !== 'ready') {
    return (
      <Screen topInset={!inStack}>
        {!inStack ? (
          <AppText variant="title" accessibilityRole="header">
            공부 타이머
          </AppText>
        ) : null}
        <Card tone="navy">
          <AppText variant="heading" color={color.onNavy} style={{ fontSize: 20, lineHeight: 28 }}>
            {status === 'needsEnrollment' ? '학번을 등록하면\n공부 시간이 반 랭킹에 더해져요' : '학교 계정으로 로그인하면\n공부 시간이 토큰과 반 랭킹이 돼요'}
          </AppText>
          <Button
            label={status === 'needsEnrollment' ? '학번 등록하기' : '로그인하기'}
            variant="soft"
            style={{ backgroundColor: color.surface }}
            onPress={() => router.push(status === 'needsEnrollment' ? '/onboarding' : '/login')}
          />
        </Card>
      </Screen>
    );
  }

  const running = s.phase === 'running' || s.phase === 'away';
  const todayRanked = s.today?.ranked_seconds ?? 0;
  // 다음 토큰까지: 오늘 랭킹 인정 시간 + 이번 신호 이후 흐른 시간(표시용 추정)
  const sinceBeat = running && !s.inClass ? s.elapsed % 60 : 0;
  const tokensToday = s.today?.tokens ?? 0;
  const toNext = secondsToNextStudyToken(todayRanked + sinceBeat);
  const step = studyTokensFor(todayRanked + sinceBeat) < 12 ? 600 : 900;
  const ringPct = toNext === null ? 1 : 1 - toNext / step;
  const r = (RING - STROKE) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <Screen topInset={!inStack} onRefresh={running ? undefined : s.reloadToday}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {!inStack ? (
          <AppText variant="title" accessibilityRole="header">
            공부 타이머
          </AppText>
        ) : (
          <View />
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: color.surface, borderRadius: radius.round, paddingHorizontal: space.md, paddingVertical: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: live?.all ? color.success : color.inkFaint }} />
          <AppText variant="label" color={color.inkMuted}>
            지금 {live?.all ?? 0}명 집중 중
          </AppText>
        </View>
      </View>

      {asking && s.phase === 'running' ? (
        <Card tone="muted" style={{ gap: space.sm, borderWidth: 2, borderColor: color.accent }}>
          <AppText variant="heading">아직 공부 중인가요? ✍️</AppText>
          <AppText variant="caption" color={color.inkMuted}>
            5분 안에 눌러 주세요. 누르지 않으면 자리를 비운 것으로 보고 세션을 끝내요.
          </AppText>
          <Button
            label="네, 계속할게요"
            onPress={() => {
              confirmedAt.current = s.elapsed;
              setAsking(false);
            }}
          />
        </Card>
      ) : null}
      {s.notice ? (
        <Pressable accessibilityRole="button" accessibilityLabel="안내 닫기" onPress={s.dismissNotice} style={{ backgroundColor: color.accentSoft, borderRadius: radius.control, padding: space.md, minHeight: 44 }}>
          <AppText variant="label" weight="regular" color={color.accentInk}>
            {s.notice}
          </AppText>
        </Pressable>
      ) : null}
      {s.error ? (
        <AppText variant="label" weight="regular" color={color.danger}>
          {s.error}
        </AppText>
      ) : null}

      <Card tone="navy" style={{ alignItems: 'center', gap: space.lg, paddingVertical: space.xxl }}>
        <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
            <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={color.navyTrack} strokeWidth={STROKE} fill="none" />
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={r}
              stroke={color.accent}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circ}`}
              strokeDashoffset={circ * (1 - ringPct)}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          <AppText variant="label" color={color.onNavyMuted}>
            {running ? (s.phase === 'away' ? '일시정지' : subject || '집중 중') : '이번 세션'}
          </AppText>
          <AppText
            variant="display"
            color={color.onNavy}
            style={{ fontSize: 44, lineHeight: 52, fontVariant: ['tabular-nums'] }}
            accessibilityLabel={`이번 세션 ${durationLabel(s.elapsed)}`}>
            {clockLabel(s.elapsed)}
          </AppText>
          <AppText variant="caption" color={color.onNavySub}>
            {toNext === null ? '오늘 공부 토큰을 다 받았어요' : `다음 토큰까지 ${Math.max(1, Math.ceil(toNext / 60))}분`}
          </AppText>
        </View>

        {running && s.inClass ? (
          <AppText variant="caption" color={color.accent} align="center">
            지금은 수업 시간이라 기록만 되고 랭킹·토큰에는 들어가지 않아요
          </AppText>
        ) : null}

        {running ? (
          <Button
            label={s.phase === 'away' ? '돌아오는 중…' : '그만하기'}
            variant="soft"
            style={{ alignSelf: 'stretch', backgroundColor: color.surface, minHeight: 52 }}
            disabled={s.phase === 'away'}
            onPress={async () => {
              await s.stop();
              refreshWallet();
            }}
          />
        ) : (
          <Button
            label={s.phase === 'starting' ? '시작하는 중…' : s.phase === 'stopping' ? '저장하는 중…' : '집중 시작'}
            variant="soft"
            style={{ alignSelf: 'stretch', backgroundColor: color.accent, minHeight: 52 }}
            disabled={s.phase !== 'idle' || !enrollment}
            onPress={() => s.start(subject === '자습' ? '' : subject)}
          />
        )}
      </Card>

      {!running ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="label" color={color.inkMuted}>
            무엇을 공부하나요? (선택)
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {subjects.map((x) => {
              const on = subject === x;
              return (
                <Pressable
                  key={x}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setSubject(on ? '' : x)}
                  style={{ minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.round, justifyContent: 'center', backgroundColor: on ? color.navy : color.surface }}>
                  <AppText variant="label" color={on ? color.onNavy : color.ink}>
                    {x}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Card style={{ flex: 1, gap: 4 }}>
          <AppText variant="label" weight="regular" color={color.inkMuted}>
            오늘 공부
          </AppText>
          <AppText variant="title">{durationLabel(todayRanked)}</AppText>
          <AppText variant="caption" color={color.inkMuted}>
            토큰 {tokensToday}/{REWARD.studyDailyCap}
            {(s.today?.class_seconds ?? 0) > 0 ? ` · 수업 중 ${durationLabel(s.today?.class_seconds ?? 0)}` : ''}
          </AppText>
        </Card>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="랭킹 보기"
          onPress={() => openFeature('ranking')}
          style={({ pressed }) => ({ flex: 1, backgroundColor: pressed ? color.surfaceMuted : color.surface, borderRadius: radius.card, padding: space.xl, gap: 4 })}>
          <AppText variant="label" weight="regular" color={color.inkMuted}>
            이번 주
          </AppText>
          <AppText variant="title">{durationLabel(s.today?.week_ranked_seconds ?? 0)}</AppText>
          <AppText variant="caption" color={color.navy} weight="semibold">
            반 랭킹 보기 ›
          </AppText>
        </Pressable>
      </View>

      <Card tone="muted" style={{ gap: 6 }}>
        <AppText variant="label">집중 모드 규칙</AppText>
        <AppText variant="caption" color={color.inkMuted}>
          • 이 화면을 켜 둔 동안만 시간이 올라가요. 공부하는 동안 화면이 꺼지지 않아요.{'\n'}• 다른 앱이나 다른 탭으로 가면 바로 멈추고, 60초 안에 돌아오면 이어져요.
          {'\n'}• 처음 2시간은 10분마다, 그 뒤로는 15분마다 토큰 +1 (하루 최대 {REWARD.studyDailyCap}). 하루 12시간까지 랭킹에 들어가요.{'\n'}• 30분마다 '아직 공부 중인가요?'를 물어요(진동). 5분 안에 누르지 않으면 세션이 끝나요.{'\n'}• 수업 시간(우리 반 시간표)은 기록만 되고 랭킹·토큰에서 빠져요.
        </AppText>
      </Card>
    </Screen>
  );
}
