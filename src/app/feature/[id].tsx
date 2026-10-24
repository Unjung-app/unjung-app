import { Stack, useLocalSearchParams } from 'expo-router';
import { FEATURE_BY_ID } from '@/features/registry';
import { FEATURE_SCREENS } from '@/features/screens';
import NotFound from '../+not-found';

/** 하단 탭에 없는 기능을 '전체'에서 열 때: 뒤로가기가 있는 화면 */
export default function FeatureInStack() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const feature = id ? FEATURE_BY_ID[id] : undefined;
  const S = id ? FEATURE_SCREENS[id] : undefined;
  if (!feature || !S) return <NotFound />;
  return (
    <>
      <Stack.Screen options={{ title: feature.title }} />
      <S inStack />
    </>
  );
}
