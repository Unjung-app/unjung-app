import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PrefsProvider, usePrefs } from '@/state/prefs';
import { AuthProvider, useAuth } from '@/state/auth';
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

function Root() {
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
        <Stack.Screen name="login" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PrefsProvider>
        <AuthProvider>
          <Root />
        </AuthProvider>
      </PrefsProvider>
    </SafeAreaProvider>
  );
}
