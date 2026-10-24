import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/AppText';
import { color, MAX_APP_WIDTH, radius, space } from '@/theme/tokens';

import { BUILD_ID } from '@/lib/build';

// BUILD_ID: 이 화면이 만들어진 빌드 번호(배포할 때 git 커밋. 로컬 개발에서는 비어 있어 배너가 뜨지 않는다)
const CHECK_EVERY_MS = 30 * 60 * 1000;

/** 새 버전이 배포되면 화면 아래(탭 바 위)에 '새로고침' 배너를 띄운다(웹 앱 전용). 게임 중 등에는 ×로 미룰 수 있다. */
export function UpdateBanner() {
  const insets = useSafeAreaInsets();
  const [fresh, setFresh] = useState(false);
  const [later, setLater] = useState(false);

  const check = useCallback(async () => {
    if (Platform.OS !== 'web' || !BUILD_ID) return;
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (!res.ok) return;
      const { id } = (await res.json()) as { id: string | null };
      if (id && id !== BUILD_ID) setFresh(true);
    } catch {
      // 오프라인이면 다음에 다시
    }
  }, []);

  useEffect(() => {
    check();
    const t = setInterval(check, CHECK_EVERY_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [check]);

  if (!fresh || later) return null;

  const reload = async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
    } catch {
      // 서비스 워커가 없어도 새로고침은 된다
    }
    window.location.reload();
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + 76,
        alignItems: 'center',
        paddingHorizontal: space.lg,
      }}>
      <View
        style={{
          width: '100%',
          maxWidth: MAX_APP_WIDTH - space.lg * 2,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: radius.pill,
          backgroundColor: color.navy,
          borderWidth: 2,
          borderColor: color.accent,
          overflow: 'hidden',
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="새 버전이 나왔어요. 눌러서 새로고침"
          onPress={reload}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            minHeight: 52,
            paddingLeft: space.lg,
            backgroundColor: pressed ? color.navyRaised : color.navy,
          })}>
          <AppText style={{ fontSize: 20, lineHeight: 26 }}>✨</AppText>
          <AppText variant="bodyStrong" color={color.onNavy} style={{ flex: 1 }}>
            새 버전이 나왔어요
          </AppText>
          <AppText variant="label" color={color.accent}>
            새로고침
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="나중에 새로고침"
          onPress={() => setLater(true)}
          style={{
            width: 48,
            minHeight: 52,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <AppText variant="heading" color={color.onNavyMuted}>
            ×
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}
