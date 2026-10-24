import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/Segmented';
import { addDays, isWeekend, parseYmd, weekdayLabel, type Ymd } from '@/lib/date';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';
import { KIND_LABEL, KINDS, type TaskDraft, type TaskKind } from './data';

const OTHER = '__other__';

function dueChipLabel(today: Ymd, d: Ymd) {
  if (d === today) return '오늘';
  if (d === addDays(today, 1)) return '내일';
  const { m, d: day } = parseYmd(d);
  return `${m}/${day}(${weekdayLabel(d)})`;
}

/** 글 올리기·고치기 카드 */
export function TaskComposer({
  today,
  subjects,
  initial,
  onSubmit,
  onCancel,
}: {
  today: Ymd;
  /** 우리 반 시간표에 나오는 과목 이름 */
  subjects: string[];
  initial?: TaskDraft;
  onSubmit: (d: TaskDraft) => Promise<{ ok: true } | { ok: false; message: string }>;
  onCancel: () => void;
}) {
  const initialPick = initial ? (subjects.includes(initial.subject) ? initial.subject : OTHER) : null;
  const [pick, setPick] = useState<string | null>(initialPick);
  const [custom, setCustom] = useState(initialPick === OTHER ? initial?.subject ?? '' : '');
  const [kind, setKind] = useState<TaskKind>(initial?.kind ?? 'assessment');
  const [due, setDue] = useState<Ymd | null>(initial?.due ?? null);
  const [body, setBody] = useState(initial?.body ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 오늘부터 학교 가는 날 15일
  const days = useMemo(() => {
    const out: Ymd[] = [];
    for (let i = 0; out.length < 15 && i < 40; i++) {
      const d = addDays(today, i);
      if (!isWeekend(d)) out.push(d);
    }
    if (initial?.due && !out.includes(initial.due)) out.push(initial.due);
    return out;
  }, [today, initial?.due]);

  const subject = pick === OTHER ? custom.trim() : pick ?? '';
  const ready = subject.length >= 1 && !!due;

  const submit = async () => {
    if (!ready || !due) return;
    setBusy(true);
    setError(null);
    const r = await onSubmit({ subject, kind, due, body: body.trim() });
    setBusy(false);
    if (!r.ok) setError(r.message);
  };

  const chip = (key: string, label: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 44,
        paddingHorizontal: space.md,
        borderRadius: radius.round,
        justifyContent: 'center',
        backgroundColor: on ? color.navy : color.surfaceMuted,
      }}>
      <AppText variant="label" color={on ? color.onNavy : color.ink}>
        {label}
      </AppText>
    </Pressable>
  );

  const input = {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.control,
    paddingHorizontal: space.md,
    fontSize: 15,
    color: color.ink,
    backgroundColor: color.surface,
    ...fontStyle('regular'),
  } as const;

  return (
    <Card style={{ borderWidth: 2, borderColor: color.navy }}>
      <AppText variant="heading">{initial ? '글 고치기' : '우리 반에 올리기'}</AppText>

      <AppText variant="label">종류</AppText>
      <Segmented label="종류" value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />

      <AppText variant="label">과목</AppText>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {subjects.map((s) => chip(s, s, pick === s, () => setPick(s)))}
        {chip(OTHER, subjects.length ? '기타(직접 입력)' : '과목 직접 입력', pick === OTHER, () => setPick(OTHER))}
      </View>
      {pick === OTHER ? (
        <TextInput
          accessibilityLabel="과목 이름"
          value={custom}
          onChangeText={(t) => setCustom(t.slice(0, 20))}
          placeholder="예) 진로, 창체"
          placeholderTextColor={color.inkFaint}
          style={{ ...input, minHeight: 44 }}
        />
      ) : null}

      <AppText variant="label">마감일</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {days.map((d) => chip(d, dueChipLabel(today, d), due === d, () => setDue(d)))}
      </ScrollView>

      <AppText variant="label">내용 (선택)</AppText>
      <TextInput
        accessibilityLabel="내용"
        value={body}
        onChangeText={(t) => setBody(t.slice(0, 200))}
        placeholder="예) 3단원 탐구 보고서, A4 2장, 손글씨"
        placeholderTextColor={color.inkFaint}
        multiline
        style={{ ...input, minHeight: 72, paddingVertical: space.sm, textAlignVertical: 'top' }}
      />
      <AppText variant="caption" color={color.inkMuted}>
        {body.length}/200 · 같은 반 친구 2명이 '확인했어요'를 누르면 +5 토큰
        {initial ? ' · 내용을 바꾸면 확인을 다시 받아요' : ''}
      </AppText>
      {error ? (
        <AppText variant="label" weight="regular" color={color.danger}>
          {error}
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="취소" variant="soft" style={{ flex: 1 }} onPress={onCancel} disabled={busy} />
        <Button label={busy ? '올리는 중…' : initial ? '고치기' : '올리기'} style={{ flex: 2 }} onPress={submit} disabled={!ready || busy} />
      </View>
    </Card>
  );
}
