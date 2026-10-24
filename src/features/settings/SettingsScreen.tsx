import Constants from 'expo-constants';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Divider, ListRow } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { classLabel } from '@/features/hooks';
import { usePrefs } from '@/state/prefs';
import { color, radius, space } from '@/theme/tokens';

export function SettingsScreen() {
  const router = useRouter();
  const { myClass } = usePrefs();
  return (
    <Screen topInset={false}>
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        <ListRow icon="pin" title="내 반" subtitle={classLabel(myClass)} onPress={() => router.push('/settings/class')} />
        <Divider />
        <ListRow icon="more" title="하단 탭" subtitle="자주 쓰는 기능 고르기" onPress={() => router.push('/settings/tabs')} />
        <Divider />
        <ListRow icon="plus" title="홈 화면에 추가" subtitle="설치 방법 보기" onPress={() => router.push('/settings/install')} />
      </View>
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        <ListRow icon="info" title="앱 버전" right={<AppText variant="label" color={color.inkMuted}>{Constants.expoConfig?.version ?? '-'}</AppText>} />
      </View>
      <AppText variant="caption" color={color.inkFaint} style={{ paddingHorizontal: space.sm }}>
        학교 계정 로그인은 다음 업데이트에서 열려요.
      </AppText>
    </Screen>
  );
}
