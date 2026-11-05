import type { ComponentType } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { LAB_BY_SLUG, labVisible } from '@/lab/registry';
import { LabErrorBoundary } from '@/lab/LabErrorBoundary';
import { useAuth } from '@/state/auth';
import NotFound from '../+not-found';

/** 실험실 기능 화면: /lab/<이름> */
export default function LabScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { role } = useAuth();
  const lab = slug ? LAB_BY_SLUG[slug] : undefined;
  if (!lab || !labVisible(role)) return <NotFound />;
  return (
    <>
      <Stack.Screen options={{ title: `${lab.emoji ?? '🧪'} ${lab.title}` }} />
      <LabErrorBoundary slug={lab.slug}>
        <LabBody load={lab.loadScreen} />
      </LabErrorBoundary>
    </>
  );
}

/** 화면 코드를 여기서 처음 불러온다. 불러오다 난 오류도 LabErrorBoundary가 잡는다. */
function LabBody({ load }: { load: () => ComponentType | null }) {
  const S = load();
  if (!S) throw new Error('index.tsx에서 화면을 export default로 내보내야 해요');
  return <S />;
}
