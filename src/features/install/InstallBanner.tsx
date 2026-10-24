import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { color, radius, space } from '@/theme/tokens';
import { needsInstall, useInstall } from './useInstall';

const KEY = 'unjung.install.dismissedAt';
const SNOOZE_MS = 7 * 24 * 3600 * 1000;

/** '오늘' 화면 위의 설치 권유. 닫으면 7일 동안 안 보인다. */
export function InstallBanner() {
  const router = useRouter();
  const { env } = useInstall();
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => setHidden(!!v && Date.now() - Number(v) < SNOOZE_MS))
      .catch(() => setHidden(false));
  }, []);

  if (hidden || !needsInstall(env)) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        backgroundColor: color.surface,
        borderRadius: radius.card,
        paddingLeft: space.lg,
        borderWidth: 1,
        borderColor: color.line,
      }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/settings/install')}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md }}>
        <Icon name="plus" size={22} color={color.navy} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">홈 화면에 추가하기</AppText>
          <AppText variant="caption" color={color.inkMuted}>
            {env.kind === 'inapp' ? '카톡 등 앱 안에서는 설치가 안 돼요 · 방법 보기' : '앱처럼 바로 열고 알림도 받아요'}
          </AppText>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="설치 안내 닫기"
        onPress={() => {
          setHidden(true);
          AsyncStorage.setItem(KEY, String(Date.now())).catch(() => {});
        }}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="close" size={18} color={color.inkFaint} />
      </Pressable>
    </View>
  );
}
