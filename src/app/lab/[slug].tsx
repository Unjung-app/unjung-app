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
  const S = lab.Screen;
  return (
    <>
      <Stack.Screen options={{ title: `${lab.emoji ?? '🧪'} ${lab.title}` }} />
      <LabErrorBoundary slug={lab.slug}>
        <S />
      </LabErrorBoundary>
    </>
  );
}
