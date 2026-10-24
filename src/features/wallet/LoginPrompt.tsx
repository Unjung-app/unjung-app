import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { Logo } from '@/components/Logo';
import { color } from '@/theme/tokens';

/** 로그인이 필요한 화면에 로그인하지 않고 들어왔을 때 */
export function LoginPrompt({ what }: { what: string }) {
  const router = useRouter();
  return (
    <Screen topInset={false}>
      <Card tone="navy">
        <Logo variant="mark-dark" size={40} />
        <AppText variant="heading" color={color.onNavy} style={{ fontSize: 20, lineHeight: 28 }}>
          {what}은(는) 학교 계정으로{'\n'}로그인하면 쓸 수 있어요
        </AppText>
        <Button label="로그인하기" variant="soft" style={{ backgroundColor: color.surface }} onPress={() => router.push('/login')} />
      </Card>
    </Screen>
  );
}
