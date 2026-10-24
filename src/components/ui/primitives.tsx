import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { color, radius, space } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export function Card({
  children,
  style,
  tone = 'surface',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'surface' | 'navy' | 'muted';
}) {
  const bg = tone === 'navy' ? color.navy : tone === 'muted' ? color.surfaceMuted : color.surface;
  return (
    <View style={[{ backgroundColor: bg, borderRadius: radius.card, padding: space.xl, gap: space.md }, style]}>
      {children}
    </View>
  );
}

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: 'primary' | 'soft' | 'ghost';
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
};

/** 누를 수 있는 모든 버튼. 높이는 손가락 기준 최소 44px. */
export function Button({ label, variant = 'primary', icon, style, disabled, ...rest }: ButtonProps) {
  const bg = variant === 'primary' ? color.navy : variant === 'soft' ? color.surfaceMuted : 'transparent';
  const fg = variant === 'primary' ? color.onNavy : color.navy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        {
          minHeight: 44,
          paddingHorizontal: space.lg,
          borderRadius: radius.control,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}>
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <AppText variant="bodyStrong" color={fg} style={{ fontSize: 14 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function Chip({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'accent' | 'navy' }) {
  const bg = tone === 'accent' ? color.accentSoft : tone === 'navy' ? color.navy : color.surfaceMuted;
  const fg = tone === 'accent' ? color.accentInk : tone === 'navy' ? color.onNavy : color.ink;
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.chip, backgroundColor: bg }}>
      <AppText variant="body" color={fg} style={{ fontSize: 14, lineHeight: 19 }}>
        {label}
      </AppText>
    </View>
  );
}

export function Badge({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'muted' | 'success' }) {
  const bg = tone === 'accent' ? color.accentSoft : tone === 'success' ? color.successSoft : color.surfaceMuted;
  const fg = tone === 'accent' ? color.accentInk : tone === 'success' ? color.success : color.inkMuted;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.round, backgroundColor: bg }}>
      <AppText variant="caption" weight="semibold" color={fg}>
        {label}
      </AppText>
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <AppText variant="heading">{title}</AppText>
      {right}
    </View>
  );
}

/** 목록의 한 줄(설정·전체 메뉴). */
export function ListRow({
  icon,
  title,
  subtitle,
  right,
  onPress,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        backgroundColor: pressed ? color.surfaceMuted : color.surface,
      })}>
      {icon ? (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: color.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name={icon} size={20} color={color.navy} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color={color.inkMuted}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevronRight" size={18} color={color.inkFaint} /> : null)}
    </Pressable>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: color.lineSoft, marginLeft: space.lg }} />;
}

/** 실데이터가 아닐 때 화면 위에 붙이는 안내. */
export function SampleNotice({ text = '서버 연결 전이라 예시 데이터를 보여 주고 있어요' }: { text?: string }) {
  return (
    <View
      accessibilityRole="text"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: radius.control,
        backgroundColor: color.accentSoft,
      }}>
      <Icon name="info" size={16} color={color.accentInk} />
      <AppText variant="caption" color={color.accentInk} style={{ flex: 1 }}>
        {text}
      </AppText>
    </View>
  );
}
