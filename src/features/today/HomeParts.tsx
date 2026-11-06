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
import { NoticeStrip } from '@/features/notice/NoticeStrip';
import { SurveyStrip } from '@/features/voice/SurveyStrip';
import { FeedbackCard } from '@/features/feedback/FeedbackCard';

/** 오늘의 한 마디(날마다 바뀜). 인사말 아래 작게 */
export function QuoteLine({ today }: { today: Ymd }) {
  const q = quoteOf(today);
  return (
    <View accessible accessibilityLabel={`오늘의 한 마디. ${q.text} ${q.by}`} style={{ borderLeftWidth: 3, borderLeftColor: color.accent, paddingLeft: space.md }}>
      <AppText variant="caption" color={color.inkMuted} style={{ fontStyle: 'italic' }} numberOfLines={2}>
        “{q.text}” — {q.by}
      </AppText>
    </View>
  );
}

/** 홈 바로 가기 8칸: 매일 쓰는 것 4 + 학생회 2 + 즐길 거리 2 (나머지는 '전체') */
const QUICK = ['timetable', 'meal', 'tasks', 'calendar', 'notice', 'voice', 'study', 'games'];

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

/** 홈 '학생회' 묶음: 학생 공지 · 참여할 설문 · 건의/설문 바로 가기 · 앱 의견(출시 이벤트) · 행사 사진 */
export function CouncilSection() {
  const router = useRouter();
  const open = useOpenFeature();
  return (
    <View style={{ gap: space.md }}>
      <SectionTitle
        title="🏫 학생회"
        right={
          <Pressable accessibilityRole="button" accessibilityLabel="운중 보이스 열기" onPress={() => open('voice')} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }}>
            <AppText variant="label" color={color.navy}>
              운중 보이스 ›
            </AppText>
          </Pressable>
        }
      />
      <NoticeStrip />
      <SurveyStrip />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <MiniTile emoji="📢" title="학생회에 건의" sub="익명 · 공감 많으면 안건으로" onPress={() => router.push('/voice/suggest')} />
        <MiniTile emoji="🗳️" title="설문·건의 보기" sub="참여하면 토큰" onPress={() => open('voice')} />
      </View>
      <FeedbackCard />
      <GalleryStrip />
    </View>
  );
}

function MiniTile({ emoji, title, sub, onPress }: { emoji: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, minHeight: 76, backgroundColor: pressed ? color.surfaceMuted : color.surface, borderRadius: radius.card, padding: space.lg, gap: 2 })}>
      <AppText variant="bodyStrong" numberOfLines={1}>
        {emoji} {title}
      </AppText>
      <AppText variant="caption" color={color.inkMuted} numberOfLines={2}>
        {sub}
      </AppText>
    </Pressable>
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
