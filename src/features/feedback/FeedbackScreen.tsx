import { useCallback, useEffect, useState } from 'react';
import { Platform, TextInput, View } from 'react-native';
import Constants from 'expo-constants';
import { useLocalSearchParams } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { LoginPrompt } from '@/features/wallet/LoginPrompt';
import { stampLabel } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/auth';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

export type FeedbackKind = 'bug' | 'idea' | 'other';
export type FeedbackStatus = 'new' | 'seen' | 'done' | 'wontfix';
export const KIND_LABEL: Record<FeedbackKind, string> = { bug: '버그', idea: '개선 제안', other: '기타' };
export const STATUS_LABEL: Record<FeedbackStatus, string> = { new: '접수됨', seen: '확인 중', done: '반영 완료', wontfix: '보류' };
export const STATUS_TONE: Record<FeedbackStatus, 'muted' | 'accent' | 'success'> = { new: 'muted', seen: 'accent', done: 'success', wontfix: 'muted' };

type Mine = { id: number; kind: FeedbackKind; body: string; status: FeedbackStatus; reply: string | null; created_at: string };

const PLACEHOLDER: Record<FeedbackKind, string> = {
  bug: '어느 화면에서, 무엇을 했을 때, 어떻게 됐는지 적어 주세요.\n예) 급식 탭에서 금요일을 누르면 화면이 하얗게 돼요',
  idea: '있으면 좋겠는 기능이나 바뀌었으면 하는 점을 적어 주세요.\n예) 시간표에 교실 위치도 보였으면 좋겠어요',
  other: '앱에 대해 하고 싶은 말을 자유롭게 적어 주세요.',
};

function deviceInfo() {
  if (Platform.OS === 'web') {
    const ua = (globalThis.navigator?.userAgent ?? '').replace(/\s+/g, ' ');
    return `web · ${ua}`.slice(0, 200);
  }
  return `${Platform.OS} ${String(Platform.Version)}`.slice(0, 200);
}

/** 버그 제보·개선 요청. 반영되면 +5 토큰. */
export function FeedbackScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { status } = useAuth();
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mine, setMine] = useState<Mine[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('feedback').select('id,kind,body,status,reply,created_at').order('created_at', { ascending: false }).limit(30);
    setMine((data as Mine[]) ?? []);
  }, []);

  useEffect(() => {
    if (status === 'ready' || status === 'needsEnrollment') load();
  }, [status, load]);

  if (status === 'signedOut') return <LoginPrompt what="의견 보내기" />;

  const len = body.trim().length;
  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc('submit_feedback', {
      p_kind: kind,
      p_body: body.trim(),
      p_screen: typeof from === 'string' ? from.slice(0, 100) : '',
      p_app_version: Constants.expoConfig?.version ?? '',
      p_device: deviceInfo(),
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: /[가-힣]/.test(error.message) ? error.message : '잠시 뒤 다시 시도해 주세요.' });
    setBody('');
    setMsg({ ok: true, text: '보냈어요! 개발팀이 확인하고 답할게요. 반영되면 +5 토큰을 드려요.' });
    load();
  };

  return (
    <Screen topInset={false}>
      <AppText variant="body" color={color.inkMuted}>
        앱을 쓰다가 이상한 점이나 바라는 점이 있으면 알려 주세요. 운중고 앱 학생 개발팀이 직접 읽어요.
      </AppText>
      <Card>
        <Segmented
          label="종류"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'bug', label: '🐞 버그' },
            { value: 'idea', label: '💡 개선 제안' },
            { value: 'other', label: '기타' },
          ]}
        />
        <TextInput
          accessibilityLabel="내용"
          value={body}
          onChangeText={(t) => {
            setBody(t.slice(0, 1000));
            setMsg(null);
          }}
          placeholder={PLACEHOLDER[kind]}
          placeholderTextColor={color.inkFaint}
          multiline
          style={{
            minHeight: 140,
            borderWidth: 1,
            borderColor: color.line,
            borderRadius: radius.control,
            padding: space.md,
            fontSize: 15,
            lineHeight: 22,
            color: color.ink,
            textAlignVertical: 'top',
            ...fontStyle('regular'),
          }}
        />
        <AppText variant="caption" color={color.inkMuted}>
          {len}/1000 · 앱 버전과 기기 종류가 함께 전달돼요(문제 해결용). 이름·학번은 보내지 않아요.
        </AppText>
        {msg ? (
          <AppText variant="label" weight="regular" color={msg.ok ? color.success : color.danger}>
            {msg.text}
          </AppText>
        ) : null}
        <Button label={busy ? '보내는 중…' : '보내기'} disabled={busy || len < 5} onPress={submit} />
      </Card>

      <AppText variant="heading" style={{ marginTop: space.sm }}>
        내가 보낸 의견
      </AppText>
      {mine === null ? (
        <AppText variant="body" color={color.inkMuted}>
          불러오는 중…
        </AppText>
      ) : mine.length === 0 ? (
        <AppText variant="body" color={color.inkMuted}>
          아직 보낸 의견이 없어요.
        </AppText>
      ) : (
        mine.map((f) => (
          <Card key={f.id} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Badge label={KIND_LABEL[f.kind]} tone="muted" />
              <Badge label={STATUS_LABEL[f.status]} tone={STATUS_TONE[f.status]} />
              <View style={{ flex: 1 }} />
              <AppText variant="caption" color={color.inkFaint}>
                {stampLabel(f.created_at)}
              </AppText>
            </View>
            <AppText variant="body">{f.body}</AppText>
            {f.reply ? (
              <View style={{ backgroundColor: color.surfaceMuted, borderRadius: radius.control, padding: space.md, gap: 2 }}>
                <AppText variant="caption" weight="semibold" color={color.navy}>
                  개발팀 답변
                </AppText>
                <AppText variant="body">{f.reply}</AppText>
              </View>
            ) : null}
          </Card>
        ))
      )}
    </Screen>
  );
}
