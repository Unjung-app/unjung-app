import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { useOpenFeature } from '@/features/hooks';
import { ymdToIso, type Ymd } from '@/lib/date';
import { REWARD } from '@/lib/rewards';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/auth';
import { useWallet } from '@/state/wallet';
import { color, radius, space } from '@/theme/tokens';

type Mission = { key: string; emoji: string; label: string; reward: string; done: boolean; feature: string };

/**
 * '오늘' 홈: 오늘 받을 수 있는 토큰 미션 4가지(출석·한줄평·공부 10분·무료 게임).
 * 완료 여부는 내 토큰 기록(오늘)과 게임 판 수로 판단한다. 다 하면 칭찬 한 줄만 남긴다.
 */
export function DailyMissions({ today }: { today: Ymd }) {
  const { status } = useAuth();
  const { wallet } = useWallet();
  const openFeature = useOpenFeature();
  const router = useRouter();
  const ready = status === 'ready';
  const [reasons, setReasons] = useState<Set<string> | null>(null);
  const [played, setPlayed] = useState(false);

  const load = useCallback(async () => {
    if (!ready) return;
    const [ledger, game] = await Promise.all([
      supabase.from('token_ledger').select('reason').gte('created_at', `${ymdToIso(today)}T00:00:00+09:00`).limit(200),
      supabase.rpc('game_status'),
    ]);
    if (!ledger.error) setReasons(new Set(((ledger.data as { reason: string }[]) ?? []).map((r) => r.reason)));
    if (game.data) setPlayed(((game.data as { plays_today?: number }).plays_today ?? 0) > 0);
  }, [ready, today]);

  // 토큰이 바뀔 때마다(미션 완료) 다시 확인
  useEffect(() => {
    load();
  }, [load, wallet?.balance]);

  if (!ready || !reasons) return null;

  const missions: Mission[] = [
    { key: 'check', emoji: '📅', label: '출석', reward: `+${REWARD.checkIn}`, done: reasons.has('check_in'), feature: 'wallet' },
    { key: 'meal', emoji: '🍱', label: '한줄평', reward: `+${REWARD.mealReview}`, done: reasons.has('meal_review'), feature: 'meal' },
    { key: 'study', emoji: '⏱️', label: '공부 10분', reward: '+1~', done: reasons.has('study'), feature: 'study' },
    { key: 'game', emoji: '🎮', label: '무료 게임', reward: '무료', done: played, feature: 'games' },
  ];
  const doneCount = missions.filter((m) => m.done).length;

  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.card, padding: space.lg, gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AppText variant="bodyStrong" style={{ flex: 1 }}>
          오늘의 미션
        </AppText>
        <AppText variant="label" color={doneCount === missions.length ? color.success : color.inkMuted}>
          {doneCount === missions.length ? '모두 완료! 🎉' : `${doneCount}/${missions.length}`}
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {missions.map((m) => (
          <Pressable
            key={m.key}
            accessibilityRole="button"
            accessibilityState={{ checked: m.done }}
            accessibilityLabel={`${m.label} ${m.reward}${m.done ? ', 완료' : ''}`}
            onPress={() => (m.feature === 'wallet' ? router.push('/wallet') : openFeature(m.feature))}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 64,
              borderRadius: radius.control,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              backgroundColor: m.done ? color.successSoft : pressed ? color.surfaceMuted : color.bg,
            })}>
            <AppText style={{ fontSize: 20, lineHeight: 24 }}>{m.done ? '✅' : m.emoji}</AppText>
            <AppText variant="caption" weight="semibold" color={m.done ? color.success : color.ink} numberOfLines={1}>
              {m.label}
            </AppText>
            <AppText variant="caption" color={m.done ? color.success : color.inkFaint}>
              {m.reward}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
