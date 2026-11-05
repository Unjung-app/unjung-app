import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { FEATURE_BY_ID } from '@/features/registry';
import { usePrefs } from '@/state/prefs';
import { color, MAX_APP_WIDTH } from '@/theme/tokens';

type Item = { name: string; label: string; icon: IconName };

/** 하단 탭바: [오늘] + 학생이 고른 기능(최대 3) + [전체] */
export function TabBar() {
  const insets = useSafeAreaInsets();
  const { tabs } = usePrefs();
  const items: Item[] = [
    { name: 'index', label: '오늘', icon: 'today' },
    ...tabs.map((id) => ({ name: id, label: FEATURE_BY_ID[id].short, icon: FEATURE_BY_ID[id].icon })),
    { name: 'more', label: '전체', icon: 'more' },
  ];

  return (
    <View
      accessibilityRole="tablist"
      style={{
        backgroundColor: color.surface,
        borderTopWidth: 1,
        borderTopColor: color.lineSoft,
        paddingBottom: Math.max(insets.bottom, 8),
      }}>
      <View style={{ flexDirection: 'row', width: '100%', maxWidth: MAX_APP_WIDTH, alignSelf: 'center' }}>
        {items.map((item) => (
          <TabTrigger key={item.name} name={item.name} asChild>
            <TabButton label={item.label} icon={item.icon} />
          </TabTrigger>
        ))}
      </View>
    </View>
  );
}

function TabButton({ label, icon, isFocused, onPress, ref, ...rest }: TabTriggerSlotProps & { label: string; icon: IconName }) {
  // expo-router의 slot 타입이 ref를 RN 0.88의 요소 타입과 다르게 선언해 둬서 형 변환만 한다(동작은 같음)
  const tint = isFocused ? color.navy : color.inkFaint;
    return (
      <Pressable
        ref={ref as never}
        {...rest}
        onPress={(e) => {
          if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
          onPress?.(e);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: !!isFocused }}
        accessibilityLabel={label}
        style={{ flex: 1, height: 58, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <Icon name={icon} size={24} color={tint} strokeWidth={isFocused ? 2.1 : 1.9} />
        <AppText variant="tab" weight={isFocused ? 'bold' : 'semibold'} color={tint}>
          {label}
        </AppText>
      </Pressable>
    );
}
