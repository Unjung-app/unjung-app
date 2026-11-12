import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/state/auth';
import { color } from '@/theme/tokens';
import { TeacherForm } from './TeacherForm';

/** 설정 → 선생님 정보 고치기 */
export function TeacherSettingsScreen() {
  const router = useRouter();
  const { teacherInfo } = useAuth();
  if (!teacherInfo) {
    return (
      <Screen topInset={false}>
        <AppText variant="body" color={color.inkMuted}>
          선생님 계정에서만 쓰는 화면이에요.
        </AppText>
      </Screen>
    );
  }
  return (
    <Screen topInset={false}>
      <TeacherForm initial={teacherInfo} onSaved={() => (router.canGoBack() ? router.back() : router.replace('/more'))} />
    </Screen>
  );
}
