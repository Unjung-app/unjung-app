import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PrefsProvider, usePrefs } from '@/state/prefs';
import { AuthProvider, useAuth } from '@/state/auth';
import { WalletProvider } from '@/state/wallet';
import { TokenToast } from '@/components/TokenToast';
import { injectWebFont, NATIVE_FONTS, fontStyle } from '@/theme/fonts';
import { color } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});
injectWebFont();

/** 학교 계정으로 로그인했는데 학번이 없으면 등록 화면으로 보낸다 */
function AuthGate() {
  const { status } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (status === 'needsEnrollment' && pathname !== '/onboarding') router.replace('/onboarding');
  }, [status, pathname, router]);
  return null;
}

/** 학교 데이터(시간표·급식·학사일정) 동기화를 한 번 깨운다. 서버가 6시간에 한 번만 실제로 돈다. */
function useWakeSchoolSync() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    fetch('/api/cron/sync-school').catch(() => {});
  }, []);
}

function Root() {
  useWakeSchoolSync();
  const [fontsLoaded, fontError] = useFonts(Platform.OS === 'web' ? {} : NATIVE_FONTS);
  const { loaded: prefsLoaded } = usePrefs();
  const ready = (fontsLoaded || !!fontError) && prefsLoaded;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: color.navy }} />;

  return (
    <>
      <StatusBar style="dark" />
      <AuthGate />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: color.bg },
          headerTintColor: color.navy,
          headerTitleStyle: { ...fontStyle('bold'), fontSize: 17, color: color.ink },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: color.bg },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="feature/[id]" options={{ title: '' }} />
        <Stack.Screen name="settings/index" options={{ title: '설정' }} />
        <Stack.Screen name="settings/tabs" options={{ title: '하단 탭 설정' }} />
        <Stack.Screen name="settings/class" options={{ title: '내 반 설정' }} />
        <Stack.Screen name="settings/install" options={{ title: '홈 화면에 추가' }} />
        <Stack.Screen name="settings/nickname" options={{ title: '닉네임' }} />
        <Stack.Screen name="wallet" options={{ title: '토큰·출석' }} />
        <Stack.Screen name="shop" options={{ title: '꾸미기 상점' }} />
        <Stack.Screen name="feedback" options={{ title: '의견 보내기' }} />
        <Stack.Screen name="admin/feedback" options={{ title: '의견 관리 (관리자)' }} />
        <Stack.Screen name="game/[id]" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="login" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
      <TokenToast />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PrefsProvider>
        <AuthProvider>
          <WalletProvider>
            <Root />
          </WalletProvider>
        </AuthProvider>
      </PrefsProvider>
    </SafeAreaProvider>
  );
}
