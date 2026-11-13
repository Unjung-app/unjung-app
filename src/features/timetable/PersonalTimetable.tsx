import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { useSubjectSelection } from './selection';
import { color, radius, space } from '@/theme/tokens';
import type { ClassLesson } from '@/features/data';
import { completeChoices, personalize, type Choices } from './personal';

type Props = {
  uid: string; year: number; semester: number; classNo: number;
  lessons: ClassLesson[]; children: (lessons: ClassLesson[]) => ReactNode;
};

/** 부모의 key가 계정·학기·반을 구분하므로 다른 계정의 선택이 화면에 남지 않는다. */
export function PersonalTimetable({ uid, year, semester, classNo, lessons, children }: Props) {
  const { groups, saved, loading, error: loadError, reload, save: saveSelection } = useSubjectSelection(uid, year, semester);
  const [changed, setDraft] = useState<Choices | null>(null);
  const draft = changed ?? saved ?? {};
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (saving || !completeChoices(groups, draft)) return;
    setSaving(true);
    setError('');
    try {
      await saveSelection(draft);
      setDraft(null);
      setEditing(false);
    } catch {
      setError('저장하지 못했어요. 선택은 유지되어 있으니 연결을 확인하고 다시 저장해 주세요.');
    } finally {
      setSaving(false);
    }
  };
  if (loading) return <AppText color={color.inkMuted}>내 과목을 불러오는 중이에요…</AppText>;
  if (!groups.length || !groups.every((g) => g.slots[String(classNo)]?.length)) return (
    <Card>
      <AppText variant="heading">과목 정보를 확인해 주세요</AppText>
      <AppText color={color.inkMuted}>{error || loadError || '이 학기 또는 반의 과목 배치가 아직 등록되지 않았어요.'}</AppText>
      <Button label="다시 불러오기" accessibilityLabel="과목 설정 다시 불러오기" onPress={() => { setError(''); void reload(); }} />
      {children(lessons)}
    </Card>
  );
  if (!saved || editing) return (
    <Card>
      <AppText variant="heading">내 시간표 과목 선택</AppText>
      <AppText color={color.inkMuted}>2학년 {classNo}반 시간표에 반영할 과목을 골라 주세요. 계정에 저장되어 다른 기기에서도 사용할 수 있어요.</AppText>
      {groups.map((g) => (
        <View key={g.id} style={{ gap: space.sm }}>
          <AppText variant="bodyStrong">{g.label}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {g.subjects.map((subject) => {
              const selected = draft[g.id] === subject;
              return (
                <Pressable key={subject} accessibilityRole="radio" accessibilityLabel={`${g.label} ${subject}`} accessibilityState={{ checked: selected, disabled: saving }} disabled={saving}
                  onPress={() => setDraft({ ...draft, [g.id]: subject })}
                  style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', padding: space.md, borderRadius: radius.control, backgroundColor: selected ? color.navy : color.surfaceMuted }}>
                  <AppText color={selected ? color.onNavy : color.ink}>{subject}</AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {error ? <AppText color={color.danger} accessibilityRole="alert">{error}</AppText> : null}
      <Button label={saving ? '저장 중…' : '내 시간표 저장'} accessibilityLabel="선택한 여섯 과목 계정에 저장" disabled={saving || !completeChoices(groups, draft)} onPress={save} />
      {saved ? <Button label="취소" accessibilityLabel="과목 재설정 취소" variant="ghost" disabled={saving} onPress={() => { setDraft(saved); setEditing(false); setError(''); }} /> : null}
    </Card>
  );
  return (
    <>
      {children(personalize(lessons, groups, saved, classNo, year, semester))}
      <Pressable accessibilityRole="button" accessibilityLabel="시간표 과목 재설정" onPress={() => { setDraft(saved); setEditing(true); }}
        style={{ minHeight: 44, minWidth: 44, alignSelf: 'flex-end', justifyContent: 'center', paddingHorizontal: space.sm }}>
        <AppText variant="caption" color={color.inkMuted}>과목 재설정</AppText>
      </Pressable>
    </>
  );
}
