import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PrefsProvider, usePrefs } from '@/state/prefs';
import { injectWebFont, NATIVE_FONTS, fontStyle } from '@/theme/fonts';
import { color } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});
injectWebFont();

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
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PrefsProvider>
        <Root />
      </PrefsProvider>
    </SafeAreaProvider>
  );
}
