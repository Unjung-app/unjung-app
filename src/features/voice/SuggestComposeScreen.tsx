import { useState } from 'react';
import { TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { LoginPrompt } from '@/features/wallet/LoginPrompt';
import { useAuth } from '@/state/auth';
import { color, space } from '@/theme/tokens';
import { CATEGORIES, CATEGORY_EMOJI, CATEGORY_LABEL, postSuggestion, type SuggestionCategory } from './data';
import { ChipRow, inputStyle, PickChip } from './ui';

/** 건의 올리기: 분야 · 제목 · 내용. 이름 없이 학년만 보인다. */
export function SuggestComposeScreen() {
  const router = useRouter();
  const { status, enrollment } = useAuth();
  const [cat, setCat] = useState<SuggestionCategory | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'signedOut') return <LoginPrompt what="건의 올리기" />;
  if (!enrollment) {
    return (
      <Screen topInset={false}>
        <AppText variant="body" color={color.inkMuted}>
          학번을 등록하면 건의를 올릴 수 있어요.
        </AppText>
      </Screen>
    );
  }

  const ready = !!cat && title.trim().length >= 2 && body.trim().length >= 5;
  const submit = async () => {
    if (!cat) return;
    setBusy(true);
    setError(null);
    const r = await postSuggestion(cat, title, body);
    setBusy(false);
    if (r.ok) router.back();
    else setError(r.message);
  };

  return (
    <Screen topInset={false}>
      <Card>
        <AppText variant="label">분야</AppText>
        <ChipRow>
          {CATEGORIES.map((c) => (
            <PickChip key={c} label={`${CATEGORY_EMOJI[c]} ${CATEGORY_LABEL[c]}`} on={cat === c} onPress={() => setCat(c)} />
          ))}
        </ChipRow>
        <AppText variant="label">제목</AppText>
        <TextInput accessibilityLabel="건의 제목" value={title} onChangeText={(t) => setTitle(t.slice(0, 40))} placeholder="예) 3층 정수기를 늘려 주세요" placeholderTextColor={color.inkFaint} style={{ ...inputStyle, minHeight: 48 }} />
        <AppText variant="label">내용 · {body.length}/500</AppText>
        <TextInput
          accessibilityLabel="건의 내용"
          value={body}
          onChangeText={(t) => setBody(t.slice(0, 500))}
          multiline
          placeholder="무엇이 불편한지, 어떻게 바뀌면 좋을지 적어 주세요"
          placeholderTextColor={color.inkFaint}
          style={{ ...inputStyle, minHeight: 140, paddingVertical: space.sm, textAlignVertical: 'top' }}
        />
      </Card>
      <Card tone="muted" style={{ gap: 6 }}>
        <AppText variant="label">올리기 전에</AppText>
        <AppText variant="caption" color={color.inkMuted}>
          · 다른 학생에게는 '익명의 {enrollment.grade}학년'으로만 보여요.{'\n'}· 특정 학생·선생님을 비난하는 글은 신고되면 숨겨지고, 학교 규정에 따라 처리될 수 있어요.{'\n'}· 기획행정부가 읽으면 '확인' 표시가 붙어요. 하루에 3개까지 올릴 수 있어요.
        </AppText>
      </Card>
      {error ? (
        <AppText variant="label" weight="regular" color={color.danger}>
          {error}
        </AppText>
      ) : null}
      <Button label={busy ? '올리는 중…' : '건의 올리기'} disabled={!ready || busy} onPress={submit} style={{ minHeight: 52 }} />
    </Screen>
  );
}
