import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { useNow } from '@/features/hooks';
import { LoginPrompt } from '@/features/wallet/LoginPrompt';
import { addDays, dDayLabel, parseYmd, shortLabel, weekdayLabel, type Ymd } from '@/lib/date';
import { useAuth } from '@/state/auth';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';
import { KIND_EMOJI, KIND_LABEL, KINDS, scopeLabel, submitNotice, type NoticeDraft, type NoticeKind, type NoticeScope } from './data';

/** 공지 올리기: 종류 → 내용 → 날짜 → 범위·기간 → 미리보기 → 제출(검토위원 승인 후 게시) */
export function NoticeComposeScreen() {
  const router = useRouter();
  const now = useNow();
  const { status, enrollment } = useAuth();
  const [kind, setKind] = useState<NoticeKind | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [eventDate, setEventDate] = useState<Ymd | null>(null);
  const [scope, setScope] = useState<NoticeScope>('all');
  const [startIn, setStartIn] = useState(0);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const eventDays = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(now.ymd, i)), [now.ymd]);

  if (status === 'signedOut') return <LoginPrompt what="공지 올리기" />;
  if (!enrollment) {
    return (
      <Screen topInset={false}>
        <AppText variant="body" color={color.inkMuted}>
          학번을 등록하면 공지를 올릴 수 있어요.
        </AppText>
      </Screen>
    );
  }

  const showFrom = addDays(now.ymd, startIn);
  const showUntil = addDays(showFrom, days - 1);
  const ready = !!kind && title.trim().length >= 2 && body.trim().length >= 5;

  if (done) {
    return (
      <Screen topInset={false}>
        <Card tone="navy" style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
          <AppText style={{ fontSize: 48, lineHeight: 56 }}>📨</AppText>
          <AppText variant="title" color={color.onNavy} align="center">
            검토를 요청했어요
          </AppText>
          <AppText variant="body" color={color.onNavySub} align="center">
            학생자치회 검토위원이 확인하면 게시되고 +30 토큰을 받아요. 결과는 학생 공지 화면의 '내가 올린 공지'에서 볼 수 있어요.
          </AppText>
        </Card>
        <Button label="학생 공지로 돌아가기" onPress={() => router.back()} />
      </Screen>
    );
  }

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

  const chip = (key: string, label: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={{ minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.round, justifyContent: 'center', backgroundColor: on ? color.navy : color.surfaceMuted }}>
      <AppText variant="label" color={on ? color.onNavy : color.ink}>
        {label}
      </AppText>
    </Pressable>
  );

  const submit = async () => {
    if (!kind) return;
    setBusy(true);
    setError(null);
    const d: NoticeDraft = { kind, title, body, eventDate, scope, showFrom, days };
    const r = await submitNotice(d);
    setBusy(false);
    if (r.ok) setDone(true);
    else setError(r.message);
  };

  return (
    <Screen topInset={false}>
      <Card>
        <AppText variant="label">1. 어떤 소식인가요?</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {KINDS.map((k) => chip(k, `${KIND_EMOJI[k]} ${KIND_LABEL[k]}`, kind === k, () => setKind(k)))}
        </View>
      </Card>

      <Card>
        <AppText variant="label">2. 제목과 내용</AppText>
        <TextInput
          accessibilityLabel="제목"
          value={title}
          onChangeText={(t) => setTitle(t.slice(0, 40))}
          placeholder="예) 11/7(금) 점심 동아리 박람회"
          placeholderTextColor={color.inkFaint}
          style={{ ...input, minHeight: 48, fontSize: 16, ...fontStyle('semibold') }}
        />
        <TextInput
          accessibilityLabel="내용"
          value={body}
          onChangeText={(t) => setBody(t.slice(0, 1000))}
          placeholder="언제, 어디서, 무엇을, 누가 참여하면 되는지 적어 주세요. 개인 연락처는 적지 마세요."
          placeholderTextColor={color.inkFaint}
          multiline
          style={{ ...input, minHeight: 120, paddingVertical: space.sm, textAlignVertical: 'top', lineHeight: 22 }}
        />
        <AppText variant="caption" color={color.inkMuted}>
          제목 {title.trim().length}/40 · 내용 {body.trim().length}/1000
        </AppText>
      </Card>

      <Card>
        <AppText variant="label">3. 행사·마감 날짜 (선택)</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {chip('none', '날짜 없음', eventDate === null, () => setEventDate(null))}
          {eventDays.map((d) => {
            const { m, d: day } = parseYmd(d);
            return chip(d, d === now.ymd ? '오늘' : `${m}/${day}(${weekdayLabel(d)})`, eventDate === d, () => setEventDate(d));
          })}
        </ScrollView>
      </Card>

      <Card>
        <AppText variant="label">4. 누구에게, 언제까지</AppText>
        <Segmented
          label="알릴 범위"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: '전체' },
            { value: 'grade', label: `${enrollment.grade}학년` },
            { value: 'class', label: `${enrollment.grade}-${enrollment.class_no}반` },
          ]}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
          <AppText variant="caption" color={color.inkMuted}>
            게시 시작
          </AppText>
          {[0, 1, 2].map((i) => chip(`s${i}`, i === 0 ? '오늘(승인 즉시)' : i === 1 ? '내일' : '모레', startIn === i, () => setStartIn(i)))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
          <AppText variant="caption" color={color.inkMuted}>
            게시 기간
          </AppText>
          {[3, 7, 14].map((d) => chip(`d${d}`, `${d}일`, days === d, () => setDays(d)))}
        </View>
        <AppText variant="caption" color={color.inkMuted}>
          {shortLabel(showFrom)} ~ {shortLabel(showUntil)} 동안 보여요
        </AppText>
      </Card>

      <AppText variant="label" style={{ marginTop: space.sm }}>
        5. 미리보기
      </AppText>
      <Card style={{ gap: 6, borderWidth: 2, borderColor: color.line }}>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge label={kind ? `${KIND_EMOJI[kind]} ${KIND_LABEL[kind]}` : '종류'} tone="muted" />
          {scope !== 'all' ? <Badge label={scopeLabel({ scope, scope_grade: enrollment.grade, scope_class: enrollment.class_no })} /> : null}
          {eventDate ? (
            <AppText variant="caption" weight="semibold" color={color.navy}>
              {shortLabel(eventDate)} · {dDayLabel(now.ymd, eventDate)}
            </AppText>
          ) : null}
        </View>
        <AppText variant="heading" color={title ? color.ink : color.inkFaint}>
          {title || '제목'}
        </AppText>
        <AppText variant="body" color={body ? color.ink : color.inkFaint}>
          {body || '내용이 여기에 보여요'}
        </AppText>
      </Card>

      {error ? (
        <AppText variant="label" weight="regular" color={color.danger}>
          {error}
        </AppText>
      ) : null}
      <Button label={busy ? '보내는 중…' : '검토 요청하기'} disabled={!ready || busy} onPress={submit} style={{ minHeight: 52 }} />
      <AppText variant="caption" color={color.inkFaint}>
        장난·광고·개인정보가 담긴 글은 반려돼요. 게시 뒤에도 신고가 3건 쌓이면 숨겨져요.
      </AppText>
    </Screen>
  );
}
