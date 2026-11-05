import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { color, MAX_APP_WIDTH, space } from '@/theme/tokens';

/** 모든 화면의 바탕. 스크롤·당겨서 새로고침·넓은 화면 가운데 정렬을 맡는다. */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
  contentStyle,
  topInset = true,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** 헤더가 없는 탭 화면은 상단 안전영역만큼 띄운다 */
  topInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={{ paddingTop: topInset ? insets.top + space.lg : space.lg, paddingBottom: space.xxxl }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
      showsVerticalScrollIndicator={false}>
      <View
        style={[
          { width: '100%', maxWidth: MAX_APP_WIDTH, alignSelf: 'center', paddingHorizontal: space.xl, gap: space.md },
          contentStyle,
        ]}>
        {children}
      </View>
    </ScrollView>
  );
}
