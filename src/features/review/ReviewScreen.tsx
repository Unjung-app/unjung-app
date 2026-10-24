import { useState } from 'react';
import { Image, TextInput, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { KIND_EMOJI, KIND_LABEL, scopeLabel } from '@/features/notice/data';
import { shortLabel, stampLabel } from '@/lib/date';
import { useAuth } from '@/state/auth';
import { useWallet } from '@/state/wallet';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';
import { useReviewQueues, type QueueNotice } from './data';

const REJECT_REASONS = ['부적절한 내용이에요', '정보가 부족해요(날짜·장소)', '이미 올라온 공지와 같아요', '개인정보가 들어 있어요', '학생 공지 성격이 아니에요'];

/** 검토위원 화면: 공지 승인 · 신고 처리 · 분실물 사진 승인. 처리할 때마다 +2 토큰(하루 최대 20) */
export function ReviewScreen() {
  const { role } = useAuth();
  const { refresh } = useWallet();
  const isReviewer = role === 'reviewer' || role === 'admin';
  const q = useReviewQueues(isReviewer);
  const [tab, setTab] = useState<'notice' | 'report' | 'photo'>('notice');

  if (!isReviewer) {
    return (
      <Screen topInset={false}>
        <AppText variant="body" color={color.inkMuted}>
          검토위원만 볼 수 있는 화면이에요. 검토위원은 학생자치회가 임명해요.
        </AppText>
      </Screen>
    );
  }

  const pending = (q.notices ?? []).filter((n) => n.status === 'pending');
  const reportedNotices = (q.notices ?? []).filter((n) => n.status !== 'pending');
  const after = () => refresh('검토위원 활동');

  return (
    <Screen topInset={false} onRefresh={q.reload}>
      <Segmented
        label="검토 종류"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'notice', label: `공지 ${pending.length}` },
          { value: 'report', label: `신고 ${reportedNotices.length + (q.reviews ?? []).filter((r) => r.hidden).length}` },
          { value: 'photo', label: `사진 ${(q.photos ?? []).length}` },
        ]}
      />
      <AppText variant="caption" color={color.inkMuted}>
        처리할 때마다 +2 토큰(하루 최대 20). 작성자는 닉네임·학년만 보여요. 공정하게 판단해 주세요.
      </AppText>

      {tab === 'notice' ? (
        q.notices === null ? (
          <AppText variant="body" color={color.inkMuted}>
            불러오는 중…
          </AppText>
        ) : pending.length === 0 ? (
          <Card>
            <AppText variant="body" color={color.inkMuted}>
              검토할 공지가 없어요 🎉
            </AppText>
          </Card>
        ) : (
          pending.map((n) => <PendingNotice key={n.id} n={n} onDecide={async (ok, reason) => { const r = await q.review(n.id, ok, reason); if (r.ok) after(); return r; }} />)
        )
      ) : null}

      {tab === 'report' ? (
        <>
          <AppText variant="heading">신고된 공지</AppText>
          {reportedNotices.length === 0 ? (
            <AppText variant="caption" color={color.inkMuted}>
              없어요
            </AppText>
          ) : (
            reportedNotices.map((n) => (
              <Card key={n.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                  <Badge label={n.status === 'hidden' ? '숨겨짐' : '게시 중'} tone={n.status === 'hidden' ? 'accent' : 'muted'} />
                  <AppText variant="caption" color={color.danger}>
                    신고 {n.report_count}건{n.reasons ? ` · ${n.reasons}` : ''}
                  </AppText>
                </View>
                <AppText variant="bodyStrong">{n.title}</AppText>
                <AppText variant="body">{n.body}</AppText>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button label="다시 게시" variant="soft" style={{ flex: 1 }} onPress={() => q.showNotice(n.id, true)} />
                  <Button label="숨김 유지" style={{ flex: 1 }} onPress={() => q.showNotice(n.id, false)} />
                </View>
              </Card>
            ))
          )}
          <AppText variant="heading" style={{ marginTop: space.md }}>
            신고된 급식 한줄평
          </AppText>
          {(q.reviews ?? []).length === 0 ? (
            <AppText variant="caption" color={color.inkMuted}>
              없어요
            </AppText>
          ) : (
            (q.reviews ?? []).map((r) => (
              <Card key={r.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                  <Badge label={r.hidden ? '숨겨짐' : '보이는 중'} tone={r.hidden ? 'accent' : 'muted'} />
                  <AppText variant="caption" color={color.danger}>
                    신고 {r.report_count}건{r.reasons ? ` · ${r.reasons}` : ''}
                  </AppText>
                </View>
                <AppText variant="caption" color={color.inkMuted}>
                  {r.meal_date} 점심 · 익명의 {r.grade}학년
                </AppText>
                <AppText variant="body">{r.body}</AppText>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button label="문제없음(복구)" variant="soft" style={{ flex: 1 }} onPress={() => q.setReviewHidden(r.id, false)} />
                  <Button label="숨김" style={{ flex: 1 }} onPress={() => q.setReviewHidden(r.id, true)} />
                </View>
              </Card>
            ))
          )}
        </>
      ) : null}

      {tab === 'photo' ? (
        (q.photos ?? []).length === 0 ? (
          <Card>
            <AppText variant="body" color={color.inkMuted}>
              승인할 분실물 사진이 없어요
            </AppText>
          </Card>
        ) : (
          (q.photos ?? []).map((p) => (
            <Card key={p.id} style={{ gap: space.sm }}>
              <AppText variant="bodyStrong">
                {p.type === 'found' ? '주웠어요' : '잃어버렸어요'} · {p.item} · {p.place}
              </AppText>
              {p.url ? (
                <Image source={{ uri: p.url }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.control, backgroundColor: color.surfaceMuted }} resizeMode="contain" accessibilityLabel={`${p.item} 사진`} />
              ) : (
                <AppText variant="caption" color={color.inkMuted}>
                  사진을 불러오지 못했어요
                </AppText>
              )}
              <AppText variant="caption" color={color.inkMuted}>
                얼굴·이름표·학번 등 개인정보가 보이거나 물건과 상관없는 사진이면 거절해 주세요.
              </AppText>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button label="거절" variant="soft" style={{ flex: 1 }} onPress={async () => { const r = await q.reviewPhoto(p.id, false); if (r.ok) after(); }} />
                <Button label="승인" style={{ flex: 1 }} onPress={async () => { const r = await q.reviewPhoto(p.id, true); if (r.ok) after(); }} />
              </View>
            </Card>
          ))
        )
      ) : null}
    </Screen>
  );
}

function PendingNotice({ n, onDecide }: { n: QueueNotice; onDecide: (ok: boolean, reason: string) => Promise<{ ok: boolean; message?: string }> }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const act = async (ok: boolean, r: string) => {
    setBusy(true);
    setErr(null);
    const x = await onDecide(ok, r);
    setBusy(false);
    if (!x.ok) setErr(x.message ?? '실패했어요');
  };
  return (
    <Card style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' }}>
        <Badge label={`${KIND_EMOJI[n.kind]} ${KIND_LABEL[n.kind]}`} tone="muted" />
        <Badge label={scopeLabel(n)} />
        <AppText variant="caption" color={color.inkMuted}>
          {n.author_nickname ?? '닉네임 없음'} · {n.author_grade}학년 · {stampLabel(n.created_at)}
        </AppText>
      </View>
      <AppText variant="heading">{n.title}</AppText>
      <AppText variant="body">{n.body}</AppText>
      <AppText variant="caption" color={color.inkMuted}>
        게시 {shortLabel(n.show_from)} ~ {shortLabel(n.show_until)}
        {n.event_date ? ` · 날짜 ${shortLabel(n.event_date)}` : ''}
      </AppText>
      {n.mine ? (
        <AppText variant="caption" color={color.accentInk}>
          내가 쓴 공지는 다른 검토위원이 검토해야 해요.
        </AppText>
      ) : rejecting ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {REJECT_REASONS.map((r) => (
              <Button key={r} label={r} variant={reason === r ? 'primary' : 'soft'} onPress={() => setReason(r)} />
            ))}
          </View>
          <TextInput
            accessibilityLabel="반려 사유"
            value={reason}
            onChangeText={(t) => setReason(t.slice(0, 200))}
            placeholder="작성자에게 보일 반려 사유"
            placeholderTextColor={color.inkFaint}
            style={{ minHeight: 44, borderWidth: 1, borderColor: color.line, borderRadius: radius.control, paddingHorizontal: space.md, fontSize: 14, color: color.ink, ...fontStyle('regular') }}
          />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="취소" variant="soft" style={{ flex: 1 }} onPress={() => setRejecting(false)} />
            <Button label="반려하기" style={{ flex: 1, backgroundColor: color.danger }} disabled={busy || !reason.trim()} onPress={() => act(false, reason)} />
          </View>
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="반려" variant="soft" style={{ flex: 1 }} disabled={busy} onPress={() => setRejecting(true)} />
          <Button label="승인 · 게시" style={{ flex: 2 }} disabled={busy} onPress={() => act(true, '')} />
        </View>
      )}
      {err ? (
        <AppText variant="label" weight="regular" color={color.danger}>
          {err}
        </AppText>
      ) : null}
    </Card>
  );
}
