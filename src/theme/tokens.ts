// 디자인 시안 A "운중 네이비"의 토큰. 색·간격·모서리·글자 크기는 여기서만 정한다.

export const color = {
  bg: '#F3F5F9',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF2F8',
  line: '#DDE3EE',
  lineSoft: '#E3E8F1',

  ink: '#0B1B33',
  inkMuted: '#4A5872', // 흰 배경 대비 6.9:1
  inkFaint: '#6B7891', // 흰 배경 대비 4.6:1 (11px 이상 라벨용)

  navy: '#0E2748',
  navyRaised: '#163460',
  navyTrack: '#24406B',
  navyDone: '#5E7BAA',
  onNavy: '#FFFFFF',
  onNavyMuted: '#B9CBEA',
  onNavySub: '#D3DEF2',

  accent: '#F5A524',
  accentSoft: '#FFF1D6',
  accentInk: '#7A4B00',

  success: '#1B6B3A',
  successSoft: '#E3F4EA',
  /** 어두운(네이비) 배경 위 '지금 켜져 있음' 점 */
  liveOnNavy: '#4ADE80',
  shadow: '#000000',
  danger: '#B42318',
  dangerSoft: '#FDECEA',
} as const;

/** 꾸미기 상점: 닉네임 색 (흰 배경 대비 4.5:1 이상) — 키는 DB shop_items.value */
export const nameColor: Record<string, string> = {
  sky: '#0B6FB8',
  mint: '#0E7C66',
  coral: '#C2410C',
  violet: '#6D28D9',
  gold: '#8A5A00',
  rose: '#BE185D',
  ocean: '#1D4ED8',
  forest: '#166534',
};

/** 꾸미기 상점: 프로필 카드 배경 테마 (bg 위 ink/sub 대비 4.5:1 이상) */
export const profileTheme: Record<string, { bg: string; ink: string; sub: string; edge: string }> = {
  plain: { bg: '#FFFFFF', ink: '#0B1B33', sub: '#4A5872', edge: '#DDE3EE' },
  dawn: { bg: '#E6ECFA', ink: '#14244A', sub: '#46557A', edge: '#9DB0DE' },
  sunset: { bg: '#FFE4D3', ink: '#5A230B', sub: '#7E3F20', edge: '#F2A27A' },
  forest: { bg: '#DDF1E3', ink: '#123D22', sub: '#355F43', edge: '#8BC79C' },
  sakura: { bg: '#FCE4EE', ink: '#5B1634', sub: '#7F3D5A', edge: '#EFA1C1' },
  ocean: { bg: '#D9F0F7', ink: '#0B3A4A', sub: '#335F6E', edge: '#86C6D9' },
  night: { bg: '#0E2748', ink: '#FFFFFF', sub: '#B9CBEA', edge: '#F5A524' },
};

export const space ={ xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { card: 22, control: 12, chip: 10, pill: 18, round: 999 } as const;

export const font = {
  display: { size: 30, line: 38, weight: 'bold' },
  title: { size: 24, line: 32, weight: 'bold' },
  heading: { size: 16, line: 22, weight: 'bold' },
  body: { size: 15, line: 22, weight: 'regular' },
  bodyStrong: { size: 15, line: 22, weight: 'semibold' },
  label: { size: 13, line: 18, weight: 'semibold' },
  caption: { size: 12, line: 16, weight: 'regular' },
  tab: { size: 11, line: 14, weight: 'semibold' },
} as const;

export type FontVariant = keyof typeof font;
export type FontWeight = 'regular' | 'semibold' | 'bold';

/** 앱 내용이 넓은 화면(웹·태블릿)에서 늘어나지 않도록 하는 최대 폭 */
export const MAX_APP_WIDTH = 520;
