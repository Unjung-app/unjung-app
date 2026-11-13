import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { color } from '@/theme/tokens';

/** 선생님 계정으로 학생 전용 기능(공부 시간·게임·토큰·반 게시판)에 들어왔을 때 */
export function StudentOnly({ what, topInset = false }: { what: string; topInset?: boolean }) {
  const router = useRouter();
  return (
    <Screen topInset={topInset}>
      <Card tone="navy">
        <AppText variant="label" color={color.onNavyMuted}>
          {what}
        </AppText>
        <AppText variant="heading" color={color.onNavy} style={{ fontSize: 20, lineHeight: 28 }}>
          {'학생 전용 기능이에요\n선생님 계정에서는 쓰지 않아요'}
        </AppText>
        <AppText variant="body" color={color.onNavyMuted}>
          학생 순위·토큰에 섞이지 않도록 나눠 두었어요. 관리 기능은 전체 탭의 '내 부서 도구'에 있어요.
        </AppText>
        <Button label="전체 탭으로" variant="soft" style={{ backgroundColor: color.surface }} onPress={() => router.replace('/more')} />
      </Card>
    </Screen>
  );
}
