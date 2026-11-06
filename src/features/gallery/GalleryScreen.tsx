import { useCallback } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/state/auth';
import { color, radius, space } from '@/theme/tokens';
import { photoUrl, useGallery, useIsComm, youtubeThumb, type GalleryPost } from './data';

/** 행사 사진: 소통홍보부가 올린 학교 행사 사진·영상 모음 */
export function GalleryScreen({ inStack = false }: { inStack?: boolean }) {
  const router = useRouter();
  const { status } = useAuth();
  const ready = status === 'ready';
  const g = useGallery(ready);
  const comm = useIsComm(ready);
  useFocusEffect(
    useCallback(() => {
      g.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [g.reload]),
  );

  return (
    <Screen topInset={!inStack} onRefresh={g.reload}>
      {!inStack ? (
        <AppText variant="title" accessibilityRole="header">
          행사 사진
        </AppText>
      ) : null}
      {!ready ? (
        <Card tone="navy" style={{ gap: space.md }}>
          <AppText variant="heading" color={color.onNavy}>
            학교 계정으로 로그인하면 행사 사진을 볼 수 있어요
          </AppText>
          <Button label="로그인하기" variant="soft" style={{ backgroundColor: color.surface }} onPress={() => router.push('/login')} />
        </Card>
      ) : null}
      {comm ? <Button label="📷 행사 사진 올리기" onPress={() => router.push('/gallery/new')} /> : null}
      {g.items && g.items.length === 0 ? (
        <Card tone="muted">
          <AppText variant="body" color={color.inkMuted}>
            아직 올라온 행사 사진이 없어요. 소통홍보부가 곧 올릴 거예요!
          </AppText>
        </Card>
      ) : null}
      {g.error ? (
        <AppText variant="caption" color={color.danger}>
          {g.error}
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md }}>
        {(g.items ?? []).map((p) => (
          <GalleryTile key={p.id} p={p} onPress={() => router.push(`/gallery/${p.id}`)} />
        ))}
      </View>
    </Screen>
  );
}

export function coverOf(p: GalleryPost) {
  return p.photos[0] ? photoUrl(p.photos[0]) : p.youtube ? youtubeThumb(p.youtube) : null;
}

export function GalleryTile({ p, onPress, width = '48%' }: { p: GalleryPost; onPress: () => void; width?: `${number}%` | number }) {
  const cover = coverOf(p);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${p.title}, ${p.event_date}, 사진 ${p.photos.length}장${p.youtube ? ', 영상' : ''}`}
      onPress={onPress}
      style={({ pressed }) => ({ width, backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden', opacity: pressed ? 0.85 : 1 })}>
      <View style={{ aspectRatio: 4 / 3, backgroundColor: color.surfaceMuted }}>
        {cover ? <Image source={{ uri: cover }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
        {p.youtube ? (
          <View style={{ position: 'absolute', right: 8, bottom: 8, backgroundColor: color.navy, borderRadius: radius.round, paddingHorizontal: 8, paddingVertical: 2 }}>
            <AppText variant="caption" color={color.onNavy}>
              ▶ 영상
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={{ padding: space.md, gap: 2 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {p.title}
        </AppText>
        <AppText variant="caption" color={color.inkMuted}>
          {p.event_date.slice(5).replace('-', '/')} · 사진 {p.photos.length}장
        </AppText>
      </View>
    </Pressable>
  );
}
