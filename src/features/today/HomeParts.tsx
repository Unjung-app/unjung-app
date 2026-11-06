import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SectionTitle } from '@/components/ui/primitives';
import { FEATURE_BY_ID } from '@/features/registry';
import { useOpenFeature } from '@/features/hooks';
import { GalleryTile } from '@/features/gallery/GalleryScreen';
import { useGallery } from '@/features/gallery/data';
import type { Ymd } from '@/lib/date';
import { useAuth } from '@/state/auth';
import { color, radius, space } from '@/theme/tokens';
import { quoteOf } from './quotes';

/** 오늘의 한 마디(날마다 바뀜) */
export function QuoteLine({ today }: { today: Ymd }) {
  const q = quoteOf(today);
  return (
    <View accessible accessibilityLabel={`오늘의 한 마디. ${q.text} ${q.by}`} style={{ borderLeftWidth: 3, borderLeftColor: color.accent, paddingLeft: space.md, paddingVertical: 2, gap: 2 }}>
      <AppText variant="body" style={{ fontStyle: 'italic' }}>
        “{q.text}”
      </AppText>
      <AppText variant="caption" color={color.inkMuted}>
        — {q.by}
      </AppText>
    </View>
  );
}

const QUICK = ['timetable', 'meal', 'study', 'games', 'notice', 'gallery', 'calendar', 'lost'];

/** 바로 가기: 자주 쓰는 기능 8개를 한 번에 */
export function QuickGrid() {
  const open = useOpenFeature();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: color.surface, borderRadius: radius.card, paddingVertical: space.sm }}>
      {QUICK.map((id) => {
        const f = FEATURE_BY_ID[id];
        if (!f) return null;
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={f.title}
            onPress={() => open(id)}
            style={({ pressed }) => ({ width: '25%', minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: radius.control, backgroundColor: pressed ? color.surfaceMuted : 'transparent' })}>
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={f.icon as IconName} size={22} color={color.navy} />
            </View>
            <AppText variant="caption" weight="semibold" numberOfLines={1}>
              {f.short}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 최근 행사 사진(소통홍보부). 글이 없으면 숨긴다 */
export function GalleryStrip() {
  const router = useRouter();
  const open = useOpenFeature();
  const { status } = useAuth();
  const g = useGallery(status === 'ready', 6);
  if (!g.items?.length) return null;
  return (
    <View style={{ gap: space.sm }}>
      <SectionTitle
        title="📷 행사 사진"
        right={
          <Pressable accessibilityRole="button" accessibilityLabel="행사 사진 모두 보기" onPress={() => open('gallery')} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }}>
            <AppText variant="label" color={color.navy}>
              모두 보기 ›
            </AppText>
          </Pressable>
        }
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
        {g.items.map((p) => (
          <View key={p.id} style={{ width: 200 }}>
            <GalleryTile p={p} width="100%" onPress={() => router.push(`/gallery/${p.id}`)} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
