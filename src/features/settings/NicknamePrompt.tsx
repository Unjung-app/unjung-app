import { useState } from 'react';
import { Modal, TextInput, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { useAuth } from '@/state/auth';
import { useWallet } from '@/state/wallet';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

const RULE = /^[가-힣A-Za-z0-9_]{2,10}$/;
/** '나중에'는 이번에 앱을 연 동안만. 다음에 열면 다시 묻는다 */
let laterThisSession = false;

/**
 * 학번을 등록했는데 닉네임이 없으면 홈에서 바로 정하게 한다(호원 요청 11-06: 닉네임 기능을 몰라 다들 익명으로 남음).
 * 닉네임은 랭킹·스터디 그룹·게임 순위에 쓰이고, 실명·학번은 다른 학생에게 보이지 않는다.
 */
export function NicknamePrompt({ onDone }: { onDone?: () => void }) {
  const { status } = useAuth();
  const { wallet, setNickname } = useWallet();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(laterThisSession);

  if (status !== 'ready' || !wallet || wallet.nickname || closed) return null;

  const v = value.trim();
  const valid = RULE.test(v);
  const close = () => {
    laterThisSession = true;
    setClosed(true);
    onDone?.();
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    const r = await setNickname(v);
    setBusy(false);
    if (r.ok) {
      setClosed(true);
      onDone?.();
    } else setError(r.message);
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: color.backdrop, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
        <Card style={{ gap: space.md, width: '100%', maxWidth: 400 }}>
          <AppText style={{ fontSize: 44, lineHeight: 54 }} align="center">
            🏷️
          </AppText>
          <AppText variant="heading" align="center">
            닉네임을 정해 주세요
          </AppText>
          <AppText variant="body" color={color.inkMuted} align="center">
            랭킹·스터디 그룹·게임 순위에 이 이름으로 나와요.{'\n'}실명과 학번은 다른 학생에게 보이지 않아요.
          </AppText>
          <TextInput
            accessibilityLabel="닉네임"
            value={value}
            onChangeText={(t) => {
              setValue(t.replace(/\s/g, '').slice(0, 10));
              setError(null);
            }}
            placeholder="예) 구름위_공부왕"
            placeholderTextColor={color.inkFaint}
            maxLength={10}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            onSubmitEditing={() => valid && !busy && save()}
            style={{
              minHeight: 52,
              borderWidth: 1,
              borderColor: v && !valid ? color.danger : color.line,
              borderRadius: radius.control,
              paddingHorizontal: space.lg,
              fontSize: 18,
              color: color.ink,
              backgroundColor: color.surface,
              ...fontStyle('semibold'),
            }}
          />
          <AppText variant="caption" color={error || (v && !valid) ? color.danger : color.inkMuted}>
            {error ?? (v && !valid ? '띄어쓰기·기호 없이 한글·영문·숫자·_ 로 2~10자예요' : '한글·영문·숫자·_ 로 2~10자 · 정하면 30일 동안 바꿀 수 없어요')}
          </AppText>
          <Button label={busy ? '저장하는 중…' : '이 닉네임으로 하기'} disabled={!valid || busy} onPress={save} />
          <Button label="나중에 정할게요" variant="ghost" onPress={close} />
        </Card>
      </View>
    </Modal>
  );
}
