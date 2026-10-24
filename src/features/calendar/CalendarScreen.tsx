import { View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Badge, Card, SampleNotice } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useUpcomingSchedule } from '@/features/data';
import { useNow } from '@/features/hooks';
import { dDayLabel, parseYmd, weekdayLabel } from '@/lib/date';
import { isMajorEvent, type SchoolEvent } from '@/lib/school';
import { color, radius, space } from '@/theme/tokens';

export function CalendarScreen({ inStack = false }: { inStack?: boolean }) {
  const now = useNow();
  const schedule = useUpcomingSchedule(now.ymd);
  const upcoming = schedule.items.filter((e) => e.date >= now.ymd);
  const hero = upcoming.find(isMajorEvent);

  const months = new Map<string, SchoolEvent[]>();
  for (const e of upcoming) {
    const key = e.date.slice(0, 6);
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
            {dDayLabel(now.ymd, hero.date)}
          </AppText>
          <AppText variant="body" color={color.onNavySub}>
            {parseYmd(hero.date).m}월 {parseYmd(hero.date).d}일 {weekdayLabel(hero.date)}요일
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
              {events.map((e, i) => (
                <View
                  key={`${e.date}-${e.name}`}
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
                    <AppText variant="heading">{parseYmd(e.date).d}</AppText>
                    <AppText variant="caption" color={color.inkMuted}>
                      {weekdayLabel(e.date)}
                    </AppText>
                  </View>
                  <AppText variant="body" style={{ flex: 1 }}>
                    {e.name}
                  </AppText>
                  {e.holiday ? <Badge label="휴업일" tone="success" /> : null}
                  <AppText variant="caption" weight="semibold" color={color.inkMuted}>
                    {dDayLabel(now.ymd, e.date)}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}
