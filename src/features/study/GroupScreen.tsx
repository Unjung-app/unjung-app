import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/Segmented';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/state/auth';
import { color, nameColor, radius, space } from '@/theme/tokens';
import { call, hm, hms, useGroupBoard, type BoardMember } from './api';

type Sort = 'today' | 'period';

/** 그룹 순위판: 멤버(닉네임) · 지금 공부 중(초록 점) · 오늘/기간 누적 순위 · 참여일 수 */
export function GroupScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const gid = Number(id) || 0;
  const { status } = useAuth();
  const b = useGroupBoard(gid, status === 'ready');
  const [sort, setSort] = useState<Sort>('period');
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const g = b.data;
  if (!g) {
    return (
      <Screen topInset={false} onRefresh={b.reload}>
        <AppText variant="body" color={b.error ? color.danger : color.inkMuted}>
          {b.error ?? '불러오는 중…'}
        </AppText>
      </Screen>
    );
  }

  const key = sort === 'today' ? 'today_seconds' : 'period_seconds';
  const rows = [...g.members].sort((a, b2) => b2[key] - a[key] || b2.period_seconds - a.period_seconds);
  const liveCount = g.members.filter((m) => m.live).length;
  const me = rows.findIndex((m) => m.mine);
  const period = `${g.starts_on.slice(5).replace('-', '/')}~${g.ends_on.slice(5).replace('-', '/')}`;
  const before = g.today < g.starts_on;

  return (
    <Screen topInset={false} onRefresh={b.reload}>
      <Card tone="navy" style={{ gap: 4 }}>
        <AppText variant="heading" color={color.onNavy} style={{ fontSize: 20, lineHeight: 28 }}>
          {g.name}
        </AppText>
        <AppText variant="caption" color={color.onNavySub}>
          기간 {period} · 멤버 {g.members.length}/{g.capacity}명
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color.liveOnNavy }} />
          <AppText variant="label" color={color.onNavy}>
            지금 {liveCount}명 공부 중
          </AppText>
        </View>
        {me >= 0 ? (
          <AppText variant="label" color={color.accent} style={{ marginTop: 2 }}>
            내 순위 {me + 1}위 · {sort === 'today' ? `오늘 ${hm(rows[me].today_seconds)}` : `누적 ${hm(rows[me].period_seconds)} · 참여 ${rows[me].days}일`}
          </AppText>
        ) : null}
      </Card>
      {before ? (
        <Card tone="muted">
          <AppText variant="caption" color={color.inkMuted}>
            집계는 {g.starts_on.slice(5).replace('-', '/')}부터 시작해요. 지금 공부한 시간은 기간 누적에 들어가지 않아요.
          </AppText>
        </Card>
      ) : null}

      <Segmented<Sort>
        label="순위 기준"
        value={sort}
        onChange={setSort}
        options={[
          { value: 'period', label: '기간 누적' },
          { value: 'today', label: '오늘' },
        ]}
      />

      <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <AppText variant="body" color={color.inkMuted} style={{ padding: space.lg }}>
            아직 멤버가 없어요.
          </AppText>
        ) : (
          rows.map((m, i) => <Row key={i} m={m} rank={i + 1} sort={sort} first={i === 0} />)
        )}
      </View>
      <AppText variant="caption" color={color.inkFaint}>
        참여일 = 하루 30분 이상 공부한 날. 수업 시간에 잰 시간도 포함해요. 30초마다 새로 고쳐요.
      </AppText>

      {g.manager ? <Button label="관리자 보기 (실명·학번·날짜별)" variant="soft" onPress={() => router.push(`/study/admin/${g.id}`)} /> : null}
      {g.joined ? (
        confirmLeave ? (
          <Card tone="muted" style={{ gap: space.sm }}>
            <AppText variant="label">정말 나갈까요? 다시 들어오려면 비밀번호가 필요해요. 공부 기록은 그대로 남아요.</AppText>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button label="취소" variant="soft" style={{ flex: 1 }} onPress={() => setConfirmLeave(false)} />
              <Button
                label={leaving ? '…' : '나가기'}
                style={{ flex: 1, backgroundColor: color.danger }}
                disabled={leaving}
                onPress={async () => {
                  setLeaving(true);
                  await call('leave_study_group', { p_id: g.id });
                  setLeaving(false);
                  router.back();
                }}
              />
            </View>
          </Card>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="그룹 나가기" onPress={() => setConfirmLeave(true)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <AppText variant="label" color={color.inkFaint}>
              그룹 나가기
            </AppText>
          </Pressable>
        )
      ) : null}
    </Screen>
  );
}

function Row({ m, rank, sort, first }: { m: BoardMember; rank: number; sort: Sort; first: boolean }) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  const sec = sort === 'today' ? m.today_seconds : m.period_seconds;
  return (
    <View
      accessible
      accessibilityLabel={`${rank}위 ${m.nickname ?? '닉네임 없음'}${m.mine ? '(나)' : ''}${m.live ? ', 지금 공부 중' : ''}, ${hm(sec)}, 참여 ${m.days}일`}
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingHorizontal: space.lg, gap: space.md, borderTopWidth: first ? 0 : 1, borderTopColor: color.lineSoft, backgroundColor: m.mine ? color.accentSoft : color.surface }}>
      <AppText variant="bodyStrong" color={color.inkMuted} style={{ width: 28, textAlign: 'center' }}>
        {medal ?? rank}
      </AppText>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m.live ? color.success : color.line }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodyStrong" numberOfLines={1} color={(m.equip?.name_color && nameColor[m.equip.name_color]) || color.ink}>
          {m.equip?.emoji ? `${m.equip.emoji} ` : ''}
          {m.nickname ?? '(닉네임 없음)'}
          {m.mine ? ' (나)' : ''}
        </AppText>
        <AppText variant="caption" color={m.live ? color.success : color.inkMuted} numberOfLines={1}>
          {m.live ? '공부 중 · ' : ''}참여 {m.days}일{sort === 'period' ? ` · 오늘 ${hm(m.today_seconds)}` : ''}
        </AppText>
      </View>
      <AppText variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
        {hms(sec)}
      </AppText>
    </View>
  );
}
