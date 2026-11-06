import { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { stampLabel } from '@/lib/date';
import { parseStudentNo } from '@/lib/student';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/auth';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

export type FixRequest = { id: number; student_no: string; name: string; status: 'pending' | 'approved' | 'rejected' | 'cancelled'; note: string | null; created_at: string };
type FixState = { can_self_fix: boolean; self_until: string | null; request: FixRequest | null };

const friendly = (m?: string) => (m && /[가-힣]/.test(m) ? m : '저장하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
const STATUS: Record<FixRequest['status'], string> = { pending: '확인 기다리는 중', approved: '정정 완료', rejected: '반려', cancelled: '취소함' };

export function useFixState() {
  const [state, setState] = useState<FixState | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_enrollment_fix');
    if (!error) setState((data as FixState) ?? null);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { state, load };
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ gap: 6, flex: 1, minWidth: 0 }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={color.inkFaint}
        {...props}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: color.line,
          borderRadius: radius.control,
          paddingHorizontal: space.md,
          fontSize: 17,
          color: color.ink,
          backgroundColor: color.surface,
          ...fontStyle('semibold'),
        }}
      />
    </View>
  );
}

/** 학번·이름 입력 두 칸 + 학번 풀이 */
function NoNameInputs({ no, setNo, name, setName }: { no: string; setNo: (v: string) => void; name: string; setName: (v: string) => void }) {
  const parsed = parseStudentNo(no);
  return (
    <>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Field label="학번 (5자리)" value={no} onChangeText={(t) => setNo(t.replace(/[^0-9]/g, '').slice(0, 5))} placeholder="예) 20818" keyboardType="number-pad" inputMode="numeric" maxLength={5} />
        <Field label="이름" value={name} onChangeText={(t) => setName(t.slice(0, 10))} placeholder="실명" maxLength={10} />
      </View>
      <AppText variant="caption" color={no.length === 5 && !parsed ? color.danger : color.inkMuted}>
        {parsed ? `${parsed.grade}학년 ${parsed.classNo}반 ${parsed.number}번` : '학년 1자리 + 반 2자리 + 번호 2자리'}
      </AppText>
    </>
  );
}

/** 정정 요청 보내기(학번 등록 화면에서도 쓴다) + 지금 요청 상태 */
export function RequestCard({ request, onChanged, initialNo = '', initialName = '' }: { request: FixRequest | null; onChanged: () => void; initialNo?: string; initialName?: string }) {
  const [no, setNo] = useState(initialNo);
  const [name, setName] = useState(initialName);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const pending = request?.status === 'pending';
  const ok = !!parseStudentNo(no) && name.trim().length >= 2;

  const send = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc('request_enrollment_fix', { p_student_no: no, p_name: name.trim(), p_reason: reason.trim() });
    setBusy(false);
    setMsg(error ? { ok: false, text: friendly(error.message) } : { ok: true, text: '요청을 보냈어요. 확인되면 알림으로 알려 드려요' });
    if (!error) onChanged();
  };
  const cancel = async () => {
    await supabase.rpc('cancel_enrollment_request');
    onChanged();
  };

  return (
    <Card>
      <AppText variant="heading">정정 요청</AppText>
      {request ? (
        <View style={{ backgroundColor: color.surfaceMuted, borderRadius: radius.control, padding: space.md, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <AppText variant="bodyStrong" style={{ flex: 1 }}>
              {request.name} · {request.student_no}
            </AppText>
            <Badge label={STATUS[request.status]} tone={request.status === 'approved' ? 'success' : request.status === 'pending' ? 'accent' : 'muted'} />
          </View>
          <AppText variant="caption" color={color.inkMuted}>
            {stampLabel(request.created_at)} 보냄{request.note ? ` · ${request.note}` : ''}
          </AppText>
          {pending ? <Button label="요청 취소" variant="ghost" onPress={cancel} /> : null}
        </View>
      ) : null}
      <AppText variant="caption" color={color.inkMuted}>
        {pending ? '내용을 고쳐 다시 보내면 기다리는 요청이 바뀌어요.' : '올바른 학번·이름을 보내면 학생회 관리자가 확인한 뒤 바꿔 줘요.'}
      </AppText>
      <NoNameInputs no={no} setNo={setNo} name={name} setName={setName} />
      <Field label="사유 (선택)" value={reason} onChangeText={(t) => setReason(t.slice(0, 100))} placeholder="예) 번호를 잘못 눌렀어요 · 다른 사람이 제 학번을 등록했어요" />
      {msg ? (
        <AppText variant="label" weight="regular" color={msg.ok ? color.success : color.danger}>
          {msg.text}
        </AppText>
      ) : null}
      <Button label={busy ? '보내는 중…' : pending ? '요청 고쳐 보내기' : '정정 요청 보내기'} disabled={!ok || busy} onPress={send} />
    </Card>
  );
}

/** 설정 → 내 학번·이름: 등록 후 24시간 안 1번은 직접, 그 뒤엔 정정 요청 */
export function EnrollmentFixScreen() {
  const { enrollment, reload } = useAuth();
  const { state, load } = useFixState();
  const [no, setNo] = useState(enrollment?.student_no ?? '');
  const [name, setName] = useState(enrollment?.name ?? '');
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const parsed = parseStudentNo(no);
  const changed = !!enrollment && (no !== enrollment.student_no || name.trim() !== enrollment.name);

  const selfFix = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.rpc('self_fix_enrollment', { p_student_no: no, p_name: name.trim() });
    setBusy(false);
    setStep('input');
    setMsg(error ? { ok: false, text: friendly(error.message) } : { ok: true, text: '고쳤어요. 시간표·반이 새 학번에 맞춰져요' });
    await Promise.all([load(), error ? Promise.resolve() : reload()]);
  };

  return (
    <Screen topInset={false}>
      <Card>
        <AppText variant="label" color={color.inkMuted}>
          지금 등록된 학적
        </AppText>
        <AppText variant="title">{enrollment?.name ?? '학번 미등록'}</AppText>
        {enrollment ? (
          <AppText variant="bodyStrong" color={color.navy}>
            {enrollment.grade}학년 {enrollment.class_no}반 {enrollment.number}번 · {enrollment.student_no}
          </AppText>
        ) : null}
      </Card>

      {enrollment && state?.can_self_fix ? (
        <Card>
          <AppText variant="heading">직접 고치기</AppText>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
            <Icon name="info" size={18} color={color.accentInk} />
            <AppText variant="caption" color={color.accentInk} style={{ flex: 1 }}>
              등록 후 24시간 안에 한 번만 직접 고칠 수 있어요{state.self_until ? ` (${stampLabel(state.self_until)}까지)` : ''}. 그 뒤에는 정정 요청을 보내 주세요.
            </AppText>
          </View>
          {step === 'input' ? (
            <>
              <NoNameInputs no={no} setNo={setNo} name={name} setName={setName} />
              <Button label="다음" disabled={!parsed || name.trim().length < 2 || !changed} onPress={() => setStep('confirm')} />
            </>
          ) : (
            <>
              <View style={{ backgroundColor: color.surfaceMuted, borderRadius: radius.control, padding: space.lg, gap: 4 }}>
                <AppText variant="title">{name.trim()}</AppText>
                <AppText variant="bodyStrong" color={color.navy}>
                  {parsed ? `${parsed.grade}학년 ${parsed.classNo}반 ${parsed.number}번 · ${no}` : ''}
                </AppText>
              </View>
              <AppText variant="caption" color={color.danger}>
                한 번 고치면 다시 직접 바꿀 수 없어요. 맞는지 한 번 더 확인해 주세요.
              </AppText>
              <Button label={busy ? '고치는 중…' : '맞아요, 이렇게 고칠게요'} disabled={busy} onPress={selfFix} />
              <Button label="다시 입력하기" variant="ghost" disabled={busy} onPress={() => setStep('input')} />
            </>
          )}
          {msg ? (
            <AppText variant="label" weight="regular" color={msg.ok ? color.success : color.danger}>
              {msg.text}
            </AppText>
          ) : null}
        </Card>
      ) : (
        <>
          {msg ? (
            <AppText variant="label" weight="regular" color={msg.ok ? color.success : color.danger}>
              {msg.text}
            </AppText>
          ) : null}
          {state ? <RequestCard request={state.request} onChanged={load} initialNo={enrollment?.student_no ?? ''} initialName={enrollment?.name ?? ''} /> : null}
        </>
      )}

      <AppText variant="caption" color={color.inkFaint}>
        다른 반 게시판을 보거나 반 랭킹을 바꾸려고 학번을 바꾸는 일을 막기 위해 직접 고치기는 한 번만 돼요. 모든 변경은 기록돼요.
      </AppText>
    </Screen>
  );
}
