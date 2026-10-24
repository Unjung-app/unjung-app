import { useEffect } from 'react';
import { Linking, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/primitives';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/state/auth';
import { useInstall } from '@/features/install/useInstall';
import { color, MAX_APP_WIDTH, radius, space } from '@/theme/tokens';

export function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status, signIn, notice } = useAuth();
  const { env, openExternal, openInChrome } = useInstall();
  // 카카오톡·인스타그램 등 앱 안 브라우저에서는 구글이 로그인을 막는다(403 disallowed_useragent)
  const inapp = env.kind === 'inapp' ? env : null;

  // 로그인이 끝나면 알아서 다음 화면으로
  useEffect(() => {
    if (status === 'ready') router.replace('/');
    if (status === 'needsEnrollment') router.replace('/onboarding');
  }, [status, router]);

  return (
    <View style={{ flex: 1, backgroundColor: color.navy, paddingTop: insets.top, paddingBottom: insets.bottom + space.xl }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: MAX_APP_WIDTH,
          alignSelf: 'center',
          paddingHorizontal: space.xxl,
          justifyContent: 'center',
          gap: space.lg,
        }}>
        <Logo variant="mark-dark" size={88} />
        <AppText variant="display" color={color.onNavy} accessibilityRole="header">
          운중고{'\n'}스마트 캠퍼스
        </AppText>
        <AppText variant="body" color={color.onNavySub}>
          학생이 만들고 학생이 운영하는 우리 학교 앱
        </AppText>
      </View>

      <View style={{ width: '100%', maxWidth: MAX_APP_WIDTH, alignSelf: 'center', paddingHorizontal: space.xxl, gap: space.md }}>
        {notice ? (
          <View style={{ backgroundColor: color.dangerSoft, borderRadius: radius.control, padding: space.md }}>
            <AppText variant="label" weight="regular" color={color.danger}>
              {notice}
            </AppText>
          </View>
        ) : null}
        {inapp ? (
          <View style={{ backgroundColor: color.accentSoft, borderRadius: radius.control, padding: space.md, gap: space.sm }}>
            <AppText variant="label" color={color.accentInk}>
              {inapp.isKakao ? '카카오톡' : '이 앱'} 안에서는 구글 로그인이 막혀 있어요
            </AppText>
            <AppText variant="caption" color={color.accentInk}>
              {inapp.isKakao || inapp.isAndroid
                ? '아래 버튼으로 크롬·사파리 같은 기본 브라우저에서 열어 주세요.'
                : '오른쪽 위 ··· 또는 공유 버튼 → "Safari로 열기"를 눌러 주세요.'}
            </AppText>
            {inapp.isKakao || inapp.isAndroid ? (
              <Button label="기본 브라우저로 열기" icon="external" onPress={inapp.isKakao ? openExternal : openInChrome} />
            ) : null}
          </View>
        ) : null}
        <Button
          label="학교 Google 계정으로 로그인"
          variant={inapp ? 'ghostOnNavy' : 'soft'}
          onPress={signIn}
          disabled={status === 'loading'}
          style={inapp ? { minHeight: 52 } : { backgroundColor: color.surface, minHeight: 52 }}
        />
        <AppText variant="caption" color={color.onNavyMuted} align="center">
          @unjung.hs.kr 계정만 사용할 수 있어요 · 로그인하면{' '}
          <AppText
            variant="caption"
            color={color.onNavy}
            style={{ textDecorationLine: 'underline' }}
            accessibilityRole="link"
            onPress={() => Linking.openURL('/privacy.html').catch(() => {})}>
            개인정보 처리방침
          </AppText>
          에 동의하게 돼요
        </AppText>
        <Button
          label="로그인 없이 둘러보기"
          variant="ghostOnNavy"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={{ minHeight: 44 }}
        />
      </View>
    </View>
  );
}
