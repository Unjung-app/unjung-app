import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { ReactNode } from 'react';

// 앱 전체 아이콘. 외부 라이브러리 없이 같은 선 굵기의 SVG로 통일한다.

const PATHS: Record<string, ReactNode> = {
  today: (
    <>
      <Path d="M3 10.5 12 3l9 7.5" />
      <Path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.5a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  timetable: (
    <>
      <Rect x={3} y={5} width={18} height={16} rx={2.5} />
      <Path d="M3 10h18M8 3v4M16 3v4M8 14h3M8 17.5h6" />
    </>
  ),
  meal: <Path d="M6 3v8a2 2 0 0 0 4 0V3M8 13v8M17 3c-1.5 1.5-2 3.5-2 5.5S15.5 12 17 12.5V21" />,
  calendar: (
    <>
      <Rect x={3} y={5} width={18} height={16} rx={2.5} />
      <Path d="M3 10h18M8 3v4M16 3v4" />
      <Circle cx={15.5} cy={15.5} r={1.6} />
    </>
  ),
  study: (
    <>
      <Circle cx={12} cy={13.5} r={7.5} />
      <Path d="M12 9.5v4l2.5 1.8M9.5 2.5h5" />
    </>
  ),
  ranking: (
    <>
      <Path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z" />
      <Path d="M17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3" />
    </>
  ),
  library: (
    <>
      <Path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5Z" />
      <Path d="M4 19.5A1.5 1.5 0 0 1 5.5 21H19v-3M8 7.5h7" />
    </>
  ),
  notice: (
    <>
      <Path d="M18 15.5V10a6 6 0 1 0-12 0v5.5L4.5 18h15Z" />
      <Path d="M10 21h4" />
    </>
  ),
  voice: (
    <>
      <Path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5Z" />
      <Path d="M8.5 8.5h7M8.5 11.5h4" />
    </>
  ),
  sports: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 3c2.8 2.2 4.5 5.4 4.5 9s-1.7 6.8-4.5 9c-2.8-2.2-4.5-5.4-4.5-9S9.2 5.2 12 3ZM3.2 9.5h17.6M3.2 14.5h17.6" />
    </>
  ),
  more: (
    <>
      <Rect x={3.5} y={3.5} width={7} height={7} rx={2} />
      <Rect x={13.5} y={3.5} width={7} height={7} rx={2} />
      <Rect x={3.5} y={13.5} width={7} height={7} rx={2} />
      <Rect x={13.5} y={13.5} width={7} height={7} rx={2} />
    </>
  ),
  coin: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v10M9 9.5h4.5a2 2 0 0 1 0 4H9" />
    </>
  ),
  task: (
    <>
      <Rect x={5} y={4} width={14} height={17} rx={2.5} />
      <Path d="M9 4V3h6v1M8.5 12.5l2.2 2.2 4.8-5" />
    </>
  ),
  bag: (
    <>
      <Path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8Z" />
      <Path d="M9 10V7a3 3 0 0 1 6 0v3" />
    </>
  ),
  user: (
    <>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  settings: (
    <>
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  chevronRight: <Path d="m9 5 7 7-7 7" />,
  chevronLeft: <Path d="m15 5-7 7 7 7" />,
  arrowUp: <Path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <Path d="M12 5v14M6 13l6 6 6-6" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  share: (
    <>
      <Path d="M12 15V3M8 7l4-4 4 4" />
      <Path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </>
  ),
  minus: <Path d="M5 12h14" />,
  check: <Path d="m5 12 5 5 9-10" />,
  search: (
    <>
      <Circle cx={11} cy={11} r={7} />
      <Path d="m20 20-3.5-3.5" />
    </>
  ),
  external: <Path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  info: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 11v6M12 7.5h.01" />
    </>
  ),
  pin: (
    <>
      <Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <Circle cx={12} cy={10} r={2.3} />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.9,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
      pointerEvents="none">
      {PATHS[name]}
    </Svg>
  );
}
