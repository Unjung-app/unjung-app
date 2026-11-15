import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_TABS, OLD_DEFAULT_TABS, sanitizeTabs } from '@/features/registry';

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
    // 탭 설정을 한 번도 바꾸지 않은 학생(옛 기본값 그대로)은 새 기본값(가운데 '스터디 윗미')으로
    const old = v?.tabsV !== 2 && Array.isArray(v?.tabs) && v.tabs.join() === OLD_DEFAULT_TABS.join();
    return { tabs: old ? DEFAULT_TABS : sanitizeTabs(v?.tabs), myClass };
  } catch {
    return DEFAULTS;
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  // 저장본을 읽기 전에 들어온 변경은 기다렸다가 저장본 위에 적용한다(안 그러면 기본값으로 저장본을 덮어써 설정이 초기화됨)
  const loadedRef = useRef(false);
  const pending = useRef<((p: Prefs) => Prefs)[]>([]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!alive) return;
        let next = parse(raw);
        const queued = pending.current;
        pending.current = [];
        for (const fn of queued) next = fn(next);
        setPrefs(next);
        if (queued.length) AsyncStorage.setItem(KEY, JSON.stringify({ ...next, tabsV: 2 })).catch(() => {});
      })
      .catch(() => {})
      .finally(() => {
        loadedRef.current = true;
        if (!alive) return;
        const left = pending.current;
        pending.current = [];
        if (left.length) setPrefs((p) => left.reduce((acc, fn) => fn(acc), p));
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 함수형 업데이트로 저장 → setTabs/setMyClass가 항상 같은 함수라서, 이를 쓰는 쪽이 불필요하게 다시 실행되지 않는다
  const update = useCallback((fn: (p: Prefs) => Prefs) => {
    if (!loadedRef.current) {
      pending.current.push(fn);
      return;
    }
    setPrefs((prev) => {
      const next = fn(prev);
      if (next === prev) return prev;
      AsyncStorage.setItem(KEY, JSON.stringify({ ...next, tabsV: 2 })).catch(() => {});
      return next;
    });
  }, []);

  const setTabs = useCallback((tabs: string[]) => update((p) => ({ ...p, tabs: sanitizeTabs(tabs) })), [update]);
  const setMyClass = useCallback(
    (myClass: MyClass | null) =>
      update((p) =>
        p.myClass?.grade === myClass?.grade && p.myClass?.classNo === myClass?.classNo ? p : { ...p, myClass },
      ),
    [update],
  );

  const value = useMemo<PrefsContext>(
    () => ({ ...prefs, loaded, setTabs, setMyClass }),
    [prefs, loaded, setTabs, setMyClass],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs must be used inside PrefsProvider');
  return v;
}
