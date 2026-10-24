import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { isSchoolEmail, SCHOOL_DOMAIN, supabase } from '@/lib/supabase';
import { schoolTerm, seoulNow } from '@/lib/date';
import { usePrefs } from './prefs';

// 로그인 상태
//  loading          확인 중
//  signedOut        로그인 안 함 (앱은 둘러볼 수 있음)
//  needsEnrollment  학교 계정으로 로그인했지만 올해 학번·이름을 아직 안 넣음
//  ready            모두 완료

export type Role = 'student' | 'reviewer' | 'admin';
export type Enrollment = { student_no: string; name: string; grade: 1 | 2 | 3; class_no: number; number: number; school_year: number };

type AuthState = {
  status: 'loading' | 'signedOut' | 'needsEnrollment' | 'ready';
  session: Session | null;
  email: string | null;
  role: Role;
  /** 학생자치회 기획행정부(운중 보이스 설문 만들기·건의 확인). 관리자도 true */
  planner: boolean;
  enrollment: Enrollment | null;
  /** 학교 계정이 아니라서 로그인을 되돌렸을 때 보여 줄 문구 */
  notice: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  register: (studentNo: string, name: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  clearNotice: () => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setMyClass } = usePrefs();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>('student');
  const [planner, setPlanner] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProfile = useCallback(
    async (s: Session | null) => {
      if (!s) {
        setRole('student');
        setPlanner(false);
        setEnrollment(null);
        return;
      }
      const year = schoolTerm(seoulNow().ymd).year;
      const [{ data: profile }, { data: enr }] = await Promise.all([
        // '*': DB에 새 칸(is_planner)이 아직 없어도 역할은 읽히게
        supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
        supabase
          .from('enrollments')
          .select('student_no,name,grade,class_no,number,school_year')
          .eq('user_id', s.user.id)
          .eq('school_year', year)
          .maybeSingle(),
      ]);
      const r = (profile?.role as Role) ?? 'student';
      setRole(r);
      setPlanner(r === 'admin' || profile?.is_planner === true);
      setEnrollment((enr as Enrollment | null) ?? null);
      if (enr) setMyClass({ grade: enr.grade as 1 | 2 | 3, classNo: enr.class_no });
    },
    [setMyClass],
  );

  const accept = useCallback(
    async (s: Session | null) => {
      // 학교 계정이 아니면 바로 로그아웃시키고 안내한다 (DB도 이중으로 막고 있음)
      if (s && !isSchoolEmail(s.user.email)) {
        await supabase.auth.signOut();
        setNotice(`학교 계정(@${SCHOOL_DOMAIN})으로만 로그인할 수 있어요. ${s.user.email ?? ''} 계정은 사용할 수 없어요.`);
        setSession(null);
        await loadProfile(null);
        return;
      }
      setSession(s);
      await loadProfile(s);
    },
    [loadProfile],
  );

  // 로그인 상태 구독은 앱이 켜질 때 한 번만 (accept는 ref로 최신 것을 쓴다)
  const acceptRef = useRef(accept);
  acceptRef.current = accept;
  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => (alive ? acceptRef.current(data.session) : undefined))
      .finally(() => alive && setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // 콜백 안에서 바로 await 하면 supabase 내부 잠금과 겹칠 수 있어 다음 틱으로 미룬다
        setTimeout(() => alive && acceptRef.current(s), 0);
      } else if (event === 'TOKEN_REFRESHED') {
        setSession(s);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async () => {
    setNotice(null);
    if (Platform.OS !== 'web') {
      setNotice('지금은 웹(홈 화면에 추가한 앱)에서만 로그인할 수 있어요.');
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        // hd: 구글 로그인 창에 학교 계정만 보이게 하는 힌트 (실제 차단은 앱·DB가 한다)
        queryParams: { hd: SCHOOL_DOMAIN, prompt: 'select_account' },
      },
    });
    if (error) setNotice('로그인 창을 열지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    await loadProfile(null);
  }, [loadProfile]);

  const register = useCallback<AuthState['register']>(
    async (studentNo, name) => {
      const { error } = await supabase.rpc('register_enrollment', { p_student_no: studentNo, p_name: name });
      if (error) return { ok: false, message: error.message || '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.' };
      await loadProfile(session);
      return { ok: true };
    },
    [loadProfile, session],
  );

  const value = useMemo<AuthState>(
    () => ({
      status: loading ? 'loading' : !session ? 'signedOut' : enrollment ? 'ready' : 'needsEnrollment',
      session,
      email: session?.user.email ?? null,
      role,
      planner,
      enrollment,
      notice,
      signIn,
      signOut,
      register,
      clearNotice: () => setNotice(null),
    }),
    [loading, session, role, planner, enrollment, notice, signIn, signOut, register],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}

/** '이호원' → '호원' (세 글자 이름이면 성을 뺀 이름으로 부른다) */
export function givenName(name: string | undefined) {
  if (!name) return null;
  const n = name.trim();
  return n.length === 3 ? n.slice(1) : n;
}
