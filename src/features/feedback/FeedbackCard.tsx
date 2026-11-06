import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { REWARD } from '@/lib/rewards';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/auth';
import { color, radius, space } from '@/theme/tokens';
import { useLaunchEvent } from '@/features/launch/Launch';

export type FeedbackStats = { total: number; done: number; mine: number; launch: boolean; bonus_today: boolean };

/** 의견 현황(전체·반영·내 것·오늘 출시 보너스 받았는지). DB가 아직 옛 버전이면 null */
export function useFeedbackStats(enabled: boolean) {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const load = useCallback(async () => {
    if (!enabled) return;
    const { data, error } = await supabase.rpc('feedback_stats');
    if (!error && data) setStats(data as FeedbackStats);
  }, [enabled]);
  useEffect(() => {
    load();
  }, [load]);
  return { stats, reload: load };
}

/**
 * '오늘' 홈: 앱 의견 보내기. 출시 기간에는 크게(하루 첫 의견 +5 · 지금까지 모인 의견 수),
 * 그 뒤에는 한 줄로 작게.
 */
export function FeedbackCard() {
  const router = useRouter();
  const { status } = useAuth();
  const ready = status === 'ready';
  const { stats } = useFeedbackStats(ready);
  const { mult } = useLaunchEvent();
  if (!ready) return null;
  const launch = !!stats?.launch;
  const done = REWARD.feedbackDone * mult;
  const line = launch
    ? stats?.bonus_today
      ? `오늘 보너스는 받았어요 · 반영되면 +${done}`
      : `오늘 첫 의견 +5 · 반영되면 +${done} 토큰`
    : `반영되면 +${done} 토큰`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`앱 의견 보내기. ${line}`}
      onPress={() => router.push('/feedback?from=홈')}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        backgroundColor: pressed ? color.accentSoft : color.surface,
        borderRadius: radius.card,
        padding: space.xl,
        borderWidth: launch ? 2 : 0,
        borderColor: color.accent,
      })}>
      <AppText style={{ fontSize: 28, lineHeight: 34 }}>🛠️</AppText>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="caption" weight="semibold" color={color.accentInk}>
          {line}
        </AppText>
        <AppText variant="bodyStrong">{launch ? '출시 2주, 불편한 점을 알려 주세요' : '앱 의견 보내기'}</AppText>
        {stats && stats.total > 0 ? (
          <AppText variant="caption" color={color.inkMuted}>
            지금까지 의견 {stats.total}개 · {stats.done}개 반영{stats.mine ? ` · 내 의견 ${stats.mine}개` : ''}
          </AppText>
        ) : launch ? (
          <AppText variant="caption" color={color.inkMuted}>
            버그·바라는 기능 무엇이든. 학생 개발팀이 직접 읽어요
          </AppText>
        ) : null}
      </View>
      <Icon name="chevronRight" size={18} color={color.inkFaint} />
    </Pressable>
  );
}
