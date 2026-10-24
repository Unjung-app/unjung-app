import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { useNow } from '@/features/hooks';
import { LoginPrompt } from '@/features/wallet/LoginPrompt';
import { shortLabel } from '@/lib/date';
import { useAuth } from '@/state/auth';
import { useWallet } from '@/state/wallet';
import { color, radius, space } from '@/theme/tokens';
import { closeSurvey, closesLabel, lastDayOf, RESULTS_LABEL, submitSurvey, useSurvey, type Answer, type SurveyDetail, type SurveyQuestion } from './data';
import { inputStyle, ResultBar } from './ui';

/** 설문 한 개: 참여 → 결과(공개 방식에 따라). 기획행정부는 주관식 답·학년 분포·마감 버튼도 본다. */
export function SurveyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, planner } = useAuth();
  const { refresh } = useWallet();
  const ready = status === 'ready';
  const { data, mine, reload } = useSurvey(Number(id), ready);
  const now = useNow();

  if (status === 'signedOut') return <LoginPrompt what="설문 참여" />;
  if (data === null) {
    return (
      <Screen topInset={false}>
        <AppText variant="body" color={color.inkMuted}>
          불러오는 중…
        </AppText>
      </Screen>
    );
  }
  if (data === 'missing') {
    return (
      <Screen topInset={false}>
        <Card>
          <AppText variant="body" color={color.inkMuted}>
            없는 설문이거나 내 학년 대상이 아니에요.
          </AppText>
        </Card>
        <Button label="돌아가기" variant="soft" onPress={() => router.back()} />
      </Screen>
    );
  }

  const canAnswer = data.is_open && !data.responded;

  return (
    <Screen topInset={false} onRefresh={reload}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          {data.responded ? <Badge label="✓ 참여함" tone="success" /> : null}
          <Badge label={data.scope_grade ? `${data.scope_grade}학년 대상` : '전체 학년'} tone="muted" />
          <AppText variant="caption" weight="semibold" color={data.is_open ? color.navy : color.inkFaint}>
            {closesLabel(data.closes_at, data.is_open, now.ymd)} · {shortLabel(lastDayOf(data.closes_at))}까지
          </AppText>
        </View>
        <AppText variant="title" accessibilityRole="header">
          {data.title}
        </AppText>
        {data.description ? <AppText variant="body">{data.description}</AppText> : null}
        <AppText variant="caption" color={color.inkFaint}>
          학생자치회 기획행정부 · {data.response_count}명 참여 · 결과 공개: {RESULTS_LABEL[data.results]} · 누가 무엇을 골랐는지는 공개되지 않아요
        </AppText>
      </View>

      {canAnswer ? (
        <AnswerForm
          survey={data}
          onDone={async () => {
            refresh('학생회 설문 참여');
            await reload();
          }}
        />
      ) : (
        <Results survey={data} mine={mine} planner={planner} />
      )}

      {planner ? <PlannerTools survey={data} onChanged={reload} onDeleted={() => router.back()} /> : null}
    </Screen>
  );
}

function AnswerForm({ survey, onDone }: { survey: SurveyDetail; onDone: () => Promise<void> }) {
  const [choices, setChoices] = useState<Record<number, number[]>>({});
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (q: SurveyQuestion, i: number) =>
    setChoices((c) => {
      const cur = c[q.id] ?? [];
      if (q.kind === 'single') return { ...c, [q.id]: [i] };
      return { ...c, [q.id]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort() };
    });
  const missing = survey.questions.filter((q) => q.required && (q.kind === 'text' ? !(texts[q.id] ?? '').trim() : !(choices[q.id] ?? []).length));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const answers: Answer[] = survey.questions.map((q) => (q.kind === 'text' ? { q: q.id, text: (texts[q.id] ?? '').trim() } : { q: q.id, choices: choices[q.id] ?? [] }));
    const r = await submitSurvey(survey.id, answers);
    setBusy(false);
    if (r.ok) await onDone();
    else setError(r.message);
  };

  return (
    <>
      {survey.questions.map((q) => (
        <Card key={q.id} style={{ gap: space.sm }}>
          <AppText variant="bodyStrong">
            {q.ord}. {q.prompt}
            {q.required ? '' : ' (선택)'}
          </AppText>
          <AppText variant="caption" color={color.inkMuted}>
            {q.kind === 'single' ? '하나만 골라요' : q.kind === 'multi' ? '여러 개 골라도 돼요' : '200자까지 · 기획행정부만 읽어요'}
          </AppText>
          {q.kind === 'text' ? (
            <TextInput
              accessibilityLabel={`${q.ord}번 답`}
              value={texts[q.id] ?? ''}
              onChangeText={(t) => setTexts((x) => ({ ...x, [q.id]: t.slice(0, 200) }))}
              multiline
              placeholder="자유롭게 적어 주세요"
              placeholderTextColor={color.inkFaint}
              style={{ ...inputStyle, minHeight: 80, paddingVertical: space.sm, textAlignVertical: 'top' }}
            />
          ) : (
            q.options.map((o, i) => {
              const on = (choices[q.id] ?? []).includes(i);
              return (
                <Pressable
                  key={i}
                  accessibilityRole={q.kind === 'single' ? 'radio' : 'checkbox'}
                  accessibilityState={{ checked: on }}
                  onPress={() => toggle(q, i)}
                  style={{
                    minHeight: 48,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    paddingHorizontal: space.md,
                    borderRadius: radius.control,
                    borderWidth: 1.5,
                    borderColor: on ? color.navy : color.line,
                    backgroundColor: on ? color.surfaceMuted : color.surface,
                  }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: q.kind === 'single' ? 11 : 6,
                      borderWidth: 2,
                      borderColor: on ? color.navy : color.inkFaint,
                      backgroundColor: on ? color.navy : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    {on ? (
                      <AppText variant="caption" weight="bold" color={color.onNavy}>
                        ✓
                      </AppText>
                    ) : null}
                  </View>
                  <AppText variant="body" style={{ flex: 1 }}>
                    {o}
                  </AppText>
                </Pressable>
              );
            })
          )}
        </Card>
      ))}
      {error ? (
        <AppText variant="label" weight="regular" color={color.danger}>
          {error}
        </AppText>
      ) : null}
      <Button
        label={busy ? '보내는 중…' : missing.length ? `${missing[0].ord}번에 답해 주세요` : '제출하고 +3 토큰 받기'}
        disabled={busy || missing.length > 0}
        onPress={submit}
        style={{ minHeight: 52 }}
      />
    </>
  );
}

function Results({ survey, mine, planner }: { survey: SurveyDetail; mine: Record<number, number[]>; planner: boolean }) {
  if (!survey.can_see_results) {
    return (
      <Card tone="muted">
        <AppText variant="bodyStrong">{survey.responded ? '참여해 주셔서 고마워요!' : '마감된 설문이에요.'}</AppText>
        <AppText variant="body" color={color.inkMuted}>
          {survey.results === 'after_close' ? '결과는 설문이 끝나면 여기에서 볼 수 있어요.' : '이 설문의 결과는 기획행정부만 봐요. 학생회 공지로 안내될 수 있어요.'}
        </AppText>
      </Card>
    );
  }
  const total = Number(survey.response_count);
  return (
    <>
      {survey.responded && survey.is_open ? (
        <AppText variant="bodyStrong" color={color.success}>
          ✓ 참여했어요. 지금까지의 결과예요.
        </AppText>
      ) : null}
      {planner && survey.by_grade ? (
        <AppText variant="caption" color={color.inkMuted}>
          학년별 참여: {[1, 2, 3].map((g) => `${g}학년 ${survey.by_grade?.[g] ?? 0}명`).join(' · ')}
        </AppText>
      ) : null}
      {survey.questions.map((q) => (
        <Card key={q.id} style={{ gap: space.md }}>
          <AppText variant="bodyStrong">
            {q.ord}. {q.prompt}
          </AppText>
          {q.kind === 'text' ? (
            planner ? (
              (q.texts ?? []).length ? (
                (q.texts ?? []).map((t, i) => (
                  <AppText key={i} variant="body" style={{ backgroundColor: color.surfaceMuted, borderRadius: radius.control, padding: space.md }}>
                    {t}
                  </AppText>
                ))
              ) : (
                <AppText variant="caption" color={color.inkMuted}>
                  아직 적힌 답이 없어요.
                </AppText>
              )
            ) : (
              <AppText variant="caption" color={color.inkMuted}>
                주관식 답 {Number(q.answered ?? 0)}개 · 기획행정부만 읽어요
              </AppText>
            )
          ) : (
            q.options.map((o, i) => <ResultBar key={i} label={o} count={Number(q.counts?.[i] ?? 0)} total={q.kind === 'multi' ? total : Number(q.answered ?? total)} mine={(mine[q.id] ?? []).includes(i)} />)
          )}
          {q.kind === 'multi' ? (
            <AppText variant="caption" color={color.inkFaint}>
              여러 개 고를 수 있어 합계가 100%를 넘을 수 있어요
            </AppText>
          ) : null}
        </Card>
      ))}
    </>
  );
}

function PlannerTools({ survey, onChanged, onDeleted }: { survey: SurveyDetail; onChanged: () => void; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState<'close' | 'delete' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async (del: boolean) => {
    const r = await closeSurvey(survey.id, del);
    setConfirm(null);
    if (!r.ok) return setErr(r.message);
    if (del) onDeleted();
    else onChanged();
  };
  return (
    <Card tone="muted" style={{ gap: space.sm }}>
      <AppText variant="label">기획행정부 도구</AppText>
      {confirm ? (
        <>
          <AppText variant="body">{confirm === 'close' ? '지금 마감할까요? 더는 참여할 수 없어요.' : '설문을 지울까요? 결과도 함께 사라져요.'}</AppText>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label={confirm === 'close' ? '마감하기' : '지우기'} style={{ flex: 1 }} onPress={() => run(confirm === 'delete')} />
            <Button label="취소" variant="ghost" style={{ flex: 1 }} onPress={() => setConfirm(null)} />
          </View>
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {survey.is_open ? <Button label="지금 마감" variant="soft" style={{ flex: 1 }} onPress={() => setConfirm('close')} /> : null}
          <Button label="설문 지우기" variant="ghost" style={{ flex: 1 }} onPress={() => setConfirm('delete')} />
        </View>
      )}
      {err ? (
        <AppText variant="caption" color={color.danger}>
          {err}
        </AppText>
      ) : null}
    </Card>
  );
}
