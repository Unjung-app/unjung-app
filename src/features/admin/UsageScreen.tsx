import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/auth';
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

/** 관리자: 앱 사용 현황(가입 · 매일 접속 · 최근 7일 기능별). 접속 = 그날 앱을 연 학생(자동 출석 기준) */
export function UsageScreen() {
  const { role } = useAuth();
  const [u, setU] = useState<Usage | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_usage');
    if (error) setErr('불러오지 못했어요. 관리자 계정인지, DB가 적용됐는지 확인해 주세요.');
    else setU(data as Usage);
  }, []);
  useEffect(() => {
    if (role === 'admin') load();
  }, [role, load]);

  if (role !== 'admin') {
    return (
      <Screen topInset={false}>
        <AppText variant="body">관리자만 볼 수 있어요.</AppText>
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
    </Screen>
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
