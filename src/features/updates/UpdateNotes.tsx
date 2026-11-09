import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { APP_VERSION } from '@/lib/build';
import { color, radius, space } from '@/theme/tokens';
import { CHANGELOG, newer } from './changelog';

const SEEN_KEY = 'unjung.updates.seen.v1';

/**
 * 홈 맨 위: 마지막으로 본 버전 이후의 업데이트 소식 카드. '확인'을 누르면 다음 업데이트까지 숨긴다.
 * (처음 쓰는 학생에게는 1.0.0 출시 소식은 빼고 그 뒤 업데이트만 보여 준다)
 */
export function UpdateNotesCard() {
  const router = useRouter();
  const [seen, setSeen] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((v) => setSeen(v))
      .catch(() => setSeen(APP_VERSION));
  }, []);
  if (seen === undefined) return null;
  const since = seen ?? '1.0.0';
  const fresh = CHANGELOG.filter((e) => newer(e.version, since) && !newer(e.version, APP_VERSION));
  if (!fresh.length) return null;
  const top = fresh[0];
  const close = () => {
    AsyncStorage.setItem(SEEN_KEY, APP_VERSION).catch(() => {});
    setSeen(APP_VERSION);
  };
  return (
    <Card style={{ gap: space.sm, borderWidth: 2, borderColor: color.accent }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <AppText variant="label" color={color.accentInk} style={{ flex: 1 }}>
          🆕 업데이트 v{top.version}
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="업데이트 소식 전체 보기" onPress={() => router.push('/settings/updates')} hitSlop={10} style={{ minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="label" color={color.navy}>
            지난 소식 ›
          </AppText>
        </Pressable>
      </View>
      <AppText variant="bodyStrong">{top.title}</AppText>
      {fresh.flatMap((e) => e.items).slice(0, 6).map((t) => (
        <AppText key={t} variant="body" color={color.inkMuted}>
          {t}
        </AppText>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="확인했어요"
        onPress={close}
        style={({ pressed }) => ({ minHeight: 44, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? color.accentSoft : color.surfaceMuted })}>
        <AppText variant="label">확인했어요</AppText>
      </Pressable>
    </Card>
  );
}

/** 전체 → 업데이트 소식: 모든 버전의 바뀐 점 */
export function UpdatesScreen() {
  return (
    <Screen topInset={false}>
      <AppText variant="caption" color={color.inkMuted}>
        지금 버전 v{APP_VERSION} · 학생 의견으로 계속 고쳐 나가요. 바라는 점은 전체 → 앱 의견 보내기로!
      </AppText>
      {CHANGELOG.filter((e) => !newer(e.version, APP_VERSION)).map((e) => (
        <Card key={e.version} style={{ gap: space.sm }}>
          <AppText variant="label" color={color.accentInk}>
            v{e.version} · {e.date.slice(5).replace('-', '/')}
          </AppText>
          <AppText variant="bodyStrong">{e.title}</AppText>
          {e.items.map((t) => (
            <AppText key={t} variant="body" color={color.inkMuted}>
              {t}
            </AppText>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
