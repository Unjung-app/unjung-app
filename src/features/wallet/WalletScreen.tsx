import { useCallback, useEffect, useState } from 'react';
import { REWARD } from '@/lib/rewards';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button, Card, Divider } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { ProfileCard } from '@/components/NameTag';
import { LoginPrompt } from '@/features/wallet/LoginPrompt';
import { stampLabel } from '@/lib/date';
import { useAuth } from '@/state/auth';
import { ledgerLabel, useWallet, type LedgerRow } from '@/state/wallet';
import { color, radius, space } from '@/theme/tokens';

/** 토큰 받는 법 (값은 lib/rewards.ts = 서버와 같은 표) */
const EARN: { what: string; amount: string; limit: string }[] = [
  { what: '출석 (하루 첫 실행)', amount: `+${REWARD.checkIn}`, limit: '하루 1번 · 주말도 받아요' },
  { what: '연속 출석 7일 · 30일마다', amount: `+${REWARD.streak7}·${REWARD.streak30}`, limit: '학교 가는 날 기준' },
  { what: '급식 한줄평 (10자 이상)', amount: `+${REWARD.mealReview}`, limit: '하루 1번' },
  { what: '내 한줄평이 공감 받음', amount: `+${REWARD.mealLike}`, limit: `하루 최대 ${REWARD.mealLikeDailyCap}` },
  { what: '집중 모드 공부', amount: '+1', limit: `처음 2시간 10분마다, 그 뒤 15분마다 · 하루 최대 ${REWARD.studyDailyCap}` },
  { what: '게임 주간 최고 기록 경신', amount: `+${REWARD.gameBest}`, limit: '게임별 하루 1번 · 주간 1~3위는 30/20/10' },
  { what: '학생회 설문 참여', amount: `+${REWARD.survey}`, limit: '설문마다 1번' },
  { what: '수행평가·숙제 등록 (친구 2명 확인)', amount: `+${REWARD.taskConfirmed}`, limit: `하루 최대 ${REWARD.taskDailyCap}` },
  { what: '학생 공지 승인', amount: `+${REWARD.noticeApproved}`, limit: '하루 1건' },
  { what: '분실물 주인 찾아 줌', amount: `+${REWARD.lostFound}`, limit: '한 주 2번까지 · 같은 친구끼리는 30일에 1번' },
  { what: '보낸 의견이 반영됨', amount: `+${REWARD.feedbackDone}`, limit: '버그 제보·개선 제안' },
];


export function WalletScreen() {
  const router = useRouter();
  const { status, enrollment } = useAuth();
  const { wallet, itemById, refresh, loadLedger } = useWallet();
  const [ledger, setLedger] = useState<LedgerRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setRefreshing(true);
    const [, rows] = await Promise.all([refresh(), loadLedger()]);
    setLedger(rows);
    setRefreshing(false);
  }, [refresh, loadLedger]);

  useEffect(() => {
    if (status === 'ready' || status === 'needsEnrollment') reload();
  }, [status, reload]);

  if (status === 'signedOut') return <LoginPrompt what="토큰과 출석" />;

  return (
    <Screen topInset={false} refreshing={refreshing} onRefresh={reload}>
      <ProfileCard
        nickname={wallet?.nickname ?? null}
        equip={wallet?.equip ?? {}}
        itemById={itemById}
        caption={wallet?.nickname ? '다른 학생에게는 이렇게 보여요' : '닉네임을 정하면 랭킹에 이 이름으로 나와요'}
      />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="꾸미기 상점" icon="bag" style={{ flex: 1 }} onPress={() => router.push('/shop')} />
        <Button label={wallet?.nickname ? '닉네임 바꾸기' : '닉네임 정하기'} variant="soft" style={{ flex: 1 }} onPress={() => router.push('/settings/nickname')} />
      </View>

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Card tone="navy" style={{ flex: 1, gap: 4 }}>
          <AppText variant="label" color={color.onNavyMuted}>
            내 토큰
          </AppText>
          <AppText variant="display" color={color.onNavy} accessibilityLabel={`토큰 ${wallet?.balance ?? 0}개`}>
            🪙 {wallet?.balance ?? '–'}
          </AppText>
          <AppText variant="caption" color={color.onNavySub}>
            이번 주 +{wallet?.week_earned ?? 0}
          </AppText>
        </Card>
        <Card style={{ flex: 1, gap: 4 }}>
          <AppText variant="label" color={color.inkMuted}>
            연속 출석
          </AppText>
          <AppText variant="display" accessibilityLabel={`연속 출석 ${wallet?.streak ?? 0}일`}>
            🔥 {wallet?.streak ?? '–'}
          </AppText>
          <AppText variant="caption" color={color.inkMuted}>
            최고 {wallet?.best ?? 0}일 · 🛡️ {wallet?.shields ?? 0}/2
          </AppText>
        </Card>
      </View>
      <AppText variant="caption" color={color.inkMuted}>
        연속 출석은 학교 가는 날만 세요. 주말·방학·휴업일엔 쉬어도 끊기지 않고, 학교 가는 날을 빠지면 스트릭 보호권이 자동으로 쓰여요.
        {enrollment ? '' : ' 학번을 등록하면 랭킹에도 참여할 수 있어요.'}
      </AppText>

      <AppText variant="heading" style={{ marginTop: space.sm }}>
        토큰 받는 법
      </AppText>
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        {EARN.map((e, i) => (
          <View key={e.what}>
            {i > 0 ? <Divider /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 52 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="body">
                  {e.what}
                </AppText>
                {e.limit ? (
                  <AppText variant="caption" color={color.inkFaint}>
                    {e.limit}
                  </AppText>
                ) : null}
              </View>
              <AppText variant="bodyStrong" color={color.success} style={{ minWidth: 34, textAlign: 'right' }}>
                {e.amount}
              </AppText>
            </View>
          </View>
        ))}
      </View>

      <AppText variant="heading" style={{ marginTop: space.sm }}>
        최근 기록
      </AppText>
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        {ledger === null ? (
          <AppText variant="body" color={color.inkMuted} style={{ padding: space.lg }}>
            불러오는 중…
          </AppText>
        ) : ledger.length === 0 ? (
          <AppText variant="body" color={color.inkMuted} style={{ padding: space.lg }}>
            아직 기록이 없어요. 내일도 앱을 열면 출석 토큰을 받아요.
          </AppText>
        ) : (
          ledger.map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Divider /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="body">{ledgerLabel(r)}</AppText>
                  <AppText variant="caption" color={color.inkFaint}>
                    {stampLabel(r.created_at)}
                  </AppText>
                </View>
                <AppText variant="bodyStrong" color={r.delta > 0 ? color.success : color.danger}>
                  {r.delta > 0 ? `+${r.delta}` : r.delta}
                </AppText>
              </View>
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}
