import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { useOpenFeature } from '@/features/hooks';
import { useAuth } from '@/state/auth';
import { color, radius, space } from '@/theme/tokens';
import { useSurveyFeed } from './data';

/** '오늘' 홈: 아직 참여하지 않은 학생회 설문이 있으면 한 줄 카드로 알린다(없으면 안 그린다) */
export function SurveyStrip() {
  const router = useRouter();
  const openFeature = useOpenFeature();
  const { status } = useAuth();
  const { items } = useSurveyFeed(status === 'ready');
  const todo = (items ?? []).filter((s) => s.is_open && !s.responded);
  if (!todo.length) return null;
  const first = todo[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`참여할 학생회 설문 ${todo.length}개. ${first.title}. 열기`}
      onPress={() => (todo.length === 1 ? router.push(`/voice/survey/${first.id}`) : openFeature('voice'))}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: pressed ? color.accentSoft : color.surface, borderRadius: radius.card, padding: space.xl })}>
      <AppText style={{ fontSize: 26, lineHeight: 32 }}>🗳️</AppText>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="caption" weight="semibold" color={color.accentInk}>
          학생회 설문 {todo.length}개 · 참여하면 +3 토큰
        </AppText>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {first.title}
        </AppText>
      </View>
      <Icon name="chevronRight" size={18} color={color.inkFaint} />
    </Pressable>
  );
}
