import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { CONTACT_EMAIL } from '@/lib/supabase';
import { parseStudentNo } from '@/lib/student';
import { useAuth } from '@/state/auth';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

/** 첫 로그인: 올해 학번·이름 한 번 입력. 저장 후에는 학생이 고칠 수 없다. */
export function OnboardingScreen() {
  const router = useRouter();
  const { status, email, register, signOut } = useAuth();
  const [studentNo, setStudentNo] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'ready') router.replace('/');
    if (status === 'signedOut') router.replace('/login');
  }, [status, router]);

  const parsed = parseStudentNo(studentNo);
  const nameOk = name.trim().length >= 2 && name.trim().length <= 10;
  const canNext = !!parsed && nameOk;

  const input = (props: React.ComponentProps<typeof TextInput>) => (
    <TextInput
      placeholderTextColor={color.inkFaint}
      {...props}
      style={{
        minHeight: 52,
        borderWidth: 1,
        borderColor: color.line,
        borderRadius: radius.control,
        paddingHorizontal: space.lg,
        fontSize: 18,
        color: color.ink,
        backgroundColor: color.surface,
        ...fontStyle('semibold'),
      }}
    />
  );

  const save = async () => {
    if (!parsed) return;
    setSaving(true);
    setError(null);
    const r = await register(studentNo.trim(), name.trim());
    setSaving(false);
    if (!r.ok) {
      setError(r.message);
      setStep('input');
    }
  };

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        반가워요!
      </AppText>
      <AppText variant="body" color={color.inkMuted}>
        올해 학번과 이름을 한 번만 알려 주세요. 시간표가 내 반에 맞춰 자동으로 나와요.
      </AppText>
      <AppText variant="caption" color={color.inkFaint}>
        로그인한 계정 · {email}
      </AppText>

      {step === 'input' ? (
        <Card>
          <View style={{ gap: 6 }}>
            <AppText variant="label" nativeID="sno-label">
              학번 (5자리)
            </AppText>
            {input({
              accessibilityLabelledBy: 'sno-label',
              accessibilityLabel: '학번 5자리',
              value: studentNo,
              onChangeText: (t) => setStudentNo(t.replace(/[^0-9]/g, '').slice(0, 5)),
              placeholder: '예) 20818',
              keyboardType: 'number-pad',
              inputMode: 'numeric',
              maxLength: 5,
            })}
            <AppText variant="caption" color={studentNo.length === 5 && !parsed ? color.danger : color.inkMuted}>
              {parsed
                ? `${parsed.grade}학년 ${parsed.classNo}반 ${parsed.number}번`
                : studentNo.length === 5
                  ? '학번 형식을 다시 확인해 주세요 (학년 1자리 + 반 2자리 + 번호 2자리)'
                  : '학년 1자리 + 반 2자리 + 번호 2자리'}
            </AppText>
          </View>
          <View style={{ gap: 6 }}>
            <AppText variant="label" nativeID="name-label">
              이름
            </AppText>
            {input({
              accessibilityLabelledBy: 'name-label',
              accessibilityLabel: '이름',
              value: name,
              onChangeText: setName,
              placeholder: '실명',
              maxLength: 10,
              autoComplete: 'name',
            })}
          </View>
          {error ? (
            <AppText variant="label" weight="regular" color={color.danger}>
              {error}
            </AppText>
          ) : null}
          <Button label="다음" disabled={!canNext} onPress={() => setStep('confirm')} />
        </Card>
      ) : (
        <Card>
          <AppText variant="heading">이대로 저장할까요?</AppText>
          <View style={{ backgroundColor: color.surfaceMuted, borderRadius: radius.control, padding: space.lg, gap: 4 }}>
            <AppText variant="title">{name.trim()}</AppText>
            <AppText variant="bodyStrong" color={color.navy}>
              {parsed ? `${parsed.grade}학년 ${parsed.classNo}반 ${parsed.number}번 · ${studentNo}` : ''}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
            <Icon name="info" size={18} color={color.accentInk} />
            <AppText variant="caption" color={color.accentInk} style={{ flex: 1 }}>
              저장하면 직접 바꿀 수 없어요. 잘못 입력했다면 {CONTACT_EMAIL} 으로 학번·이름과 함께 연락해 주세요.
            </AppText>
          </View>
          <Button label={saving ? '저장하는 중…' : '맞아요, 저장할게요'} disabled={saving} onPress={save} />
          <Button label="다시 입력하기" variant="ghost" disabled={saving} onPress={() => setStep('input')} />
        </Card>
      )}

      <Button label="다른 계정으로 로그인" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
