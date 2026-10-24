import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Badge, Divider, ListRow } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { classLabel, useOpenFeature } from '@/features/hooks';
import { FEATURES } from '@/features/registry';
import { usePrefs } from '@/state/prefs';
import { color, radius, space } from '@/theme/tokens';

const LEADS = ['howon', 'jongbum', 'yeonjun'];

export function MoreScreen() {
  const router = useRouter();
  const openFeature = useOpenFeature();
  const { myClass } = usePrefs();
  const live = FEATURES.filter((f) => f.status === 'live');
  const soon = FEATURES.filter((f) => f.status === 'soon');
  const contributors = [...new Set(FEATURES.flatMap((f) => f.credits ?? []))];

  const group = (children: React.ReactNode) => (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>{children}</View>
  );

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        전체
      </AppText>

      {group(
        <>
          <ListRow icon="pin" title={classLabel(myClass)} subtitle="내 반 설정" onPress={() => router.push('/settings/class')} />
          <Divider />
          <ListRow icon="settings" title="하단 탭 설정" subtitle="자주 쓰는 기능을 아래 탭에 고정해요" onPress={() => router.push('/settings/tabs')} />
        </>,
      )}

      <AppText variant="heading" style={{ marginTop: space.sm }}>
        기능
      </AppText>
      {group(
        live.map((f, i) => (
          <View key={f.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow icon={f.icon} title={f.title} subtitle={f.desc} onPress={() => openFeature(f.id)} />
          </View>
        )),
      )}

      <AppText variant="heading" style={{ marginTop: space.sm }}>
        준비 중
      </AppText>
      {group(
        soon.map((f, i) => (
          <View key={f.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              icon={f.icon}
              title={f.title}
              subtitle={f.desc}
              onPress={() => openFeature(f.id)}
              right={<Badge label="준비 중" tone="muted" />}
            />
          </View>
        )),
      )}

      <View style={{ marginTop: space.xl, gap: 4, alignItems: 'center' }}>
        <AppText variant="caption" color={color.inkMuted} align="center">
          NERD LAB × 알고리즘 동아리 · 운중고 학생자치회
        </AppText>
        <AppText variant="caption" color={color.inkFaint} align="center">
          만든 사람들 · {[...LEADS, ...contributors.filter((c) => !LEADS.includes(c))].join(', ')}
        </AppText>
      </View>
    </Screen>
  );
}
