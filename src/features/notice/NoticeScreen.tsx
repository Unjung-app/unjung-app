import { useCallback, useEffect, useState } from 'react';
import { REWARD } from '@/lib/rewards';
import { Pressable, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useNow } from '@/features/hooks';
import { useReviewCount } from '@/features/review/data';
import { dDayLabel, shortLabel } from '@/lib/date';
import { useAuth } from '@/state/auth';
import { color, radius, space } from '@/theme/tokens';
import { markNoticesSeen } from './NoticeStrip';
import { KIND_EMOJI, KIND_LABEL, KINDS, reportNotice, scopeLabel, useMyNotices, useNoticeFeed, withdrawNotice, type Notice, type NoticeKind } from './data';

const STATUS: Record<string, { label: string; tone: 'muted' | 'accent' | 'success' }> = {
  pending: { label: '검토 중', tone: 'accent' },
  approved: { label: '게시 중', tone: 'success' },
  rejected: { label: '반려됨', tone: 'muted' },
  hidden: { label: '신고로 숨김', tone: 'muted' },
};

export function NoticeScreen({ inStack = false }: { inStack?: boolean }) {
  const router = useRouter();
  const now = useNow();
  const { status, role } = useAuth();
  const ready = status === 'ready';
  const feed = useNoticeFeed(ready);
  const mine = useMyNotices(ready);
  const reviewCount = useReviewCount(ready && role !== 'student');
  const [filter, setFilter] = useState<NoticeKind | 'all'>('all');

  // 이 화면을 보면 홈의 '새 공지' 표시를 지운다
  useEffect(() => {
    if (feed.items?.length) markNoticesSeen(Math.max(...feed.items.map((n) => n.id)));
  }, [feed.items]);

  useFocusEffect(
    useCallback(() => {
      feed.reload();
      mine.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [feed.reload, mine.reload]),
  );

  const header = !inStack ? (
    <AppText variant="title" accessibilityRole="header">
      학생 공지
    </AppText>
  ) : null;

  if (!ready) {
    return (
      <Screen topInset={!inStack}>
        {header}
        <Card tone="navy">
          <AppText variant="heading" color={color.onNavy} style={{ fontSize: 20, lineHeight: 28 }}>
            학교 계정으로 로그인하면{'\n'}학생 공지를 보고 올릴 수 있어요
          </AppText>
          <Button
            label={status === 'needsEnrollment' ? '학번 등록하기' : '로그인하기'}
            variant="soft"
            style={{ backgroundColor: color.surface }}
            onPress={() => router.push(status === 'needsEnrollment' ? '/onboarding' : '/login')}
          />
        </Card>
      </Screen>
    );
  }

  const list = (feed.items ?? []).filter((n) => filter === 'all' || n.kind === filter);
  const myOpen = (mine.items ?? []).filter((n) => n.status !== 'approved' || n.show_until >= now.ymd).slice(0, 5);

  return (
    <Screen topInset={!inStack} onRefresh={() => (feed.reload(), mine.reload())}>
      {header}
      <AppText variant="body" color={color.inkMuted}>
        학생이 올리고 학생자치회 검토위원이 확인한 소식이에요. 선생님 공식 공지는 리로스쿨에서 확인하세요.
      </AppText>

      {role !== 'student' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/review')}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: pressed ? color.navyRaised : color.navy, borderRadius: radius.card, padding: space.lg })}>
          <AppText variant="bodyStrong" color={color.onNavy} style={{ flex: 1 }}>
            🛡️ 검토위원 · 처리할 일 {reviewCount ?? 0}건
          </AppText>
          <AppText variant="label" color={color.accent}>
            검토하기 ›
          </AppText>
        </Pressable>
      ) : null}

      <Button label="＋ 공지 올리기" onPress={() => router.push('/notice/new')} />
      <AppText variant="caption" color={color.inkMuted} align="center">
        검토위원이 승인하면 게시되고 +{REWARD.noticeApproved} 토큰을 받아요(하루 1건)
      </AppText>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {(['all', ...KINDS] as const).map((k) => {
          const on = filter === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setFilter(k)}
              style={{ minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.round, justifyContent: 'center', backgroundColor: on ? color.navy : color.surface }}>
              <AppText variant="label" color={on ? color.onNavy : color.ink}>
                {k === 'all' ? '전체' : `${KIND_EMOJI[k]} ${KIND_LABEL[k]}`}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {feed.items === null ? (
        <AppText variant="body" color={color.inkMuted}>
          불러오는 중…
        </AppText>
      ) : list.length === 0 ? (
        <Card>
          <AppText variant="body" color={color.inkMuted}>
            지금 게시 중인 공지가 없어요. 알리고 싶은 소식이 있다면 올려 보세요!
          </AppText>
        </Card>
      ) : (
        list.map((n) => <NoticeCard key={n.id} n={n} today={now.ymd} onReported={feed.reload} />)
      )}

      {myOpen.length ? (
        <>
          <AppText variant="heading" style={{ marginTop: space.md }}>
            내가 올린 공지
          </AppText>
          {myOpen.map((n) => (
            <Card key={n.id} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Badge label={STATUS[n.status]?.label ?? n.status} tone={STATUS[n.status]?.tone ?? 'muted'} />
                <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {n.title}
                </AppText>
              </View>
              <AppText variant="caption" color={color.inkMuted}>
                게시 {shortLabel(n.show_from)} ~ {shortLabel(n.show_until)}
              </AppText>
              {n.status === 'rejected' && n.reject_reason ? (
                <AppText variant="caption" color={color.danger}>
                  반려 사유: {n.reject_reason}
                </AppText>
              ) : null}
              {n.status === 'pending' || n.status === 'approved' ? (
                <Button
                  label={n.status === 'pending' ? '올리기 취소' : '게시 내리기'}
                  variant="ghost"
                  onPress={async () => {
                    await withdrawNotice(n.id);
                    mine.reload();
                    feed.reload();
                  }}
                />
              ) : null}
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function NoticeCard({ n, today, onReported }: { n: Notice; today: string; onReported: () => void }) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  return (
    <Card style={{ gap: space.sm }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          <Badge label={`${KIND_EMOJI[n.kind]} ${KIND_LABEL[n.kind]}`} tone="muted" />
          {n.scope !== 'all' ? <Badge label={scopeLabel(n)} /> : null}
          {n.event_date ? (
            <AppText variant="caption" weight="semibold" color={color.navy}>
              {shortLabel(n.event_date)} · {dDayLabel(today, n.event_date)}
            </AppText>
          ) : null}
        </View>
        <AppText variant="heading">{n.title}</AppText>
        <AppText variant="body" numberOfLines={open ? undefined : 3}>
          {n.body}
        </AppText>
        <AppText variant="caption" color={color.inkFaint}>
          {n.mine ? '내가 올림' : n.author_nickname ?? `${n.author_grade ?? ''}학년 학생`} · {shortLabel(n.show_until)}까지 게시
        </AppText>
      </Pressable>
      {open && !n.mine ? (
        n.reported ? (
          <AppText variant="caption" color={color.inkFaint}>
            신고했어요. 검토위원이 확인해요.
          </AppText>
        ) : reporting ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
            <AppText variant="caption" color={color.danger}>
              신고 사유:
            </AppText>
            {['부적절해요', '사실이 아니에요', '도배·장난'].map((r) => (
              <Button
                key={r}
                label={r}
                variant="soft"
                onPress={async () => {
                  await reportNotice(n.id, r);
                  setReporting(false);
                  onReported();
                }}
              />
            ))}
          </View>
        ) : (
          <Button label="신고하기" variant="ghost" onPress={() => setReporting(true)} />
        )
      ) : null}
    </Card>
  );
}
