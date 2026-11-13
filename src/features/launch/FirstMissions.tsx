import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/primitives';
import { useOpenFeature } from '@/features/hooks';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/auth';
import { useWallet } from '@/state/wallet';
import { color, radius, space } from '@/theme/tokens';

type Row = { id: string; done: boolean; claimed: boolean };
type State = { active: boolean; reward: number; bonus: number; bonus_claimed: boolean; missions: Row[] };

/** 미션 설명과 바로 가기. 완료 판정은 서버(first_missions)가 실제 기록으로 한다 */
const INFO: Record<string, { emoji: string; title: string; go: { feature?: string; path?: string } }> = {
  nickname: { emoji: '🏷️', title: '닉네임 정하기', go: { path: '/settings/nickname' } },
  push: { emoji: '🔔', title: '알림 켜기', go: { path: '/settings/notifications' } },
  meal: { emoji: '🍱', title: '급식 한줄평 남기기', go: { feature: 'meal' } },
  study: { emoji: '⏱️', title: '스터디 윗미로 10분 공부', go: { feature: 'study' } },
  group: { emoji: '👥', title: '스터디 그룹 들어가기', go: { feature: 'study' } },
  game: { emoji: '🎮', title: '학생이 만든 게임 한 판', go: { feature: 'games' } },
  survey: { emoji: '🗳️', title: '학생회 설문 참여', go: { feature: 'voice' } },
  shop: { emoji: '🛍️', title: '꾸미기 상점에서 하나 사기', go: { path: '/shop' } },
  feedback: { emoji: '🛠️', title: '앱 의견 보내기', go: { path: '/feedback?from=첫걸음 미션' } },
};

/** '오늘' 홈: 출시 기념 첫걸음 미션(1회성). 이벤트가 끝났거나 모두 받았으면 숨긴다 */
export function FirstMissions() {
  const router = useRouter();
  const open = useOpenFeature();
  const { status } = useAuth();
  const { refresh } = useWallet();
  const ready = status === 'ready';
  const [st, setSt] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready) return;
    const { data, error } = await supabase.rpc('first_missions');
    if (!error && data) setSt(data as State);
  }, [ready]);
  // 다른 화면에서 미션을 하고 돌아오면 다시 확인
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!st?.active || !st.missions?.length) return null;
  const rows = st.missions.filter((m) => INFO[m.id]);
  const doneCount = rows.filter((m) => m.done).length;
  const allDone = doneCount === rows.length;
  if (allDone && st.bonus_claimed && rows.every((m) => m.claimed)) return null;
  const claimable = rows.filter((m) => m.done && !m.claimed).length * st.reward + (allDone && !st.bonus_claimed ? st.bonus : 0);
  const todo = rows.filter((m) => !m.done);

  const claim = async () => {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.rpc('claim_first_missions');
    setBusy(false);
    if (error) return setMsg(/[가-힣]/.test(error.message) ? error.message : '잠시 뒤 다시 시도해 주세요.');
    const got = Number((data as { tokens?: number } | null)?.tokens ?? 0);
    if (got) refresh(`첫걸음 미션 +${got}`);
    load();
  };

  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.card, padding: space.lg, gap: space.sm, borderWidth: 2, borderColor: color.accent }}>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppText variant="bodyStrong" style={{ flex: 1 }}>
            🚀 첫걸음 미션
          </AppText>
          <AppText variant="label" color={color.accentInk}>
            {doneCount}/{rows.length}
          </AppText>
        </View>
        <AppText variant="caption" color={color.inkMuted}>
          출시 기념 · 하나에 +{st.reward}, 모두 하면 +{st.bonus} 더! 앱을 한 바퀴 둘러봐요
        </AppText>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: color.line, overflow: 'hidden' }}>
        <View style={{ width: `${Math.round((100 * doneCount) / rows.length)}%`, height: '100%', backgroundColor: color.success }} />
      </View>

      {todo.slice(0, 4).map((m) => {
        const info = INFO[m.id];
        return (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            accessibilityLabel={`${info.title}. 하러 가기`}
            onPress={() => (info.go.path ? router.push(info.go.path as never) : open(info.go.feature!))}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44, borderRadius: radius.control, paddingHorizontal: space.sm, backgroundColor: pressed ? color.surfaceMuted : 'transparent' })}>
            <AppText style={{ fontSize: 20, lineHeight: 26 }}>{info.emoji}</AppText>
            <AppText variant="body" style={{ flex: 1 }} numberOfLines={1}>
              {info.title}
            </AppText>
            <AppText variant="label" color={color.accentInk}>
              +{st.reward}
            </AppText>
            <Icon name="chevronRight" size={16} color={color.inkFaint} />
          </Pressable>
        );
      })}
      {todo.length > 4 ? (
        <AppText variant="caption" color={color.inkMuted}>
          외 {todo.length - 4}개 · {todo.slice(4).map((m) => INFO[m.id].title).join(', ')}
        </AppText>
      ) : null}

      {claimable ? <Button label={busy ? '받는 중…' : `🎁 미션 보상 받기 +${claimable}`} disabled={busy} onPress={claim} /> : null}
      {msg ? (
        <AppText variant="caption" color={color.danger}>
          {msg}
        </AppText>
      ) : null}
    </View>
  );
}
