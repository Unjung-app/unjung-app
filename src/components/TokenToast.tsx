import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/AppText';
import { useWallet } from '@/state/wallet';
import { color, MAX_APP_WIDTH, radius, space } from '@/theme/tokens';

const SHOW_MS = 2800;

/** 토큰을 받으면 화면 아래(탭 바 위)에 올라오는 알림. 진동은 지갑(WalletProvider)이 함께 울린다. */
export function TokenToast() {
  const { toast, dismissToast } = useWallet();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!toast) return;
    y.setValue(0);
    pop.setValue(0.6);
    Animated.parallel([
      Animated.timing(y, { toValue: 1, duration: 260, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(120),
        Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
      ]),
    ]).start();
    const t = setTimeout(() => {
      Animated.timing(y, { toValue: 0, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => dismissToast());
    }, SHOW_MS);
    return () => clearTimeout(t);
  }, [toast, y, pop, dismissToast]);

  if (!toast) return null;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 76, alignItems: 'center', paddingHorizontal: space.lg }}>
      <Animated.View
        style={{
          width: '100%',
          maxWidth: MAX_APP_WIDTH - space.lg * 2,
          opacity: y,
          transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        }}>
        <Pressable
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`토큰 ${toast.amount}개를 받았어요. ${toast.label}`}
          onPress={dismissToast}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            backgroundColor: color.navy,
            borderRadius: radius.pill,
            paddingVertical: space.md,
            paddingHorizontal: space.lg,
            minHeight: 56,
            borderWidth: 2,
            borderColor: color.accent,
            shadowColor: color.shadow,
            shadowOpacity: 0.25,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}>
          <Animated.Text style={{ fontSize: 30, transform: [{ scale: pop }] }}>🪙</Animated.Text>
          <View style={{ flex: 1 }}>
            <AppText variant="heading" color={color.accent} style={{ fontSize: 18, lineHeight: 24 }}>
              +{toast.amount} 토큰 받았어요!
            </AppText>
            <AppText variant="caption" color={color.onNavySub} numberOfLines={1}>
              {toast.label}
            </AppText>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
