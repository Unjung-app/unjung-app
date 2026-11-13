import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProfileCard } from '@/components/NameTag';
import { AppText } from '@/components/ui/AppText';
import { Button, Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { GAMES } from '@/features/games/catalog';
import { hm } from '@/features/study/api';
import { LoginPrompt } from '@/features/wallet/LoginPrompt';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/auth';
import { useWallet, type Equip } from '@/state/wallet';
import { color, radius, space } from '@/theme/tokens';

type PublicProfile = {
  nickname: string;
  mine: boolean;
  grade: number | null;
  equip: Partial<Equip>;
  streak: { current: number; best: number } | null;
  study_week_seconds: number;
  study_total_seconds: number;
  study_days: number;
  games: { game: string; best: number; week_best: number | null }[];
  badges: string[];
};

const OLD_GAMES: Record<string, string> = { word: '🔤 영단어', math: '➗ 수학', life: '🌱 생활' };
const gameName = (id: string) => (GAMES[id] ? `${GAMES[id].emoji} ${GAMES[id].title}` : OLD_GAMES[id] ?? id);

/** 다른 학생 프로필(닉네임으로): 꾸미기 · 출석 · 공부 · 게임 기록. 실명·반은 보이지 않는다. 학생 의견 #24 #34 */
export function ProfileScreen() {
  const router = useRouter();
  const { nickname } = useLocalSearchParams<{ nickname: string }>();
  const { status } = useAuth();
  const { itemById } = useWallet();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (status !== 'ready' || !nickname) return;
    const { data: d, error: e } = await supabase.rpc('public_profile', { p_nickname: String(nickname) });
    if (e) setError(/[가-힣]/.test(e.message) ? e.message : '잠시 뒤 다시 시도해 주세요.');
    else {
      setError(null);
      setData(d as PublicProfile);
    }
  }, [nickname, status]);
  useEffect(() => {
    load();
  }, [load]);

  if (status === 'signedOut') return <LoginPrompt what="프로필 보기" />;
  if (error) {
    return (
      <Screen topInset={false}>
        <Card>
          <AppText variant="body" color={color.inkMuted}>
            {error} 랭킹 숨김을 켠 학생의 프로필은 볼 수 없어요.
          </AppText>
        </Card>
        <Button label="돌아가기" variant="soft" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen topInset={false}>
        <AppText variant="body" color={color.inkMuted}>
          불러오는 중…
        </AppText>
      </Screen>
    );
  }

  return (
    <Screen topInset={false} onRefresh={load}>
      <ProfileCard nickname={data.nickname} equip={data.equip} itemById={itemById} caption={`${data.grade ? `${data.grade}학년` : '운중고'}${data.mine ? ' · 내 프로필' : ''}`} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat label="연속 출석" value={`${data.streak?.current ?? 0}일`} sub={`최고 ${data.streak?.best ?? 0}일`} />
        <Stat label="이번 주 공부" value={hm(data.study_week_seconds)} sub={`누적 ${hm(data.study_total_seconds)}`} />
        <Stat label="30분 넘게 공부한 날" value={`${data.study_days}일`} />
      </View>

      <SectionTitle title="게임 기록" />
      <Card style={{ gap: space.sm }}>
        {data.games.length ? (
          data.games.map((g) => (
            <View key={g.game} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32 }}>
              <AppText variant="body" style={{ flex: 1 }} numberOfLines={1}>
                {gameName(g.game)}
              </AppText>
              <AppText variant="caption" color={color.inkFaint}>
                이번 주 {g.week_best ?? '-'}
              </AppText>
              <AppText variant="bodyStrong" style={{ minWidth: 64, textAlign: 'right' }}>
                최고 {g.best}
              </AppText>
            </View>
          ))
        ) : (
          <AppText variant="body" color={color.inkMuted}>
            아직 게임 기록이 없어요.
          </AppText>
        )}
      </Card>

      {data.badges.length ? (
        <>
          <SectionTitle title="모은 배지" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {data.badges.map((b) => (
              <View key={b} style={{ backgroundColor: color.navy, borderRadius: radius.round, paddingHorizontal: 12, paddingVertical: 4 }}>
                <AppText variant="caption" weight="semibold" color={color.accent}>
                  {b}
                </AppText>
              </View>
            ))}
          </View>
        </>
      ) : null}
      {data.mine ? (
        <AppText variant="caption" color={color.inkMuted} align="center">
          다른 학생에게 이렇게 보여요. 숨기려면 닉네임 설정에서 '랭킹에서 닉네임 숨기기'를 켜 주세요.
        </AppText>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: color.surface, borderRadius: radius.card, padding: space.md, gap: 2 }}>
      <AppText variant="caption" color={color.inkMuted}>
        {label}
      </AppText>
      <AppText variant="heading">{value}</AppText>
      {sub ? (
        <AppText variant="caption" color={color.inkFaint}>
          {sub}
        </AppText>
      ) : null}
    </View>
  );
}
