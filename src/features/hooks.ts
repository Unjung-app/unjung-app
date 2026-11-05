import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { seoulNow } from '@/lib/date';
import { usePrefs } from '@/state/prefs';

/** 한국 시간 기준 '지금'. 30초마다 갱신해 남은 시간 표시가 움직이게 한다. */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => seoulNow());
  useEffect(() => {
    const id = setInterval(() => setNow(seoulNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** 기능 열기: 하단 탭에 있으면 그 탭으로, 없으면 뒤로가기가 있는 화면으로 */
export function useOpenFeature() {
  const router = useRouter();
  const { tabs } = usePrefs();
  return (id: string) => {
    if (tabs.includes(id)) router.navigate(`/${id}`);
    else router.push(`/feature/${id}`);
  };
}

export function classLabel(c: { grade: number; classNo: number } | null) {
  return c ? `${c.grade}학년 ${c.classNo}반` : '반 미설정';
}
