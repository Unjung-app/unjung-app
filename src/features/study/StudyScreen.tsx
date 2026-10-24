import { useCallback, useMemo, useState } from 'react';
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
import { clockLabel, durationLabel, useStudyLive, useStudySession } from './session';

const RING = 220;
const STROKE = 14;
const TOKEN_SECONDS = 600;

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
  const progressSec = (todayRanked + sinceBeat) % TOKEN_SECONDS;
  const tokensToday = s.today?.tokens ?? 0;
  const ringPct = tokensToday >= 30 ? 1 : progressSec / TOKEN_SECONDS;
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
            {tokensToday >= 30 ? '오늘 공부 토큰을 다 받았어요' : `다음 토큰까지 ${Math.ceil((TOKEN_SECONDS - progressSec) / 60)}분`}
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
            토큰 {tokensToday}/30
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
          {'\n'}• 10분마다 토큰 +1 (하루 최대 30). 하루 12시간까지 랭킹에 들어가요.{'\n'}• 수업 시간(1~7교시)은 기록만 되고 랭킹·토큰에서 빠져요.
        </AppText>
      </Card>
    </Screen>
  );
}
