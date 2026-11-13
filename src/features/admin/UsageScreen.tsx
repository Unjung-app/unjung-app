import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { supabase } from '@/lib/supabase';
import { useStaffAccess } from './access';
import { GAMES } from '@/features/games/catalog';
import { color, radius, space } from '@/theme/tokens';

type Usage = {
  today: string;
  accounts: number;
  enrolled: number;
  by_grade: Record<string, number>;
  new_today: number;
  daily: { day: string; active: number }[];
  week_active: number;
  push: number;
  features: Record<string, number>;
  games_week?: GameRow[];
  games_4w?: GameRow[];
  games_since?: GameRow[];
  games_since_day?: string;
};

const FEATURES: [string, string][] = [
  ['study_users', '스터디 윗미 사용자'],
  ['study_hours', '스터디 윗미 총 시간(시간)'],
  ['game_users', '게임 한 사람'],
  ['game_plays', '게임 판 수'],
  ['meal_reviews', '급식 한줄평'],
  ['notices', '학생 공지 글'],
  ['suggestions', '건의'],
  ['survey_answers', '설문 응답'],
];

/** 관리자·개발자: 앱 사용 현황(가입 · 매일 접속 · 최근 7일 기능별). 접속 = 그날 앱을 연 학생(자동 출석 기준) */
export function UsageScreen() {
  const { staff, checked } = useStaffAccess();
  const [u, setU] = useState<Usage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_usage');
    if (error) setErr('불러오지 못했어요. 관리자·개발자 계정인지, DB가 적용됐는지 확인해 주세요.');
    else setU(data as Usage);
  }, []);
  useEffect(() => {
    if (staff) load();
  }, [staff, load]);

  if (!staff) {
    return (
      <Screen topInset={false}>
        <AppText variant="body">{checked ? '관리자·개발자만 볼 수 있어요.' : '확인하는 중…'}</AppText>
      </Screen>
    );
  }
  if (!u) {
    return (
      <Screen topInset={false} onRefresh={load}>
        <AppText variant="body" color={err ? color.danger : color.inkMuted}>
          {err ?? '불러오는 중…'}
        </AppText>
      </Screen>
    );
  }

  const todayActive = u.daily[u.daily.length - 1]?.active ?? 0;
  const max = Math.max(1, ...u.daily.map((d) => d.active));
  return (
    <Screen topInset={false} onRefresh={load}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Stat label="오늘 접속" value={todayActive} />
        <Stat label="최근 7일 접속" value={u.week_active} />
        <Stat label="학번 등록" value={u.enrolled} sub={`오늘 +${u.new_today}`} />
        <Stat label="알림 켠 학생" value={u.push} />
      </View>
      <AppText variant="caption" color={color.inkMuted}>
        학년별 등록 {Object.entries(u.by_grade).map(([g, n]) => `${g}학년 ${n}명`).join(' · ') || '없음'} · 로그인한 계정 {u.accounts}개
      </AppText>

      <Card style={{ gap: space.md }}>
        <AppText variant="label">매일 접속한 학생 (최근 14일)</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 4 }} accessible accessibilityLabel={u.daily.map((d) => `${d.day.slice(5)} ${d.active}명`).join(', ')}>
          {u.daily.map((d) => (
            <View key={d.day} style={{ flex: 1, alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }}>
              <AppText style={{ fontSize: 9, lineHeight: 11 }} color={color.inkMuted}>
                {d.active || ''}
              </AppText>
              <View style={{ width: '100%', height: `${(d.active / max) * 80}%`, minHeight: d.active ? 3 : 1, borderRadius: 4, backgroundColor: d.day === u.today ? color.accent : color.navy }} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="caption" color={color.inkFaint}>
            {u.daily[0]?.day.slice(5).replace('-', '/')}
          </AppText>
          <AppText variant="caption" color={color.inkFaint}>
            오늘
          </AppText>
        </View>
      </Card>

      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        <AppText variant="label" style={{ padding: space.lg, paddingBottom: space.sm }}>
          최근 7일 기능별
        </AppText>
        {FEATURES.map(([k, label], i) => (
          <View key={k} style={{ flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: i ? 1 : 0, borderTopColor: color.lineSoft }}>
            <AppText variant="body" style={{ flex: 1 }}>
              {label}
            </AppText>
            <AppText variant="bodyStrong">{(u.features[k] ?? 0).toLocaleString()}</AppText>
          </View>
        ))}
      </View>

      {u.games_4w ? <GameTable title="게임별 · 최근 4주 (교체 판단 기준)" rows={u.games_4w} /> : null}
      {u.games_week ? <GameTable title="게임별 · 최근 7일" rows={u.games_week} /> : null}
      {u.games_since ? <GameTable title={`게임별 · 출시(${(u.games_since_day ?? '').slice(5).replace('-', '/')}) 이후`} rows={u.games_since} /> : null}
      {u.games_week ? (
        <AppText variant="caption" color={color.inkFaint}>
          순위 = 기간 중 플레이한 학생 수(개발자 계정 제외). 게임 교체는 결정 직전 4주 기준이고, 새로 들어온 게임은 첫 업데이트 한 번은 교체 대상에서 빠져요. 다시 온 학생 = 서로 다른 날 2번 이상 플레이. 의견 = 게임 화면의 '이 게임에 의견'으로 들어온 수.
        </AppText>
      ) : null}
    </Screen>
  );
}

type GameRow = { game: string; plays: number; players: number; dev_plays: number; repeat_players: number; avg_minutes: number; feedback: number };

/** 게임별 사용량 표: 플레이한 학생 수 순. 게임 정리(5개 유지) 판단 근거 */
function GameTable({ title, rows }: { title: string; rows: GameRow[] }) {
  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
      <AppText variant="label" style={{ padding: space.lg, paddingBottom: space.sm }}>
        🎮 {title}
      </AppText>
      {rows.length === 0 ? (
        <AppText variant="body" color={color.inkMuted} style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
          아직 기록이 없어요.
        </AppText>
      ) : (
        rows.map((r, i) => {
          const g = (GAMES as Record<string, (typeof GAMES)[keyof typeof GAMES] | undefined>)[r.game];
          return (
            <View
              key={r.game}
              accessible
              accessibilityLabel={`${i + 1}위 ${g?.title ?? r.game}, 학생 ${r.players}명, ${r.plays}판, 다시 온 학생 ${r.repeat_players}명, 평균 ${r.avg_minutes}분, 의견 ${r.feedback}개`}
              style={{ paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, borderTopColor: color.lineSoft, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {i + 1}. {g ? `${g.emoji} ${g.title}` : r.game}
                </AppText>
                <AppText variant="bodyStrong">{r.players.toLocaleString()}명</AppText>
              </View>
              <AppText variant="caption" color={color.inkMuted}>
                {r.plays.toLocaleString()}판 · 다시 온 학생 {r.repeat_players}명 · 평균 {r.avg_minutes}분 · 의견 {r.feedback}개{r.dev_plays ? ` · 개발자 플레이 ${r.dev_plays}판(제외)` : ''}
                {g?.by ? ` · ${g.by}` : ''}
              </AppText>
            </View>
          );
        })
      )}
    </View>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: color.surface, borderRadius: radius.card, padding: space.lg, gap: 2 }}>
      <AppText variant="caption" color={color.inkMuted}>
        {label}
      </AppText>
      <AppText variant="title">{value.toLocaleString()}</AppText>
      {sub ? (
        <AppText variant="caption" color={color.success}>
          {sub}
        </AppText>
      ) : null}
    </View>
  );
}
