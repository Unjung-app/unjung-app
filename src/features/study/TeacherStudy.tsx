import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Card, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/state/auth';
import { color, radius, space } from '@/theme/tokens';
import { hm, useTeacherClass, useTeacherOverview, type TeacherStudent } from './api';

const mmdd = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

/** 선생님: 스터디 윗미 이용 현황(학년·반별 이번 주 합계 · 최근 14일 · 지금 공부 중). 반을 누르면 학생별 기록 */
export function TeacherStudyScreen({ topInset = true }: { topInset?: boolean }) {
  const router = useRouter();
  const { teacherInfo } = useAuth();
  const ov = useTeacherOverview(true);
  const [grade, setGrade] = useState<number>(teacherInfo?.homeGrade ?? 1);
  const d = ov.data;
  const classes = (d?.classes ?? []).filter((c) => c.grade === grade);
  const all = d?.classes ?? [];
  const sum = (k: 'members' | 'studied' | 'week_seconds') => all.reduce((a, c) => a + c[k], 0);
  const maxSec = Math.max(1, ...(d?.daily ?? []).map((x) => x.seconds));

  return (
    <Screen topInset={topInset} onRefresh={ov.reload}>
      <AppText variant="title" accessibilityRole="header">
        스터디 윗미 현황
      </AppText>
      <AppText variant="caption" color={color.inkMuted}>
        선생님 전용 · 이번 주({d ? mmdd(d.week_start) : '-'}~) 기준 · 학생 화면의 공부 시간과 같은 기록이에요
      </AppText>
      {ov.error ? (
        <Card>
          <AppText variant="body" color={color.danger}>
            {ov.error}
          </AppText>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat label="지금 공부 중" value={`${d?.live.all ?? 0}명`} sub={d ? `1학년 ${d.live.g1} · 2학년 ${d.live.g2} · 3학년 ${d.live.g3}` : ''} />
        <Stat label="이번 주 참여" value={`${sum('studied')}명`} sub={`가입 ${sum('members')}명 중`} />
        <Stat label="이번 주 합계" value={hm(sum('week_seconds'))} />
      </View>

      <SectionTitle title="최근 14일" />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 110 }} accessibilityLabel="최근 14일 공부 시간 막대 그래프">
          {(d?.daily ?? []).map((x) => (
            <View key={x.day} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <AppText variant="caption" color={color.inkFaint} style={{ fontSize: 10 }}>
                {x.students || ''}
              </AppText>
              <View style={{ width: '100%', height: Math.max(2, (x.seconds / maxSec) * 80), borderRadius: 3, backgroundColor: x.day === d?.today ? color.accent : color.navy }} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="caption" color={color.inkFaint}>
            {d?.daily[0] ? mmdd(d.daily[0].day) : ''}
          </AppText>
          <AppText variant="caption" color={color.inkFaint}>
            막대 = 하루 공부 시간 합계 · 숫자 = 공부한 학생 수
          </AppText>
          <AppText variant="caption" color={color.inkFaint}>
            오늘
          </AppText>
        </View>
      </Card>

      <SectionTitle title="반별 이번 주" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {[1, 2, 3].map((g) => (
          <Pressable
            key={g}
            accessibilityRole="tab"
            accessibilityState={{ selected: grade === g }}
            accessibilityLabel={`${g}학년`}
            onPress={() => setGrade(g)}
            style={{ flex: 1, minHeight: 44, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center', backgroundColor: grade === g ? color.navy : color.surface }}>
            <AppText variant="label" color={grade === g ? color.onNavy : color.ink}>
              {g}학년
            </AppText>
          </Pressable>
        ))}
      </View>
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        {classes.length === 0 ? (
          <AppText variant="body" color={color.inkMuted} style={{ padding: space.lg }}>
            아직 이 학년에 가입한 학생이 없어요.
          </AppText>
        ) : (
          classes.map((c, i) => {
            const mine = teacherInfo?.homeGrade === c.grade && teacherInfo?.homeClass === c.class_no;
            return (
              <Pressable
                key={c.class_no}
                accessibilityRole="button"
                accessibilityLabel={`${c.grade}학년 ${c.class_no}반, 가입 ${c.members}명 중 ${c.studied}명 참여, 합계 ${hm(c.week_seconds)}. 학생별 기록 보기`}
                onPress={() => router.push({ pathname: '/study/teacher', params: { g: String(c.grade), c: String(c.class_no) } })}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, borderTopWidth: i ? 1 : 0, borderTopColor: color.lineSoft, backgroundColor: pressed ? color.surfaceMuted : mine ? color.accentSoft : color.surface })}>
                <AppText variant="bodyStrong" style={{ width: 64 }}>
                  {c.class_no}반{mine ? ' ⭐' : ''}
                </AppText>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: color.surfaceMuted, overflow: 'hidden' }}>
                    <View style={{ width: `${c.members ? Math.round((c.studied / c.members) * 100) : 0}%`, height: 6, backgroundColor: color.navy }} />
                  </View>
                  <AppText variant="caption" color={color.inkMuted}>
                    {c.studied}/{c.members}명 참여 · 오늘 {hm(c.today_seconds)}
                  </AppText>
                </View>
                <AppText variant="label">{hm(c.week_seconds)}</AppText>
                <AppText variant="label" color={color.inkFaint}>
                  ›
                </AppText>
              </Pressable>
            );
          })
        )}
      </View>
      <AppText variant="caption" color={color.inkFaint} align="center">
        학생 이름이 보이는 기록은 선생님 계정에서만 보여요. 학생 화면에는 닉네임 순위만 나와요.
      </AppText>
    </Screen>
  );
}

/** 선생님: 한 반의 학생별 공부 기록 */
export function TeacherClassScreen() {
  const { g, c } = useLocalSearchParams<{ g: string; c: string }>();
  const grade = Number(g) || 1;
  const cls = Number(c) || 1;
  const { teacher } = useAuth();
  const q = useTeacherClass(grade, cls, !!teacher);
  const [sort, setSort] = useState<'number' | 'week' | 'month'>('number');
  const rows = [...(q.data ?? [])].sort((a, b) => (sort === 'number' ? a.number - b.number : sort === 'week' ? b.week_seconds - a.week_seconds : b.month_seconds - a.month_seconds));
  const studied = (q.data ?? []).filter((x) => x.week_seconds > 0).length;

  if (!teacher) {
    return (
      <Screen topInset={false}>
        <AppText variant="body" color={color.inkMuted}>
          선생님 계정에서만 볼 수 있어요.
        </AppText>
      </Screen>
    );
  }
  return (
    <Screen topInset={false} onRefresh={q.reload}>
      <AppText variant="heading">
        {grade}학년 {cls}반 · 이번 주 {studied}/{q.data?.length ?? 0}명 참여
      </AppText>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {(
          [
            ['number', '번호순'],
            ['week', '이번 주'],
            ['month', '최근 30일'],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ selected: sort === k }}
            accessibilityLabel={`${label} 정렬`}
            onPress={() => setSort(k)}
            style={{ minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center', backgroundColor: sort === k ? color.navy : color.surface }}>
            <AppText variant="label" color={sort === k ? color.onNavy : color.ink}>
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>
      {q.error ? (
        <AppText variant="body" color={color.danger}>
          {q.error}
        </AppText>
      ) : null}
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        {rows.length === 0 && !q.loading ? (
          <AppText variant="body" color={color.inkMuted} style={{ padding: space.lg }}>
            이 반에 가입한 학생이 없어요.
          </AppText>
        ) : null}
        {rows.map((s, i) => (
          <StudentRow key={s.number} s={s} first={i === 0} />
        ))}
      </View>
      <AppText variant="caption" color={color.inkFaint} align="center">
        30분 넘게 공부한 날 수는 최근 30일 기준이에요. 가입하지 않은 학생은 목록에 없어요.
      </AppText>
    </Screen>
  );
}

function StudentRow({ s, first }: { s: TeacherStudent; first: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60, paddingHorizontal: space.lg, paddingVertical: space.sm, borderTopWidth: first ? 0 : 1, borderTopColor: color.lineSoft }}>
      <AppText variant="label" color={color.inkFaint} style={{ width: 24, textAlign: 'right' }}>
        {s.number}
      </AppText>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {s.name}
          {s.live ? ' 🟢' : ''}
        </AppText>
        <AppText variant="caption" color={color.inkFaint} numberOfLines={1}>
          {s.last_day ? `마지막 ${mmdd(s.last_day)}` : '기록 없음'} · 30일 중 {s.days_30}일 · 누적 {hm(s.total_seconds)}
        </AppText>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <AppText variant="label">{hm(s.week_seconds)}</AppText>
        <AppText variant="caption" color={color.inkFaint}>
          30일 {hm(s.month_seconds)}
        </AppText>
      </View>
    </View>
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
        <AppText variant="caption" color={color.inkFaint} style={{ fontSize: 11 }}>
          {sub}
        </AppText>
      ) : null}
    </View>
  );
}
