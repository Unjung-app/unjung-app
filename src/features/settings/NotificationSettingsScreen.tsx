import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button, Card, Divider } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { LoginPrompt } from '@/features/wallet/LoginPrompt';
import { disablePush, enablePush, pushState, type PushState } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/auth';
import { color, radius, space } from '@/theme/tokens';

type Prefs = { mine: boolean; deadline: boolean; morning: boolean; survey: boolean; devices: number };
const ROWS: { key: keyof Omit<Prefs, 'devices'>; title: string; desc: string }[] = [
  { key: 'mine', title: '내 글 소식', desc: '공지 승인·반려, 분실물 응답, 건의 확인, 토큰 받음' },
  { key: 'deadline', title: '과제 마감 전날', desc: '우리 반 게시판에 내일 마감이 있으면 저녁 7시에' },
  { key: 'morning', title: '아침 급식·시간표', desc: '학교 가는 날 아침 7시 30분에 1교시와 점심 메뉴' },
  { key: 'survey', title: '새 학생회 설문', desc: '기획행정부가 설문을 올리면' },
];

/** 알림 설정: 이 기기 알림 켜기/끄기 + 받을 알림 종류 */
export function NotificationSettingsScreen() {
  const router = useRouter();
  const { status } = useAuth();
  const [state, setState] = useState<PushState | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setState(await pushState());
    const { data } = await supabase.rpc('my_push_prefs');
    if (data) setPrefs(data as Prefs);
  }, []);
  useEffect(() => {
    if (status === 'ready' || status === 'needsEnrollment') load();
  }, [status, load]);

  if (status === 'signedOut') return <LoginPrompt what="알림 받기" />;

  const turnOn = async () => {
    setBusy(true);
    setMsg(null);
    const r = await enablePush();
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: '이 기기에서 알림을 받아요.' } : { ok: false, text: r.message });
    load();
  };
  const turnOff = async () => {
    setBusy(true);
    await disablePush();
    setBusy(false);
    setMsg({ ok: true, text: '이 기기의 알림을 껐어요.' });
    load();
  };
  const toggle = async (key: keyof Omit<Prefs, 'devices'>) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    const { data, error } = await supabase.rpc('set_push_prefs', { p_mine: next.mine, p_deadline: next.deadline, p_morning: next.morning, p_survey: next.survey });
    if (error) {
      setPrefs(prefs);
      setMsg({ ok: false, text: '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.' });
    } else if (data) setPrefs(data as Prefs);
  };
  const test = async () => {
    const { data, error } = await supabase.rpc('send_test_push');
    setMsg(error ? { ok: false, text: /[가-힣]/.test(error.message) ? error.message : '보내지 못했어요.' } : data ? { ok: true, text: '시험 알림을 보냈어요. 몇 초 안에 와요.' } : { ok: false, text: '1분 뒤에 다시 보낼 수 있어요.' });
  };

  return (
    <Screen topInset={false}>
      <Card tone={state === 'on' ? 'surface' : 'navy'} style={{ gap: space.md }}>
        {state === null ? (
          <AppText variant="body" color={color.onNavy}>
            확인 중…
          </AppText>
        ) : state === 'on' ? (
          <>
            <AppText variant="heading">🔔 이 기기에서 알림을 받고 있어요</AppText>
            <AppText variant="caption" color={color.inkMuted}>
              알림을 켠 기기 {prefs?.devices ?? 1}대 · 수업 시간에는 보내지 않고 쉬는 시간에 모아서 보내요
            </AppText>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button label="시험 알림 보내기" variant="soft" style={{ flex: 1 }} onPress={test} />
              <Button label="이 기기 끄기" variant="ghost" style={{ flex: 1 }} disabled={busy} onPress={turnOff} />
            </View>
          </>
        ) : state === 'needs-install' ? (
          <>
            <AppText variant="heading" color={color.onNavy}>
              아이폰은 홈 화면에 추가하면 알림을 받을 수 있어요
            </AppText>
            <AppText variant="body" color={color.onNavySub}>
              사파리 공유 버튼 → '홈 화면에 추가' → 홈 화면의 운중고 앱을 열고 여기서 알림을 켜 주세요. (iOS 16.4 이상)
            </AppText>
            <Button label="홈 화면에 추가하는 방법" variant="soft" style={{ backgroundColor: color.surface }} onPress={() => router.push('/settings/install')} />
          </>
        ) : state === 'unsupported' ? (
          <AppText variant="body" color={color.onNavy}>
            이 브라우저는 알림을 지원하지 않아요. 크롬이나 홈 화면에 추가한 앱에서 열어 주세요. (카카오톡 안 브라우저는 안 돼요)
          </AppText>
        ) : state === 'blocked' ? (
          <>
            <AppText variant="heading" color={color.onNavy}>
              알림이 차단되어 있어요
            </AppText>
            <AppText variant="body" color={color.onNavySub}>
              휴대폰 설정 → 앱(또는 크롬) → 알림에서 운중고 앱 알림을 허용한 뒤 다시 열어 주세요.
            </AppText>
          </>
        ) : (
          <>
            <AppText variant="heading" color={color.onNavy} style={{ fontSize: 20, lineHeight: 28 }}>
              알림을 켜면 내일 마감 과제와{'\n'}아침 급식을 알려 드려요
            </AppText>
            <Button label={busy ? '켜는 중…' : '🔔 알림 켜기'} variant="soft" style={{ backgroundColor: color.surface }} disabled={busy} onPress={turnOn} />
          </>
        )}
      </Card>
      {msg ? (
        <AppText variant="label" weight="regular" color={msg.ok ? color.success : color.danger}>
          {msg.text}
        </AppText>
      ) : null}

      <AppText variant="heading" style={{ marginTop: space.sm }}>
        받을 알림
      </AppText>
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        {ROWS.map((r, i) => {
          const on = !!prefs?.[r.key];
          return (
            <View key={r.key}>
              {i ? <Divider /> : null}
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: on, disabled: !prefs }}
                accessibilityLabel={`${r.title}. ${r.desc}`}
                disabled={!prefs}
                onPress={() => toggle(r.key)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, minHeight: 64, backgroundColor: pressed ? color.surfaceMuted : 'transparent' })}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong">{r.title}</AppText>
                  <AppText variant="caption" color={color.inkMuted}>
                    {r.desc}
                  </AppText>
                </View>
                <View style={{ width: 48, height: 28, borderRadius: radius.round, backgroundColor: on ? color.navy : color.line, padding: 3, alignItems: on ? 'flex-end' : 'flex-start' }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color.surface }} />
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
      <AppText variant="caption" color={color.inkMuted}>
        종류 설정은 내 계정의 모든 기기에 함께 적용돼요. 알림에는 이름·학번이 들어가지 않아요.
      </AppText>
    </Screen>
  );
}
