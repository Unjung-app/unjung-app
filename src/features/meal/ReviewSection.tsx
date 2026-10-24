import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button, Card, SectionTitle } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/Segmented';
import { useNow } from '@/features/hooks';
import { hhmm, seoulNow, type Ymd } from '@/lib/date';
import { useAuth } from '@/state/auth';
import { useWallet } from '@/state/wallet';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';
import { reviewWindow, useMealReviews, type MealReview } from './reviews';

const REPORT_REASONS = ['욕설·비하', '급식과 상관없음', '도배·장난'];
const PAGE = 5;

/** 한 끼(점심·저녁)의 한줄평: 내 한줄평 쓰기 + 친구들 한줄평(공감순/최신순) */
export function ReviewSection({ mealYmd, code, title }: { mealYmd: Ymd; code: number; title: string }) {
  const router = useRouter();
  const now = useNow();
  const { status, enrollment } = useAuth();
  const { refresh: refreshWallet } = useWallet();
  const signedIn = status === 'ready';
  const { items, post, remove, like, report } = useMealReviews(mealYmd, code, signedIn);
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const [shown, setShown] = useState(PAGE);
  const [draft, setDraft] = useState<string | null>(null); // null = 쓰는 중 아님
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const mine = items?.find((r) => r.mine) ?? null;
  const others = useMemo(() => {
    const list = (items ?? []).filter((r) => !r.mine);
    return sort === 'top'
      ? [...list].sort((a, b) => b.like_count - a.like_count || a.created_at.localeCompare(b.created_at))
      : list;
  }, [items, sort]);
  const win = reviewWindow(mealYmd, code, enrollment?.grade ?? null, now.ymd, now.minutes);

  if (status === 'signedOut' || status === 'loading') {
    return (
      <Card>
        <SectionTitle title={`${title} 한줄평`} />
        <AppText variant="body" color={color.inkMuted}>
          학교 계정으로 로그인하면 친구들의 한줄평을 보고 내 한줄평도 남길 수 있어요. 모든 한줄평은 익명이에요.
        </AppText>
        <Button label="로그인하기" variant="soft" onPress={() => router.push('/login')} />
      </Card>
    );
  }

  const submit = async () => {
    if (draft === null) return;
    setBusy(true);
    setMsg(null);
    const r = await post(draft);
    setBusy(false);
    if (r.ok) {
      setDraft(null);
      setMsg({ ok: true, text: '등록했어요' });
      if (r.tokens) refreshWallet('급식 한줄평');
    } else setMsg({ ok: false, text: r.message });
  };

  const len = draft?.trim().length ?? 0;

  return (
    <Card>
      <SectionTitle
        title={`${title} 한줄평`}
        right={
          <AppText variant="caption" color={color.inkMuted}>
            {items ? `${items.length}개 · 익명` : ''}
          </AppText>
        }
      />

      {/* 내 한줄평 */}
      {draft !== null ? (
        <View style={{ gap: space.sm }}>
          <TextInput
            accessibilityLabel="한줄평 쓰기"
            value={draft}
            onChangeText={(t) => setDraft(t.replace(/\n/g, ' ').slice(0, 100))}
            placeholder="오늘 급식 어땠어요? (별점 없이 한 줄로)"
            placeholderTextColor={color.inkFaint}
            maxLength={100}
            autoFocus
            style={{
              minHeight: 48,
              borderWidth: 1,
              borderColor: color.line,
              borderRadius: radius.control,
              paddingHorizontal: space.md,
              fontSize: 15,
              color: color.ink,
              backgroundColor: color.surface,
              ...fontStyle('regular'),
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <AppText variant="caption" color={color.inkMuted} style={{ flex: 1 }}>
              {len}/100 · {mine ? '수정해도 토큰은 다시 받지 않아요' : len >= 10 ? '+3 토큰을 받아요' : '10자 이상이면 +3 토큰'}
            </AppText>
            <Button label="취소" variant="ghost" onPress={() => setDraft(null)} disabled={busy} />
            <Button label={busy ? '등록 중…' : '등록'} onPress={submit} disabled={busy || len < 2} />
          </View>
        </View>
      ) : mine ? (
        <View style={{ backgroundColor: color.accentSoft, borderRadius: radius.control, padding: space.md, gap: 4 }}>
          <AppText variant="caption" weight="semibold" color={color.accentInk}>
            내 한줄평{mine.hidden ? ' · 신고가 많아 다른 학생에게 숨겨졌어요' : ` · 👍 ${mine.like_count}`}
          </AppText>
          <AppText variant="body">{mine.body}</AppText>
          {win.open ? (
            <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' }}>
              <Button label="수정" variant="ghost" onPress={() => setDraft(mine.body)} />
              <Button
                label="삭제"
                variant="ghost"
                onPress={async () => {
                  const r = await remove(mine.id);
                  setMsg(r.ok ? { ok: true, text: '삭제했어요' } : { ok: false, text: r.message });
                }}
              />
            </View>
          ) : null}
        </View>
      ) : !enrollment ? (
        <AppText variant="caption" color={color.inkMuted}>
          학번을 등록하면 한줄평을 쓸 수 있어요.
        </AppText>
      ) : win.open ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="한줄평 쓰기"
          onPress={() => {
            setDraft('');
            setMsg(null);
          }}
          style={({ pressed }) => ({
            minHeight: 48,
            borderRadius: radius.control,
            borderWidth: 1,
            borderColor: color.line,
            borderStyle: 'dashed',
            backgroundColor: pressed ? color.surfaceMuted : color.surface,
            justifyContent: 'center',
            paddingHorizontal: space.md,
          })}>
          <AppText variant="body" color={color.inkMuted}>
            ✏️ 한줄평 남기기 · +3 토큰
          </AppText>
        </Pressable>
      ) : (
        <AppText variant="caption" color={color.inkMuted}>
          {win.reason}
        </AppText>
      )}
      {msg ? (
        <AppText variant="label" weight="regular" color={msg.ok ? color.success : color.danger}>
          {msg.text}
        </AppText>
      ) : null}

      {/* 친구들 한줄평 */}
      {others.length > 1 ? (
        <Segmented
          label="정렬"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'top', label: '공감순' },
            { value: 'new', label: '최신순' },
          ]}
        />
      ) : null}
      {items === null ? (
        <AppText variant="caption" color={color.inkMuted}>
          불러오는 중…
        </AppText>
      ) : others.length === 0 ? (
        <AppText variant="caption" color={color.inkMuted}>
          아직 친구들의 한줄평이 없어요{win.open ? '. 첫 번째로 남겨 보세요!' : ''}
        </AppText>
      ) : (
        <View style={{ gap: space.sm }}>
          {others.slice(0, shown).map((r) => (
            <ReviewRow key={r.id} r={r} onLike={(on) => like(r.id, on)} onReport={(reason) => report(r.id, reason)} />
          ))}
          {others.length > shown ? (
            <Button label={`${others.length - shown}개 더 보기`} variant="ghost" onPress={() => setShown((n) => n + PAGE * 2)} />
          ) : null}
        </View>
      )}
    </Card>
  );
}

function ReviewRow({
  r,
  onLike,
  onReport,
}: {
  r: MealReview;
  onLike: (on: boolean) => void;
  onReport: (reason: string) => Promise<{ ok: boolean }>;
}) {
  const [reporting, setReporting] = useState(false);
  const t = seoulNow(new Date(r.created_at));
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: color.lineSoft, paddingTop: space.sm, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <AppText variant="caption" color={color.inkMuted} style={{ flex: 1 }}>
          익명의 {r.grade}학년 · {hhmm(t.minutes)}
        </AppText>
        {r.reported ? (
          <AppText variant="caption" color={color.inkFaint}>
            신고함
          </AppText>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이 한줄평 신고하기"
            onPress={() => setReporting((v) => !v)}
            hitSlop={8}
            style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
            <AppText variant="caption" color={color.inkFaint}>
              신고
            </AppText>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`공감 ${r.like_count}개${r.liked ? ', 공감함' : ''}`}
          accessibilityState={{ selected: r.liked }}
          onPress={() => onLike(!r.liked)}
          style={({ pressed }) => ({
            minHeight: 44,
            minWidth: 64,
            paddingHorizontal: space.md,
            borderRadius: radius.round,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: r.liked ? color.navy : pressed ? color.surfaceMuted : color.bg,
          })}>
          <AppText variant="label" color={r.liked ? color.onNavy : color.ink}>
            👍 {r.like_count}
          </AppText>
        </Pressable>
      </View>
      <AppText variant="body">{r.body}</AppText>
      {reporting ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
          <AppText variant="caption" color={color.danger}>
            신고 사유:
          </AppText>
          {REPORT_REASONS.map((reason) => (
            <Button
              key={reason}
              label={reason}
              variant="soft"
              onPress={async () => {
                await onReport(reason);
                setReporting(false);
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
