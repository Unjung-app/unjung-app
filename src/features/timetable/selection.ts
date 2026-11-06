import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { completeChoices, type Choices, type SubjectGroup } from './personal';

type Selection = { groups: SubjectGroup[]; saved: Choices | null; loading: boolean; error: string };
const empty: Selection = { groups: [], saved: null, loading: true, error: '' };
const states = new Map<string, Selection>();
const listeners = new Set<() => void>();
const pending = new Set<string>();
const versions = new Map<string, number>();
const keyFor = (uid: string, year: number, semester: number) => `${uid}:${year}:${semester}`;
function publish(key: string, value: Selection) {
  states.set(key, value);
  listeners.forEach((notify) => notify());
}
const subscribe = (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify); }; };

/** 홈과 시간표가 같은 선택을 구독한다. 계정·학기별로 분리한다. */
export function useSubjectSelection(uid: string | null, year: number, semester: number) {
  const key = uid ? keyFor(uid, year, semester) : '';
  const state = useSyncExternalStore(subscribe, () => states.get(key) ?? empty, () => empty);
  const reload = useCallback(async () => {
    if (!uid || pending.has(key)) return;
    pending.add(key);
    const version = versions.get(key) ?? 0;
    try {
      const [config, selection] = await Promise.all([
        supabase.from('timetable_configs').select('groups').eq('school_year', year).eq('semester', semester).eq('grade', 2).maybeSingle(),
        supabase.from('timetable_choices').select('choices').eq('user_id', uid).eq('school_year', year).eq('semester', semester).maybeSingle(),
      ]);
      if ((versions.get(key) ?? 0) !== version) return;
      if (config.error || selection.error) throw new Error('과목 설정을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
      const groups = (config.data?.groups ?? []) as SubjectGroup[];
      const saved = selection.data?.choices as Choices | undefined;
      publish(key, { groups, saved: saved && completeChoices(groups, saved) ? saved : null, loading: false, error: '' });
    } catch {
      if ((versions.get(key) ?? 0) !== version) return;
      publish(key, { ...(states.get(key) ?? empty), loading: false, error: '과목 설정을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.' });
    } finally { pending.delete(key); }
  }, [uid, year, semester, key]);
  useEffect(() => { void reload(); }, [reload]);
  const save = async (choices: Choices) => {
    if (!uid || !completeChoices(state.groups, choices)) throw new Error('과목을 모두 선택해 주세요.');
    const { error } = await supabase.rpc('save_timetable_choices', { p_year: year, p_semester: semester, p_choices: choices });
    if (error) throw error;
    versions.set(key, (versions.get(key) ?? 0) + 1);
    publish(key, { ...state, saved: { ...choices }, loading: false, error: '' });
  };
  return { ...state, reload, save };
}
