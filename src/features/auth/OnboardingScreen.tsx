import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { RequestCard, useFixState } from '@/features/settings/EnrollmentFixScreen';
import { parseStudentNo } from '@/lib/student';
import { useAuth } from '@/state/auth';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

/** 첫 로그인: 올해 학번·이름 입력. 저장 후 24시간 안 1번은 직접 고칠 수 있고, 그 뒤엔 정정 요청. */
export function OnboardingScreen() {
  const router = useRouter();
  const { status, email, register, signOut } = useAuth();
  const [studentNo, setStudentNo] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 내 학번을 다른 계정이 먼저 등록했을 때 → 정정 요청 */
  const [taken, setTaken] = useState(false);
  const { state: fix, load: loadFix } = useFixState();

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
      setTaken(r.message.includes('다른 계정'));
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
              저장한 뒤 24시간 안에 한 번은 설정에서 직접 고칠 수 있어요. 그 뒤에는 앱 안에서 정정 요청을 보내야 해요.
            </AppText>
          </View>
          <Button label={saving ? '저장하는 중…' : '맞아요, 저장할게요'} disabled={saving} onPress={save} />
          <Button label="다시 입력하기" variant="ghost" disabled={saving} onPress={() => setStep('input')} />
        </Card>
      )}

      {taken || fix?.request?.status === 'pending' ? (
        <RequestCard request={fix?.request ?? null} onChanged={loadFix} initialNo={studentNo} initialName={name.trim()} />
      ) : null}

      <Button label="다른 계정으로 로그인" variant="ghost" onPress={signOut} />
      <AppText variant="caption" color={color.inkFaint} align="center">
        선생님이시라면 학번을 넣지 마시고 학생회(관리자)에게 학교 이메일을 알려 주세요. 선생님 명단에 오르면 다시 열었을 때 학번 없이 바로 들어가져요. 운중고 학생이 아니라면 로그아웃한 뒤 '로그인 없이 둘러보기'를 써 주세요.
      </AppText>
    </Screen>
  );
}
