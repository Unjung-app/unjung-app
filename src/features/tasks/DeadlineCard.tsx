import { Pressable, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { useOpenFeature } from '@/features/hooks';
import { addDays, type Ymd } from '@/lib/date';
import { useAuth } from '@/state/auth';
import { color, radius, space } from '@/theme/tokens';
import { KIND_LABEL, useClassTasks } from './data';
import { dueLabel, KIND_TONE } from './TasksScreen';

/** '오늘' 홈: 3일 안에 마감되는 우리 반 수행평가·숙제 (없으면 아무것도 안 그린다) */
export function DeadlineCard({ today }: { today: Ymd }) {
  const openFeature = useOpenFeature();
  const { status } = useAuth();
  const { items } = useClassTasks(today, status === 'ready');
  const soon = (items ?? []).filter((t) => t.due >= today && t.due <= addDays(today, 3));
  if (soon.length === 0) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`다가오는 마감 ${soon.length}개, 수행평가·숙제 열기`}
      onPress={() => openFeature('tasks')}
      style={({ pressed }) => ({
        backgroundColor: pressed ? color.surfaceMuted : color.surface,
        borderRadius: radius.card,
        padding: space.xl,
        gap: space.sm,
        borderLeftWidth: 4,
        borderLeftColor: color.accent,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="heading">다가오는 마감 {soon.length}</AppText>
        <Icon name="chevronRight" size={18} color={color.inkFaint} />
      </View>
      {soon.slice(0, 3).map((t) => (
        <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <AppText variant="label" color={t.due <= addDays(today, 1) ? color.danger : color.inkMuted} style={{ width: 40 }}>
            {dueLabel(today, t.due)}
          </AppText>
          <View style={{ backgroundColor: KIND_TONE[t.kind].bg, borderRadius: radius.round, paddingHorizontal: 6, paddingVertical: 1 }}>
            <AppText variant="caption" weight="semibold" color={KIND_TONE[t.kind].fg}>
              {KIND_LABEL[t.kind]}
            </AppText>
          </View>
          <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>
            {t.subject}
            {t.body ? ` · ${t.body}` : ''}
          </AppText>
        </View>
      ))}
      {soon.length > 3 ? (
        <AppText variant="caption" color={color.inkMuted}>
          외 {soon.length - 3}개
        </AppText>
      ) : null}
    </Pressable>
  );
}
