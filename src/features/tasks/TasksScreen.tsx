import { useMemo, useState } from 'react';
import { REWARD } from '@/lib/rewards';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { useWeekTimetable } from '@/features/data';
import { classLabel, useNow } from '@/features/hooks';
import { addDays, dDayLabel, diffDays, shortLabel, type Ymd } from '@/lib/date';
import { useAuth } from '@/state/auth';
import { usePrefs } from '@/state/prefs';
import { useWallet } from '@/state/wallet';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';
import { KIND_LABEL, loadSuggestions, useClassTasks, type ClassTask, type Suggestion, type TaskDraft, type TaskKind } from './data';
import { TaskComposer } from './TaskComposer';

export const KIND_TONE: Record<TaskKind, { bg: string; fg: string }> = {
  assessment: { bg: color.accentSoft, fg: color.accentInk },
  homework: { bg: color.surfaceMuted, fg: color.navy },
  supplies: { bg: color.successSoft, fg: color.success },
  exam: { bg: color.navy, fg: color.onNavy },
};

export function dueLabel(today: Ymd, due: Ymd) {
  const n = diffDays(today, due);
  if (n === 0) return '오늘';
  if (n === 1) return '내일';
  if (n === 2) return '모레';
  return dDayLabel(today, due);
}

export function TasksScreen({ inStack = false }: { inStack?: boolean }) {
  const router = useRouter();
  const now = useNow();
  const { status, enrollment } = useAuth();
  const { myClass } = usePrefs();
  const { refresh: refreshWallet } = useWallet();
  const ready = status === 'ready';
  const board = useClassTasks(now.ymd, ready);
  const [tab, setTab] = useState<'next' | 'past'>('next');
  const [composing, setComposing] = useState<null | { id?: number; draft?: TaskDraft }>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 과목 목록: 이번 주 + 다음 주 우리 반 시간표에서
  const tt1 = useWeekTimetable(now.ymd, myClass);
  const tt2 = useWeekTimetable(addDays(now.ymd, 7), myClass);
  const subjects = useMemo(() => {
    const count = new Map<string, number>();
    for (const l of [...tt1.items, ...tt2.items]) if (l.subject) count.set(l.subject, (count.get(l.subject) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [tt1.items, tt2.items]);

  const list = board.items ?? [];
  const upcoming = list.filter((t) => t.due >= now.ymd);
  const past = list.filter((t) => t.due < now.ymd).reverse();
  const shown = tab === 'next' ? upcoming : past;
  const groups = useMemo(() => {
    const m = new Map<Ymd, ClassTask[]>();
    for (const t of shown) m.set(t.due, [...(m.get(t.due) ?? []), t]);
    return [...m.entries()];
  }, [shown]);

  const header = (
    <>
      {!inStack ? (
        <AppText variant="title" accessibilityRole="header">
          수행평가·숙제
        </AppText>
      ) : null}
      <AppText variant="body" color={color.inkMuted}>
        {enrollment ? `${enrollment.grade}학년 ${enrollment.class_no}반` : classLabel(myClass)} 친구들끼리만 보는 마감 게시판이에요.
      </AppText>
    </>
  );

  if (status !== 'ready') {
    return (
      <Screen topInset={!inStack}>
        {header}
        <Card tone="navy">
          <AppText variant="heading" color={color.onNavy} style={{ fontSize: 20, lineHeight: 28 }}>
            {status === 'needsEnrollment' ? '학번을 등록하면\n우리 반 게시판이 열려요' : '학교 계정으로 로그인하면\n우리 반 게시판이 열려요'}
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

  const submit = async (d: TaskDraft) => {
    const r = composing?.id ? await board.update(composing.id, d) : await board.create(d);
    if (r.ok) {
      setComposing(null);
      setNotice(composing?.id ? '고쳤어요' : `올렸어요! 친구 2명이 확인하면 +${REWARD.taskConfirmed} 토큰`);
    }
    return r;
  };

  return (
    <Screen topInset={!inStack} refreshing={board.refreshing} onRefresh={board.reload}>
      {header}

      {composing ? (
        <TaskComposer today={now.ymd} subjects={subjects} initial={composing.draft} onSubmit={submit} onCancel={() => setComposing(null)} />
      ) : (
        <Button label="＋ 수행평가·숙제 올리기" onPress={() => (setComposing({}), setNotice(null))} />
      )}
      {notice ? (
        <AppText variant="label" weight="regular" color={color.success}>
          {notice}
        </AppText>
      ) : null}

      <Segmented
        label="보기"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'next', label: `다가오는 ${upcoming.length}` },
          { value: 'past', label: '지난 항목' },
        ]}
      />

      {board.items === null ? (
        <AppText variant="body" color={color.inkMuted}>
          불러오는 중…
        </AppText>
      ) : groups.length === 0 ? (
        <Card>
          <AppText variant="body" color={color.inkMuted}>
            {tab === 'next'
              ? '아직 올라온 마감이 없어요. 선생님이 말한 수행평가나 숙제를 먼저 올려 보세요!'
              : '지난 30일 동안의 항목이 없어요.'}
          </AppText>
        </Card>
      ) : (
        groups.map(([due, tasks]) => (
          <View key={due} style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.sm }}>
              <AppText variant="heading">{shortLabel(due)}</AppText>
              <AppText variant="label" color={due <= addDays(now.ymd, 1) && tab === 'next' ? color.danger : color.inkMuted}>
                {dueLabel(now.ymd, due)}
              </AppText>
            </View>
            {tasks.map((t) => (
              <TaskCard
                key={t.id}
                t={t}
                past={tab === 'past'}
                board={board}
                onEdit={() => setComposing({ id: t.id, draft: { subject: t.subject, kind: t.kind, due: t.due, body: t.body } })}
                onConfirmed={refreshWallet}
              />
            ))}
          </View>
        ))
      )}
      <AppText variant="caption" color={color.inkFaint}>
        우리 반 학생만 볼 수 있어요. 틀린 내용은 '정정 제안'으로 알려 주세요. 장난 글은 검토위원이 지울 수 있어요.
      </AppText>
    </Screen>
  );
}

function TaskCard({
  t,
  past,
  board,
  onEdit,
  onConfirmed,
}: {
  t: ClassTask;
  past: boolean;
  board: ReturnType<typeof useClassTasks>;
  onEdit: () => void;
  onConfirmed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sugs, setSugs] = useState<Suggestion[] | null>(null);
  const [fix, setFix] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tone = KIND_TONE[t.kind];

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) setSugs(await loadSuggestions(t.id));
  };
  const act = async (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true);
    setErr(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setErr(r.message ?? '잠시 뒤 다시 시도해 주세요.');
    return r.ok;
  };

  return (
    <View style={{ backgroundColor: color.surface, borderRadius: radius.card, overflow: 'hidden', opacity: past ? 0.75 : 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${KIND_LABEL[t.kind]} ${t.subject}${t.body ? `, ${t.body}` : ''}${t.confirmed ? ', 확인됨' : ''}. 자세히 보기`}
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={({ pressed }) => ({ padding: space.lg, gap: 6, backgroundColor: pressed ? color.surfaceMuted : color.surface })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={{ backgroundColor: tone.bg, borderRadius: radius.round, paddingHorizontal: 8, paddingVertical: 2 }}>
            <AppText variant="caption" weight="semibold" color={tone.fg}>
              {KIND_LABEL[t.kind]}
            </AppText>
          </View>
          <AppText variant="bodyStrong" style={{ flex: 1 }}>
            {t.subject}
          </AppText>
          {t.confirmed ? <Badge label="✓ 확인됨" tone="success" /> : null}
          {t.open_suggestions > 0 ? <Badge label={`정정 ${t.open_suggestions}`} tone="accent" /> : null}
        </View>
        {t.body ? <AppText variant="body">{t.body}</AppText> : null}
        <AppText variant="caption" color={color.inkFaint}>
          {t.mine ? '내가 올림' : t.author_nickname ?? '우리 반 친구'} · 확인 {Math.min(t.confirm_count, 99)}명
        </AppText>
      </Pressable>

      {!t.mine && !t.i_confirmed && !past ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
          <Button
            label={t.confirmed ? '나도 확인했어요' : `확인했어요 (${t.confirm_count}/2)`}
            variant="soft"
            disabled={busy}
            onPress={async () => {
              if (await act(() => board.confirm(t.id))) onConfirmed();
            }}
          />
        </View>
      ) : null}

      {open ? (
        <View style={{ borderTopWidth: 1, borderTopColor: color.lineSoft, padding: space.lg, gap: space.sm }}>
          <AppText variant="label">정정 제안</AppText>
          {sugs === null ? (
            <AppText variant="caption" color={color.inkMuted}>
              불러오는 중…
            </AppText>
          ) : sugs.length === 0 ? (
            <AppText variant="caption" color={color.inkMuted}>
              아직 없어요
            </AppText>
          ) : (
            sugs.map((s) => (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <AppText variant="body" color={s.resolved ? color.inkFaint : color.ink} style={{ flex: 1, textDecorationLine: s.resolved ? 'line-through' : 'none' }}>
                  {s.body}
                </AppText>
                {t.mine && !s.resolved ? (
                  <Button
                    label="반영함"
                    variant="ghost"
                    disabled={busy}
                    onPress={async () => {
                      if (await act(() => board.resolve(s.id))) setSugs(await loadSuggestions(t.id));
                    }}
                  />
                ) : null}
              </View>
            ))
          )}
          {!past ? (
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
              <TextInput
                accessibilityLabel="정정 제안 쓰기"
                value={fix}
                onChangeText={(v) => setFix(v.slice(0, 100))}
                placeholder="예) 마감이 금요일로 바뀌었어요"
                placeholderTextColor={color.inkFaint}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderWidth: 1,
                  borderColor: color.line,
                  borderRadius: radius.control,
                  paddingHorizontal: space.md,
                  fontSize: 14,
                  color: color.ink,
                  ...fontStyle('regular'),
                }}
              />
              <Button
                label="보내기"
                disabled={busy || !fix.trim()}
                onPress={async () => {
                  if (await act(() => board.suggest(t.id, fix.trim()))) {
                    setFix('');
                    setSugs(await loadSuggestions(t.id));
                  }
                }}
              />
            </View>
          ) : null}
          {t.mine ? (
            confirmDelete ? (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button label="취소" variant="soft" style={{ flex: 1 }} onPress={() => setConfirmDelete(false)} />
                <Button label="정말 지우기" style={{ flex: 1, backgroundColor: color.danger }} disabled={busy} onPress={() => act(() => board.remove(t.id))} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button label="고치기" variant="soft" style={{ flex: 1 }} onPress={onEdit} />
                <Button label="지우기" variant="ghost" style={{ flex: 1 }} onPress={() => setConfirmDelete(true)} />
              </View>
            )
          ) : null}
        </View>
      ) : null}
      {err ? (
        <AppText variant="label" weight="regular" color={color.danger} style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
          {err}
        </AppText>
      ) : null}
    </View>
  );
}
