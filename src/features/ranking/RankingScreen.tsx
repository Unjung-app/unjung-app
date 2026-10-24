import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { NameTag } from '@/components/NameTag';
import { useNow, useOpenFeature } from '@/features/hooks';
import { durationLabel, useStudyLive } from '@/features/study/session';
import { addDays, appHidden, mondayOf, parseYmd, ymdToIso } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/auth';
import { usePrefs } from '@/state/prefs';
import { useWallet, type Equip } from '@/state/wallet';
import { color, radius, space } from '@/theme/tokens';

type Kind = 'study' | 'tokens';
type ClassRow = { class_no: number; members: number; total: number; avg: number; eligible: boolean; rank: number | null; mine: boolean };
type TopRow = { rank: number; score: number; mine: boolean; nickname: string | null; hidden: boolean; equip: Partial<Equip> | null };
type Ranking = {
  week_start: string;
  week_end: string;
  classes: ClassRow[];
  top: TopRow[];
  me: { score: number; rank: number | null; of: number } | null;
  participants: number;
};

const MEDAL = ['🥇', '🥈', '🥉'];

function scoreLabel(kind: Kind, v: number) {
  return kind === 'study' ? durationLabel(v) : `${v.toLocaleString()}개`;
}

function useRanking(kind: Kind, grade: number, weekStart: string, enabled: boolean) {
  const [data, setData] = useState<Ranking | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const { data: d } = await supabase.rpc('ranking', { p_kind: kind, p_grade: grade, p_week_start: weekStart });
    setLoading(false);
    if (d) setData(d as Ranking);
  }, [kind, grade, weekStart, enabled]);
  useEffect(() => {
    setData(null);
    load();
    const t = setInterval(() => !appHidden() && load(), 60_000); // 1분마다 새로고침(앱이 뒤에 있으면 건너뜀)
    return () => clearInterval(t);
  }, [load]);
  return { data, loading, reload: load };
}

export function RankingScreen({ inStack = false }: { inStack?: boolean }) {
  const router = useRouter();
  const now = useNow();
  const openFeature = useOpenFeature();
  const { status, enrollment } = useAuth();
  const { myClass } = usePrefs();
  const { itemById } = useWallet();
  const ready = status === 'ready';
  const [kind, setKind] = useState<Kind>('study');
  const [grade, setGrade] = useState<number>(enrollment?.grade ?? myClass?.grade ?? 2);
  const [week, setWeek] = useState<0 | -1>(0);
  const weekStart = ymdToIso(addDays(mondayOf(now.ymd), week * 7));
  const { data, loading, reload } = useRanking(kind, grade, weekStart, ready);
  const live = useStudyLive(ready && kind === 'study');

  useEffect(() => {
    if (enrollment?.grade) setGrade(enrollment.grade);
  }, [enrollment?.grade]);

  if (!ready) {
    return (
      <Screen topInset={!inStack}>
        {!inStack ? (
          <AppText variant="title" accessibilityRole="header">
            랭킹
          </AppText>
        ) : null}
        <Card tone="navy">
          <AppText variant="heading" color={color.onNavy} style={{ fontSize: 20, lineHeight: 28 }}>
            학교 계정으로 로그인하면{'\n'}반 대항 랭킹을 볼 수 있어요
          </AppText>
          <Button
            label={status === 'needsEnrollment' ? '학번 등록하기' : '로그인하기'}
            variant="soft"
            style={{ backgroundColor: color.surface }}
            onPress={() => router.push(status === 'needsEnrollment' ? '/onboarding' : '/login')}
          />
        </Card>
      </Screen>
    );
  }

  const eligible = data?.classes.filter((c) => c.eligible) ?? [];
  const maxAvg = Math.max(1, ...eligible.map((c) => c.avg));
  const ws = parseYmd(weekStart.replace(/-/g, ''));
  const we = parseYmd(addDays(weekStart.replace(/-/g, ''), 6));
  const myGrade = enrollment?.grade === grade;

  return (
    <Screen topInset={!inStack} refreshing={loading && !!data} onRefresh={reload}>
      {!inStack ? (
        <AppText variant="title" accessibilityRole="header">
          랭킹
        </AppText>
      ) : null}

      <Segmented
        label="랭킹 종류"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'study', label: '공부 시간' },
          { value: 'tokens', label: '토큰' },
        ]}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {[1, 2, 3].map((g) => (
          <Pressable
            key={g}
            accessibilityRole="radio"
            accessibilityState={{ checked: grade === g }}
            onPress={() => setGrade(g)}
            style={{ minHeight: 44, minWidth: 64, paddingHorizontal: space.md, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center', backgroundColor: grade === g ? color.navy : color.surface }}>
            <AppText variant="label" color={grade === g ? color.onNavy : color.ink}>
              {g}학년
            </AppText>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable accessibilityRole="button" onPress={() => setWeek(week === 0 ? -1 : 0)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm }}>
          <AppText variant="label" color={color.navy}>
            {week === 0 ? '이번 주 ▾' : '지난주 ▾'}
          </AppText>
        </Pressable>
      </View>
      <AppText variant="caption" color={color.inkMuted}>
        {ws.m}/{ws.d} ~ {we.m}/{we.d} · {kind === 'study' ? '집중 모드 공부 시간(수업 시간 제외)' : '이번 주에 받은 토큰(쓴 것은 빼지 않음)'} · 1분마다 새로고침
      </AppText>

      {kind === 'study' && week === 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`지금 ${live?.all ?? 0}명 집중 중. 공부 타이머 열기`}
          onPress={() => openFeature('study')}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: pressed ? color.navyRaised : color.navy, borderRadius: radius.card, padding: space.lg })}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: live?.all ? color.liveOnNavy : color.navyDone }} />
          <AppText variant="bodyStrong" color={color.onNavy} style={{ flex: 1 }}>
            지금 {live?.all ?? 0}명 집중 중{live && grade ? ` · ${grade}학년 ${live[`g${grade}` as 'g1'] ?? 0}명` : ''}
          </AppText>
          <AppText variant="label" color={color.accent}>
            나도 시작 ›
          </AppText>
        </Pressable>
      ) : null}

      {/* 내 순위 */}
      {myGrade && data?.me ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="label" weight="regular" color={color.inkMuted}>
              내 순위 (나만 보여요)
            </AppText>
            <AppText variant="title">{data.me.rank ? `${data.me.rank}위` : '아직 기록 없음'}</AppText>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <AppText variant="bodyStrong">{scoreLabel(kind, data.me.score)}</AppText>
            <AppText variant="caption" color={color.inkMuted}>
              {grade}학년 {data.participants}명 참여
            </AppText>
          </View>
        </Card>
      ) : null}

      {/* 반 대항 */}
      <AppText variant="heading" style={{ marginTop: space.sm }}>
        반 대항 · {grade}학년
      </AppText>
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, padding: space.lg, gap: space.md }}>
        {data === null ? (
          <AppText variant="body" color={color.inkMuted}>
            불러오는 중…
          </AppText>
        ) : (
          data.classes.map((c) => (
            <View
              key={c.class_no}
              accessible
              accessibilityLabel={`${c.class_no}반 ${c.eligible ? `${c.rank}위, 1인 평균 ${scoreLabel(kind, c.avg)}` : '참여 인원 부족'}${c.mine ? ', 우리 반' : ''}`}
              style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <AppText variant="bodyStrong" style={{ width: 34 }} color={c.eligible ? color.ink : color.inkFaint}>
                  {c.eligible ? (c.rank && c.rank <= 3 ? MEDAL[c.rank - 1] : `${c.rank}`) : '–'}
                </AppText>
                <AppText variant="bodyStrong" color={c.eligible ? color.ink : color.inkFaint}>
                  {c.class_no}반
                </AppText>
                {c.mine ? <Badge label="우리 반" /> : null}
                <View style={{ flex: 1 }} />
                <AppText variant="label" color={c.eligible ? color.ink : color.inkFaint}>
                  {c.eligible ? `평균 ${scoreLabel(kind, c.avg)}` : `참여 인원 부족 (${c.members}/5명)`}
                </AppText>
              </View>
              {c.eligible ? (
                <View style={{ height: 8, borderRadius: 4, backgroundColor: color.surfaceMuted, marginLeft: 34, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.max(3, (c.avg / maxAvg) * 100)}%`, height: 8, borderRadius: 4, backgroundColor: c.mine ? color.accent : color.navy }} />
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
      <AppText variant="caption" color={color.inkFaint}>
        반 점수 = 반 합계 ÷ 앱에 학번을 등록한 학생 수. 등록 학생이 5명 이상인 반부터 순위에 들어가요.
      </AppText>

      {/* 개인 TOP 10 */}
      <AppText variant="heading" style={{ marginTop: space.sm }}>
        개인 TOP 10 · {grade}학년
      </AppText>
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        {data && data.top.length === 0 ? (
          <AppText variant="body" color={color.inkMuted} style={{ padding: space.lg }}>
            {week === 0 ? '이번 주 첫 기록의 주인공이 되어 보세요!' : '지난주 기록이 없어요'}
          </AppText>
        ) : (
          (data?.top ?? []).map((t, i) => (
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
                <NameTag nickname={t.hidden ? null : t.nickname} equip={t.equip ?? {}} itemById={itemById} fallback={`익명의 ${grade}학년${t.mine ? ' (나)' : ''}`} />
              </View>
              <AppText variant="label">{scoreLabel(kind, t.score)}</AppText>
            </View>
          ))
        )}
      </View>
      <AppText variant="caption" color={color.inkFaint}>
        11위 아래는 다른 학생에게 보이지 않아요. 닉네임을 숨기려면 전체 → 닉네임에서 '랭킹에서 닉네임 숨기기'를 켜세요.
      </AppText>
    </Screen>
  );
}
