import { View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { FEATURE_BY_ID } from './registry';
import { color, space } from '@/theme/tokens';

const PLAN: Record<string, string> = {
  study: '공부 시간을 재면 토큰이 쌓이고, 반·학년 랭킹에 반영돼요.',
  ranking: '공부 시간과 앱 활동으로 모은 토큰을 개인·반·학년별로 겨뤄요.',
  notice: '학교·학년 공지를 한곳에 모아 새 공지가 오면 알려 줘요.',
  voice: '학생회 설문과 건의를 앱에서 바로 참여해요.',
  sports: '반 대항전 대진표와 결과를 실시간으로 확인해요.',
};

export function ComingSoonScreen({ id, inStack = false }: { id: string; inStack?: boolean }) {
  const f = FEATURE_BY_ID[id];
  return (
    <Screen topInset={!inStack} contentStyle={{ alignItems: 'center', paddingTop: space.xxxl * 2 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          backgroundColor: color.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={f.icon} size={34} color={color.navy} />
      </View>
      <AppText variant="title" align="center" accessibilityRole="header">
        {f.title}
      </AppText>
      <Badge label="준비 중" />
      <AppText variant="body" color={color.inkMuted} align="center" style={{ maxWidth: 300 }}>
        {PLAN[id] ?? f.desc}
      </AppText>
      {f.credits?.length ? (
        <AppText variant="caption" color={color.inkFaint} align="center">
          아이디어 · {f.credits.join(', ')}
        </AppText>
      ) : null}
    </Screen>
  );
}
