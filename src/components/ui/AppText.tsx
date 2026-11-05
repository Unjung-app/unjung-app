import { Text, type TextProps, type TextStyle } from 'react-native';
import { color as palette, font, type FontVariant, type FontWeight } from '@/theme/tokens';
import { fontStyle } from '@/theme/fonts';

type Props = TextProps & {
  variant?: FontVariant;
  weight?: FontWeight;
  color?: string;
  align?: TextStyle['textAlign'];
};

/** 앱의 모든 글자는 이 컴포넌트로 쓴다. variant가 크기·줄간격·기본 굵기를 정한다. */
export function AppText({ variant = 'body', weight, color, align, style, ...rest }: Props) {
  const v = font[variant];
  return (
    <Text
      {...rest}
      style={[
        {
          fontSize: v.size,
          lineHeight: v.line,
          color: color ?? palette.ink,
          textAlign: align,
          letterSpacing: v.size >= 22 ? -0.4 : 0,
        },
        fontStyle(weight ?? v.weight),
        style,
      ]}
    />
  );
}
