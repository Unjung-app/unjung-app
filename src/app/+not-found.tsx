import { Link } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { color } from '@/theme/tokens';

export default function NotFound() {
  return (
    <Screen>
      <AppText variant="title">페이지를 찾을 수 없어요</AppText>
      <Link href="/">
        <AppText variant="bodyStrong" color={color.navy}>
          오늘 화면으로 가기 ›
        </AppText>
      </Link>
    </Screen>
  );
}
