import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppText } from "./AppText";
import { color, MAX_APP_WIDTH, space } from "@/theme/tokens";

/** 모든 화면의 바탕. 스크롤·당겨서 새로고침·넓은 화면 가운데 정렬을 맡는다. */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
  contentStyle,
  topInset = true,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** 헤더가 없는 탭 화면은 상단 안전영역만큼 띄운다 */
  topInset?: boolean;
}) {
  const insets = useSafeAreaInsets();
  // 넓은 화면(태블릿·폴드 펼침·PC)에서는 내용 폭을 넓힌다. 폰은 그대로
  const { width } = useWindowDimensions();
  const maxWidth = width >= 900 ? 960 : width >= 680 ? 680 : MAX_APP_WIDTH;
  const web = useWebPullToRefresh(onRefresh, refreshing);
  return (
    <ScrollView
      {...web.scrollProps}
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={{
        paddingTop: topInset ? insets.top + space.lg : space.lg,
        paddingBottom: space.xxxl,
      }}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    >
      <View {...web.touchProps}>
        {web.indicator}
        <View
          style={[
            {
              width: "100%",
              maxWidth,
              alignSelf: "center",
              paddingHorizontal: width < 360 ? space.lg : space.xl,
              gap: space.md,
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </View>
    </ScrollView>
  );
}

/**
 * 웹(홈 화면에 추가한 앱)에는 '당겨서 새로고침'이 없어서 직접 만든다(학생 의견 #93).
 *  · 맨 위에서 아래로 당겼다 놓으면 새로고침
 *  · 다른 앱에 갔다가 돌아오면(30초 넘게 지났으면) 알아서 새로고침
 */
function useWebPullToRefresh(
  onRefresh: (() => void) | undefined,
  refreshing: boolean,
) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const top = useRef(true);
  const startY = useRef<number | null>(null);
  const last = useRef(Date.now());
  const cb = useRef(onRefresh);
  cb.current = onRefresh;
  const enabled = Platform.OS === "web" && !!onRefresh;

  const run = () => {
    last.current = Date.now();
    setBusy(true);
    cb.current?.();
    setTimeout(() => setBusy(false), 900);
  };

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const onVis = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - last.current > 30_000
      ) {
        last.current = Date.now();
        cb.current?.();
      }
      if (document.visibilityState === "hidden")
        last.current = Math.min(last.current, Date.now());
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled]);

  if (!enabled) return { scrollProps: {}, touchProps: {}, indicator: null };
  const shown = busy || refreshing ? 44 : Math.min(pull, 70);
  return {
    scrollProps: {
      scrollEventThrottle: 32,
      onScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => {
        top.current = e.nativeEvent.contentOffset.y <= 0;
      },
    },
    touchProps: {
      onTouchStart: (e: TouchLike) => {
        startY.current = top.current ? touchY(e) : null;
      },
      onTouchMove: (e: TouchLike) => {
        if (startY.current === null) return;
        const dy = touchY(e) - startY.current;
        setPull(dy > 0 ? dy / 2 : 0);
      },
      onTouchEnd: () => {
        if (startY.current !== null && pull >= 50) run();
        startY.current = null;
        setPull(0);
      },
    },
    indicator:
      shown > 4 ? (
        <View
          style={{
            height: shown,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 6,
            overflow: "hidden",
          }}
        >
          {busy || refreshing ? (
            <ActivityIndicator size="small" color={color.navy} />
          ) : null}
          <AppText variant="caption" color={color.inkMuted}>
            {busy || refreshing
              ? "새로 불러오는 중…"
              : pull >= 50
                ? "놓으면 새로고침"
                : "↓ 당겨서 새로고침"}
          </AppText>
        </View>
      ) : null,
  };
}

type TouchLike = { nativeEvent: { pageY?: number; touches?: ArrayLike<{ pageY: number }>; changedTouches?: ArrayLike<{ pageY: number }> } };
/** 웹 터치 이벤트는 손가락 위치가 touches 안에 있다 */
function touchY(e: TouchLike) {
  const n = e.nativeEvent;
  return n.touches?.[0]?.pageY ?? n.changedTouches?.[0]?.pageY ?? n.pageY ?? 0;
}
