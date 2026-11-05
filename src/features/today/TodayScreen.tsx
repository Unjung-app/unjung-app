import { useEffect, useState } from 'react';
import { REWARD } from '@/lib/rewards';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { Button, Card, Chip, SampleNotice, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { InstallBanner } from '@/features/install/InstallBanner';
import { WalletStrip } from '@/features/today/WalletStrip';
import { DailyMissions } from '@/features/today/DailyMissions';
import { durationLabel, useStudyLive, type StudyToday } from '@/features/study/session';
import { supabase } from '@/lib/supabase';
import { DeadlineCard } from '@/features/tasks/DeadlineCard';
import { NoticeStrip } from '@/features/notice/NoticeStrip';
import { SurveyStrip } from '@/features/voice/SurveyStrip';
import { PushPrompt } from '@/features/settings/PushPrompt';
import { MEAL_CODE, useTopReview } from '@/features/meal/reviews';
import { Logo } from '@/components/Logo';
import { givenName, useAuth } from '@/state/auth';
import { useUpcomingSchedule, useWeekMeals, useWeekTimetable } from '@/features/data';
import { classLabel, useNow, useOpenFeature } from '@/features/hooks';
import { bellFor, lunchOver, phaseAt, type DayPhase } from '@/features/timetable/bell';
import { addDays, dDayLabel, isWeekend, longLabel, mondayOf, shortLabel, weekdayLabel } from '@/lib/date';
import { groupEvents, isForGrade, isMajorEvent, type Meal, type SchoolEvent } from '@/lib/school';
import type { ClassLesson as Lesson } from '@/features/data';
import { usePrefs, type MyClass } from '@/state/prefs';
import { color, radius, space } from '@/theme/tokens';

function greeting(minutes: number) {
  if (minutes < 12 * 60) return '좋은 아침이에요';
  if (minutes < 17 * 60) return '좋은 오후예요';
  return '오늘도 수고했어요';
}

export function TodayScreen() {
  const now = useNow();
  const router = useRouter();
  const { myClass } = usePrefs();
  const { enrollment } = useAuth();
  const nick = givenName(enrollment?.name);
  // 주말에는 다음 주 데이터를 불러와 '다음 수업일'을 보여 준다
  const schoolWeekDay = isWeekend(now.ymd) ? addDays(mondayOf(now.ymd), 7) : now.ymd;
  const timetable = useWeekTimetable(schoolWeekDay, myClass);
  const meals = useWeekMeals(schoolWeekDay);
  const schedule = useUpcomingSchedule(now.ymd);

  const refreshing = timetable.refreshing || meals.refreshing || schedule.refreshing;
  const anySample =
    meals.source === 'sample' || schedule.source === 'sample' || (!!myClass && timetable.source === 'sample');

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        timetable.refresh();
        meals.refresh();
        schedule.refresh();
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ gap: 2, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Logo variant="mark-light" size={18} />
            <AppText variant="label" weight="regular" color={color.inkMuted}>
              {longLabel(now.ymd)} · {classLabel(myClass)}
            </AppText>
          </View>
          <AppText variant="title" accessibilityRole="header">
            {greeting(now.minutes)}
            {nick ? `, ${nick}` : ''}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="설정"
          onPress={() => router.push('/settings')}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? color.surfaceMuted : color.surface,
            borderWidth: 1,
            borderColor: color.line,
          })}>
          <Icon name="settings" size={20} color={color.navy} />
        </Pressable>
      </View>

      <WalletStrip />
      <InstallBanner />
      {anySample ? <SampleNotice /> : null}

      <NowCard
        myClass={myClass}
        today={now.ymd}
        minutes={now.minutes}
        lessons={timetable.items}
        loading={timetable.source === 'loading'}
        holiday={schedule.items.find((e) => e.date === now.ymd && e.holiday)}
      />
      <DeadlineCard today={now.ymd} />
      <DailyMissions today={now.ymd} />
      <NoticeStrip />
      <SurveyStrip />
      <PushPrompt />
      <MealCard today={now.ymd} minutes={now.minutes} meals={meals.items} grade={myClass?.grade ?? null} />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <StudyCard />
        <EventCard today={now.ymd} events={schedule.items} grade={myClass?.grade ?? null} />
      </View>
    </Screen>
  );
}

/* ---------- 지금 수업 ---------- */

function NowCard({
  myClass,
  today,
  minutes,
  lessons,
  loading,
  holiday,
}: {
  myClass: MyClass | null;
  today: string;
  minutes: number;
  lessons: Lesson[];
  loading: boolean;
  holiday?: SchoolEvent;
}) {
  const router = useRouter();
  const openFeature = useOpenFeature();

  if (!myClass) {
    return (
      <Card tone="navy">
        <AppText variant="label" color={color.onNavyMuted}>
          지금 수업
        </AppText>
        <AppText variant="heading" color={color.onNavy} style={{ fontSize: 20, lineHeight: 28 }}>
          내 반을 설정하면{'\n'}지금 수업과 남은 시간이 보여요
        </AppText>
        <Button label="반 설정하기" variant="soft" onPress={() => router.push('/settings/class')} />
      </Card>
    );
  }

  const todays = lessons.filter((l) => l.date === today);
  const subjectAt = (p: number) => todays.find((l) => l.period === p);

  if (isWeekend(today) || holiday || (!loading && todays.length === 0)) {
    let next = addDays(today, 1);
    while (isWeekend(next)) next = addDays(next, 1);
    const first = lessons.find((l) => l.date === next && l.period === 1);
    return (
      <Card tone="navy">
        <AppText variant="label" color={color.onNavyMuted}>
          {holiday ? holiday.name : `${weekdayLabel(today)}요일`}
        </AppText>
        <AppText variant="display" color={color.onNavy}>
          오늘은 수업이 없어요
        </AppText>
        <AppText variant="body" color={color.onNavySub}>
          다음 수업일 {shortLabel(next)}
          {first ? ` · 1교시 ${first.subject}` : ''}
        </AppText>
      </Card>
    );
  }

  const lastPeriod = todays.length ? Math.max(...todays.map((l) => l.period)) : 7;
  const BELL = bellFor(myClass.grade).periods;
  const phase: DayPhase = phaseAt(minutes, lastPeriod, myClass.grade);
  const focusPeriod =
    phase.kind === 'class' ? phase.current : phase.kind === 'after' ? null : phase.next;
  const focus = focusPeriod ? subjectAt(focusPeriod.period) : undefined;
  const after = focusPeriod ? subjectAt(focusPeriod.period + 1) : undefined;
  const afterBell = focusPeriod ? BELL.find((b) => b.period === focusPeriod.period + 1) : undefined;
  const tomorrowFirst = lessons.find((l) => l.date === addDays(today, 1) && l.period === 1);

  const top =
    phase.kind === 'class'
      ? { left: `지금 · ${phase.current.period}교시`, right: `${phase.remaining}분 남음` }
      : phase.kind === 'before'
        ? { left: '곧 1교시', right: `${phase.next.start - minutes}분 후` }
        : phase.kind === 'break'
          ? { left: `쉬는 시간 · 다음 ${phase.next.period}교시`, right: `${phase.minutesUntil}분 후` }
          : phase.kind === 'lunch'
            ? { left: `점심시간 · 다음 ${phase.next.period}교시`, right: `${phase.minutesUntil}분 후` }
            : { left: '오늘 수업 끝', right: '' };

  return (
    <Card tone="navy" style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="label" color={color.onNavyMuted}>
          {top.left}
        </AppText>
        {top.right ? (
          <AppText variant="label" color={color.accent}>
            {top.right}
          </AppText>
        ) : null}
      </View>

      <View style={{ gap: 4 }}>
        <AppText variant="display" color={color.onNavy}>
          {phase.kind === 'after' ? '수고했어요' : (focus?.subject ?? (loading ? '불러오는 중' : '수업 정보 없음'))}
        </AppText>
        {focusPeriod ? (
          <AppText variant="body" color={color.onNavySub}>
            {fmt(focusPeriod.start)} – {fmt(focusPeriod.end)}
            {focus?.room ? ` · ${focus.room}` : ''}
          </AppText>
        ) : (
          <AppText variant="body" color={color.onNavySub}>
            {lastPeriod}교시까지 모두 끝났어요
            {tomorrowFirst ? ` · 내일 1교시 ${tomorrowFirst.subject}` : ''}
          </AppText>
        )}
      </View>

      <View
        accessible
        accessibilityLabel={`오늘 ${lastPeriod}교시 중 ${focusPeriod?.period ?? lastPeriod}교시`}
        style={{ flexDirection: 'row', gap: 4 }}>
        {BELL.filter((b) => b.period <= lastPeriod).map((b) => {
          const done = b.end <= minutes;
          const current = phase.kind === 'class' && phase.current.period === b.period;
          return (
            <View
              key={b.period}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                backgroundColor: current ? color.accent : done ? color.navyDone : color.navyTrack,
              }}
            />
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText variant="label" weight="regular" color={color.onNavySub} style={{ flex: 1 }}>
          {after && afterBell && phase.kind !== 'after'
            ? `다음 ${afterBell.period}교시 ${after.subject} · ${fmt(afterBell.start)}`
            : ' '}
        </AppText>
        <Pressable accessibilityRole="link" onPress={() => openFeature('timetable')} hitSlop={12}>
          <AppText variant="label" color={color.onNavy}>
            시간표 ›
          </AppText>
        </Pressable>
      </View>
    </Card>
  );
}

const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/* ---------- 급식 ---------- */

function pickMeal(today: string, minutes: number, meals: Meal[], grade: number | null) {
  const todays = meals.filter((m) => m.date === today);
  const dinner = todays.find((m) => m.type === '석식');
  if (lunchOver(minutes, grade) && dinner) return { meal: dinner, label: '오늘 저녁' };
  const lunch = todays.find((m) => m.type === '중식');
  // 점심이 끝나고 30분까지는 오늘 점심을 그대로 보여 준다(한줄평 남기기 좋은 시간)
  if (lunch && !lunchOver(minutes - 30, grade)) return { meal: lunch, label: '오늘 점심' };
  const next = meals.find((m) => m.date > today && m.type === '중식');
  if (next) return { meal: next, label: `${weekdayLabel(next.date)}요일 점심` };
  return lunch ? { meal: lunch, label: '오늘 점심' } : null;
}

function MealCard({ today, minutes, meals, grade }: { today: string; minutes: number; meals: Meal[]; grade: number | null }) {
  const openFeature = useOpenFeature();
  const picked = pickMeal(today, minutes, meals, grade);
  const { status } = useAuth();
  const top = useTopReview(picked?.meal.date ?? today, picked ? MEAL_CODE[picked.meal.type] : 2, status === 'ready' && !!picked);
  return (
    <Card>
      <SectionTitle
        title={picked?.label ?? '급식'}
        right={
          picked?.meal.kcal ? (
            <AppText variant="caption" color={color.inkMuted}>
              {picked.meal.kcal} kcal
            </AppText>
          ) : null
        }
      />
      {picked ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {picked.meal.dishes.map((d) => (
            <Chip key={d.name} label={d.name} />
          ))}
        </View>
      ) : (
        <AppText variant="body" color={color.inkMuted}>
          이번 주 급식 정보가 아직 없어요
        </AppText>
      )}
      {top ? (
        <View style={{ backgroundColor: color.bg, borderRadius: radius.control, padding: space.md, gap: 2 }}>
          <AppText variant="caption" color={color.inkMuted}>
            인기 한줄평 · 익명의 {top.grade}학년 · 👍 {top.like_count}
          </AppText>
          <AppText variant="body" numberOfLines={2}>
            “{top.body}”
          </AppText>
        </View>
      ) : null}
      <Button label="급식 · 한줄평 보기" variant="soft" onPress={() => openFeature('meal')} />
    </Card>
  );
}

/* ---------- 아래 두 칸 ---------- */

function StudyCard() {
  const openFeature = useOpenFeature();
  const { status } = useAuth();
  const ready = status === 'ready';
  const live = useStudyLive(ready);
  const [today, setToday] = useState<StudyToday | null>(null);
  useEffect(() => {
    if (!ready) return;
    supabase.rpc('my_study_today').then(({ data }) => data && setToday(data as StudyToday));
  }, [ready]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`오늘 공부 ${today ? durationLabel(today.ranked_seconds) : ''}. 공부 타이머 열기`}
      onPress={() => openFeature('study')}
      style={({ pressed }) => ({ flex: 1, backgroundColor: pressed ? color.navyRaised : color.navy, borderRadius: radius.card, padding: space.lg, gap: 6 })}>
      <AppText variant="label" weight="regular" color={color.onNavyMuted}>
        오늘 공부
      </AppText>
      <AppText variant="heading" color={color.onNavy} style={{ fontSize: 22, lineHeight: 28 }}>
        {ready ? durationLabel(today?.ranked_seconds ?? 0) : '집중 모드'}
      </AppText>
      <AppText variant="caption" color={color.onNavySub}>
        {ready ? `토큰 ${today?.tokens ?? 0}/${REWARD.studyDailyCap} · 10분마다 +1` : '로그인하면 공부 시간이 반 랭킹이 돼요'}
      </AppText>
      <View style={{ marginTop: 'auto', paddingTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: live?.all ? color.liveOnNavy : color.navyDone }} />
        <AppText variant="caption" weight="semibold" color={color.accent}>
          {ready ? `${live?.all ?? 0}명 집중 중 · 시작 ›` : '시작 ›'}
        </AppText>
      </View>
    </Pressable>
  );
}

function EventCard({ today, events, grade }: { today: string; events: SchoolEvent[]; grade: number | null }) {
  const openFeature = useOpenFeature();
  const upcoming = groupEvents(events).filter((e) => e.end >= today && isForGrade(e, grade));
  const major = upcoming.find((e) => isMajorEvent(e, grade)) ?? upcoming[0];
  const next = upcoming.find((e) => e !== major);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openFeature('calendar')}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: pressed ? color.surfaceMuted : color.surface,
        borderRadius: radius.card,
        padding: space.lg,
        gap: 6,
      })}>
      <AppText variant="label" weight="regular" color={color.inkMuted}>
        다가오는 일정
      </AppText>
      {major ? (
        <>
          <AppText variant="title" style={{ fontSize: 22, lineHeight: 28 }}>
            {major.start <= today ? '진행 중' : dDayLabel(today, major.start)}
          </AppText>
          <AppText variant="caption" color={color.inkMuted} numberOfLines={2}>
            {major.name}
          </AppText>
          {next ? (
            <AppText variant="caption" style={{ marginTop: 'auto' }} numberOfLines={1}>
              {shortLabel(next.start)} · {next.name}
            </AppText>
          ) : null}
        </>
      ) : (
        <AppText variant="body" color={color.inkMuted}>
          예정된 일정이 없어요
        </AppText>
      )}
    </Pressable>
  );
}
