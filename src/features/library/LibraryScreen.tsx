import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { Button, Card } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/Screen';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

// 독서로(read365)의 운중고 장서 검색 결과를 앱 안 브라우저로 연다.
const BASE_URL = 'https://read365.edunet.net/PureScreen/SchoolSearchResult';
const RECENT_SEARCHES_KEY = 'library.recentSearches';
const MAX_RECENT_SEARCHES = 5;
function parseRecentSearches(value: string | null): string[] {
  try {
    const parsed: unknown = value ? JSON.parse(value) : [];
    if (!Array.isArray(parsed)) return [];
    const keywords = parsed.map((item: unknown) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && 'keyword' in item && typeof item.keyword === 'string') {
        return item.keyword.trim();
      }
      return '';
    });
    return [...new Set(keywords.filter(Boolean))].slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

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
  const [inputFocused, setInputFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const word = keyword.trim();
  const matchingRecentSearches = recentSearches.filter((item) =>
    word.toLowerCase().includes(item.toLowerCase()),
  );

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(RECENT_SEARCHES_KEY)
      .then((value) => {
        if (active) setRecentSearches(parseRecentSearches(value));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const search = (searchKeyword = word) => {
    const trimmedKeyword = searchKeyword.trim();
    if (!trimmedKeyword) return;

    const nextRecentSearches = [
      trimmedKeyword,
      ...recentSearches.filter((item) => item !== trimmedKeyword),
    ].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(nextRecentSearches);
    AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(nextRecentSearches)).catch(() => {});
    setInputFocused(false);
    WebBrowser.openBrowserAsync(searchUrl(trimmedKeyword)).catch(() => {});
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
        <AppText variant="body" color={color.inkMuted}>제목, 저자 등을 검색하세요.</AppText>
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
            onSubmitEditing={() => search()}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            returnKeyType="search"
            placeholder="책 제목, 저자, 키워드"
            placeholderTextColor={color.inkFaint}
            style={{ flex: 1, minHeight: 48, fontSize: 15, color: color.ink, ...fontStyle('regular') }}
          />
        </View>
        {inputFocused && matchingRecentSearches.length > 0 ? (
          <View style={{ gap: space.xs }}>
            <AppText variant="label" color={color.inkMuted}>
              최근 검색
            </AppText>
            {matchingRecentSearches.map((item) => {
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityLabel={`${item} 다시 검색`}
                  onPress={() => search(item)}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: space.md,
                    paddingHorizontal: space.md,
                    borderRadius: radius.control,
                    backgroundColor: pressed ? color.surfaceMuted : color.surface,
                  })}>
                  <AppText variant="bodyStrong" style={{ flex: 1 }}>
                    {item}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <Button label="검색" icon="external" onPress={() => search()} disabled={!word} />
        <AppText variant="caption" color={color.inkMuted}>
          검색 결과는 독서로(read365)에서 보여 줘요. 대출 가능 여부도 그 화면에서 확인할 수 있어요.
        </AppText>
      </Card>
    </Screen>
  );
}
