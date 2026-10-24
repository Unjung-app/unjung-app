import { useState } from 'react';
import { TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

// 첫 버전: yongwon. 독서로(read365)의 운중고 장서 검색 결과를 앱 안 브라우저로 연다.
const BASE_URL = 'https://read365.edunet.net/PureScreen/SchoolSearchResult';

function searchUrl(keyword: string) {
  const params = new URLSearchParams({
    searchKeyword: keyword,
    provCode: 'J10',
    neisCode: 'J100005844',
    schoolName: '운중고등학교',
  });
  return `${BASE_URL}?${params.toString()}`;
}

export function LibraryScreen({ inStack = false }: { inStack?: boolean }) {
  const [keyword, setKeyword] = useState('');
  const word = keyword.trim();
  const search = () => {
    if (word) WebBrowser.openBrowserAsync(searchUrl(word)).catch(() => {});
  };

  return (
    <Screen topInset={!inStack}>
      {!inStack ? (
        <AppText variant="title" accessibilityRole="header">
          도서관
        </AppText>
      ) : null}
      <Card>
        <AppText variant="heading" nativeID="lib-label">
          장서 검색
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            borderWidth: 1,
            borderColor: color.line,
            borderRadius: radius.control,
            paddingHorizontal: space.md,
          }}>
          <Icon name="search" size={18} color={color.inkFaint} />
          <TextInput
            accessibilityLabel="책 제목, 저자, 키워드"
            accessibilityLabelledBy="lib-label"
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={search}
            returnKeyType="search"
            placeholder="책 제목, 저자, 키워드"
            placeholderTextColor={color.inkFaint}
            style={{ flex: 1, minHeight: 48, fontSize: 15, color: color.ink, ...fontStyle('regular') }}
          />
        </View>
        <Button label="검색" icon="external" onPress={search} disabled={!word} />
        <AppText variant="caption" color={color.inkMuted}>
          검색 결과는 독서로(read365)에서 보여 줘요. 대출 가능 여부도 그 화면에서 확인할 수 있어요.
        </AppText>
      </Card>
    </Screen>
  );
}
