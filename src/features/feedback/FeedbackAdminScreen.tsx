import { useCallback, useEffect, useState } from 'react';
import { REWARD } from '@/lib/rewards';
import { TextInput, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { stampLabel } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { useStaffAccess } from '@/features/admin/access';
import { GAMES } from '@/features/games/catalog';
import { AiRelay } from './AiRelay';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';
import { KIND_LABEL, STATUS_LABEL, STATUS_TONE, type FeedbackKind, type FeedbackStatus } from './FeedbackScreen';

type Row = {
  id: number;
  kind: FeedbackKind;
  body: string;
  screen: string | null;
  app_version: string | null;
  device: string | null;
  status: FeedbackStatus;
  reply: string | null;
  created_at: string;
  nickname: string | null;
  grade: number | null;
  class_no: number | null;
};

/** 관리자·개발자: 학생 의견 처리(개발자는 확인 중·답변까지). '반영 완료'로 바꾸면 작성자에게 +10 토큰(서버가 한 번만 지급). */
export function FeedbackAdminScreen() {
  const { admin, developer, checked } = useStaffAccess();
  const staff = admin || developer; // 선생님(관리자 아님)은 의견 관리 대상 아님
  const [filter, setFilter] = useState<'open' | 'all' | 'game'>('open');
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    let qy = supabase.from('feedback_admin').select('*').order('created_at', { ascending: false }).limit(100);
    if (filter === 'open') qy = qy.in('status', ['new', 'seen']);
    if (filter === 'game') qy = qy.like('screen', 'game:%');
    const { data } = await qy;
    setRows((data as Row[]) ?? []);
  }, [filter]);

  useEffect(() => {
    if (staff) load();
  }, [staff, load]);

  if (!staff) {
    return (
      <Screen topInset={false}>
        <AppText variant="body" color={color.inkMuted}>
          {checked ? '관리자·개발자만 볼 수 있는 화면이에요.' : '확인하는 중…'}
        </AppText>
      </Screen>
    );
  }

  return (
    <Screen topInset={false} onRefresh={load}>
      {admin ? <AiRelay onApplied={load} /> : null}
      <Segmented
        label="보기"
        value={filter}
        onChange={setFilter}
        options={
          admin
            ? [
                { value: 'open', label: '처리할 것' },
                { value: 'game', label: '게임 의견' },
                { value: 'all', label: '전체' },
              ]
            : [
                { value: 'open', label: '처리할 것' },
                { value: 'all', label: '전체 게임 의견' },
              ]
        }
      />
      {rows === null ? (
        <AppText variant="body" color={color.inkMuted}>
          불러오는 중…
        </AppText>
      ) : rows.length === 0 ? (
        <AppText variant="body" color={color.inkMuted}>
          처리할 의견이 없어요 🎉
        </AppText>
      ) : (
        rows.map((r) => <AdminCard key={r.id} r={r} admin={admin} onChanged={load} />)
      )}
    </Screen>
  );
}

function AdminCard({ r, admin, onChanged }: { r: Row; admin: boolean; onChanged: () => void }) {
  const [reply, setReply] = useState(r.reply ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = async (status: FeedbackStatus) => {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc('admin_update_feedback', { p_id: r.id, p_status: status, p_reply: reply });
    setBusy(false);
    if (error) setErr(error.message);
    else onChanged();
  };

  return (
    <Card style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
        <Badge label={KIND_LABEL[r.kind]} tone={r.kind === 'bug' ? 'accent' : 'muted'} />
        <Badge label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />
        <AppText variant="caption" color={color.inkMuted}>
          {r.grade ? `${r.grade}-${r.class_no}` : '학번 없음'} · {r.nickname ?? '닉네임 없음'} · {stampLabel(r.created_at)}
        </AppText>
      </View>
      <AppText variant="body">{r.body}</AppText>
      <AppText variant="caption" color={color.inkFaint} numberOfLines={2}>
        {[r.screen && (r.screen.startsWith('game:') ? `🎮 ${gameTitle(r.screen.slice(5))}` : `화면 ${r.screen}`), r.app_version && `v${r.app_version}`, r.device].filter(Boolean).join(' · ')}
      </AppText>
      <TextInput
        accessibilityLabel="답변"
        value={reply}
        onChangeText={(t) => setReply(t.slice(0, 500))}
        placeholder="학생에게 보일 답변 (선택)"
        placeholderTextColor={color.inkFaint}
        multiline
        style={{
          minHeight: 64,
          borderWidth: 1,
          borderColor: color.line,
          borderRadius: radius.control,
          padding: space.md,
          fontSize: 14,
          color: color.ink,
          textAlignVertical: 'top',
          ...fontStyle('regular'),
        }}
      />
      {err ? (
        <AppText variant="label" weight="regular" color={color.danger}>
          {err}
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Button label="확인 중" variant="soft" disabled={busy} onPress={() => set('seen')} />
        {admin ? (
          <>
            <Button label={`반영 완료 (+${REWARD.feedbackDone})`} disabled={busy} onPress={() => set('done')} />
            <Button label="보류" variant="ghost" disabled={busy} onPress={() => set('wontfix')} />
          </>
        ) : null}
      </View>
      {!admin ? (
        <AppText variant="caption" color={color.inkFaint}>
          개발자는 '확인 중'과 답변까지 할 수 있어요. 반영 완료(토큰 지급)는 호원·종범에게 알려 주세요.
        </AppText>
      ) : null}
    </Card>
  );
}

function gameTitle(id: string) {
  const g = (GAMES as Record<string, { emoji: string; title: string } | undefined>)[id];
  return g ? `${g.emoji} ${g.title}` : id;
}
