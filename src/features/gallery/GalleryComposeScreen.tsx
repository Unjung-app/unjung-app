import { useState } from 'react';
import { Image, Platform, Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { inputStyle } from '@/features/voice/ui';
import { seoulNow, ymdToIso } from '@/lib/date';
import { pickPhotos, type PickedPhoto } from '@/lib/photos';
import { useAuth } from '@/state/auth';
import { color, space } from '@/theme/tokens';
import { postGallery, uploadPhotos, useIsComm } from './data';

const MAX = 30;

/** 소통홍보부: 행사 사진 올리기(사진은 직접, 영상은 유튜브 링크) */
export function GalleryComposeScreen() {
  const router = useRouter();
  const { status, session } = useAuth();
  const comm = useIsComm(status === 'ready');
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(ymdToIso(seoulNow().ymd));
  const [body, setBody] = useState('');
  const [yt, setYt] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!comm) {
    return (
      <Screen topInset={false}>
        <AppText variant="body" color={color.inkMuted}>
          소통홍보부만 행사 사진을 올릴 수 있어요.
        </AppText>
      </Screen>
    );
  }

  const submit = async () => {
    setErr(null);
    if (title.trim().length < 2) return setErr('제목을 2자 이상 써 주세요.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return setErr('날짜는 2026-11-09처럼 써 주세요.');
    if (!photos.length && !yt.trim()) return setErr('사진이나 유튜브 링크를 하나 이상 넣어 주세요.');
    setBusy(`사진 올리는 중 0/${photos.length}`);
    const up = await uploadPhotos(session!.user.id, photos.map((p) => p.blob), (n) => setBusy(`사진 올리는 중 ${n}/${photos.length}`));
    if (!up.ok) {
      setBusy(null);
      return setErr(up.message);
    }
    setBusy('저장하는 중…');
    const r = await postGallery({ title: title.trim(), body: body.trim(), eventDate: day, photos: up.paths, youtube: yt.trim() });
    setBusy(null);
    if (!r.ok) return setErr(r.message);
    router.replace(`/gallery/${r.id}`);
  };

  return (
    <Screen topInset={false}>
      <Field label="행사 이름">
        <TextInput accessibilityLabel="행사 이름" value={title} onChangeText={(t) => setTitle(t.slice(0, 40))} placeholder="예) 2026 체육대회" placeholderTextColor={color.inkFaint} style={{ ...inputStyle, minHeight: 48 }} />
      </Field>
      <Field label="행사 날짜">
        <TextInput accessibilityLabel="행사 날짜" value={day} onChangeText={(t) => setDay(t.replace(/[^0-9-]/g, '').slice(0, 10))} placeholder="2026-11-09" placeholderTextColor={color.inkFaint} style={{ ...inputStyle, minHeight: 48 }} />
      </Field>
      <Field label="한 줄 설명 (선택)">
        <TextInput accessibilityLabel="설명" value={body} onChangeText={(t) => setBody(t.slice(0, 500))} multiline placeholder="어떤 행사였는지 짧게" placeholderTextColor={color.inkFaint} style={{ ...inputStyle, minHeight: 72, textAlignVertical: 'top', paddingVertical: space.sm }} />
      </Field>

      <Field label={`사진 (${photos.length}/${MAX})`}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {photos.map((p, i) => (
            <Pressable key={p.preview} accessibilityRole="button" accessibilityLabel={`사진 ${i + 1} 빼기`} onPress={() => setPhotos((ps) => ps.filter((_, k) => k !== i))} style={{ width: '23.8%', aspectRatio: 1 }}>
              <Image source={{ uri: p.preview }} style={{ width: '100%', height: '100%', borderRadius: 6 }} />
              <View style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: color.navy, alignItems: 'center', justifyContent: 'center' }}>
                <AppText variant="caption" color={color.onNavy}>
                  ✕
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
        <Button
          label={Platform.OS === 'web' ? `📷 사진 고르기 (여러 장 한 번에)` : '사진은 웹 앱에서 올릴 수 있어요'}
          variant="soft"
          disabled={Platform.OS !== 'web' || photos.length >= MAX}
          onPress={async () => {
            setErr(null);
            setBusy('사진 줄이는 중…');
            const picked = await pickPhotos(MAX - photos.length);
            setBusy(null);
            setPhotos((ps) => [...ps, ...picked].slice(0, MAX));
          }}
        />
        <AppText variant="caption" color={color.inkFaint}>
          사진은 자동으로 줄여서(긴 변 1600px) 올라가요. 위치 정보는 지워져요. 사진을 누르면 빠져요.
        </AppText>
      </Field>

      <Field label="영상 (유튜브 링크, 선택)">
        <TextInput accessibilityLabel="유튜브 링크" value={yt} onChangeText={setYt} autoCapitalize="none" placeholder="https://youtu.be/..." placeholderTextColor={color.inkFaint} style={{ ...inputStyle, minHeight: 48 }} />
        <AppText variant="caption" color={color.inkFaint}>
          영상은 유튜브에 '일부 공개'로 올린 뒤 링크를 붙여 넣어 주세요. 앱 안에서 바로 재생돼요.
        </AppText>
      </Field>

      {err ? (
        <AppText variant="label" color={color.danger}>
          {err}
        </AppText>
      ) : null}
      <Button label={busy ?? '올리기'} disabled={!!busy} onPress={submit} />
      <Card tone="muted">
        <AppText variant="caption" color={color.inkMuted}>
          학생 얼굴이 크게 나온 사진은 본인이 괜찮다고 한 것만 올려 주세요. 올린 글은 내가 언제든 지울 수 있어요.
        </AppText>
      </Card>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="label">{label}</AppText>
      {children}
    </View>
  );
}
