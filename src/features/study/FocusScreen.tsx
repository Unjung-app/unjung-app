import { useCallback, useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { noSleepOff, noSleepOn, noSleepResume } from '@/lib/noSleep';
import { AppText } from '@/components/ui/AppText';
import { useWallet } from '@/state/wallet';
import { focus as F, radius, space, subjectColor } from '@/theme/tokens';
import { hm, hms, useDashboard } from './api';
import { setQuietRewards } from '@/state/wallet';
import { useStudyLive, useStudySession } from './session';

/**
 * 열품타식 집중 화면: 검은 바탕에 이 과목 오늘 시간이 크게 올라간다.
 * 들어오면 바로 시작하고, 나가면(그만하기·뒤로) 기록을 저장한다.
 */
export function FocusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ subject?: string; color?: string }>();
  const subject = (params.subject ?? '').slice(0, 20);
  const tint = subjectColor[params.color ?? ''] ?? F.accent;
  const { refresh: refreshWallet } = useWallet();
  const s = useStudySession(true);
  const dash = useDashboard(true, 60_000);
  // 공부하는 동안은 토큰 진동 끄기
  useEffect(() => {
    setQuietRewards(true);
    return () => setQuietRewards(false);
  }, []);
  const live = useStudyLive(true);
  const started = useRef(false);
  const base = useRef<{ subject: number; total: number } | null>(null);

  // 들어오면 한 번만 시작
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    s.start(subject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 시작 시점의 오늘 기록(이 과목·전체)을 기준으로, 이번 세션 시간을 더해 보여 준다
  useEffect(() => {
    if (!base.current && dash.data) base.current = { subject: dash.data.by_subject[subject] ?? 0, total: dash.data.today.total_seconds };
  }, [dash.data, subject]);

  // 공부 토큰이 늘면 '+1 토큰' 알림
  const seenTokens = useRef<number | null>(null);
  useEffect(() => {
    const t = s.today?.tokens;
    if (t === undefined) return;
    if (seenTokens.current !== null && t > seenTokens.current) refreshWallet('집중 10분 달성');
    seenTokens.current = t;
  }, [s.today?.tokens, refreshWallet]);

  // 집중 화면에 있는 동안 폰이 저절로 꺼지지 않게(호원 결정 11-06: 30분 확인은 없앰)
  useEffect(() => {
    noSleepOn();
    const vis = () => !document.hidden && noSleepResume();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', vis);
    return () => {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', vis);
      noSleepOff();
    };
  }, []);

  // 다른 탭·화면으로 가면 일시정지, 돌아오면 이어서
  useFocusEffect(
    useCallback(() => {
      s.back();
      return () => s.leave();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [s.back, s.leave]),
  );

  const running = s.phase === 'running' || s.phase === 'away' || s.phase === 'check';
  const ended = s.phase === 'idle' && started.current && !!s.notice;
  const group = dash.data?.groups?.[0];
  const subjectSeconds = (base.current?.subject ?? 0) + s.elapsed;
  const totalSeconds = (base.current?.total ?? 0) + s.elapsed;

  const close = async () => {
    if (running) await s.stop();
    refreshWallet();
    if (router.canGoBack()) router.back();
    else router.replace('/study');
  };

  return (
    <View style={{ flex: 1, backgroundColor: F.bg, paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.xl }}>
      <View style={{ width: '100%', maxWidth: 520, alignSelf: 'center', flex: 1 }}>
        {/* 위: 그룹 현황 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: F.live }} />
          <AppText variant="label" color={F.sub} style={{ flex: 1 }} numberOfLines={1}>
            {group
              ? `${group.name} · ${group.live}명 공부 중`
              : live?.all
                ? `지금 ${live.all}명 함께 공부 중${live.my_class ? ` · 우리 반 ${live.my_class}명` : ''}`
                : '스터디 윗미'}
          </AppText>
          <AppText variant="label" color={F.sub} style={{ fontVariant: ['tabular-nums'] }}>
            오늘 총 {hms(totalSeconds)}
          </AppText>
        </View>

        {/* 가운데: 큰 시계 */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.round, backgroundColor: F.surface }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tint }} />
            <AppText variant="bodyStrong" color={F.ink}>
              {subject || '자습'}
            </AppText>
          </View>
          <AppText
            color={F.ink}
            weight="bold"
            style={{ fontSize: 64, lineHeight: 76, fontVariant: ['tabular-nums'], letterSpacing: 1 }}
            accessibilityLabel={`${subject || '자습'} 오늘 ${hm(subjectSeconds)}`}>
            {hms(subjectSeconds)}
          </AppText>
          <AppText variant="label" color={F.sub}>
            {s.phase === 'starting'
              ? '시작하는 중…'
              : s.phase === 'away'
                ? '일시정지 · 60초 안에 돌아오면 이어져요'
                : s.phase === 'check'
                  ? '새벽 확인 중 · 아래 버튼을 눌러 주세요'
                : s.phase === 'stopping'
                  ? '저장하는 중…'
                  : running
                    ? `이번 집중 ${hm(s.elapsed)}${s.inClass ? ' · 수업 시간(토큰 제외)' : ''}`
                    : ''}
          </AppText>

          {s.notice || s.error ? (
            <AppText variant="label" weight="regular" color={s.error ? F.danger : F.accent} align="center">
              {s.error ?? s.notice}
            </AppText>
          ) : null}
        </View>

        {/* 아래: 버튼 */}
        {ended || (s.phase === 'idle' && s.error) ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Big label="닫기" grow onPress={close} />
            <Big label="다시 시작" grow primary onPress={() => {
              s.dismissNotice();
              base.current = null;
              dash.reload();
              s.start(subject);
            }} />
          </View>
        ) : (
          <Big label={s.phase === 'stopping' ? '저장하는 중…' : '■  그만하기'} disabled={!running} onPress={close} />
        )}
      </View>

      {s.phase === 'check' ? (
        <View
          accessibilityViewIsModal
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: F.scrim, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md }}>
          <View style={{ width: '100%', maxWidth: 420, gap: space.md, alignItems: 'center' }}>
            <AppText style={{ fontSize: 48, lineHeight: 58 }}>🌙</AppText>
            <AppText variant="heading" color={F.ink} align="center">
              아직 공부 중인가요?
            </AppText>
            <AppText variant="body" color={F.sub} align="center">
              새벽에는 2시간마다 확인해요. 90초 안에 누르지 않으면 지금까지만 기록하고 끝나요.
            </AppText>
            <Big label="네, 계속 공부할게요" primary onPress={() => s.confirmAlive()} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Big({ label, onPress, primary, disabled, grow }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean; grow?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label.replace('■', '').trim()}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: grow ? 1 : undefined,
        minHeight: 56,
        borderRadius: radius.round,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? F.accent : pressed ? F.line : F.surface,
        borderWidth: primary ? 0 : 1,
        borderColor: F.line,
        opacity: disabled ? 0.5 : 1,
      })}>
      <AppText variant="bodyStrong" color={primary ? F.onAccent : F.ink}>
        {label}
      </AppText>
    </Pressable>
  );
}
