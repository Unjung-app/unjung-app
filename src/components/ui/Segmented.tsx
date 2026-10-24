import { Pressable, View } from 'react-native';
import { AppText } from './AppText';
import { color, radius } from '@/theme/tokens';

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', backgroundColor: color.surfaceMuted, borderRadius: radius.control, padding: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: radius.control - 3,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? color.surface : 'transparent',
            }}>
            <AppText variant="label" color={on ? color.navy : color.inkMuted} weight={on ? 'bold' : 'semibold'}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** ‹ 이번 주 › 같은 이전/다음 이동 줄 */
export function Stepper({
  label,
  onPrev,
  onNext,
  onReset,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onReset?: () => void;
}) {
  const btn = (text: string, a11y: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? color.surfaceMuted : 'transparent',
      })}>
      <AppText variant="heading" color={color.navy}>
        {text}
      </AppText>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {btn('‹', '이전', onPrev)}
      <Pressable accessibilityRole="button" disabled={!onReset} onPress={onReset} hitSlop={8}>
        <AppText variant="bodyStrong">{label}</AppText>
      </Pressable>
      {btn('›', '다음', onNext)}
    </View>
  );
}
