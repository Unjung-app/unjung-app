import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { isSchoolEmail, SCHOOL_DOMAIN, supabase } from '@/lib/supabase';
import { schoolTerm, seoulNow } from '@/lib/date';
import { usePrefs } from './prefs';

// 로그인 상태
//  loading          확인 중
//  signedOut        로그인 안 함 (앱은 둘러볼 수 있음)
//  needsEnrollment  학교 계정으로 로그인했지만 올해 학번·이름을 아직 안 넣음
//  ready            모두 완료 (선생님 계정은 학번 없이 바로 ready)

export type Role = 'student' | 'reviewer' | 'admin';

// 학적·역할을 기기에 저장해 둔다: 다음에 열 때 바로 보이고, 학교 와이파이가 끊겨도
// '학번 등록' 화면으로 잘못 보내지 않는다(서버 확인에 실패하면 저장본을 그대로 쓴다).
const PROFILE_KEY = 'unjung.profile.v1';
type ProfileCache = { uid: string; year: number; role: Role; planner: boolean; enrollment: Enrollment | null; teacher?: string | null; teacherInfo?: TeacherInfo | null; teacherBlocked?: boolean };

/** 선생님 정보(교직원 계정) */
export type TeacherInfo = { name: string; homeGrade: number | null; homeClass: number | null; dept: string | null };

/** 학생 계정 = 앞 5자리가 숫자. 그 밖의 학교 계정은 교직원(선생님) 계정 */
export const isStudentEmail = (email?: string | null) => /^[0-9]{5}/.test((email ?? '').split('@')[0]);
export type Enrollment = { student_no: string; name: string; grade: 1 | 2 | 3; class_no: number; number: number; school_year: number };

type AuthState = {
  status: 'loading' | 'signedOut' | 'needsEnrollment' | 'ready';
  session: Session | null;
  email: string | null;
  role: Role;
  /** 학생자치회 기획행정부(운중 보이스 설문 만들기·건의 확인). 관리자도 true */
  planner: boolean;
  enrollment: Enrollment | null;
  /** 선생님 계정이면 선생님 이름(관리자가 선생님 명단에 넣은 학교 계정). 학생이면 null */
  teacher: string | null;
  teacherInfo: TeacherInfo | null;
  /** 교직원 계정(앞 5자리가 숫자가 아님)이고 학번이 없어 선생님으로 등록할 수 있음 */
  canBeTeacher: boolean;
  /** 관리자가 선생님 사용을 막은 계정(공용·행정 계정 등) */
  teacherBlocked: boolean;
  /** 학교 계정이 아니라서 로그인을 되돌렸을 때 보여 줄 문구 */
  notice: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  register: (studentNo: string, name: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  /** 학적·역할을 서버에서 다시 읽는다(학번 정정 뒤 등) */
  reload: () => Promise<void>;
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
  const [teacher, setTeacher] = useState<string | null>(null);
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [teacherBlocked, setTeacherBlocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** 로그인한 사람의 학적을 서버(또는 저장본)로 확인했는가. 확인 전에는 status를 'loading'으로 둔다 */
  const [profileKnown, setProfileKnown] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyProfile = useCallback(
    (c: Omit<ProfileCache, 'uid' | 'year'>) => {
      setRole(c.role);
      setPlanner(c.role === 'admin' || c.planner);
      setEnrollment(c.enrollment);
      setTeacher(c.teacher ?? null);
      setTeacherInfo(c.teacherInfo ?? null);
      setTeacherBlocked(!!c.teacherBlocked);
      if (c.enrollment) setMyClass({ grade: c.enrollment.grade, classNo: c.enrollment.class_no });
      setProfileKnown(true);
    },
    [setMyClass],
  );

  const loadProfile = useCallback(
    async (s: Session | null): Promise<void> => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = null;
      if (!s) {
        setRole('student');
        setPlanner(false);
        setEnrollment(null);
        setTeacher(null);
        setTeacherInfo(null);
        setTeacherBlocked(false);
        setProfileKnown(false);
        return;
      }
      const uid = s.user.id;
      const year = schoolTerm(seoulNow().ymd).year;
      // 1) 저장본: 같은 사람·같은 학년도면 바로 보여 준다
      let cached: ProfileCache | null = null;
      try {
        const raw = await AsyncStorage.getItem(PROFILE_KEY);
        cached = raw ? (JSON.parse(raw) as ProfileCache) : null;
      } catch {
        cached = null;
      }
      if (cached && cached.uid === uid && cached.year === year) applyProfile(cached);

      // 2) 서버 확인
      const [p, e] = await Promise.all([
        // '*': DB에 새 칸(is_planner)이 생기기 전이어도 역할은 읽히게
        supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
        supabase.from('enrollments').select('student_no,name,grade,class_no,number,school_year').eq('user_id', uid).eq('school_year', year).maybeSingle(),
      ]);
      if (p.error || e.error) {
        // 네트워크 문제: 저장본이 있으면 그대로, 없으면 잠시 뒤 다시(학번 등록 화면으로 보내지 않는다)
        retryTimer.current = setTimeout(() => {
          supabase.auth.getSession().then(({ data }) => {
            if (data.session?.user.id === uid) loadProfile(data.session);
          });
        }, 5000);
        return;
      }
      const fresh: ProfileCache = {
        uid,
        year,
        role: (p.data?.role as Role) ?? 'student',
        planner: p.data?.is_planner === true,
        enrollment: (e.data as Enrollment | null) ?? null,
        teacher: p.data?.teacher_blocked ? null : ((p.data?.teacher_name as string | null | undefined) ?? null),
        teacherBlocked: !!p.data?.teacher_blocked,
        teacherInfo:
          p.data?.teacher_name && !p.data?.teacher_blocked
            ? { name: p.data.teacher_name, homeGrade: p.data.teacher_home_grade ?? null, homeClass: p.data.teacher_home_class ?? null, dept: p.data.teacher_dept ?? null }
            : null,
      };
      applyProfile(fresh);
      AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(fresh)).catch(() => {});
    },
    [applyProfile],
  );

  // 앱으로 돌아올 때 역할·학적을 다시 확인(검토위원 임명 등이 바로 반영되게)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) loadProfile(data.session);
      });
    });
    return () => sub.remove();
  }, [loadProfile]);

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
      .then(({ data }) => {
        // 학적 확인을 기다리지 않는다: 저장본이 있으면 바로 화면이 뜨고, 서버 확인은 뒤에서 이어진다
        if (alive) acceptRef.current(data.session);
      })
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
    await supabase.auth.signOut().catch(() => {});
    AsyncStorage.removeItem(PROFILE_KEY).catch(() => {});
    setSession(null);
    await loadProfile(null);
  }, [loadProfile]);

  const register = useCallback<AuthState['register']>(
    async (studentNo, name) => {
      const { error } = await supabase.rpc('register_enrollment', { p_student_no: studentNo, p_name: name });
      if (error) return { ok: false, message: /[가-힣]/.test(error.message ?? '') ? error.message : '저장하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.' };
      await loadProfile(session);
      return { ok: true };
    },
    [loadProfile, session],
  );

  const reload = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await loadProfile(data.session);
  }, [loadProfile]);

  const value = useMemo<AuthState>(
    () => ({
      status: loading ? 'loading' : !session ? 'signedOut' : !profileKnown ? 'loading' : enrollment || teacher ? 'ready' : 'needsEnrollment',
      session,
      email: session?.user.email ?? null,
      role,
      planner,
      enrollment,
      teacher,
      teacherInfo,
      teacherBlocked,
      canBeTeacher: !!session && !enrollment && !teacherBlocked && !isStudentEmail(session.user.email),
      notice,
      signIn,
      signOut,
      register,
      reload,
      clearNotice: () => setNotice(null),
    }),
    [loading, session, profileKnown, role, planner, enrollment, teacher, teacherInfo, teacherBlocked, notice, signIn, signOut, register, reload],
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
