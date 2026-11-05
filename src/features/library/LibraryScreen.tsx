import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppText } from '@/components/ui/AppText';
import { Icon } from '@/components/ui/Icon';
import { Button, Card } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/Segmented';
import { Screen } from '@/components/ui/Screen';
import { fontStyle } from '@/theme/fonts';
import { color, radius, space } from '@/theme/tokens';

// 독서로(read365)의 운중고 장서 검색 결과를 앱 안 브라우저로 연다.
const BASE_URL = 'https://read365.edunet.net/PureScreen/SchoolSearchResult';
const RECENT_SEARCHES_KEY = 'library.recentSearches';
const MAX_RECENT_SEARCHES = 5;
type SearchCategory = 'all' | 'title' | 'author' | 'publisher';
type RecentSearch = { keyword: string; category: SearchCategory };

const SEARCH_CATEGORIES: { value: SearchCategory; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'title', label: '제목' },
  { value: 'author', label: '저자' },
  { value: 'publisher', label: '발행자' },
];

function isSearchCategory(value: unknown): value is SearchCategory {
  return SEARCH_CATEGORIES.some((option) => option.value === value);
}

function parseRecentSearches(value: string | null): RecentSearch[] {
  try {
    const parsed: unknown = value ? JSON.parse(value) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is RecentSearch => {
        if (typeof item !== 'object' || item === null) return false;
        const entry = item as Record<string, unknown>;
        return typeof entry.keyword === 'string' && !!entry.keyword && isSearchCategory(entry.category);
      })
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

function searchUrl(keyword: string, category: SearchCategory) {
  const params = new URLSearchParams({
    searchKeyword: keyword,
    ...(category === 'all' ? {} : { searchType: category.toUpperCase() }),
    provCode: 'J10',
    neisCode: 'J100005844',
    schoolName: '운중고등학교',
  });
  return `${BASE_URL}?${params.toString()}`;
}

export function LibraryScreen({ inStack = false }: { inStack?: boolean }) {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [inputFocused, setInputFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const word = keyword.trim();
  const matchingRecentSearches = recentSearches.filter((item) =>
    word.toLowerCase().includes(item.keyword.toLowerCase()),
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

  const search = (searchKeyword = word, searchCategory = category) => {
    const trimmedKeyword = searchKeyword.trim();
    if (!trimmedKeyword) return;

    const nextRecentSearches = [
      { keyword: trimmedKeyword, category: searchCategory },
      ...recentSearches.filter(
        (item) => item.keyword !== trimmedKeyword || item.category !== searchCategory,
      ),
    ].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(nextRecentSearches);
    AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(nextRecentSearches)).catch(() => {});
    setInputFocused(false);
    WebBrowser.openBrowserAsync(searchUrl(trimmedKeyword, searchCategory)).catch(() => {});
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
        <Segmented
          label="검색 범위"
          value={category}
          onChange={setCategory}
          options={SEARCH_CATEGORIES}
        />
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
              const categoryLabel = SEARCH_CATEGORIES.find((option) => option.value === item.category)?.label;
              return (
                <Pressable
                  key={`${item.category}:${item.keyword}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.keyword}, ${categoryLabel} 범위로 다시 검색`}
                  onPress={() => search(item.keyword, item.category)}
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
                    {item.keyword}
                  </AppText>
                  <AppText variant="caption" color={color.inkMuted}>
                    {categoryLabel}
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
