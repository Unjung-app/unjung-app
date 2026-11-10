import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { supabase } from '@/lib/supabase';
import { type TeacherInfo, useAuth } from '@/state/auth';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

const friendly = (m?: string) => (m && /[가-힣]/.test(m) ? m : '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.');

/** 선생님 정보: 이름(필수) · 담임 학년·반(선택) · 담당(선택). 교직원 계정 첫 로그인과 설정에서 함께 쓴다 */
export function TeacherForm({ initial, onSaved }: { initial?: TeacherInfo | null; onSaved?: () => void }) {
  const { reload } = useAuth();
  const [name, setName] = useState(initial?.name ?? '');
  const [homeroom, setHomeroom] = useState(!!initial?.homeGrade);
  const [grade, setGrade] = useState<number | null>(initial?.homeGrade ?? null);
  const [cls, setCls] = useState<number | null>(initial?.homeClass ?? null);
  const [dept, setDept] = useState(initial?.dept ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOk = /^[가-힣]{2,5}$/.test(name.trim());
  const homeOk = !homeroom || (grade !== null && cls !== null);
  const input = { minHeight: 52, borderWidth: 1, borderColor: color.line, borderRadius: radius.control, paddingHorizontal: space.lg, fontSize: 17, color: color.ink, backgroundColor: color.surface, ...fontStyle('semibold') } as const;

  const save = async () => {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc('register_teacher', {
      p_name: name.trim(),
      p_home_grade: homeroom ? grade : null,
      p_home_class: homeroom ? cls : null,
      p_dept: dept.trim() || null,
    });
    setBusy(false);
    if (e) return setError(friendly(e.message));
    await reload();
    onSaved?.();
  };

  const chip = (label: string, on: boolean, onPress: () => void, a11y: string) => (
    <Pressable
      key={a11y}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={a11y}
      onPress={onPress}
      style={{ minHeight: 44, minWidth: 48, paddingHorizontal: space.md, borderRadius: radius.round, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color.navy : color.surfaceMuted }}>
      <AppText variant="label" color={on ? color.onNavy : color.ink}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <Card style={{ gap: space.md }}>
      <View style={{ gap: space.xs }}>
        <AppText variant="label">이름 (실명)</AppText>
        <TextInput accessibilityLabel="선생님 이름" value={name} onChangeText={(t) => setName(t.slice(0, 5))} placeholder="예) 김운중" placeholderTextColor={color.inkFaint} style={input} />
        <AppText variant="caption" color={color.inkMuted}>
          공지·행사 사진·설문에 &apos;👩‍🏫 {nameOk ? name.trim() : '○○○'} 선생님&apos;으로 보여요.
        </AppText>
      </View>
      <View style={{ gap: space.xs }}>
        <AppText variant="label">담임 (선택)</AppText>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {chip('담임 아님', !homeroom, () => setHomeroom(false), '담임 아님')}
          {chip('담임이에요', homeroom, () => setHomeroom(true), '담임이에요')}
        </View>
        {homeroom ? (
          <>
            <View style={{ flexDirection: 'row', gap: space.sm }}>{[1, 2, 3].map((g) => chip(`${g}학년`, grade === g, () => setGrade(g), `${g}학년`))}</View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c) => chip(`${c}반`, cls === c, () => setCls(c), `${c}반`))}
            </View>
          </>
        ) : null}
      </View>
      <View style={{ gap: space.xs }}>
        <AppText variant="label">담당 교과·부서 (선택)</AppText>
        <TextInput accessibilityLabel="담당 교과나 부서" value={dept} onChangeText={(t) => setDept(t.slice(0, 30))} placeholder="예) 정보 · 창의체험부" placeholderTextColor={color.inkFaint} style={input} />
      </View>
      {error ? (
        <AppText variant="label" weight="regular" color={color.danger}>
          {error}
        </AppText>
      ) : null}
      <Button label={busy ? '저장 중…' : initial ? '저장하기' : '선생님으로 시작하기'} disabled={!nameOk || !homeOk || busy} onPress={save} style={{ minHeight: 52 }} />
    </Card>
  );
}
