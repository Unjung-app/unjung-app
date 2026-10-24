import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_TABS, sanitizeTabs } from '@/features/registry';

// 학생 개인 설정. 지금은 이 기기에만 저장하고, 로그인이 생기면 계정과 동기화한다.

export type MyClass = { grade: 1 | 2 | 3; classNo: number };

type Prefs = {
  tabs: string[];
  myClass: MyClass | null;
};

type PrefsContext = Prefs & {
  loaded: boolean;
  setTabs: (tabs: string[]) => void;
  setMyClass: (c: MyClass | null) => void;
};

const KEY = 'unjung.prefs.v1';
const DEFAULTS: Prefs = { tabs: DEFAULT_TABS, myClass: null };

const Ctx = createContext<PrefsContext | null>(null);

function parse(raw: string | null): Prefs {
  if (!raw) return DEFAULTS;
  try {
    const v = JSON.parse(raw);
    const c = v?.myClass;
    const myClass =
      c && [1, 2, 3].includes(c.grade) && Number.isInteger(c.classNo) && c.classNo >= 1 && c.classNo <= 20
        ? { grade: c.grade, classNo: c.classNo }
        : null;
    return { tabs: sanitizeTabs(v?.tabs), myClass };
  } catch {
    return DEFAULTS;
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => alive && setPrefs(parse(raw)))
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback((next: Prefs) => {
    setPrefs(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const value = useMemo<PrefsContext>(
    () => ({
      ...prefs,
      loaded,
      setTabs: (tabs) => save({ ...prefs, tabs: sanitizeTabs(tabs) }),
      setMyClass: (myClass) => save({ ...prefs, myClass }),
    }),
    [prefs, loaded, save],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs must be used inside PrefsProvider');
  return v;
}
