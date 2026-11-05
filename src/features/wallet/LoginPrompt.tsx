import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/state/auth';
import { color } from '@/theme/tokens';

/** 로그인(또는 학번 등록)이 필요한 화면에 그냥 들어왔을 때 */
export function LoginPrompt({ what }: { what: string }) {
  const router = useRouter();
  const { status } = useAuth();
  const enroll = status === 'needsEnrollment';
  return (
    <Screen topInset={false}>
      <Card tone="navy">
        <Logo variant="mark-dark" size={40} />
        <AppText variant="label" color={color.onNavyMuted}>
          {what}
        </AppText>
        <AppText variant="heading" color={color.onNavy} style={{ fontSize: 20, lineHeight: 28 }}>
          {enroll ? '학번을 등록하면\n바로 쓸 수 있어요' : '학교 계정으로 로그인하면\n바로 쓸 수 있어요'}
        </AppText>
        <Button
          label={enroll ? '학번 등록하기' : '로그인하기'}
          variant="soft"
          style={{ backgroundColor: color.surface }}
          onPress={() => router.push(enroll ? '/onboarding' : '/login')}
        />
      </Card>
    </Screen>
  );
}
