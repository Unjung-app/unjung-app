import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { useNow } from '@/features/hooks';
import { LoginPrompt } from '@/features/wallet/LoginPrompt';
import { addDays, parseYmd, weekdayLabel, type Ymd } from '@/lib/date';
import { useAuth } from '@/state/auth';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';
import { KEEP_AT, pickPhoto, PLACES, postLostItem, type LostType } from './data';

export function LostComposeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const now = useNow();
  const { status, session } = useAuth();
  const [type, setType] = useState<LostType>(params.type === 'lost' ? 'lost' : 'found');
  const [item, setItem] = useState('');
  const [place, setPlace] = useState<string | null>(null);
  const [placeOther, setPlaceOther] = useState('');
  const [day, setDay] = useState<Ymd>(now.ymd);
  const [desc, setDesc] = useState('');
  const [keepAt, setKeepAt] = useState<string>('학생회실');
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string } | null>(null);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'signedOut' || !session) return <LoginPrompt what="분실물 올리기" />;

  const placeValue = place === '기타' ? placeOther.trim() : place ?? '';
  const ready = item.trim().length >= 1 && placeValue.length >= 1;
  const days = Array.from({ length: 8 }, (_, i) => addDays(now.ymd, -i));

  const chip = (key: string, label: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={{ minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.round, justifyContent: 'center', backgroundColor: on ? color.navy : color.surfaceMuted }}>
      <AppText variant="label" color={on ? color.onNavy : color.ink}>
        {label}
      </AppText>
    </Pressable>
  );
  const input = {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    fontSize: 15,
    color: color.ink,
    backgroundColor: color.surface,
    ...fontStyle('regular'),
  } as const;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await postLostItem(
      { type, item, place: placeValue, happenedOn: day, description: desc, keepAt: type === 'found' ? keepAt : null, photo: photo?.blob ?? null },
      session.user.id,
    );
    setBusy(false);
    if (r.ok) router.back();
    else setError(r.message);
  };

  return (
    <Screen topInset={false}>
      <Segmented
        label="종류"
        value={type}
        onChange={setType}
        options={[
          { value: 'found', label: '📦 주웠어요' },
          { value: 'lost', label: '🔍 잃어버렸어요' },
        ]}
      />
      <Card>
        <AppText variant="label">무엇을</AppText>
        <TextInput accessibilityLabel="물건" value={item} onChangeText={(t) => setItem(t.slice(0, 30))} placeholder="예) 검정 필통, 에어팟, 체육복" placeholderTextColor={color.inkFaint} style={{ ...input, minHeight: 48 }} />
        <AppText variant="label">어디서</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {[...PLACES, '기타'].map((p) => chip(p, p === '기타' ? '기타(입력)' : p, place === p, () => setPlace(p)))}
        </View>
        {place === '기타' ? (
          <TextInput accessibilityLabel="장소" value={placeOther} onChangeText={(t) => setPlaceOther(t.slice(0, 30))} placeholder="장소를 적어 주세요" placeholderTextColor={color.inkFaint} style={{ ...input, minHeight: 44 }} />
        ) : null}
        <AppText variant="label">언제</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {days.map((d, i) => {
            const { m, d: dd } = parseYmd(d);
            return chip(d, i === 0 ? '오늘' : i === 1 ? '어제' : `${m}/${dd}(${weekdayLabel(d)})`, day === d, () => setDay(d));
          })}
        </ScrollView>
        <AppText variant="label">자세히 (선택)</AppText>
        <TextInput
          accessibilityLabel="설명"
          value={desc}
          onChangeText={(t) => setDesc(t.slice(0, 300))}
          placeholder={type === 'found' ? '색·특징 등. 주인만 아는 특징 하나는 적지 말고 남겨 두면 확인할 때 좋아요' : '색·특징·마지막으로 본 곳 등'}
          placeholderTextColor={color.inkFaint}
          multiline
          style={{ ...input, minHeight: 72, paddingVertical: space.sm, textAlignVertical: 'top' }}
        />
        {type === 'found' ? (
          <>
            <AppText variant="label">어디에 맡겼나요</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>{KEEP_AT.map((k) => chip(k, k, keepAt === k, () => setKeepAt(k)))}</View>
          </>
        ) : null}
      </Card>

      <Card>
        <AppText variant="label">사진 (선택)</AppText>
        {photo ? (
          <View style={{ gap: space.sm }}>
            <Image source={{ uri: photo.preview }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.control, backgroundColor: color.surfaceMuted }} resizeMode="contain" accessibilityLabel="고른 사진" />
            <Button label="사진 빼기" variant="ghost" onPress={() => setPhoto(null)} />
          </View>
        ) : (
          <Button
            label={Platform.OS === 'web' ? '📷 사진 고르기' : '사진은 웹 앱에서 올릴 수 있어요'}
            variant="soft"
            disabled={Platform.OS !== 'web'}
            onPress={async () => {
              setPhotoErr(null);
              const p = await pickPhoto();
              if (p) setPhoto(p);
              else setPhotoErr('사진을 불러오지 못했어요. 다른 사진으로 해 보세요.');
            }}
          />
        )}
        {photoErr ? (
          <AppText variant="caption" color={color.danger}>
            {photoErr}
          </AppText>
        ) : null}
        <AppText variant="caption" color={color.inkMuted}>
          사진은 작게 줄이고 위치 정보를 지운 뒤 올려요. 검토위원이 확인한 뒤에만 다른 학생에게 보여요. 얼굴·이름표가 나오지 않게 찍어 주세요.
        </AppText>
      </Card>

      {error ? (
        <AppText variant="label" weight="regular" color={color.danger}>
          {error}
        </AppText>
      ) : null}
      <Button label={busy ? '올리는 중…' : '올리기'} disabled={!ready || busy} onPress={submit} style={{ minHeight: 52 }} />
    </Screen>
  );
}
