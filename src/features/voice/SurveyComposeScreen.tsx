import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { useNow } from '@/features/hooks';
import { addDays, shortLabel } from '@/lib/date';
import { useAuth } from '@/state/auth';
import { color, radius, space } from '@/theme/tokens';
import { createSurvey, RESULTS_LABEL, type QuestionDraft, type QuestionKind, type SurveyResults } from './data';
import { ChipRow, inputStyle, PickChip } from './ui';

let seq = 0;
const newQuestion = (kind: QuestionKind = 'single'): QuestionDraft => ({ key: `q${++seq}`, kind, prompt: '', options: kind === 'text' ? [] : ['', ''], required: true });
const DAYS = [1, 3, 5, 7, 14];

/** 기획행정부: 설문 만들기 (질문 1~10개, 보기 2~8개) */
export function SurveyComposeScreen() {
  const router = useRouter();
  const now = useNow();
  const { planner } = useAuth();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [grade, setGrade] = useState<1 | 2 | 3 | null>(null);
  const [days, setDays] = useState(5);
  const [results, setResults] = useState<SurveyResults>('after_vote');
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => [newQuestion()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!planner) {
    return (
      <Screen topInset={false}>
        <AppText variant="body" color={color.inkMuted}>
          설문은 학생자치회 기획행정부만 만들 수 있어요.
        </AppText>
      </Screen>
    );
  }

  const update = (key: string, patch: Partial<QuestionDraft>) => setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const problems: string[] = [];
  if (title.trim().length < 2) problems.push('제목을 2자 이상 적어 주세요');
  questions.forEach((q, i) => {
    if (!q.prompt.trim()) problems.push(`${i + 1}번 질문을 적어 주세요`);
    else if (q.kind !== 'text' && q.options.filter((o) => o.trim()).length < 2) problems.push(`${i + 1}번 질문에 보기를 2개 이상 적어 주세요`);
  });

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await createSurvey({ title, description: desc, scopeGrade: grade, days, results, questions });
    setBusy(false);
    if (r.ok) router.replace(`/voice/survey/${r.id}`);
    else setError(r.message);
  };

  return (
    <Screen topInset={false}>
      <Card>
        <AppText variant="label">제목</AppText>
        <TextInput accessibilityLabel="설문 제목" value={title} onChangeText={(t) => setTitle(t.slice(0, 60))} placeholder="예) 축제 부스 선호도 조사" placeholderTextColor={color.inkFaint} style={{ ...inputStyle, minHeight: 48 }} />
        <AppText variant="label">설명 (선택)</AppText>
        <TextInput
          accessibilityLabel="설문 설명"
          value={desc}
          onChangeText={(t) => setDesc(t.slice(0, 500))}
          multiline
          placeholder="왜 묻는지, 결과를 어디에 쓰는지 적어 주면 참여가 늘어요"
          placeholderTextColor={color.inkFaint}
          style={{ ...inputStyle, minHeight: 72, paddingVertical: space.sm, textAlignVertical: 'top' }}
        />
        <AppText variant="label">대상</AppText>
        <ChipRow>
          <PickChip label="전체 학년" on={grade === null} onPress={() => setGrade(null)} />
          {([1, 2, 3] as const).map((g) => (
            <PickChip key={g} label={`${g}학년`} on={grade === g} onPress={() => setGrade(g)} />
          ))}
        </ChipRow>
        <AppText variant="label">기간 · {shortLabel(addDays(now.ymd, days - 1))}까지</AppText>
        <ChipRow>
          {DAYS.map((d) => (
            <PickChip key={d} label={d === 1 ? '오늘만' : `${d}일`} on={days === d} onPress={() => setDays(d)} />
          ))}
        </ChipRow>
        <AppText variant="label">결과 공개</AppText>
        <ChipRow>
          {(Object.keys(RESULTS_LABEL) as SurveyResults[]).map((k) => (
            <PickChip key={k} label={RESULTS_LABEL[k]} on={results === k} onPress={() => setResults(k)} />
          ))}
        </ChipRow>
        <AppText variant="caption" color={color.inkMuted}>
          주관식 답은 공개 방식과 상관없이 기획행정부만 읽어요. 누가 무엇을 골랐는지는 아무에게도 보이지 않아요.
        </AppText>
      </Card>

      {questions.map((q, i) => (
        <Card key={q.key} style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <AppText variant="heading" style={{ flex: 1 }}>
              {i + 1}번 질문
            </AppText>
            {questions.length > 1 ? <Button label="빼기" variant="ghost" onPress={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))} /> : null}
          </View>
          <Segmented
            label={`${i + 1}번 질문 종류`}
            value={q.kind}
            onChange={(k) => update(q.key, { kind: k, options: k === 'text' ? [] : q.options.length >= 2 ? q.options : ['', ''] })}
            options={[
              { value: 'single', label: '하나 고르기' },
              { value: 'multi', label: '여러 개' },
              { value: 'text', label: '주관식' },
            ]}
          />
          <TextInput
            accessibilityLabel={`${i + 1}번 질문 내용`}
            value={q.prompt}
            onChangeText={(t) => update(q.key, { prompt: t.slice(0, 100) })}
            placeholder="질문을 적어 주세요"
            placeholderTextColor={color.inkFaint}
            style={{ ...inputStyle, minHeight: 48 }}
          />
          {q.kind !== 'text'
            ? q.options.map((o, j) => (
                <View key={j} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                  <TextInput
                    accessibilityLabel={`${i + 1}번 질문 보기 ${j + 1}`}
                    value={o}
                    onChangeText={(t) => update(q.key, { options: q.options.map((x, k) => (k === j ? t.slice(0, 40) : x)) })}
                    placeholder={`보기 ${j + 1}`}
                    placeholderTextColor={color.inkFaint}
                    style={{ ...inputStyle, minHeight: 44, flex: 1 }}
                  />
                  {q.options.length > 2 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`보기 ${j + 1} 빼기`}
                      onPress={() => update(q.key, { options: q.options.filter((_, k) => k !== j) })}
                      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.control }}>
                      <AppText variant="heading" color={color.inkFaint}>
                        ×
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
              ))
            : null}
          {q.kind !== 'text' && q.options.length < 8 ? <Button label="＋ 보기 추가" variant="soft" onPress={() => update(q.key, { options: [...q.options, ''] })} /> : null}
          <ChipRow>
            <PickChip label="꼭 답하기" on={q.required} onPress={() => update(q.key, { required: true })} />
            <PickChip label="선택 질문" on={!q.required} onPress={() => update(q.key, { required: false })} />
          </ChipRow>
        </Card>
      ))}
      {questions.length < 10 ? <Button label="＋ 질문 추가" variant="soft" onPress={() => setQuestions((qs) => [...qs, newQuestion()])} /> : null}

      {error ? (
        <AppText variant="label" weight="regular" color={color.danger}>
          {error}
        </AppText>
      ) : null}
      <Button label={busy ? '올리는 중…' : problems[0] ?? '설문 올리기'} disabled={busy || problems.length > 0} onPress={submit} style={{ minHeight: 52 }} />
      <AppText variant="caption" color={color.inkMuted} align="center">
        올리면 바로 학생들에게 보여요. 올린 뒤에는 고칠 수 없으니 미리 확인해 주세요.
      </AppText>
    </Screen>
  );
}
