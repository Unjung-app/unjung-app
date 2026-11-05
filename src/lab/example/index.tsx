// 실험실 예시 화면. 새 기능을 만들 때 이 파일의 구조를 참고한다.
// - 글자는 AppText, 색·간격은 tokens, 상자는 Card, 버튼은 Button
// - 화면 바탕은 Screen (스크롤·가운데 정렬을 알아서 해 준다)
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { color, space } from '@/theme/tokens';

const WORDS = ['오늘도 한 걸음!', '물 한 잔 마시고 시작해요', '쉬는 시간엔 스트레칭', '모르는 건 친구에게 물어보기'];

export default function ExampleLab() {
  const [index, setIndex] = useState(0);

  return (
    <Screen topInset={false}>
      <Card tone="navy">
        <AppText variant="label" color={color.onNavyMuted}>
          오늘의 한마디
        </AppText>
        <AppText variant="title" color={color.onNavy}>
          {WORDS[index]}
        </AppText>
      </Card>
      <View style={{ gap: space.sm }}>
        <Button label="다른 말 보기" icon="share" onPress={() => setIndex((i) => (i + 1) % WORDS.length)} />
        <AppText variant="caption" color={color.inkMuted} align="center">
          {`${index + 1} / ${WORDS.length}`}
        </AppText>
      </View>
    </Screen>
  );
}
