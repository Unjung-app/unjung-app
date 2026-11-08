import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/state/auth';

/**
 * 관리 화면 접근: 관리자(role) 또는 개발자(app_config 'developers' 학번, 서버 is_developer).
 * 화면은 이 값으로 보여 줄지만 정하고, 실제 권한 검사는 서버 함수가 한다.
 */
export function useStaffAccess() {
  const { status, role } = useAuth();
  const admin = role === 'admin';
  const [developer, setDeveloper] = useState(false);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (status !== 'ready') return;
    let alive = true;
    supabase.rpc('is_developer').then(({ data }) => {
      if (!alive) return;
      setDeveloper(data === true);
      setChecked(true);
    });
    return () => {
      alive = false;
    };
  }, [status]);
  return { admin, developer, staff: admin || developer, checked: admin || checked || status !== 'ready' };
}
