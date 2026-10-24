import { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { parseStudentNo } from '@/lib/student';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/auth';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

type Found = { user_id: string; name: string; email: string; role: 'student' | 'reviewer' | 'admin'; grade: number; class_no: number; nickname: string | null; is_planner?: boolean };
type Staff = { user_id: string; name: string | null; student_no: string | null; role: 'student' | 'reviewer' | 'admin'; is_planner?: boolean };
const ROLE = { student: '학생', reviewer: '검토위원', admin: '관리자' } as const;

/** 관리자: 학생자치회가 임명한 검토위원·기획행정부를 학번으로 찾아 지정·해제 */
export function StaffScreen() {
  const { role } = useAuth();
  const [no, setNo] = useState('');
  const [found, setFound] = useState<Found | null | 'none'>(null);
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadStaff = useCallback(async () => {
    const { data } = await supabase.rpc('admin_list_staff');
    setStaff((data as Staff[]) ?? []);
  }, []);
  useEffect(() => {
    if (role === 'admin') loadStaff();
  }, [role, loadStaff]);

  if (role !== 'admin') {
    return (
      <Screen topInset={false}>
        <AppText variant="body" color={color.inkMuted}>
          관리자만 볼 수 있는 화면이에요.
        </AppText>
      </Screen>
    );
  }

  const search = async () => {
    setMsg(null);
    const { data } = await supabase.rpc('admin_find_user', { p_student_no: no });
    setFound(((data as Found[]) ?? [])[0] ?? 'none');
  };
  const setRole = async (userId: string, r: 'student' | 'reviewer') => {
    const { error } = await supabase.rpc('admin_set_role', { p_user: userId, p_role: r });
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: r === 'reviewer' ? '검토위원으로 임명했어요' : '학생으로 바꿨어요' });
    if (!error) {
      await search();
      loadStaff();
    }
  };

  const setPlanner = async (userId: string, on: boolean) => {
    const { error } = await supabase.rpc('admin_set_planner', { p_user: userId, p_on: on });
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: on ? '기획행정부로 지정했어요' : '기획행정부에서 뺐어요' });
    if (!error) {
      await search();
      loadStaff();
    }
  };

  return (
    <Screen topInset={false}>
      <AppText variant="body" color={color.inkMuted}>
        학생자치회에서 정한 학생을 학번으로 찾아 지정하세요. 검토위원은 공지·신고·분실물 사진을, 기획행정부는 운중 보이스 설문과 건의 확인을 맡아요. 관리자 지정은 보안을 위해 앱에서 할 수 없어요.
      </AppText>
      <Card>
        <AppText variant="label">학번으로 찾기</AppText>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput
            accessibilityLabel="학번 5자리"
            value={no}
            onChangeText={(t) => setNo(t.replace(/[^0-9]/g, '').slice(0, 5))}
            placeholder="예) 20818"
            placeholderTextColor={color.inkFaint}
            keyboardType="number-pad"
            style={{ flex: 1, minWidth: 0, minHeight: 48, borderWidth: 1, borderColor: color.line, borderRadius: radius.control, paddingHorizontal: space.md, fontSize: 17, color: color.ink, ...fontStyle('semibold') }}
          />
          <Button label="찾기" disabled={!parseStudentNo(no)} onPress={search} />
        </View>
        {found === 'none' ? (
          <AppText variant="caption" color={color.inkMuted}>
            올해 이 학번으로 등록한 학생이 없어요.
          </AppText>
        ) : found ? (
          <View style={{ backgroundColor: color.surfaceMuted, borderRadius: radius.control, padding: space.md, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <AppText variant="heading">{found.name}</AppText>
              <Badge label={ROLE[found.role]} tone={found.role === 'student' ? 'muted' : 'accent'} />
              {found.is_planner ? <Badge label="기획행정부" tone="success" /> : null}
            </View>
            <AppText variant="caption" color={color.inkMuted}>
              {found.grade}학년 {found.class_no}반 · {found.email} · 닉네임 {found.nickname ?? '없음'}
            </AppText>
            {found.role === 'student' ? (
              <Button label="검토위원으로 임명" onPress={() => setRole(found.user_id, 'reviewer')} />
            ) : found.role === 'reviewer' ? (
              <Button label="검토위원 해제" variant="soft" onPress={() => setRole(found.user_id, 'student')} />
            ) : null}
            {found.role !== 'admin' ? (
              found.is_planner ? (
                <Button label="기획행정부에서 빼기" variant="soft" onPress={() => setPlanner(found.user_id, false)} />
              ) : (
                <Button label="기획행정부로 지정" variant={found.role === 'student' ? 'soft' : 'primary'} onPress={() => setPlanner(found.user_id, true)} />
              )
            ) : null}
          </View>
        ) : null}
        {msg ? (
          <AppText variant="label" weight="regular" color={msg.ok ? color.success : color.danger}>
            {msg.text}
          </AppText>
        ) : null}
      </Card>

      <AppText variant="heading" style={{ marginTop: space.sm }}>
        지금 직책을 맡은 학생
      </AppText>
      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        {(staff ?? []).map((s, i) => (
          <View key={s.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderTopWidth: i ? 1 : 0, borderTopColor: color.lineSoft }}>
            <AppText variant="bodyStrong" style={{ flex: 1 }}>
              {s.name ?? '학번 미등록'} {s.student_no ? `· ${s.student_no}` : ''}
            </AppText>
            {s.role !== 'student' ? <Badge label={ROLE[s.role]} tone={s.role === 'admin' ? 'accent' : 'success'} /> : null}
            {s.is_planner && s.role !== 'admin' ? <Badge label="기획행정부" tone="success" /> : null}
          </View>
        ))}
      </View>
    </Screen>
  );
}
