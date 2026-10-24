import { View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Badge, Card, SampleNotice } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useUpcomingSchedule } from '@/features/data';
import { useNow } from '@/features/hooks';
import { dDayLabel, parseYmd, weekdayLabel } from '@/lib/date';
import { groupEvents, isForGrade, isMajorEvent, type EventRange } from '@/lib/school';
import { usePrefs } from '@/state/prefs';
import { color, radius, space } from '@/theme/tokens';

function rangeLabel(e: EventRange) {
  const a = parseYmd(e.start);
  if (e.start === e.end) return `${a.m}월 ${a.d}일 ${weekdayLabel(e.start)}요일`;
  const b = parseYmd(e.end);
  return a.m === b.m ? `${a.m}월 ${a.d}일 – ${b.d}일` : `${a.m}월 ${a.d}일 – ${b.m}월 ${b.d}일`;
}

export function CalendarScreen({ inStack = false }: { inStack?: boolean }) {
  const now = useNow();
  const { myClass } = usePrefs();
  const grade = myClass?.grade ?? null;
  const schedule = useUpcomingSchedule(now.ymd);
  const upcoming = groupEvents(schedule.items).filter((e) => e.end >= now.ymd);
  const hero = upcoming.find((e) => isMajorEvent(e, grade));

  const months = new Map<string, EventRange[]>();
  for (const e of upcoming) {
    const key = (e.start < now.ymd ? now.ymd : e.start).slice(0, 6);
    months.set(key, [...(months.get(key) ?? []), e]);
  }

  return (
    <Screen topInset={!inStack} refreshing={schedule.refreshing} onRefresh={schedule.refresh}>
      {!inStack ? (
        <AppText variant="title" accessibilityRole="header">
          학사일정
        </AppText>
      ) : null}
      {schedule.source === 'sample' ? <SampleNotice /> : null}

      {hero ? (
        <Card tone="navy">
          <AppText variant="label" color={color.onNavyMuted}>
            {hero.name}
          </AppText>
          <AppText variant="display" color={color.onNavy} style={{ fontSize: 40, lineHeight: 46 }}>
            {hero.start <= now.ymd ? '진행 중' : dDayLabel(now.ymd, hero.start)}
          </AppText>
          <AppText variant="body" color={color.onNavySub}>
            {rangeLabel(hero)}
          </AppText>
        </Card>
      ) : null}

      {upcoming.length === 0 ? (
        <Card>
          <AppText variant="body" color={color.inkMuted}>
            앞으로 예정된 일정이 없어요
          </AppText>
        </Card>
      ) : (
        [...months.entries()].map(([ym, events]) => (
          <View key={ym} style={{ gap: space.sm }}>
            <AppText variant="heading" style={{ marginTop: space.sm }}>
              {Number(ym.slice(4, 6))}월
            </AppText>
            <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
              {events.map((e, i) => {
                const mine = isForGrade(e, grade);
                const start = parseYmd(e.start);
                const ongoing = e.start <= now.ymd;
                return (
                  <View
                    key={`${e.start}-${e.name}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.md,
                      paddingHorizontal: space.lg,
                      paddingVertical: 14,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: color.lineSoft,
                    }}>
                    <View style={{ width: 40, alignItems: 'center' }}>
                      <AppText variant="heading">{start.d}</AppText>
                      <AppText variant="caption" color={color.inkMuted}>
                        {weekdayLabel(e.start)}
                      </AppText>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText variant="body">{e.name}</AppText>
                      {e.start !== e.end ? (
                        <AppText variant="caption" color={color.inkMuted}>
                          {rangeLabel(e)}
                        </AppText>
                      ) : null}
                    </View>
                    {!mine && e.grade ? <Badge label={`${e.grade}학년`} tone="muted" /> : null}
                    {e.holiday ? <Badge label="쉬는 날" tone="success" /> : null}
                    <AppText variant="caption" weight="semibold" color={color.inkMuted}>
                      {ongoing ? '진행 중' : dDayLabel(now.ymd, e.start)}
                    </AppText>
                  </View>
                );
              })}
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}
