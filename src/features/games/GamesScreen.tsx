import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { NameTag } from '@/components/NameTag';
import { useAuth } from '@/state/auth';
import { useWallet } from '@/state/wallet';
import { color, radius, space } from '@/theme/tokens';
import { GAME_IDS, GAMES, settleLastWeek, useGameRanking, useGameStatus, type GameId } from './data';

const MEDAL = ['🥇', '🥈', '🥉'];

/** 게임 모음: 학생이 만든 게임 목록 + 게임별 주간 랭킹 */
export function GamesScreen({ inStack = false }: { inStack?: boolean }) {
  const router = useRouter();
  const { status: auth } = useAuth();
  const { wallet, itemById, refresh } = useWallet();
  const ready = auth === 'ready';
  const { status, reload } = useGameStatus(ready);
  const [board, setBoard] = useState<GameId>(GAME_IDS[0]);
  const ranking = useGameRanking(board, ready);
  const settled = useRef(false);

  // 지난주 정산(한 번). 내가 1~3위였다면 지갑 알림으로 '+n 토큰'이 뜬다
  useEffect(() => {
    if (!ready || settled.current) return;
    settled.current = true;
    settleLastWeek().then(() => refresh('지난주 게임 랭킹 보상'));
  }, [ready, refresh]);

  // 게임을 하고 돌아오면 판 수·최고 기록·랭킹을 새로
  useFocusEffect(
    useCallback(() => {
      reload();
      ranking.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reload, ranking.reload]),
  );

  if (!ready) {
    return (
      <Screen topInset={!inStack}>
        {!inStack ? (
          <AppText variant="title" accessibilityRole="header">
            게임
          </AppText>
        ) : null}
        <Card tone="navy">
          <AppText variant="heading" color={color.onNavy} style={{ fontSize: 20, lineHeight: 28 }}>
            {auth === 'needsEnrollment' ? '학번을 등록하면\n게임을 할 수 있어요' : '학교 계정으로 로그인하면\n게임을 할 수 있어요'}
          </AppText>
          <Button
            label={auth === 'needsEnrollment' ? '학번 등록하기' : '로그인하기'}
            variant="soft"
            style={{ backgroundColor: color.surface }}
            onPress={() => router.push(auth === 'needsEnrollment' ? '/onboarding' : '/login')}
          />
        </Card>
      </Screen>
    );
  }

  const left = status ? status.max_plays - status.plays_today : null;
  const costLabel = !status ? '' : status.next_cost === null ? '오늘 10판을 다 했어요' : '무료! 잘할수록 토큰을 더 받아요';

  return (
    <Screen topInset={!inStack} onRefresh={() => (reload(), ranking.reload())}>
      {!inStack ? (
        <AppText variant="title" accessibilityRole="header">
          게임
        </AppText>
      ) : null}

      {status?.in_class ? (
        <Card tone="navy" style={{ gap: 4 }}>
          <AppText variant="heading" color={color.onNavy}>
            📚 지금은 수업 시간이에요
          </AppText>
          <AppText variant="caption" color={color.onNavySub}>
            게임은 쉬는 시간·점심시간·방과후에 열려요. 우리 반 시간표 기준이에요.
          </AppText>
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: color.surface, borderRadius: radius.card, padding: space.lg }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">{costLabel}</AppText>
            <AppText variant="caption" color={color.inkMuted}>
              오늘 {status?.plays_today ?? 0}/{status?.max_plays ?? 10}판 · 오늘 게임으로 받은 토큰 {status?.score_tokens_today ?? 0}/30 · 내 토큰 🪙 {wallet?.balance ?? 0}
            </AppText>
          </View>
        </View>
      )}

      {GAME_IDS.map((g) => {
        const m = GAMES[g];
        const best = status?.best?.[g];
        return (
          <Pressable
            key={g}
            accessibilityRole="button"
            accessibilityLabel={`${m.title}. ${m.desc}. 이번 주 내 최고 ${best ?? 0}점`}
            onPress={() => router.push(`/game/${g}`)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.lg,
              backgroundColor: pressed ? color.surfaceMuted : color.surface,
              borderRadius: radius.card,
              padding: space.lg,
              opacity: status?.in_class ? 0.6 : 1,
            })}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: color.navy, alignItems: 'center', justifyContent: 'center' }}>
              <AppText style={{ fontSize: 30, lineHeight: 36 }}>{m.emoji}</AppText>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppText variant="heading">{m.title}</AppText>
                <Badge label={m.tag} tone="muted" />
              </View>
              <AppText variant="caption" color={color.inkMuted}>
                {m.desc}
              </AppText>
              {m.by ? (
                <AppText variant="caption" color={color.inkFaint}>
                  만든 사람 {m.by}
                </AppText>
              ) : null}
              <AppText variant="caption" weight="semibold" color={color.navy}>
                이번 주 내 최고 {best ?? 0}점
              </AppText>
            </View>
          </Pressable>
        );
      })}

      <AppText variant="heading" style={{ marginTop: space.md }}>
        이번 주 게임 랭킹
      </AppText>
      <Segmented label="게임 선택" value={board} onChange={setBoard} options={GAME_IDS.map((g) => ({ value: g, label: GAMES[g].title.replace('운중고 ', '') }))} />
      {ranking.data?.me ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppText variant="label" weight="regular" color={color.inkMuted} style={{ flex: 1 }}>
            내 순위 (나만 보여요)
          </AppText>
          <AppText variant="heading">
            {ranking.data.me.rank}위 · {ranking.data.me.score}점
          </AppText>
        </Card>
      ) : null}
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        {ranking.data === null ? (
          <AppText variant="body" color={color.inkMuted} style={{ padding: space.lg }}>
            불러오는 중…
          </AppText>
        ) : ranking.data.top.length === 0 ? (
          <AppText variant="body" color={color.inkMuted} style={{ padding: space.lg }}>
            이번 주 첫 기록을 세워 보세요!
          </AppText>
        ) : (
          ranking.data.top.map((t, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                minHeight: 56,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: color.lineSoft,
                backgroundColor: t.mine ? color.accentSoft : color.surface,
              }}>
              <AppText variant="bodyStrong" style={{ width: 30 }}>
                {t.rank <= 3 ? MEDAL[t.rank - 1] : t.rank}
              </AppText>
              <View style={{ flex: 1 }}>
                <NameTag nickname={t.hidden ? null : t.nickname} equip={t.equip ?? {}} itemById={itemById} fallback={`익명의 ${t.grade}학년${t.mine ? ' (나)' : ''}`} />
              </View>
              <AppText variant="caption" color={color.inkMuted}>
                {t.grade}학년
              </AppText>
              <AppText variant="label" style={{ minWidth: 48, textAlign: 'right' }}>
                {t.score}점
              </AppText>
            </View>
          ))
        )}
      </View>
      <Card tone="muted" style={{ gap: 4 }}>
        <AppText variant="label">게임 규칙</AppText>
        <AppText variant="caption" color={color.inkMuted}>
          • 모든 게임 무료 · 하루 10판까지{'\n'}• 판마다 점수에 따라 1~5토큰: 그 게임의 이번 주 기록 중 상위일수록 많이 받아요 (게임 점수 보상은 하루 30토큰까지){'\n'}• 수업 시간(우리 반 시간표)에는 게임이 잠겨요{'\n'}• 이번 주 내 최고 기록을 넘기면 +2 토큰 (게임별 하루 1번){'\n'}• 매주 월요일, 게임별 학교 1~3위에게 +30/+20/+10 토큰, 1위는 '주간 게임왕 👑' 배지
        </AppText>
      </Card>
    </Screen>
  );
}
