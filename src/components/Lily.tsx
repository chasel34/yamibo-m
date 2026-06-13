import Svg, { Path, Circle } from 'react-native-svg';

interface LilyProps {
  size?: number;
  stroke?: number;
  color?: string;
}

// Original lily line-mark logo, ported 1:1 from app/ui.jsx.
export default function Lily({ size = 46, stroke = 1.7, color = '#ad473c' }: LilyProps) {
  const p = { stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {/* back petals */}
      <Path {...p} d="M32 34C24 30 17 22 18 13c7 0 13 6 14 14" opacity={0.55} />
      <Path {...p} d="M32 34C40 30 47 22 46 13c-7 0-13 6-14 14" opacity={0.55} />
      {/* front three petals */}
      <Path {...p} d="M32 36C26 31 22 22 25 13c5 2 8 9 7 16" />
      <Path {...p} d="M32 36c6-5 10-14 7-23-5 2-8 9-7 16" />
      <Path {...p} d="M32 11c-3 4-4 13-1 19" />
      <Path {...p} d="M32 11c3 4 4 13 1 19" />
      {/* stamens */}
      <Path {...p} d="M32 36c0 6-1 11-1 11M32 36c-3 5-5 8-5 8M32 36c3 5 5 8 5 8" />
      <Circle cx="31" cy="48.5" r="1.3" fill={color} />
      <Circle cx="26.5" cy="45" r="1.3" fill={color} />
      <Circle cx="37.5" cy="45" r="1.3" fill={color} />
      {/* stem */}
      <Path {...p} d="M32 47c0 6-1 9-4 12" opacity={0.5} />
    </Svg>
  );
}
