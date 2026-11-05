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

type Role = 'student' | 'reviewer' | 'admin';
type Found = {
  user_id: string;
  name: string | null;
  student_no: string | null;
  email: string;
  role: Role;
  grade: number | null;
  class_no: number | null;
  nickname: string | null;
  is_planner?: boolean;
  balance?: number;
};
type Staff = { user_id: string; name: string | null; student_no: string | null; role: Role; is_planner?: boolean };
const ROLE: Record<Role, string> = { student: '학생', reviewer: '검토위원', admin: '관리자' };
type Msg = { ok: boolean; text: string } | null;

const friendly = (m?: string) => (m && /[가-힣]/.test(m) ? m : '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.');

/**
 * 관리자: 학생 관리.
 *  · 학번·닉네임·이메일로 찾기
 *  · 직책: 검토위원·기획행정부 지정/해제 (관리자 지정은 보안상 SQL로만)
 *  · 학적 정정(잘못 입력한 학번·이름), 학적 지우기(남의 학번을 등록한 계정), 닉네임 지우기, 토큰 보정
 */
export function StaffScreen() {
  const { role, session } = useAuth();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Found[] | null>(null);
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const loadStaff = useCallback(async () => {
    const { data } = await supabase.rpc('admin_list_staff');
    setStaff((data as Staff[]) ?? []);
  }, []);
  useEffect(() => {
    if (role === 'admin') loadStaff();
  }, [role, loadStaff]);

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    const { data, error } = await supabase.rpc('admin_find_user', { p_query: q });
    if (error) return setMsg({ ok: false, text: friendly(error.message) });
    setFound((data as Found[]) ?? []);
  }, [query]);

  if (role !== 'admin') {
    return (
      <Screen topInset={false}>
        <AppText variant="body" color={color.inkMuted}>
          관리자만 볼 수 있는 화면이에요.
        </AppText>
      </Screen>
    );
  }

  const act = async (fn: string, args: Record<string, unknown>, okText: string) => {
    setMsg(null);
    const { error } = await supabase.rpc(fn, args);
    setMsg(error ? { ok: false, text: friendly(error.message) } : { ok: true, text: okText });
    if (!error) {
      await search();
      loadStaff();
    }
    return !error;
  };

  const input = { borderWidth: 1, borderColor: color.line, borderRadius: radius.control, paddingHorizontal: space.md, color: color.ink, backgroundColor: color.surface } as const;

  return (
    <Screen topInset={false}>
      <AppText variant="body" color={color.inkMuted}>
        학생을 찾아 직책을 정하거나 학적·닉네임·토큰을 바로잡아요. 검토위원은 공지·신고·분실물 사진을, 기획행정부는 운중 보이스 설문과 건의 확인을 맡아요.
      </AppText>
      <Card>
        <AppText variant="label">학번 · 닉네임 · 이메일로 찾기</AppText>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <TextInput
            accessibilityLabel="학번, 닉네임 또는 이메일"
            value={query}
            onChangeText={(t) => setQuery(t.slice(0, 60))}
            onSubmitEditing={search}
            placeholder="예) 20818 · 구름위"
            placeholderTextColor={color.inkFaint}
            autoCapitalize="none"
            style={{ ...input, flex: 1, minWidth: 0, minHeight: 48, fontSize: 17, ...fontStyle('semibold') }}
          />
          <Button label="찾기" disabled={query.trim().length < 2} onPress={search} />
        </View>
        {found !== null && found.length === 0 ? (
          <AppText variant="caption" color={color.inkMuted}>
            찾는 학생이 없어요. 학번은 5자리, 닉네임·이메일은 정확히 입력해 주세요.
          </AppText>
        ) : null}
        {(found ?? []).map((f) => (
          <StudentCard key={f.user_id} f={f} me={session?.user.id ?? ''} act={act} />
        ))}
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
          <View key={s.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg, borderTopWidth: i ? 1 : 0, borderTopColor: color.lineSoft }}>
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

function StudentCard({ f, me, act }: { f: Found; me: string; act: (fn: string, args: Record<string, unknown>, okText: string) => Promise<boolean> }) {
  const [mode, setMode] = useState<null | 'fix' | 'tokens' | 'release'>(null);
  const [no, setNo] = useState(f.student_no ?? '');
  const [name, setName] = useState(f.name ?? '');
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const isMe = f.user_id === me;
  const input = { borderWidth: 1, borderColor: color.line, borderRadius: radius.control, paddingHorizontal: space.md, minHeight: 44, color: color.ink, backgroundColor: color.surface, ...fontStyle('regular') } as const;
  const deltaNum = Number(delta);
  const deltaOk = /^-?\d{1,4}$/.test(delta) && deltaNum !== 0 && note.trim().length >= 2;

  return (
    <View style={{ backgroundColor: color.surfaceMuted, borderRadius: radius.control, padding: space.md, gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
        <AppText variant="heading">{f.name ?? '학적 없음'}</AppText>
        <Badge label={ROLE[f.role]} tone={f.role === 'student' ? 'muted' : 'accent'} />
        {f.is_planner ? <Badge label="기획행정부" tone="success" /> : null}
      </View>
      <AppText variant="caption" color={color.inkMuted}>
        {f.student_no ? `${f.grade}학년 ${f.class_no}반 · ${f.student_no}` : '올해 학번 미등록'} · {f.email} · 닉네임 {f.nickname ?? '없음'} · 🪙 {f.balance ?? 0}
      </AppText>

      {f.role !== 'admin' ? (
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Button
            label={f.role === 'reviewer' ? '검토위원 해제' : '검토위원 임명'}
            variant={f.role === 'reviewer' ? 'soft' : 'primary'}
            onPress={() => act('admin_set_role', { p_user: f.user_id, p_role: f.role === 'reviewer' ? 'student' : 'reviewer' }, f.role === 'reviewer' ? '학생으로 바꿨어요' : '검토위원으로 임명했어요')}
          />
          <Button
            label={f.is_planner ? '기획행정부 빼기' : '기획행정부 지정'}
            variant="soft"
            onPress={() => act('admin_set_planner', { p_user: f.user_id, p_on: !f.is_planner }, f.is_planner ? '기획행정부에서 뺐어요' : '기획행정부로 지정했어요')}
          />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Button label="학적 정정" variant="ghost" onPress={() => setMode(mode === 'fix' ? null : 'fix')} />
        <Button label="토큰 보정" variant="ghost" onPress={() => setMode(mode === 'tokens' ? null : 'tokens')} />
        {f.nickname ? <Button label="닉네임 지우기" variant="ghost" onPress={() => act('admin_clear_nickname', { p_user: f.user_id }, '닉네임을 지웠어요. 학생이 새로 정할 수 있어요')} /> : null}
        {f.student_no && !isMe ? <Button label="학적 지우기" variant="ghost" onPress={() => setMode(mode === 'release' ? null : 'release')} /> : null}
      </View>

      {mode === 'fix' ? (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <TextInput accessibilityLabel="정정할 학번" value={no} onChangeText={(t) => setNo(t.replace(/[^0-9]/g, '').slice(0, 5))} placeholder="학번 5자리" keyboardType="number-pad" placeholderTextColor={color.inkFaint} style={{ ...input, flex: 1, minWidth: 0 }} />
            <TextInput accessibilityLabel="정정할 이름" value={name} onChangeText={(t) => setName(t.slice(0, 10))} placeholder="이름" placeholderTextColor={color.inkFaint} style={{ ...input, flex: 1, minWidth: 0 }} />
          </View>
          <Button
            label="이대로 정정"
            disabled={!parseStudentNo(no) || name.trim().length < 2}
            onPress={async () => (await act('admin_fix_enrollment', { p_user: f.user_id, p_student_no: no, p_name: name.trim() }, '학적을 정정했어요. 학생이 앱을 다시 열면 반영돼요')) && setMode(null)}
          />
        </View>
      ) : null}

      {mode === 'tokens' ? (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <TextInput accessibilityLabel="더하거나 뺄 토큰" value={delta} onChangeText={(t) => setDelta(t.replace(/[^0-9-]/g, '').slice(0, 5))} placeholder="+20 또는 -20" placeholderTextColor={color.inkFaint} style={{ ...input, width: 110 }} />
            <TextInput accessibilityLabel="보정 사유" value={note} onChangeText={(t) => setNote(t.slice(0, 40))} placeholder="사유(학생 기록에 보여요)" placeholderTextColor={color.inkFaint} style={{ ...input, flex: 1, minWidth: 0 }} />
          </View>
          <Button
            label={deltaOk ? `${deltaNum > 0 ? '+' : ''}${deltaNum} 토큰 보정` : '숫자와 사유를 적어 주세요'}
            disabled={!deltaOk}
            onPress={async () => (await act('admin_adjust_tokens', { p_user: f.user_id, p_delta: deltaNum, p_note: note.trim() }, '토큰을 보정했어요')) && (setMode(null), setDelta(''), setNote(''))}
          />
          <AppText variant="caption" color={color.inkMuted}>
            관리자 보정은 주간 토큰 랭킹에 들어가지 않아요. 행사 보상·오류 정정에만 써 주세요.
          </AppText>
        </View>
      ) : null}

      {mode === 'release' ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="caption" color={color.danger}>
            이 계정의 올해 학적({f.student_no} {f.name})을 지워요. 그 학번을 진짜 주인이 등록할 수 있게 되고, 이 계정은 다음에 열 때 학번을 다시 입력해야 해요.
          </AppText>
          <Button label="학적 지우기" onPress={async () => (await act('admin_release_enrollment', { p_user: f.user_id }, '학적을 지웠어요')) && setMode(null)} />
        </View>
      ) : null}
    </View>
  );
}
