import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

/** 글 입력칸 공통 모양 */
export const inputStyle = {
  borderWidth: 1,
  borderColor: color.line,
  borderRadius: radius.control,
  paddingHorizontal: space.md,
  fontSize: 15,
  color: color.ink,
  backgroundColor: color.surface,
  ...fontStyle('regular'),
} as const;

/** 하나를 고르는 칩(누를 수 있는 높이 44) */
export function PickChip({ label, on, onPress, a11y }: { label: string; on: boolean; onPress: () => void; a11y?: string }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={a11y ?? label}
      onPress={onPress}
      style={{ minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.round, justifyContent: 'center', backgroundColor: on ? color.navy : color.surfaceMuted }}>
      <AppText variant="label" color={on ? color.onNavy : color.ink}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{children}</View>;
}

/** 결과 막대: 보기 · 표 · 수(%) */
export function ResultBar({ label, count, total, mine }: { label: string; count: number; total: number; mine?: boolean }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View accessibilityLabel={`${label} ${count}명 ${pct}퍼센트`} style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <AppText variant="label" weight={mine ? 'bold' : 'semibold'} style={{ flex: 1 }}>
          {mine ? '✓ ' : ''}
          {label}
        </AppText>
        <AppText variant="label" color={color.inkMuted}>
          {count}명 · {pct}%
        </AppText>
      </View>
      <View style={{ height: 10, borderRadius: radius.round, backgroundColor: color.surfaceMuted, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', borderRadius: radius.round, backgroundColor: mine ? color.accent : color.navy }} />
      </View>
    </View>
  );
}
