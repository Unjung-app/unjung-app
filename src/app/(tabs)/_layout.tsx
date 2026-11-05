import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { TabBar } from '@/components/TabBar';
import { FEATURES } from '@/features/registry';

// 모든 기능 화면을 탭으로 '등록'만 해 두고(숨긴 TabList), 실제로 보이는 탭바는
// 학생 설정에 따라 그린다. 그래서 설정을 바꿔도 앱이 다시 시작되지 않는다.
export default function TabsLayout() {
  return (
    <Tabs style={{ flex: 1 }}>
      <TabSlot style={{ flex: 1, flexBasis: 0, minHeight: 0 }} />
      <TabBar />
      <TabList style={{ display: 'none' }}>
        <TabTrigger name="index" href="/" />
        {FEATURES.map((f) => (
          <TabTrigger key={f.id} name={f.id} href={`/${f.id}`} />
        ))}
        <TabTrigger name="more" href="/more" />
      </TabList>
    </Tabs>
  );
}
