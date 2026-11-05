import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { useNow } from '@/features/hooks';
import { isoToYmd, shortLabel, stampLabel } from '@/lib/date';
import { useAuth } from '@/state/auth';
import { color, radius, space } from '@/theme/tokens';
import {
  CATEGORIES,
  CATEGORY_EMOJI,
  CATEGORY_LABEL,
  closesLabel,
  lastDayOf,
  useSuggestionFeed,
  useSuggestionModQueue,
  useSurveyFeed,
  type ModSuggestion,
  type Suggestion,
  type SuggestionCategory,
  type SurveyItem,
} from './data';
import { ChipRow, PickChip } from './ui';

/** 운중 보이스: 학생회 설문(참여 +3) · 익명 건의(공감, 기획행정부 확인 표시) */
export function VoiceScreen({ inStack = false }: { inStack?: boolean }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { status, planner } = useAuth();
  const ready = status === 'ready';
  const [tab, setTab] = useState<'survey' | 'suggest'>(params.tab === 'suggest' ? 'suggest' : 'survey');
  const surveys = useSurveyFeed(ready);
  const suggestions = useSuggestionFeed(ready);
  const modQueue = useSuggestionModQueue(ready && planner);

  useFocusEffect(
    useCallback(() => {
      surveys.reload();
      suggestions.reload();
      modQueue.reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [surveys.reload, suggestions.reload, modQueue.reload]),
  );

  const header = !inStack ? (
    <AppText variant="title" accessibilityRole="header">
      운중 보이스
    </AppText>
  ) : null;

  if (!ready) {
    return (
      <Screen topInset={!inStack}>
        {header}
        <Card tone="navy">
          <AppText variant="heading" color={color.onNavy} style={{ fontSize: 20, lineHeight: 28 }}>
            학교 계정으로 로그인하면{'\n'}학생회 설문에 참여하고 건의할 수 있어요
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

  const openCount = (surveys.items ?? []).filter((s) => s.is_open && !s.responded).length;

  return (
    <Screen topInset={!inStack} onRefresh={() => (surveys.reload(), suggestions.reload(), modQueue.reload())}>
      {header}
      <Segmented
        label="보기"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'survey', label: openCount ? `설문 · 참여할 것 ${openCount}` : '설문' },
          { value: 'suggest', label: '건의' },
        ]}
      />
      {tab === 'survey' ? (
        <SurveyList items={surveys.items} planner={planner} onOpen={(id) => router.push(`/voice/survey/${id}`)} onCreate={() => router.push('/voice/survey/new')} />
      ) : (
        <SuggestionList feed={suggestions} planner={planner} mod={modQueue} onWrite={() => router.push('/voice/suggest')} />
      )}
    </Screen>
  );
}

function SurveyList({ items, planner, onOpen, onCreate }: { items: SurveyItem[] | null; planner: boolean; onOpen: (id: number) => void; onCreate: () => void }) {
  const now = useNow();
  return (
    <>
      {planner ? (
        <>
          <Button label="＋ 설문 만들기 (기획행정부)" onPress={onCreate} />
        </>
      ) : (
        <AppText variant="caption" color={color.inkMuted} align="center">
          학생자치회 기획행정부가 올리는 설문이에요 · 참여하면 +3 토큰
        </AppText>
      )}
      {items === null ? (
        <AppText variant="body" color={color.inkMuted}>
          불러오는 중…
        </AppText>
      ) : items.length === 0 ? (
        <Card>
          <AppText variant="body" color={color.inkMuted}>
            지금 진행 중인 설문이 없어요.
          </AppText>
        </Card>
      ) : (
        items.map((s) => (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={`${s.title}. ${s.responded ? '참여함' : s.is_open ? '참여하기' : '마감됨'}`}
            onPress={() => onOpen(s.id)}
            style={({ pressed }) => ({ backgroundColor: pressed ? color.surfaceMuted : color.surface, borderRadius: radius.card, padding: space.xl, gap: 6, opacity: s.is_open ? 1 : 0.75 })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
              {s.responded ? <Badge label="✓ 참여함" tone="success" /> : s.is_open ? <Badge label="참여하기 +3" /> : <Badge label="마감됨" tone="muted" />}
              {s.scope_grade ? <Badge label={`${s.scope_grade}학년`} tone="muted" /> : null}
              <AppText variant="caption" weight="semibold" color={s.is_open ? color.navy : color.inkFaint}>
                {closesLabel(s.closes_at, s.is_open, now.ymd)}
              </AppText>
            </View>
            <AppText variant="heading">{s.title}</AppText>
            {s.description ? (
              <AppText variant="body" color={color.inkMuted} numberOfLines={2}>
                {s.description}
              </AppText>
            ) : null}
            <AppText variant="caption" color={color.inkFaint}>
              질문 {s.question_count}개 · {s.response_count}명 참여 · {shortLabel(lastDayOf(s.closes_at))}까지
              {s.can_see_results ? ' · 결과 보기' : ''}
            </AppText>
          </Pressable>
        ))
      )}
    </>
  );
}

type Feed = ReturnType<typeof useSuggestionFeed>;
type Mod = ReturnType<typeof useSuggestionModQueue>;

function SuggestionList({ feed, planner, mod, onWrite }: { feed: Feed; planner: boolean; mod: Mod; onWrite: () => void }) {
  const [sort, setSort] = useState<'likes' | 'new'>('likes');
  const [cat, setCat] = useState<SuggestionCategory | 'all'>('all');
  const all = feed.items ?? [];
  const list = all
    .filter((x) => cat === 'all' || x.category === cat)
    .slice()
    .sort((a, b) => (sort === 'likes' ? b.like_count - a.like_count || b.created_at.localeCompare(a.created_at) : b.created_at.localeCompare(a.created_at)));

  return (
    <>
      <Button label="＋ 건의 올리기" onPress={onWrite} />
      <AppText variant="caption" color={color.inkMuted} align="center">
        이름 없이 학년만 보여요 · 공감이 많은 건의를 기획행정부가 먼저 살펴봐요
      </AppText>

      {planner && (mod.items?.length ?? 0) > 0 ? <ModQueue items={mod.items ?? []} onMod={async (id, show) => (await mod.mod(id, show), feed.reload())} /> : null}

      <ChipRow>
        <PickChip label="공감순" on={sort === 'likes'} onPress={() => setSort('likes')} />
        <PickChip label="최신순" on={sort === 'new'} onPress={() => setSort('new')} />
      </ChipRow>
      <ChipRow>
        <PickChip label="전체" on={cat === 'all'} onPress={() => setCat('all')} />
        {CATEGORIES.map((c) => (
          <PickChip key={c} label={`${CATEGORY_EMOJI[c]} ${CATEGORY_LABEL[c]}`} on={cat === c} onPress={() => setCat(c)} />
        ))}
      </ChipRow>

      {feed.items === null ? (
        <AppText variant="body" color={color.inkMuted}>
          불러오는 중…
        </AppText>
      ) : list.length === 0 ? (
        <Card>
          <AppText variant="body" color={color.inkMuted}>
            {all.length ? '이 분야의 건의가 없어요.' : '아직 건의가 없어요. 학교에 바라는 점을 처음으로 남겨 보세요!'}
          </AppText>
        </Card>
      ) : (
        list.map((x) => <SuggestionCard key={x.id} x={x} planner={planner} feed={feed} />)
      )}
    </>
  );
}

function SuggestionCard({ x, planner, feed }: { x: Suggestion; planner: boolean; feed: Feed }) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (p: Promise<{ ok: boolean; message?: string }>) => {
    setErr(null);
    const r = await p;
    if (!r.ok) setErr(r.message ?? '실패했어요');
  };

  return (
    <Card style={{ gap: space.sm }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          <Badge label={`${CATEGORY_EMOJI[x.category]} ${CATEGORY_LABEL[x.category]}`} tone="muted" />
          {x.checked ? <Badge label="✓ 기획행정부 확인" tone="success" /> : null}
        </View>
        <AppText variant="heading">{x.title}</AppText>
        <AppText variant="body" numberOfLines={open ? undefined : 3}>
          {x.body}
        </AppText>
        <AppText variant="caption" color={color.inkFaint}>
          {x.mine ? '내가 올림' : `익명의 ${x.author_grade ?? ''}학년`} · {shortLabel(isoToYmd(x.created_at))}
          {x.checked && x.checked_at ? ` · ${stampLabel(x.checked_at)} 확인` : ''}
        </AppText>
      </Pressable>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: x.liked, disabled: x.mine }}
          accessibilityLabel={`공감 ${x.like_count}개${x.liked ? ', 내가 공감함' : ''}`}
          disabled={x.mine}
          onPress={() => run(feed.like(x.id, !x.liked))}
          style={{ minHeight: 44, minWidth: 44, paddingHorizontal: space.md, borderRadius: radius.round, justifyContent: 'center', backgroundColor: x.liked ? color.accentSoft : color.surfaceMuted }}>
          <AppText variant="label" color={x.liked ? color.accentInk : color.ink}>
            👍 {x.like_count}
          </AppText>
        </Pressable>
        {planner ? (
          <Button label={x.checked ? '확인 취소' : '✓ 확인했어요'} variant={x.checked ? 'ghost' : 'soft'} onPress={() => run(feed.check(x.id, !x.checked))} />
        ) : null}
        {x.mine ? <Button label="내리기" variant="ghost" onPress={() => run(feed.withdraw(x.id))} /> : null}
        {!x.mine && open && !x.reported && !reporting ? <Button label="신고" variant="ghost" onPress={() => setReporting(true)} /> : null}
      </View>

      {reporting ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
          <AppText variant="caption" color={color.danger}>
            신고 사유:
          </AppText>
          {['욕설·비방', '특정인 언급', '장난·도배'].map((r) => (
            <Button
              key={r}
              label={r}
              variant="soft"
              onPress={async () => {
                setReporting(false);
                await run(feed.report(x.id, r));
              }}
            />
          ))}
        </View>
      ) : null}
      {x.reported ? (
        <AppText variant="caption" color={color.inkFaint}>
          신고했어요. 기획행정부가 확인해요.
        </AppText>
      ) : null}
      {err ? (
        <AppText variant="label" weight="regular" color={color.danger}>
          {err}
        </AppText>
      ) : null}
    </Card>
  );
}

function ModQueue({ items, onMod }: { items: ModSuggestion[]; onMod: (id: number, show: boolean) => Promise<unknown> }) {
  return (
    <Card tone="muted" style={{ gap: space.sm }}>
      <AppText variant="bodyStrong">🚩 신고된 건의 {items.length}건 (기획행정부)</AppText>
      {items.map((x) => (
        <View key={x.id} style={{ backgroundColor: color.surface, borderRadius: radius.control, padding: space.md, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Badge label={x.status === 'hidden' ? '숨김' : `신고 ${x.report_count}`} tone={x.status === 'hidden' ? 'muted' : 'accent'} />
            <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
              {x.title}
            </AppText>
          </View>
          <AppText variant="body" numberOfLines={4}>
            {x.body}
          </AppText>
          {x.reasons ? (
            <AppText variant="caption" color={color.danger}>
              신고 사유: {x.reasons}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="문제없음 · 보이기" variant="soft" style={{ flex: 1 }} onPress={() => onMod(x.id, true)} />
            {x.status === 'hidden' ? null : <Button label="숨기기" variant="ghost" style={{ flex: 1 }} onPress={() => onMod(x.id, false)} />}
          </View>
        </View>
      ))}
    </Card>
  );
}
