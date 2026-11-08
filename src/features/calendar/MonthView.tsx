import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { addDays, dayOfWeek, parseYmd, toYmd, weekdayLabel, type Ymd } from '@/lib/date';
import type { SchoolEvent } from '@/lib/school';
import { color, radius, space } from '@/theme/tokens';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

/** 학사일정 달력 보기(학생 의견 #17): 한 달 칸에 일정 있는 날 점 표시, 날짜를 누르면 그날 일정 */
export function MonthView({ today, events }: { today: Ymd; events: SchoolEvent[] }) {
  const t = parseYmd(today);
  const [ym, setYm] = useState({ y: t.y, m: t.m });
  const [sel, setSel] = useState<Ymd>(today);

  const first = toYmd(ym.y, ym.m, 1);
  const nextFirst = ym.m === 12 ? toYmd(ym.y + 1, 1, 1) : toYmd(ym.y, ym.m + 1, 1);
  const last = addDays(nextFirst, -1);
  const lead = dayOfWeek(first);
  const days: (Ymd | null)[] = [...Array(lead).fill(null)];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  while (days.length % 7) days.push(null);

  const byDay = new Map<string, SchoolEvent[]>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const maxMonth = parseYmd(addDays(today, 120));
  const canPrev = ym.y > t.y || ym.m > t.m;
  const canNext = ym.y < maxMonth.y || ym.m < maxMonth.m;
  const move = (n: number) => {
    const m0 = ym.m - 1 + n;
    const y = ym.y + Math.floor(m0 / 12);
    const m = ((m0 % 12) + 12) % 12 + 1;
    setYm({ y, m });
    setSel(y === t.y && m === t.m ? today : toYmd(y, m, 1));
  };
  const selEvents = byDay.get(sel) ?? [];
  const s = parseYmd(sel);

  return (
    <View style={{ gap: space.md }}>
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, padding: space.md, gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Arrow label="이전 달" text="‹" disabled={!canPrev} onPress={() => move(-1)} />
          <AppText variant="heading" align="center" style={{ flex: 1 }}>
            {ym.y}년 {ym.m}월
          </AppText>
          <Arrow label="다음 달" text="›" disabled={!canNext} onPress={() => move(1)} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          {WEEK.map((w, i) => (
            <AppText key={w} variant="caption" align="center" color={i === 0 ? color.danger : color.inkMuted} style={{ flex: 1 }}>
              {w}
            </AppText>
          ))}
        </View>
        {Array.from({ length: days.length / 7 }, (_, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {days.slice(r * 7, r * 7 + 7).map((d, i) => {
              if (!d) return <View key={i} style={{ flex: 1, minHeight: 48 }} />;
              const ev = byDay.get(d) ?? [];
              const holiday = ev.some((e) => e.holiday);
              const on = d === sel;
              const isToday = d === today;
              const past = d < today;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${parseYmd(d).m}월 ${parseYmd(d).d}일${ev.length ? `, 일정 ${ev.map((e) => e.name).join(', ')}` : ''}`}
                  onPress={() => setSel(d)}
                  style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: radius.control, backgroundColor: on ? color.navy : 'transparent' }}>
                  <AppText
                    variant="label"
                    weight={isToday ? 'bold' : undefined}
                    color={on ? color.onNavy : holiday || i === 0 ? color.danger : past ? color.inkFaint : color.ink}
                    style={isToday && !on ? { textDecorationLine: 'underline' } : undefined}>
                    {parseYmd(d).d}
                  </AppText>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ev.length ? (holiday ? color.danger : on ? color.accent : color.navy) : 'transparent' }} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, padding: space.lg, gap: space.sm }}>
        <AppText variant="label" color={color.inkMuted}>
          {s.m}월 {s.d}일 {weekdayLabel(sel)}요일
        </AppText>
        {selEvents.length === 0 ? (
          <AppText variant="body" color={color.inkMuted}>
            {sel < today ? '지난 날이에요' : '일정이 없어요'}
          </AppText>
        ) : (
          selEvents.map((e) => (
            <AppText key={e.name} variant="bodyStrong" color={e.holiday ? color.danger : color.ink}>
              {e.holiday ? '🏖️ ' : '📌 '}
              {e.name}
            </AppText>
          ))
        )}
      </View>
    </View>
  );
}

function Arrow({ label, text, disabled, onPress }: { label: string; text: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}>
      <AppText style={{ fontSize: 26, lineHeight: 30 }} color={color.ink}>
        {text}
      </AppText>
    </Pressable>
  );
}
