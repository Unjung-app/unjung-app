import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { DEV_TEAM } from '@/features/registry';
import { REWARD } from '@/lib/rewards';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/auth';
import { useWallet } from '@/state/wallet';
import { color, radius, space } from '@/theme/tokens';

export type LaunchEvent = { active: boolean; started?: boolean; from?: string; until?: string; mult?: number; gift?: number; gift_claimed?: boolean };

let cache: LaunchEvent | null = null;

/** 출시 기념 이벤트 상태(서버 app_config 'launch_event'). 기간·배수는 서버에서만 바꾼다 */
export function useLaunchEvent() {
  const { status } = useAuth();
  const [ev, setEv] = useState<LaunchEvent | null>(cache);
  const load = useCallback(async () => {
    if (status !== 'ready') return;
    const { data } = await supabase.rpc('launch_event');
    if (data) setEv((cache = data as LaunchEvent));
  }, [status]);
  useEffect(() => {
    load();
  }, [load]);
  return { ev, reload: load, mult: ev?.active ? ev.mult ?? 1 : 1 };
}

const md = (iso?: string) => (iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}` : '');

/** 홈: 출시 기념 토큰 부스트(원래 보상에 줄을 긋고 2배 보상) + 웰컴 토큰 받기 */
export function LaunchBanner() {
  const { ev, reload } = useLaunchEvent();
  const { refresh } = useWallet();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  if (!ev?.from || !ev.until) return null;
  const ended = !ev.active && ev.started;
  if (ended) return null;
  const m = ev.mult ?? 2;
  // 웰컴 토큰을 받은 뒤에는 한 줄로 접어 둔다(눌러서 펼치기)
  if (ev.active && ev.gift_claimed && !open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`출시 기념 토큰 부스트 ${m}배, ${md(ev.until)}까지. 펼치기`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, backgroundColor: pressed ? color.navyRaised : color.navy, borderRadius: radius.card, paddingHorizontal: space.lg })}>
        <AppText variant="bodyStrong" color={color.onNavy} style={{ flex: 1 }}>
          🎉 출시 기념 토큰 ×{m}
        </AppText>
        <AppText variant="label" color={color.accent}>
          {md(ev.until)}까지 ›
        </AppText>
      </Pressable>
    );
  }
  const rows: [string, string, string][] = [
    ['📅 출석', `+${REWARD.checkIn}`, `+${REWARD.checkIn * m}`],
    ['🍱 급식 한줄평', `+${REWARD.mealReview}`, `+${REWARD.mealReview * m}`],
    ['⏱️ 공부 10분', '+1', `+${m}`],
    ['🎮 게임 한 판', '1~5', `${m}~${5 * m}`],
    ['🗳️ 설문 참여', `+${REWARD.survey}`, `+${REWARD.survey * m}`],
    ['🛠️ 앱 의견 (하루 첫 의견)', '0', '+5'],
    ['🚀 첫걸음 미션 9개', '0', '최대 +65'],
    ['✅ 내 의견이 반영되면', `+${REWARD.feedbackDone}`, `+${REWARD.feedbackDone * m}`],
  ];
  return (
    <Card tone="navy" style={{ gap: space.md, borderWidth: 2, borderColor: color.accent }}>
      <View style={{ gap: 2 }}>
        <AppText variant="label" color={color.accent}>
          {ev.active ? `${md(ev.until)}까지` : `${md(ev.from)} 밤 10시 시작`}
        </AppText>
        <AppText variant="heading" color={color.onNavy} style={{ fontSize: 22, lineHeight: 30 }}>
          🎉 출시 기념 토큰 부스트 ×{m}
        </AppText>
      </View>
      <View style={{ backgroundColor: color.navyRaised, borderRadius: radius.control, padding: space.md, gap: 6 }}>
        {rows.map(([label, before, after]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <AppText variant="body" color={color.onNavy} style={{ flex: 1 }}>
              {label}
            </AppText>
            <AppText variant="body" color={color.onNavyMuted} style={{ textDecorationLine: 'line-through' }}>
              {before}
            </AppText>
            <AppText variant="bodyStrong" color={color.accent} style={{ minWidth: 56, textAlign: 'right' }}>
              {after} 🪙
            </AppText>
          </View>
        ))}
      </View>
      {ev.active && ev.gift ? (
        ev.gift_claimed ? (
          <AppText variant="label" color={color.onNavySub}>
            🎁 웰컴 토큰 {ev.gift}개를 받았어요
          </AppText>
        ) : (
          <Button
            label={busy ? '받는 중…' : `🎁 웰컴 토큰 ${ev.gift}개 받기`}
            variant="soft"
            style={{ backgroundColor: color.accent }}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              const { error } = await supabase.rpc('claim_launch_gift');
              setBusy(false);
              if (error) setMsg(/[가-힣]/.test(error.message) ? error.message : '잠시 뒤 다시 시도해 주세요.');
              else {
                refresh('출시 기념 웰컴 토큰');
                reload();
              }
            }}
          />
        )
      ) : null}
      {msg ? (
        <AppText variant="caption" color={color.onNavySub}>
          {msg}
        </AppText>
      ) : null}
    </Card>
  );
}

/** 앱을 만든 우리들(단체 사진). 홈에는 출시 이벤트 동안만, 앱 정보에는 늘 */
export function TeamCard({ homeOnly = false }: { homeOnly?: boolean }) {
  const { ev } = useLaunchEvent();
  if (homeOnly && ev && ev.started && !ev.active) return null;
  return (
    <Card style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
      <Image source={{ uri: '/team/app-team-2026.jpg' }} style={{ width: '100%', aspectRatio: 1200 / 751, backgroundColor: color.surfaceMuted }} resizeMode="cover" accessibilityLabel="앱을 만든 운중고 학생들의 단체 사진" />
      <View style={{ padding: space.lg, gap: 4 }}>
        <AppText variant="heading">👋 이 앱을 만든 우리들이에요</AppText>
        <AppText variant="caption" color={color.inkMuted}>
          운중고 학생 {DEV_TEAM.length}명이 직접 기획하고 만들었어요. 불편한 점은 전체 → 의견 보내기로 알려 주세요!
        </AppText>
        <AppText variant="caption" color={color.inkFaint}>
          {DEV_TEAM.join(' · ')}
        </AppText>
      </View>
    </Card>
  );
}
