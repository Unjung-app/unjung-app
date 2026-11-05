import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { supabase } from '@/lib/supabase';
import { color, radius, space } from '@/theme/tokens';
import type { ClassLesson } from '@/features/data';
import { completeChoices, personalize, type Choices, type SubjectGroup } from './personal';

type Props = {
  uid: string; year: number; semester: number; classNo: number;
  lessons: ClassLesson[]; children: (lessons: ClassLesson[]) => ReactNode;
};

/** 부모의 key가 계정·학기·반을 구분하므로 다른 계정의 선택이 화면에 남지 않는다. */
export function PersonalTimetable({ uid, year, semester, classNo, lessons, children }: Props) {
  const [groups, setGroups] = useState<SubjectGroup[]>([]);
  const [saved, setSaved] = useState<Choices | null>(null);
  const [draft, setDraft] = useState<Choices>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [config, selection] = await Promise.all([
          supabase.from('timetable_configs').select('groups').eq('school_year', year).eq('semester', semester).eq('grade', 2).maybeSingle(),
          supabase.from('timetable_choices').select('choices').eq('user_id', uid).eq('school_year', year).eq('semester', semester).maybeSingle(),
        ]);
        if (!alive) return;
        if (config.error || selection.error) throw new Error('과목 설정을 불러오지 못했어요. 인터넷 연결 또는 과목 데이터 등록 상태를 확인해 주세요.');
        const list = (config.data?.groups ?? []) as SubjectGroup[];
        setGroups(list);
        const choice = selection.data?.choices as Choices | undefined;
        setSaved(choice && completeChoices(list, choice) ? choice : null);
        setDraft(choice ?? {});
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : '과목 설정을 불러오지 못했어요.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => { alive = false; };
  }, [uid, year, semester, retry]);

  const save = async () => {
    if (saving || !completeChoices(groups, draft)) return;
    setSaving(true);
    setError('');
    try {
      const { error: failure } = await supabase.rpc('save_timetable_choices', { p_year: year, p_semester: semester, p_choices: draft });
      if (failure) throw failure;
      setSaved({ ...draft });
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
      <AppText color={color.inkMuted}>{error || '이 학기 또는 반의 과목 배치가 아직 등록되지 않았어요.'}</AppText>
      <Button label="다시 불러오기" accessibilityLabel="과목 설정 다시 불러오기" onPress={() => { setLoading(true); setError(''); setRetry((v) => v + 1); }} />
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
                  onPress={() => setDraft((v) => ({ ...v, [g.id]: subject }))}
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
