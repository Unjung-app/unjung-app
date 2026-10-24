import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card, SampleNotice } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { Segmented, Stepper } from '@/components/ui/Segmented';
import { useWeekTimetable } from '@/features/data';
import { classLabel, useNow } from '@/features/hooks';
import { bellFor, phaseAt } from './bell';
import { shortSubject } from './subjects';
import { addDays, diffDays, isWeekend, mondayOf, parseYmd, weekdayLabel } from '@/lib/date';
import type { ClassLesson as Lesson } from '@/features/data';
import { useAuth } from '@/state/auth';
import { usePrefs } from '@/state/prefs';
import { KIND_LABEL, useClassTasks } from '@/features/tasks/data';
import { color, radius, space } from '@/theme/tokens';

const fmt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

export function TimetableScreen({ inStack = false }: { inStack?: boolean }) {
  const now = useNow();
  const router = useRouter();
  const { myClass } = usePrefs();
  const [mode, setMode] = useState<'week' | 'day'>('week');
  // 주말에는 다가오는 주(다음 월요일)를 먼저 보여 준다
  const home = isWeekend(now.ymd) ? addDays(mondayOf(now.ymd), 7) : now.ymd;
  const [anchor, setAnchor] = useState(home);
  const tt = useWeekTimetable(anchor, myClass);
  const monday = mondayOf(anchor);
  const thisMonday = mondayOf(now.ymd); // 라벨(이번 주·다음 주)은 실제 달력 기준
  const weekOffset = Math.round(diffDays(thisMonday, monday) / 7);
  // 우리 반 게시판의 마감을 해당 날짜·과목 칸에 점으로 표시
  const { status } = useAuth();
  const board = useClassTasks(now.ymd, status === 'ready');
  const marks = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of board.items ?? []) {
      const k = `${t.due}|${t.subject}`;
      m.set(k, m.has(k) ? `${m.get(k)}·${KIND_LABEL[t.kind]}` : KIND_LABEL[t.kind]);
    }
    return m;
  }, [board.items]);

  return (
    <Screen topInset={!inStack} refreshing={tt.refreshing} onRefresh={tt.refresh}>
      {!inStack ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <AppText variant="title" accessibilityRole="header">
            시간표
          </AppText>
          <Pressable accessibilityRole="button" onPress={() => router.push('/settings/class')} hitSlop={10}>
            <AppText variant="label" color={color.navy}>
              {classLabel(myClass)} ›
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {!myClass ? (
        <Card>
          <AppText variant="heading">내 반을 먼저 알려 주세요</AppText>
          <AppText variant="body" color={color.inkMuted}>
            학년과 반을 고르면 이번 주 시간표를 바로 불러와요.
          </AppText>
          <Button label="반 설정하기" onPress={() => router.push('/settings/class')} />
        </Card>
      ) : (
        <>
          {tt.source === 'sample' ? <SampleNotice /> : null}
          <Segmented
            label="보기 방식"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'week', label: '주간' },
              { value: 'day', label: '하루' },
            ]}
          />
          {mode === 'week' ? (
            <>
              <Stepper
                label={weekOffset === 0 ? '이번 주' : weekOffset === 1 ? '다음 주' : weekOffset === -1 ? '지난 주' : weekLabel(monday)}
                onPrev={() => setAnchor(addDays(monday, -7))}
                onNext={() => setAnchor(addDays(monday, 7))}
                onReset={() => setAnchor(home)}
              />
              <WeekGrid monday={monday} lessons={tt.items} today={now.ymd} minutes={now.minutes} grade={myClass.grade} marks={marks} />
            </>
          ) : (
            <DayList anchor={anchor} setAnchor={setAnchor} lessons={tt.items} today={now.ymd} minutes={now.minutes} grade={myClass.grade} marks={marks} />
          )}
          <AppText variant="caption" color={color.inkFaint}>
            {marks.size ? '주황 점은 우리 반 게시판에 올라온 마감이에요. ' : ''}선택 과목 자동 반영은 준비 중이에요.
          </AppText>
        </>
      )}
    </Screen>
  );
}

function weekLabel(monday: string) {
  const { m, d } = parseYmd(monday);
  return `${m}월 ${d}일 주`;
}

function WeekGrid({ monday, lessons, today, minutes, grade, marks }: { monday: string; lessons: Lesson[]; today: string; minutes: number; grade: number; marks: Map<string, string> }) {
  const days = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
  const maxPeriod = Math.max(6, ...lessons.filter((l) => days.includes(l.date)).map((l) => l.period));
  const periods = bellFor(grade).periods.filter((b) => b.period <= maxPeriod);
  const phase = phaseAt(minutes, maxPeriod, grade);
  const currentPeriod = phase.kind === 'class' ? phase.current.period : null;

  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.card, padding: space.sm }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 28 }} />
        {days.map((d) => {
          const isToday = d === today;
          return (
            <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: radius.round,
                  backgroundColor: isToday ? color.navy : 'transparent',
                }}>
                <AppText variant="label" color={isToday ? color.onNavy : color.inkMuted}>
                  {weekdayLabel(d)} {parseYmd(d).d}
                </AppText>
              </View>
            </View>
          );
        })}
      </View>
      {periods.map((p) => (
        <View key={p.period} style={{ flexDirection: 'row', minHeight: 52 }}>
          <View style={{ width: 28, alignItems: 'center', justifyContent: 'center' }}>
            <AppText variant="caption" weight="semibold" color={color.inkFaint}>
              {p.period}
            </AppText>
          </View>
          {days.map((d) => {
            const lesson = lessons.find((l) => l.date === d && l.period === p.period);
            const isToday = d === today;
            const isNow = isToday && currentPeriod === p.period;
            const mark = lesson ? marks.get(`${d}|${lesson.subject}`) : undefined;
            return (
              <View key={d} style={{ flex: 1, padding: 2 }}>
                <View
                  accessible
                  accessibilityLabel={`${weekdayLabel(d)}요일 ${p.period}교시 ${lesson ? lesson.subject + (lesson.tags.length ? ` (${lesson.tags.join(', ')})` : '') : '수업 없음'}${mark ? `, ${mark} 마감` : ''}`}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 2,
                    backgroundColor: isNow ? color.accentSoft : isToday ? color.surfaceMuted : 'transparent',
                    borderWidth: isNow ? 1.5 : 0,
                    borderColor: color.accent,
                  }}>
                  <AppText
                    variant="caption"
                    weight={isToday ? 'semibold' : 'regular'}
                    align="center"
                    numberOfLines={2}
                    color={lesson ? (lesson.tags.length ? color.accentInk : color.ink) : color.inkFaint}
                    style={{ fontSize: 12.5 }}>
                    {lesson ? shortSubject(lesson.subject) : '–'}
                  </AppText>
                  {mark ? (
                    <View style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: 4, backgroundColor: color.accent }} />
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function DayList({
  anchor,
  setAnchor,
  lessons,
  today,
  minutes,
  grade,
  marks,
}: {
  anchor: string;
  setAnchor: (d: string) => void;
  lessons: Lesson[];
  today: string;
  minutes: number;
  grade: number;
  marks: Map<string, string>;
}) {
  const todays = lessons.filter((l) => l.date === anchor);
  const isToday = anchor === today;
  const step = (dir: 1 | -1) => {
    let d = addDays(anchor, dir);
    while (isWeekend(d)) d = addDays(d, dir);
    setAnchor(d);
  };
  const { m, d } = parseYmd(anchor);
  return (
    <>
      <Stepper
        label={`${m}월 ${d}일 ${weekdayLabel(anchor)}요일${isToday ? ' · 오늘' : ''}`}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
      />
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        {todays.length === 0 ? (
          <View style={{ padding: space.xl }}>
            <AppText variant="body" color={color.inkMuted}>
              이날은 수업 정보가 없어요
            </AppText>
          </View>
        ) : (
          todays.map((l, i) => {
            const bell = bellFor(grade).periods.find((b) => b.period === l.period);
            const now = isToday && bell && minutes >= bell.start && minutes < bell.end;
            const done = isToday && bell && minutes >= bell.end;
            return (
              <View
                key={l.period}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  paddingHorizontal: space.lg,
                  paddingVertical: 14,
                  backgroundColor: now ? color.accentSoft : color.surface,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: color.lineSoft,
                }}>
                <View style={{ width: 52 }}>
                  <AppText variant="label" color={now ? color.accentInk : color.navy}>
                    {l.period}교시
                  </AppText>
                  {bell ? (
                    <AppText variant="caption" color={color.inkFaint}>
                      {fmt(bell.start)}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="bodyStrong" style={{ flex: 1 }} color={done ? color.inkFaint : color.ink}>
                  {l.subject}
                </AppText>
                {marks.get(`${l.date}|${l.subject}`) ? <Badge label={`${marks.get(`${l.date}|${l.subject}`)} 마감`} /> : null}
                {l.tags.map((t) => (
                  <Badge key={t} label={t} />
                ))}
                {l.room ? (
                  <AppText variant="caption" color={color.inkMuted}>
                    {l.room}
                  </AppText>
                ) : null}
                {now ? (
                  <AppText variant="caption" weight="bold" color={color.accentInk}>
                    지금
                  </AppText>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </>
  );
}
