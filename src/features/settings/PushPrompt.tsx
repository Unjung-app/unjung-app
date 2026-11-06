import { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { enablePush, pushState, syncPush } from '@/lib/push';
import { useAuth } from '@/state/auth';
import { color, space } from '@/theme/tokens';

const DISMISS_KEY = 'unjung.push.prompt.later';
const LATER_DAYS = 7;
/** 처음 한 번은 화면 가운데 창으로 묻는다(호원 결정 11-06: 최초 실행 때 알림 허용 요청) */
const ASKED_KEY = 'unjung.push.asked.v1';

/**
 * '오늘' 홈: 알림을 아직 켜지 않은 학생에게 한 번 권한다('나중에'를 누르면 7일 뒤 다시).
 * 이미 켠 기기라면 열 때마다 구독을 지금 계정으로 다시 저장한다.
 */
export function PushPrompt() {
  const { status } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [first, setFirst] = useState<null | 'ask' | 'install'>(null);

  useEffect(() => {
    if (status !== 'ready') return setShow(false);
    let alive = true;
    (async () => {
      const st = await pushState();
      if (st === 'on') return void syncPush().catch(() => {});
      const asked = await AsyncStorage.getItem(ASKED_KEY).catch(() => '1');
      if (!asked && alive && (st === 'off' || st === 'needs-install')) setFirst(st === 'off' ? 'ask' : 'install');
      if (st !== 'off') return;
      const later = Number((await AsyncStorage.getItem(DISMISS_KEY).catch(() => null)) ?? 0);
      if (alive && Date.now() - later > LATER_DAYS * 86400000) setShow(true);
    })();
    return () => {
      alive = false;
    };
  }, [status]);

  const closeFirst = () => {
    AsyncStorage.setItem(ASKED_KEY, '1').catch(() => {});
    setFirst(null);
  };
  const turnOn = async () => {
    setBusy(true);
    setErr(null);
    const r = await enablePush();
    setBusy(false);
    if (r.ok) {
      setShow(false);
      closeFirst();
    } else setErr(r.message);
  };

  if (first) {
    return (
      <Modal transparent animationType="fade" visible onRequestClose={closeFirst}>
        <View style={{ flex: 1, backgroundColor: color.backdrop, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
          <Card style={{ gap: space.md, width: '100%', maxWidth: 400, alignItems: 'center' }}>
            <AppText style={{ fontSize: 48, lineHeight: 58 }}>🔔</AppText>
            <AppText variant="heading" align="center">
              {first === 'ask' ? '알림을 켜 둘까요?' : '알림을 받으려면 홈 화면에 추가해 주세요'}
            </AppText>
            <AppText variant="body" color={color.inkMuted} align="center">
              {first === 'ask'
                ? '내일 마감 과제, 아침 급식·1교시, 내 글에 달린 반응을 알려 드려요. 수업 시간에는 울리지 않아요.'
                : '아이폰은 사파리에서 공유 버튼 → "홈 화면에 추가"로 설치한 앱에서만 알림을 받을 수 있어요. 설치한 앱으로 다시 열면 알림을 켤 수 있어요.'}
            </AppText>
            {first === 'ask' ? <Button label={busy ? '켜는 중…' : '알림 켜기'} style={{ alignSelf: 'stretch' }} disabled={busy} onPress={turnOn} /> : null}
            <Button label={first === 'ask' ? '나중에' : '확인'} variant="ghost" style={{ alignSelf: 'stretch' }} onPress={closeFirst} />
            {err ? (
              <AppText variant="caption" color={color.danger} align="center">
                {err}
              </AppText>
            ) : null}
          </Card>
        </View>
      </Modal>
    );
  }

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
