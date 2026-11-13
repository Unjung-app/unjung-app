import { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { stampLabel } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

type Req = {
  id: number;
  user_id: string;
  email: string;
  cur_no: string | null;
  cur_name: string | null;
  req_no: string;
  req_name: string;
  reason: string | null;
  created_at: string;
  holder_id: string | null;
  holder_name: string | null;
  holder_email: string | null;
};
type Listed = { user_id: string; student_no: string; name: string; email: string; want: 'admin' | 'planner' };
type Log = { at: string; kind: string; name: string; old_no: string | null; old_name: string | null; new_no: string | null; new_name: string | null; email: string };

const KIND: Record<string, string> = { self: '직접 정정', request: '요청 승인', admin: '관리자 정정', release: '학적 해제', sql: 'SQL', register: '등록' };
const friendly = (m?: string) => (m && /[가-힣]/.test(m) ? m : '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.');

/** 관리자: 학적 정정 요청 · 직책 명단 확인 · 최근 변경 기록 */
export function EnrollmentAdmin() {
  const [reqs, setReqs] = useState<Req[] | null>(null);
  const [listed, setListed] = useState<Listed[]>([]);
  const [log, setLog] = useState<Log[] | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [r, l] = await Promise.all([supabase.rpc('admin_enrollment_requests'), supabase.rpc('admin_listed_pending')]);
    setReqs((r.data as Req[]) ?? []);
    setListed((l.data as Listed[]) ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const loadLog = async () => {
    const { data } = await supabase.rpc('admin_enrollment_log', { p_limit: 30 });
    setLog((data as Log[]) ?? []);
    setShowLog(true);
  };

  const run = async (fn: string, args: Record<string, unknown>, okText: string) => {
    setMsg(null);
    const { error } = await supabase.rpc(fn, args);
    setMsg(error ? { ok: false, text: friendly(error.message) } : { ok: true, text: okText });
    await load();
    if (showLog) loadLog();
  };

  return (
    <>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <AppText variant="heading" style={{ flex: 1 }}>
            학적 정정 요청
          </AppText>
          <Badge label={reqs === null ? '…' : `${reqs.length}건`} tone={reqs?.length ? 'accent' : 'muted'} />
        </View>
        {reqs?.length === 0 ? (
          <AppText variant="caption" color={color.inkMuted}>
            기다리는 요청이 없어요. 학생은 등록 후 24시간 안에 한 번은 직접 고칠 수 있어요.
          </AppText>
        ) : null}
        {(reqs ?? []).map((r) => (
          <RequestRow key={r.id} r={r} run={run} />
        ))}
        {msg ? (
          <AppText variant="label" weight="regular" color={msg.ok ? color.success : color.danger}>
            {msg.text}
          </AppText>
        ) : null}
      </Card>

      {listed.length ? (
        <Card>
          <AppText variant="heading">직책 명단 확인</AppText>
          <AppText variant="caption" color={color.inkMuted}>
            명단의 학번으로 등록한 계정이에요. 학번은 아무나 입력할 수 있으니 이름·이메일이 맞는지 보고 확인해 주세요.
          </AppText>
          {listed.map((l) => (
            <View key={l.user_id} style={{ backgroundColor: color.surfaceMuted, borderRadius: radius.control, padding: space.md, gap: space.sm }}>
              <AppText variant="bodyStrong">
                {l.name} · {l.student_no} → {l.want === 'admin' ? '관리자' : '기획행정부'}
              </AppText>
              <AppText variant="caption" color={color.inkMuted}>
                {l.email}
              </AppText>
              <Button label="맞아요, 지정하기" variant="soft" onPress={() => run('admin_confirm_listed', { p_user: l.user_id }, `${l.name} 학생을 지정했어요`)} />
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <AppText variant="heading" style={{ flex: 1 }}>
            최근 학적 변경
          </AppText>
          <Button label={showLog ? '접기' : '보기'} variant="ghost" onPress={() => (showLog ? setShowLog(false) : loadLog())} />
        </View>
        {showLog && log?.length === 0 ? (
          <AppText variant="caption" color={color.inkMuted}>
            아직 변경이 없어요.
          </AppText>
        ) : null}
        {showLog
          ? (log ?? []).map((g, i) => (
              <View key={i} style={{ gap: 2, paddingVertical: space.xs, borderTopWidth: i ? 1 : 0, borderTopColor: color.lineSoft }}>
                <AppText variant="label">
                  {KIND[g.kind] ?? g.kind} · {g.old_no ? `${g.old_name} ${g.old_no}` : '없음'} → {g.new_no ? `${g.new_name} ${g.new_no}` : '없음'}
                </AppText>
                <AppText variant="caption" color={color.inkMuted}>
                  {stampLabel(g.at)} · {g.email}
                </AppText>
              </View>
            ))
          : null}
      </Card>
    </>
  );
}

function RequestRow({ r, run }: { r: Req; run: (fn: string, args: Record<string, unknown>, okText: string) => Promise<void> }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  return (
    <View style={{ backgroundColor: color.surfaceMuted, borderRadius: radius.control, padding: space.md, gap: space.sm }}>
      <AppText variant="bodyStrong">
        {r.cur_no ? `${r.cur_name} ${r.cur_no}` : '학번 미등록'} → {r.req_name} {r.req_no}
      </AppText>
      <AppText variant="caption" color={color.inkMuted}>
        {r.email} · {stampLabel(r.created_at)}
        {r.reason ? `\n사유: ${r.reason}` : ''}
      </AppText>
      {r.holder_id ? (
        <AppText variant="caption" color={color.danger}>
          {r.req_no}은(는) 지금 {r.holder_name}({r.holder_email}) 계정이 쓰고 있어요. 승인하면 그 계정의 학적이 지워지고, 그 학생에게 다시 등록하라는 알림이 가요.
        </AppText>
      ) : null}
      {rejecting ? (
        <View style={{ gap: space.sm }}>
          <TextInput
            accessibilityLabel="반려 사유"
            value={note}
            onChangeText={(t) => setNote(t.slice(0, 100))}
            placeholder="반려 사유(학생에게 알림으로 가요)"
            placeholderTextColor={color.inkFaint}
            style={{ borderWidth: 1, borderColor: color.line, borderRadius: radius.control, paddingHorizontal: space.md, minHeight: 44, color: color.ink, backgroundColor: color.surface, ...fontStyle('regular') }}
          />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="반려하기" variant="soft" onPress={() => run('admin_decide_enrollment_request', { p_id: r.id, p_approve: false, p_note: note.trim() }, '반려했어요')} />
            <Button label="취소" variant="ghost" onPress={() => setRejecting(false)} />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="승인" onPress={() => run('admin_decide_enrollment_request', { p_id: r.id, p_approve: true, p_note: '' }, `${r.req_name} ${r.req_no}(으)로 정정했어요`)} />
          <Button label="반려" variant="ghost" onPress={() => setRejecting(true)} />
        </View>
      )}
    </View>
  );
}
