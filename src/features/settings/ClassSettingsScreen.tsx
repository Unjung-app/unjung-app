import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { usePrefs, type MyClass } from '@/state/prefs';
import { color, radius, space } from '@/theme/tokens';

// TODO: 학년별 반 수를 NEIS classInfo로 받아오기. 지금은 1~12반을 보여 준다.
const CLASS_COUNT = 12;

export function ClassSettingsScreen() {
  const router = useRouter();
  const { myClass, setMyClass } = usePrefs();
  const [grade, setGrade] = useState<MyClass['grade']>(myClass?.grade ?? 1);
  const [classNo, setClassNo] = useState<number | null>(myClass?.classNo ?? null);

  return (
    <Screen topInset={false}>
      <AppText variant="body" color={color.inkMuted}>
        시간표를 불러올 학년과 반을 골라 주세요. 학교 계정 로그인이 생기면 자동으로 채워져요.
      </AppText>

      <AppText variant="heading" style={{ marginTop: space.sm }}>
        학년
      </AppText>
      <Segmented
        label="학년"
        value={grade}
        onChange={setGrade}
        options={[
          { value: 1, label: '1학년' },
          { value: 2, label: '2학년' },
          { value: 3, label: '3학년' },
        ]}
      />

      <AppText variant="heading" style={{ marginTop: space.sm }}>
        반
      </AppText>
      <View accessibilityRole="radiogroup" accessibilityLabel="반" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {Array.from({ length: CLASS_COUNT }, (_, i) => i + 1).map((n) => {
          const on = classNo === n;
          return (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${n}반`}
              onPress={() => setClassNo(n)}
              style={{
                width: '22.6%',
                minHeight: 52,
                borderRadius: radius.control,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? color.navy : color.surface,
              }}>
              <AppText variant="bodyStrong" color={on ? color.onNavy : color.ink}>
                {n}반
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <Button
        label={classNo ? `${grade}학년 ${classNo}반으로 저장` : '반을 골라 주세요'}
        disabled={!classNo}
        style={{ marginTop: space.lg }}
        onPress={() => {
          if (!classNo) return;
          setMyClass({ grade, classNo });
          if (router.canGoBack()) router.back();
          else router.replace('/');
        }}
      />
    </Screen>
  );
}
