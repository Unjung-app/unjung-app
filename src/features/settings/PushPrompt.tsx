import { useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { enablePush, pushState, syncPush } from '@/lib/push';
import { useAuth } from '@/state/auth';
import { color, space } from '@/theme/tokens';

const DISMISS_KEY = 'unjung.push.prompt.later';
const LATER_DAYS = 7;

/**
 * '오늘' 홈: 알림을 아직 켜지 않은 학생에게 한 번 권한다('나중에'를 누르면 7일 뒤 다시).
 * 이미 켠 기기라면 열 때마다 구독을 지금 계정으로 다시 저장한다.
 */
export function PushPrompt() {
  const { status } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'ready') return setShow(false);
    let alive = true;
    (async () => {
      const st = await pushState();
      if (st === 'on') return void syncPush().catch(() => {});
      if (st !== 'off') return;
      const later = Number((await AsyncStorage.getItem(DISMISS_KEY).catch(() => null)) ?? 0);
      if (alive && Date.now() - later > LATER_DAYS * 86400000) setShow(true);
    })();
    return () => {
      alive = false;
    };
  }, [status]);

  if (!show) return null;

  return (
    <Card style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <AppText style={{ fontSize: 28, lineHeight: 34 }}>🔔</AppText>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">알림 켜기</AppText>
          <AppText variant="caption" color={color.inkMuted}>
            내일 마감 과제(저녁 7시)와 아침 급식·1교시를 알려 드려요. 수업 시간에는 울리지 않아요.
          </AppText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button
          label={busy ? '켜는 중…' : '켜기'}
          style={{ flex: 1 }}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            setErr(null);
            const r = await enablePush();
            setBusy(false);
            if (r.ok) setShow(false);
            else setErr(r.message);
          }}
        />
        <Button
          label="나중에"
          variant="ghost"
          style={{ flex: 1 }}
          onPress={() => {
            AsyncStorage.setItem(DISMISS_KEY, String(Date.now())).catch(() => {});
            setShow(false);
          }}
        />
      </View>
      {err ? (
        <AppText variant="caption" color={color.danger}>
          {err}
        </AppText>
      ) : null}
    </Card>
  );
}
