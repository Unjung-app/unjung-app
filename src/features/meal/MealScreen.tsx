import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Card, SampleNotice, SectionTitle } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { Stepper } from '@/components/ui/Segmented';
import { useWeekMeals } from '@/features/data';
import { useNow } from '@/features/hooks';
import { addDays, diffDays, isWeekend, mondayOf, parseYmd, weekdayLabel } from '@/lib/date';
import { ALLERGENS, type Meal } from '@/lib/school';
import { ReviewSection } from './ReviewSection';
import { MEAL_CODE } from './reviews';
import { color, radius, space } from '@/theme/tokens';

export function MealScreen({ inStack = false }: { inStack?: boolean }) {
  const now = useNow();
  const initial = isWeekend(now.ymd) ? addDays(mondayOf(now.ymd), 7) : now.ymd;
  const [selected, setSelected] = useState(initial);
  const [showAllergy, setShowAllergy] = useState(false);
  const meals = useWeekMeals(selected);
  const monday = mondayOf(selected);
  const offset = Math.round(diffDays(mondayOf(now.ymd), monday) / 7);
  const dayMeals = meals.items.filter((m) => m.date === selected);

  return (
    <Screen topInset={!inStack} refreshing={meals.refreshing} onRefresh={meals.refresh}>
      {!inStack ? (
        <AppText variant="title" accessibilityRole="header">
          급식
        </AppText>
      ) : null}
      {meals.source === 'sample' ? <SampleNotice /> : null}

      <Stepper
        label={offset === 0 ? '이번 주' : offset === 1 ? '다음 주' : offset === -1 ? '지난 주' : `${parseYmd(monday).m}월 ${parseYmd(monday).d}일 주`}
        onPrev={() => setSelected(addDays(monday, -7))}
        onNext={() => setSelected(addDays(monday, 7))}
        onReset={() => setSelected(initial)}
      />
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 6 }}>
        {[0, 1, 2, 3, 4].map((i) => {
          const d = addDays(monday, i);
          const on = d === selected;
          const isToday = d === now.ymd;
          return (
            <Pressable
              key={d}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${weekdayLabel(d)}요일 ${parseYmd(d).d}일${isToday ? ' 오늘' : ''}`}
              onPress={() => setSelected(d)}
              style={{
                flex: 1,
                minHeight: 56,
                borderRadius: radius.control,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? color.navy : color.surface,
                borderWidth: isToday && !on ? 1.5 : 0,
                borderColor: color.navy,
              }}>
              <AppText variant="caption" color={on ? color.onNavyMuted : color.inkMuted}>
                {weekdayLabel(d)}
              </AppText>
              <AppText variant="bodyStrong" color={on ? color.onNavy : color.ink}>
                {parseYmd(d).d}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space.sm }}>
        <AppText variant="label" weight="regular" color={color.inkMuted} nativeID="allergy-label">
          알레르기 정보
        </AppText>
        <Switch
          accessibilityLabelledBy="allergy-label"
          accessibilityLabel="알레르기 정보 보기"
          value={showAllergy}
          onValueChange={setShowAllergy}
          trackColor={{ true: color.navy, false: color.line }}
          thumbColor={color.surface}
        />
      </View>

      {dayMeals.length === 0 ? (
        <Card>
          <AppText variant="body" color={color.inkMuted}>
            이날은 급식 정보가 없어요
          </AppText>
        </Card>
      ) : (
        dayMeals.map((m) => (
          <View key={m.type} style={{ gap: space.md }}>
            <MealBlock meal={m} showAllergy={showAllergy} />
            <ReviewSection mealYmd={m.date} code={MEAL_CODE[m.type]} title={m.type === '중식' ? '점심' : m.type === '석식' ? '저녁' : '아침'} />
          </View>
        ))
      )}
    </Screen>
  );
}

function MealBlock({ meal, showAllergy }: { meal: Meal; showAllergy: boolean }) {
  return (
    <Card>
      <SectionTitle
        title={meal.type}
        right={
          meal.kcal ? (
            <AppText variant="caption" color={color.inkMuted}>
              {meal.kcal} kcal
            </AppText>
          ) : null
        }
      />
      <View style={{ gap: 10 }}>
        {meal.dishes.map((d) => (
          <View key={d.name} style={{ gap: 2 }}>
            <AppText variant="body">{d.name}</AppText>
            {showAllergy && d.allergens.length > 0 ? (
              <AppText variant="caption" color={color.inkMuted}>
                {d.allergens.map((n) => ALLERGENS[n]).join(' · ')}
              </AppText>
            ) : null}
          </View>
        ))}
      </View>
    </Card>
  );
}
