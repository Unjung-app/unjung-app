import { useId } from 'react';
import Svg, { Circle, G, Line, Mask, Rect } from 'react-native-svg';
import { color } from '@/theme/tokens';

// 운중고 로고(雲中): 구름 모양 '口' + 가운데를 관통하는 세로획 = 中
// variant
//  'mark-light' (C) 밝은 바탕용: 남색 구름 테두리 + 노란 세로획
//  'mark-dark'  (A) 남색 바탕용: 흰 구름 테두리 + 노란 세로획
//  'icon'       (B) 앱 아이콘: 남색 판 + 갈라진 흰 구름
// 원본: brand/make.py — 모양을 바꾸면 여기도 같이 바꾼다.

function CloudShapes() {
  return (
    <>
      <Circle cx={178} cy={284} r={56} />
      <Circle cx={256} cy={236} r={82} />
      <Circle cx={334} cy={284} r={56} />
      <Rect x={122} y={262} width={268} height={78} rx={39} />
    </>
  );
}

export function Logo({ size = 32, variant = 'mark-light' }: { size?: number; variant?: 'mark-light' | 'mark-dark' | 'icon' }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (variant === 'icon') {
    return (
      <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityLabel="운중고 로고">
        <Rect width={512} height={512} rx={115} fill={color.navy} />
        <Mask id={`s${id}`}>
          <Rect width={512} height={512} fill="#fff" />
          <Line x1={256} y1={140} x2={256} y2={380} stroke="#000" strokeWidth={30} strokeLinecap="round" />
        </Mask>
        <G fill="#fff" mask={`url(#s${id})`}>
          <CloudShapes />
        </G>
        <Line x1={256} y1={110} x2={256} y2={150} stroke={color.accent} strokeWidth={30} strokeLinecap="round" />
        <Line x1={256} y1={372} x2={256} y2={412} stroke={color.accent} strokeWidth={30} strokeLinecap="round" />
      </Svg>
    );
  }
  const ink = variant === 'mark-dark' ? '#FFFFFF' : color.navy;
  return (
    <Svg width={size} height={size} viewBox="64 80 384 352" accessibilityLabel="운중고 로고">
      <Mask id={`r${id}`}>
        <G fill="none" stroke="#fff" strokeWidth={52} strokeLinejoin="round">
          <CloudShapes />
        </G>
        <G fill="#000">
          <CloudShapes />
        </G>
      </Mask>
      <Rect width={512} height={512} fill={ink} mask={`url(#r${id})`} />
      <Line x1={256} y1={118} x2={256} y2={410} stroke={color.accent} strokeWidth={30} strokeLinecap="round" />
    </Svg>
  );
}
