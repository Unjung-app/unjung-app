import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { useOpenFeature } from '@/features/hooks';
import { useAuth } from '@/state/auth';
import { color, radius, space } from '@/theme/tokens';
import { KIND_EMOJI, useNoticeFeed } from './data';

const SEEN_KEY = 'unjung.notice.seen';

/** 학생 공지 화면을 열면 '여기까지 봤음'을 기기에 적어 둔다 */
export async function markNoticesSeen(maxId: number) {
  try {
    await AsyncStorage.setItem(SEEN_KEY, String(maxId));
  } catch {
    // 저장이 안 돼도 다음에 '새 공지'로 한 번 더 보일 뿐
  }
}

/** '오늘' 홈: 게시 중인 학생 공지 최신 2개 + 안 본 개수 (없으면 안 그린다) */
export function NoticeStrip() {
  const openFeature = useOpenFeature();
  const { status } = useAuth();
  const { items } = useNoticeFeed(status === 'ready');
  const [seen, setSeen] = useState<number | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((v) => setSeen(v ? Number(v) : 0))
      .catch(() => setSeen(0));
  }, [items]);

  if (!items || items.length === 0) return null;
  const fresh = seen === null ? 0 : items.filter((n) => n.id > seen).length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`학생 공지 ${items.length}개${fresh ? `, 새 공지 ${fresh}개` : ''}. 열기`}
      onPress={() => {
        markNoticesSeen(Math.max(...items.map((n) => n.id)));
        openFeature('notice');
      }}
      style={({ pressed }) => ({ backgroundColor: pressed ? color.surfaceMuted : color.surface, borderRadius: radius.card, padding: space.xl, gap: space.sm })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <AppText variant="heading" style={{ flex: 1 }}>
          학생 공지
        </AppText>
        {fresh ? (
          <View style={{ backgroundColor: color.danger, borderRadius: radius.round, paddingHorizontal: 8, paddingVertical: 2 }}>
            <AppText variant="caption" weight="bold" color={color.onNavy}>
              새 {fresh}
            </AppText>
          </View>
        ) : null}
        <Icon name="chevronRight" size={18} color={color.inkFaint} />
      </View>
      {items.slice(0, 2).map((n) => (
        <AppText key={n.id} variant="body" numberOfLines={1}>
          {KIND_EMOJI[n.kind]} {n.title}
        </AppText>
      ))}
    </Pressable>
  );
}
