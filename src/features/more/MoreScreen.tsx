import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Badge, Divider, ListRow } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { AccountCard } from '@/features/auth/AccountCard';
import { classLabel, useOpenFeature } from '@/features/hooks';
import { DEV_TEAM, DEV_TEAM_NAME, FEATURES } from '@/features/registry';
import { useAuth } from '@/state/auth';
import { usePrefs } from '@/state/prefs';
import { useWallet } from '@/state/wallet';
import { color, radius, space } from '@/theme/tokens';

export function MoreScreen() {
  const router = useRouter();
  const openFeature = useOpenFeature();
  const { myClass } = usePrefs();
  const { status, role } = useAuth();
  const { wallet } = useWallet();
  const signedIn = status === 'ready' || status === 'needsEnrollment';
  const live = FEATURES.filter((f) => f.status === 'live');
  const soon = FEATURES.filter((f) => f.status === 'soon');

  const group = (children: React.ReactNode) => (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>{children}</View>
  );

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        전체
      </AppText>

      <AccountCard />

      {signedIn
        ? group(
            <>
              <ListRow
                icon="coin"
                title="토큰·출석"
                subtitle={wallet ? `🪙 ${wallet.balance} · 🔥 ${wallet.streak}일 연속` : '불러오는 중'}
                onPress={() => router.push('/wallet')}
              />
              <Divider />
              <ListRow icon="bag" title="꾸미기 상점" subtitle="이모지·닉네임 색·프로필 테마" onPress={() => router.push('/shop')} />
              <Divider />
              <ListRow
                icon="user"
                title="닉네임"
                subtitle={wallet?.nickname ?? '아직 없어요 · 랭킹에 쓰일 이름'}
                onPress={() => router.push('/settings/nickname')}
              />
            </>,
          )
        : null}

      {group(
        <>
          <ListRow icon="pin" title={classLabel(myClass)} subtitle="내 반 설정" onPress={() => router.push('/settings/class')} />
          <Divider />
          <ListRow icon="settings" title="하단 탭 설정" subtitle="자주 쓰는 기능을 아래 탭에 고정해요" onPress={() => router.push('/settings/tabs')} />
          <Divider />
          <ListRow icon="plus" title="홈 화면에 추가" subtitle="앱처럼 바로 열고 알림 받기" onPress={() => router.push('/settings/install')} />
        </>,
      )}

      {group(
        <>
          <ListRow icon="voice" title="의견 보내기" subtitle="버그 제보·개선 요청 · 반영되면 +5 토큰" onPress={() => router.push('/feedback?from=전체')} />
          {role !== 'student' && signedIn ? (
            <>
              <Divider />
              <ListRow icon="check" title="검토하기" subtitle="공지 승인·신고 처리·분실물 사진 (검토위원)" onPress={() => router.push('/review')} />
            </>
          ) : null}
          {role === 'admin' ? (
            <>
              <Divider />
              <ListRow icon="user" title="검토위원 관리" subtitle="학번으로 검토위원 임명·해제 (관리자)" onPress={() => router.push('/admin/staff')} />
              <Divider />
              <ListRow icon="settings" title="의견 관리" subtitle="관리자 전용" onPress={() => router.push('/admin/feedback')} />
            </>
          ) : null}
        </>,
      )}

      <AppText variant="heading" style={{ marginTop: space.sm }}>
        기능
      </AppText>
      {group(
        live.map((f, i) => (
          <View key={f.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow icon={f.icon} title={f.title} subtitle={f.desc} onPress={() => openFeature(f.id)} />
          </View>
        )),
      )}

      <AppText variant="heading" style={{ marginTop: space.sm }}>
        준비 중
      </AppText>
      {group(
        soon.map((f, i) => (
          <View key={f.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              icon={f.icon}
              title={f.title}
              subtitle={f.desc}
              onPress={() => openFeature(f.id)}
              right={<Badge label="준비 중" tone="muted" />}
            />
          </View>
        )),
      )}

      <View style={{ marginTop: space.xl, gap: 4, alignItems: 'center' }}>
        <AppText variant="caption" color={color.inkMuted} align="center">
          {DEV_TEAM_NAME}
        </AppText>
        <AppText variant="caption" color={color.inkFaint} align="center">
          만든 사람들: {DEV_TEAM.join(', ')}
        </AppText>
      </View>
    </Screen>
  );
}
