import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { addDays, dayOfWeek, parseYmd, toYmd, ymdToIso, type Ymd } from '@/lib/date';
import { color, radius, space, subjectColor } from '@/theme/tokens';
import { hm, useMonth } from './api';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/** 하루 공부 시간에 따라 칸을 진하게(0 · 30분 · 1시간 · 2시간 · 4시간 이상) */
function level(sec: number) {
  if (sec <= 0) return 0;
  if (sec < 1800) return 1;
  if (sec < 3600) return 2;
  if (sec < 7200) return 3;
  if (sec < 14400) return 4;
  return 5;
}
const OPACITY = [0, 0.15, 0.3, 0.5, 0.72, 1];

/** 스터디 윗미 기록 달력: 한 달을 한눈에, 날짜를 누르면 과목별 시간 */
export function StudyCalendar({ today, subjects }: { today: Ymd; subjects: { name: string; color: string }[] }) {
  const t = parseYmd(today);
  const [ym, setYm] = useState({ y: t.y, m: t.m });
  const first = toYmd(ym.y, ym.m, 1);
  const month = useMonth(ymdToIso(first));
  const [pick, setPick] = useState<Ymd>(today);

  const cells = useMemo(() => {
    const lead = dayOfWeek(first);
    const out: (Ymd | null)[] = Array(lead).fill(null);
    for (let d = first; parseYmd(d).m === ym.m; d = addDays(d, 1)) out.push(d);
    while (out.length % 7) out.push(null);
    return out;
  }, [first, ym.m]);

  const days = month.data?.days ?? {};
  const total = Object.values(days).reduce((a, b) => a + b, 0);
  const studied = Object.keys(days).length;
  const isThisMonth = ym.y === t.y && ym.m === t.m;
  const move = (n: number) => setYm(({ y, m }) => (m + n < 1 ? { y: y - 1, m: 12 } : m + n > 12 ? { y: y + 1, m: 1 } : { y, m: m + n }));
  const pickIso = ymdToIso(pick);
  const pickSubjects = Object.entries(month.data?.by_subject?.[pickIso] ?? {}).sort((a, b) => b[1] - a[1]);
  const colorOf = (name: string) => subjectColor[subjects.find((s) => s.name === name)?.color ?? 'gray'] ?? subjectColor.gray;

  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.card, padding: space.lg, gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Nav label="‹" a11y="이전 달" onPress={() => move(-1)} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <AppText variant="bodyStrong">
            {ym.y}년 {ym.m}월
          </AppText>
          <AppText variant="caption" color={color.inkMuted}>
            {studied}일 공부 · 총 {hm(total)}
          </AppText>
        </View>
        <Nav label="›" a11y="다음 달" onPress={() => move(1)} disabled={isThisMonth} />
      </View>

      <View style={{ flexDirection: 'row' }}>
        {DOW.map((d, i) => (
          <AppText key={d} variant="caption" align="center" color={i === 0 ? color.danger : color.inkMuted} style={{ flex: 1 }}>
            {d}
          </AppText>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          const sec = days[ymdToIso(d)] ?? 0;
          const lv = level(sec);
          const future = d > today;
          const on = d === pick;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${parseYmd(d).d}일 ${sec ? hm(sec) : '기록 없음'}`}
              disabled={future}
              onPress={() => setPick(d)}
              style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
              <View style={{ flex: 1, borderRadius: 10, overflow: 'hidden', borderWidth: on ? 2 : 0, borderColor: color.accent, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.navy, opacity: OPACITY[lv] }} />
                <AppText variant="caption" weight="semibold" color={lv >= 3 ? color.onNavy : future ? color.inkFaint : color.ink}>
                  {parseYmd(d).d}
                </AppText>
                {sec ? (
                  <AppText style={{ fontSize: 10, lineHeight: 12 }} color={lv >= 3 ? color.onNavy : color.inkMuted}>
                    {sec >= 3600 ? `${Math.floor(sec / 3600)}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}` : `${Math.floor(sec / 60)}분`}
                  </AppText>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: color.lineSoft, paddingTop: space.md, gap: 6 }}>
        <AppText variant="label">
          {parseYmd(pick).m}월 {parseYmd(pick).d}일 · {hm(days[pickIso] ?? 0)}
        </AppText>
        {pickSubjects.length === 0 ? (
          <AppText variant="caption" color={color.inkMuted}>
            {month.error ? month.error : '이날은 기록이 없어요.'}
          </AppText>
        ) : (
          pickSubjects.map(([name, sec]) => (
            <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colorOf(name) }} />
              <AppText variant="caption" style={{ flex: 1 }}>
                {name || '자습'}
              </AppText>
              <AppText variant="caption" color={color.inkMuted}>
                {hm(sec)}
              </AppText>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function Nav({ label, a11y, onPress, disabled }: { label: string; a11y: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} disabled={disabled} onPress={onPress} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}>
      <AppText variant="heading">{label}</AppText>
    </Pressable>
  );
}
