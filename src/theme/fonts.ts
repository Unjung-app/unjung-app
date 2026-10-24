import { Platform } from 'react-native';
import type { FontWeight } from './tokens';

// 앱(iOS·Android): assets/fonts 의 Pretendard 3종을 expo-font 로 불러온다.
// 웹: 무거운 원본 대신 CDN의 '다이내믹 서브셋' CSS를 쓴다(필요한 글자만 내려받음).

export const NATIVE_FONTS = {
  'Pretendard-Regular': require('../../assets/fonts/Pretendard-Regular.otf'),
  'Pretendard-SemiBold': require('../../assets/fonts/Pretendard-SemiBold.otf'),
  'Pretendard-Bold': require('../../assets/fonts/Pretendard-Bold.otf'),
};

export const WEB_FONT_CSS =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';

const WEB_STACK =
  "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', system-ui, sans-serif";

const NATIVE_FAMILY: Record<FontWeight, string> = {
  regular: 'Pretendard-Regular',
  semibold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
};

const WEB_WEIGHT: Record<FontWeight, '400' | '600' | '700'> = {
  regular: '400',
  semibold: '600',
  bold: '700',
};

/** 굵기 → 플랫폼별 글꼴 스타일. 앱에서는 fontWeight를 주지 않아야 안드로이드에서 가짜 굵게가 생기지 않는다. */
export function fontStyle(weight: FontWeight) {
  if (Platform.OS === 'web') {
    return { fontFamily: WEB_STACK, fontWeight: WEB_WEIGHT[weight] } as const;
  }
  return { fontFamily: NATIVE_FAMILY[weight] } as const;
}

/** 웹에서 한 번만 Pretendard CSS를 붙인다. */
export function injectWebFont() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('pretendard-css')) return;
  const link = document.createElement('link');
  link.id = 'pretendard-css';
  link.rel = 'stylesheet';
  link.href = WEB_FONT_CSS;
  document.head.appendChild(link);
}
