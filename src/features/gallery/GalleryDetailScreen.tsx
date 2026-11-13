import { createElement, useState } from 'react';
import { Image, Modal, Platform, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/state/auth';
import { color, focus as F, radius, space } from '@/theme/tokens';
import { deleteGallery, photoUrl, useGallery, youtubeEmbed } from './data';

export function GalleryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, session, role } = useAuth();
  const g = useGallery(status === 'ready', 60);
  const p = g.items?.find((x) => String(x.id) === String(id));
  const [open, setOpen] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);

  if (!p) {
    return (
      <Screen topInset={false}>
        <AppText variant="body" color={color.inkMuted}>
          {g.items ? '없는 글이에요.' : '불러오는 중…'}
        </AppText>
      </Screen>
    );
  }
  const mine = session?.user.id === p.author || role === 'admin';

  return (
    <Screen topInset={false} onRefresh={g.reload}>
      <View style={{ gap: 4 }}>
        <AppText variant="title">{p.title}</AppText>
        <AppText variant="caption" color={color.inkMuted}>
          {p.event_date.replace(/-/g, '.')} · 소통홍보부
        </AppText>
      </View>
      {p.body ? <AppText variant="body">{p.body}</AppText> : null}

      {p.youtube && Platform.OS === 'web' ? (
        <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: radius.card, overflow: 'hidden', backgroundColor: F.bg }}>
          {createElement('iframe', {
            src: youtubeEmbed(p.youtube),
            title: `${p.title} 영상`,
            allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen',
            allowFullScreen: true,
            style: { border: 0, width: '100%', height: '100%' },
          })}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {p.photos.map((ph, i) => (
          <Pressable key={ph} accessibilityRole="imagebutton" accessibilityLabel={`사진 ${i + 1} 크게 보기`} onPress={() => setOpen(i)} style={{ width: '32.6%', aspectRatio: 1 }}>
            <Image source={{ uri: photoUrl(ph) }} style={{ width: '100%', height: '100%', borderRadius: 6, backgroundColor: color.surfaceMuted }} resizeMode="cover" />
          </Pressable>
        ))}
      </View>

      {mine ? (
        confirm ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="취소" variant="soft" style={{ flex: 1 }} onPress={() => setConfirm(false)} />
            <Button
              label="지우기"
              style={{ flex: 1, backgroundColor: color.danger }}
              onPress={async () => {
                const e = await deleteGallery(p.id);
                if (!e) router.back();
              }}
            />
          </View>
        ) : (
          <Button label="이 글 지우기" variant="ghost" onPress={() => setConfirm(true)} />
        )
      ) : null}

      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: F.scrim, justifyContent: 'center' }}>
          {open !== null ? <Image source={{ uri: photoUrl(p.photos[open]) }} style={{ width: '100%', height: '80%' }} resizeMode="contain" accessibilityLabel={`사진 ${open + 1}`} /> : null}
          <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xl }}>
            <Nav label="‹" a11y="이전 사진" disabled={!open} onPress={() => setOpen((o) => (o ? o - 1 : o))} />
            <AppText color={F.ink}>
              {(open ?? 0) + 1} / {p.photos.length}
            </AppText>
            <Nav label="›" a11y="다음 사진" disabled={open === null || open >= p.photos.length - 1} onPress={() => setOpen((o) => (o !== null && o < p.photos.length - 1 ? o + 1 : o))} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" onPress={() => setOpen(null)} style={{ position: 'absolute', top: 40, right: 16, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
            <AppText color={F.ink} style={{ fontSize: 26, lineHeight: 30 }}>
              ✕
            </AppText>
          </Pressable>
        </View>
      </Modal>
    </Screen>
  );
}

function Nav({ label, a11y, onPress, disabled }: { label: string; a11y: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} disabled={disabled} onPress={onPress} style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: F.surface, opacity: disabled ? 0.3 : 1 }}>
      <AppText color={F.ink} style={{ fontSize: 28, lineHeight: 32 }}>
        {label}
      </AppText>
    </Pressable>
  );
}
