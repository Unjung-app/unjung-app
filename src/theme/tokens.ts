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
  danger: '#B42318',
  dangerSoft: '#FDECEA',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

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
