import Constants from 'expo-constants';
import { Linking, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Divider, ListRow } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { AccountCard } from '@/features/auth/AccountCard';
import { classLabel } from '@/features/hooks';
import { useAuth } from '@/state/auth';
import { usePrefs } from '@/state/prefs';
import { useWallet } from '@/state/wallet';
import { color, radius, space } from '@/theme/tokens';

export function SettingsScreen() {
  const router = useRouter();
  const { myClass } = usePrefs();
  const { status } = useAuth();
  const { wallet } = useWallet();
  const signedIn = status === 'ready' || status === 'needsEnrollment';
  return (
    <Screen topInset={false}>
      <AccountCard />
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        {signedIn ? (
          <>
            <ListRow icon="user" title="닉네임" subtitle={wallet?.nickname ?? '아직 없어요'} onPress={() => router.push('/settings/nickname')} />
            <Divider />
          </>
        ) : null}
        <ListRow icon="pin" title="내 반" subtitle={classLabel(myClass)} onPress={() => router.push('/settings/class')} />
        <Divider />
        <ListRow icon="more" title="하단 탭" subtitle="자주 쓰는 기능 고르기" onPress={() => router.push('/settings/tabs')} />
        <Divider />
        <ListRow icon="plus" title="홈 화면에 추가" subtitle="설치 방법 보기" onPress={() => router.push('/settings/install')} />
      </View>
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        <ListRow icon="info" title="앱 버전" right={<AppText variant="label" color={color.inkMuted}>{Constants.expoConfig?.version ?? '-'}</AppText>} />
        <Divider />
        <ListRow icon="external" title="개인정보 처리방침" onPress={() => Linking.openURL('/privacy.html').catch(() => {})} />
      </View>
    </Screen>
  );
}
