import { useEffect, useState } from 'react';
import { Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { NameTag } from '@/components/NameTag';
import { LoginPrompt } from '@/features/wallet/LoginPrompt';
import { untilLabel } from '@/lib/date';
import { useAuth } from '@/state/auth';
import { useWallet } from '@/state/wallet';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

const RULE = /^[가-힣A-Za-z0-9_]{2,10}$/;


export function NicknameScreen() {
  const router = useRouter();
  const { status, enrollment } = useAuth();
  const { wallet, itemById, setNickname, setRankingHidden } = useWallet();
  const [value, setValue] = useState('');
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (wallet?.nickname && !value) setValue(wallet.nickname);
    // 처음 한 번만 채운다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.nickname]);

  if (status === 'signedOut') return <LoginPrompt what="닉네임" />;

  const v = value.trim();
  const valid = RULE.test(v);
  const unchanged = !!wallet?.nickname && v === wallet.nickname;
  const lockedUntil = wallet?.nickname && wallet.nickname_changed_at ? untilLabel(wallet.nickname_changed_at, 30) : null;
  const hint = !v
    ? '한글·영문·숫자·_ 로 2~10자'
    : valid
      ? `${v.length}/10`
      : '띄어쓰기·기호 없이 한글·영문·숫자·_ 로 2~10자예요';

  const save = async () => {
    setBusy(true);
    setError(null);
    const r = await setNickname(v);
    setBusy(false);
    if (r.ok) {
      setSaved(true);
      setStep('edit');
    } else {
      setError(r.message);
      setStep('edit');
    }
  };

  return (
    <Screen topInset={false}>
      <Card>
        <AppText variant="label" nativeID="nick-label">
          닉네임
        </AppText>
        <TextInput
          accessibilityLabelledBy="nick-label"
          accessibilityLabel="닉네임"
          value={value}
          editable={!lockedUntil && step === 'edit'}
          onChangeText={(t) => {
            setValue(t.replace(/\s/g, '').slice(0, 10));
            setSaved(false);
            setError(null);
          }}
          placeholder="예) 구름위_공부왕"
          placeholderTextColor={color.inkFaint}
          maxLength={10}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            minHeight: 52,
            borderWidth: 1,
            borderColor: v && !valid ? color.danger : color.line,
            borderRadius: radius.control,
            paddingHorizontal: space.lg,
            fontSize: 18,
            color: color.ink,
            backgroundColor: lockedUntil ? color.surfaceMuted : color.surface,
            ...fontStyle('semibold'),
          }}
        />
        <AppText variant="caption" color={v && !valid ? color.danger : color.inkMuted}>
          {hint}
        </AppText>
        {v && valid ? (
          <View style={{ backgroundColor: color.surfaceMuted, borderRadius: radius.control, padding: space.md, gap: 4 }}>
            <AppText variant="caption" color={color.inkMuted}>
              랭킹에서 이렇게 보여요
            </AppText>
            <NameTag nickname={v} equip={wallet?.equip ?? {}} itemById={itemById} />
          </View>
        ) : null}
        {error ? (
          <AppText variant="label" weight="regular" color={color.danger}>
            {error}
          </AppText>
        ) : null}
        {saved ? (
          <AppText variant="label" weight="regular" color={color.success}>
            저장했어요
          </AppText>
        ) : null}

        {lockedUntil ? (
          <Button label={`${lockedUntil}부터 바꿀 수 있어요`} disabled />
        ) : step === 'confirm' ? (
          <>
            <AppText variant="caption" color={color.accentInk}>
              저장하면 30일 동안 바꿀 수 없어요. 이대로 할까요?
            </AppText>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button label="다시 쓰기" variant="soft" style={{ flex: 1 }} disabled={busy} onPress={() => setStep('edit')} />
              <Button label={busy ? '저장하는 중…' : '저장하기'} style={{ flex: 2 }} disabled={busy} onPress={save} />
            </View>
          </>
        ) : (
          <Button label="저장하기" disabled={!valid || unchanged || busy} onPress={() => setStep('confirm')} />
        )}
      </Card>

      <AppText variant="caption" color={color.inkMuted}>
        • 닉네임은 다른 학생과 겹칠 수 없어요. 욕설·비하·사칭(관리자, 선생님 등)은 쓸 수 없어요.{'\n'}
        • 부적절한 닉네임은 관리자가 지울 수 있어요.{'\n'}
        • 실명·학번은 다른 학생에게 절대 보이지 않아요.
      </AppText>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong" nativeID="hide-label">
              랭킹에서 닉네임 숨기기
            </AppText>
            <AppText variant="caption" color={color.inkMuted}>
              켜면 개인 순위에 '익명의 {enrollment?.grade ?? 'n'}학년'으로 나와요. 반 점수에는 그대로 더해져요.
            </AppText>
          </View>
          <Switch
            accessibilityLabelledBy="hide-label"
            accessibilityLabel="랭킹에서 닉네임 숨기기"
            value={!!wallet?.hide_in_ranking}
            onValueChange={(h) => {
              setRankingHidden(h);
            }}
            trackColor={{ true: color.navy, false: color.line }}
          />
        </View>
      </Card>

      {saved ? <Button label="지갑으로 돌아가기" variant="ghost" onPress={() => router.back()} /> : null}
    </Screen>
  );
}
