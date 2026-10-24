import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button, Divider, ListRow } from '@/components/ui/primitives';
import { Logo } from '@/components/Logo';
import { CONTACT_EMAIL } from '@/lib/supabase';
import { useAuth } from '@/state/auth';
import { color, radius, space } from '@/theme/tokens';

const ROLE_LABEL = { student: '학생', reviewer: '검토위원', admin: '관리자' } as const;

/** 전체·설정 화면 맨 위의 계정 카드 */
export function AccountCard() {
  const router = useRouter();
  const { status, email, enrollment, role, signOut } = useAuth();

  if (status === 'signedOut' || status === 'loading') {
    return (
      <View style={{ backgroundColor: color.navy, borderRadius: radius.card, padding: space.xl, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Logo variant="mark-dark" size={36} />
          <AppText variant="heading" color={color.onNavy} style={{ flex: 1 }}>
            학교 계정으로 로그인하면 공지·한줄평·토큰을 쓸 수 있어요
          </AppText>
        </View>
        <Button label="로그인하기" variant="soft" style={{ backgroundColor: color.surface }} onPress={() => router.push('/login')} />
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
      <View style={{ padding: space.lg, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <AppText variant="heading">{enrollment?.name ?? '학번 등록 필요'}</AppText>
          {role !== 'student' ? (
            <View style={{ backgroundColor: color.accentSoft, borderRadius: radius.round, paddingHorizontal: 8, paddingVertical: 2 }}>
              <AppText variant="caption" weight="semibold" color={color.accentInk}>
                {ROLE_LABEL[role]}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="caption" color={color.inkMuted}>
          {enrollment ? `${enrollment.grade}학년 ${enrollment.class_no}반 ${enrollment.number}번 · ` : ''}
          {email}
        </AppText>
      </View>
      {status === 'needsEnrollment' ? (
        <>
          <Divider />
          <ListRow icon="pin" title="학번·이름 등록하기" onPress={() => router.push('/onboarding')} />
        </>
      ) : null}
      <Divider />
      <ListRow icon="close" title="로그아웃" onPress={signOut} right={<View />} />
      {enrollment ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
          <AppText variant="caption" color={color.inkFaint}>
            학번·이름이 틀렸다면 {CONTACT_EMAIL} 으로 연락해 주세요.
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
