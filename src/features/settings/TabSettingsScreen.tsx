import { Pressable, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button, Divider } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { DEFAULT_TABS, FEATURE_BY_ID, FEATURES, MAX_CUSTOM_TABS } from '@/features/registry';
import { usePrefs } from '@/state/prefs';
import { color, radius, space } from '@/theme/tokens';

function RoundButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.3 : 1,
        backgroundColor: pressed ? color.surfaceMuted : 'transparent',
      })}>
      <Icon name={icon} size={20} color={color.navy} />
    </Pressable>
  );
}

export function TabSettingsScreen() {
  const { tabs, setTabs } = usePrefs();
  const full = tabs.length >= MAX_CUSTOM_TABS;
  const available = FEATURES.filter((f) => !tabs.includes(f.id));

  const move = (i: number, dir: -1 | 1) => {
    const next = [...tabs];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setTabs(next);
  };

  const preview: { label: string; icon: IconName }[] = [
    { label: '오늘', icon: 'today' },
    ...tabs.map((id) => ({ label: FEATURE_BY_ID[id].short, icon: FEATURE_BY_ID[id].icon })),
    { label: '전체', icon: 'more' },
  ];

  return (
    <Screen topInset={false}>
      <View
        accessible
        accessibilityLabel={`미리보기: ${preview.map((p) => p.label).join(', ')}`}
        style={{ flexDirection: 'row', backgroundColor: color.surface, borderRadius: radius.card, paddingVertical: space.md }}>
        {preview.map((p, i) => (
          <View key={`${p.label}-${i}`} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
            <Icon name={p.icon} size={22} color={i === 0 || i === preview.length - 1 ? color.inkFaint : color.navy} />
            <AppText variant="tab" color={i === 0 || i === preview.length - 1 ? color.inkFaint : color.navy}>
              {p.label}
            </AppText>
          </View>
        ))}
      </View>
      <AppText variant="caption" color={color.inkMuted}>
        ‘오늘’과 ‘전체’는 항상 고정이고, 가운데 {MAX_CUSTOM_TABS}칸을 원하는 기능으로 채울 수 있어요.
      </AppText>

      <AppText variant="heading" style={{ marginTop: space.sm }}>
        내 탭 ({tabs.length}/{MAX_CUSTOM_TABS})
      </AppText>
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        {tabs.length === 0 ? (
          <View style={{ padding: space.lg }}>
            <AppText variant="body" color={color.inkMuted}>
              아래에서 기능을 추가해 보세요
            </AppText>
          </View>
        ) : (
          tabs.map((id, i) => {
            const f = FEATURE_BY_ID[id];
            return (
              <View key={id}>
                {i > 0 ? <Divider /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: space.lg, minHeight: 56 }}>
                  <Icon name={f.icon} size={20} color={color.navy} />
                  <AppText variant="bodyStrong" style={{ flex: 1, marginLeft: space.md }}>
                    {f.title}
                  </AppText>
                  <RoundButton icon="arrowUp" label={`${f.title} 위로`} disabled={i === 0} onPress={() => move(i, -1)} />
                  <RoundButton icon="arrowDown" label={`${f.title} 아래로`} disabled={i === tabs.length - 1} onPress={() => move(i, 1)} />
                  <RoundButton icon="minus" label={`${f.title} 빼기`} onPress={() => setTabs(tabs.filter((t) => t !== id))} />
                </View>
              </View>
            );
          })
        )}
      </View>

      <AppText variant="heading" style={{ marginTop: space.sm }}>
        추가할 수 있는 기능
      </AppText>
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        {available.map((f, i) => (
          <View key={f.id}>
            {i > 0 ? <Divider /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: space.lg, minHeight: 56 }}>
              <Icon name={f.icon} size={20} color={color.inkMuted} />
              <View style={{ flex: 1, marginLeft: space.md }}>
                <AppText variant="bodyStrong">{f.title}</AppText>
                {f.status === 'soon' ? (
                  <AppText variant="caption" color={color.inkFaint}>
                    준비 중
                  </AppText>
                ) : null}
              </View>
              <RoundButton icon="plus" label={`${f.title} 추가`} disabled={full} onPress={() => setTabs([...tabs, f.id])} />
            </View>
          </View>
        ))}
      </View>
      {full ? (
        <AppText variant="caption" color={color.inkMuted}>
          탭이 가득 찼어요. 하나를 빼면 새로 추가할 수 있어요.
        </AppText>
      ) : null}

      <Button label="기본값으로 되돌리기" variant="ghost" onPress={() => setTabs(DEFAULT_TABS)} />
    </Screen>
  );
}
