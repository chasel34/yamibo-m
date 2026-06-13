import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Polygon, Rect } from 'react-native-svg';

// Icon set ported 1:1 from app/ui.jsx (SVG paths preserved verbatim).
// Defined once at module scope (not rebuilt every render); `c` is the currentColor
// used by the few icons with inline fills.
const ICONS: Record<string, (c: string) => React.ReactElement> = {
  search: () => <><Circle cx="11" cy="11" r="7" /><Line x1="21" y1="21" x2="16.7" y2="16.7" /></>,
  gear: () => <><Circle cx="12" cy="12" r="3.2" /><Path d="M19.4 13.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1A2 2 0 1 1 6.9 4.5l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 .9-1.4V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5.9z" /></>,
  back: () => <Polyline points="15 5 8 12 15 19" />,
  close: () => <><Line x1="6" y1="6" x2="18" y2="18" /><Line x1="18" y1="6" x2="6" y2="18" /></>,
  check: () => <Polyline points="5 12.5 10 17.5 19.5 6.5" />,
  heart: () => <Path d="M19 8.5c0 4-7 9.5-7 9.5s-7-5.5-7-9.5a3.7 3.7 0 0 1 7-1.6 3.7 3.7 0 0 1 7 1.6z" />,
  share: () => <><Circle cx="6" cy="12" r="2.4" /><Circle cx="17" cy="6" r="2.4" /><Circle cx="17" cy="18" r="2.4" /><Line x1="8" y1="11" x2="15" y2="7" /><Line x1="8" y1="13" x2="15" y2="17" /></>,
  reply: () => <><Polyline points="9 7 4 12 9 17" /><Path d="M4 12h9a6 6 0 0 1 6 6v1" /></>,
  forum: () => <Path d="M4 5h16v10H9l-4 4V5z" />,
  bell: () => <><Path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 8-2.5 8h17S18 15 18 9z" /><Path d="M10.5 21a2 2 0 0 0 3 0" /></>,
  mail: () => <><Rect x="3" y="5" width="18" height="14" rx="2.5" /><Path d="M3.5 7 12 13l8.5-6" /></>,
  user: () => <><Circle cx="12" cy="8.5" r="3.7" /><Path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" /></>,
  users: () => <><Circle cx="9" cy="8.5" r="3.2" /><Path d="M2.5 20c0-3.3 2.9-5 6.5-5s6.5 1.7 6.5 5" /><Path d="M16 5.2a3.2 3.2 0 0 1 0 6.4" /><Path d="M17.5 15.2c2.6.5 4 2.2 4 4.8" /></>,
  infinity: () => <Path d="M6.5 9.5c-2 0-3.5 1.1-3.5 2.5s1.5 2.5 3.5 2.5c3 0 5-5 8-5 2 0 3.5 1.1 3.5 2.5s-1.5 2.5-3.5 2.5c-3 0-5-5-8-5z" />,
  star: () => <Polygon points="12 4 14.2 9.2 19.8 9.6 15.5 13.2 16.9 18.6 12 15.6 7.1 18.6 8.5 13.2 4.2 9.6 9.8 9.2" />,
  chevDown: () => <Polyline points="6 9.5 12 15.5 18 9.5" />,
  chevRight: () => <Polyline points="9.5 6 15.5 12 9.5 18" />,
  lock: () => <><Rect x="5" y="11" width="14" height="9" rx="2.4" /><Path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  eye: () => <><Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><Circle cx="12" cy="12" r="2.6" /></>,
  bookmark: () => <Path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.2L6 20V5a1 1 0 0 1 1-1z" />,
  history: () => <><Path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><Polyline points="3 3.5 3 8 7.5 8" /><Polyline points="12 7.5 12 12 15.5 14" /></>,
  info: (c) => <><Circle cx="12" cy="12" r="9" /><Line x1="12" y1="11" x2="12" y2="16.5" /><Circle cx="12" cy="7.8" r="0.4" fill={c} /></>,
  logout: () => <><Path d="M14 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8" /><Polyline points="17 8 21 12 17 16" /><Line x1="21" y1="12" x2="9" y2="12" /></>,
  at: () => <><Circle cx="12" cy="12" r="4" /><Path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1" /></>,
  pin: () => <><Path d="M9 4h6l-1 5 3 3v2h-5v5l-1 1-1-1v-5H4v-2l3-3z" /></>,
  bell2: () => <><Path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 8-2.5 8h17S18 15 18 9z" /></>,
  sprout: () => <><Path d="M12 20v-7" /><Path d="M12 13c0-3 2-5 5-5 0 3-2 5-5 5z" /><Path d="M12 14c0-3-2.2-5.2-5.2-5.2 0 3 2.2 5.2 5.2 5.2z" /></>,
  sparkle: () => <><Path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" /><Path d="M18.5 16l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7z" /></>,
  wave: () => <><Path d="M3 8c2 0 2 2 4.5 2S10 8 12 8s2 2 4.5 2S19 8 21 8" /><Path d="M3 13c2 0 2 2 4.5 2S10 13 12 13s2 2 4.5 2S19 13 21 13" /></>,
  book: () => <><Path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><Path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5A2.5 2.5 0 0 1 20 21.5z" /></>,
  game: (c) => <><Rect x="2.5" y="7" width="19" height="10" rx="4" /><Line x1="7" y1="11" x2="7" y2="13" /><Line x1="6" y1="12" x2="8" y2="12" /><Circle cx="16" cy="11.5" r="0.6" fill={c} /><Circle cx="18" cy="13.5" r="0.6" fill={c} /></>,
  film: () => <><Rect x="3" y="4" width="18" height="16" rx="2.5" /><Line x1="8" y1="4" x2="8" y2="20" /><Line x1="16" y1="4" x2="16" y2="20" /><Line x1="3" y1="12" x2="21" y2="12" /></>,
  box: () => <><Path d="M3.5 8 12 4l8.5 4-8.5 4z" /><Path d="M3.5 8v8L12 20l8.5-4V8" /><Line x1="12" y1="12" x2="12" y2="20" /></>,
  doc: () => <><Path d="M7 3h7l4 4v14H7z" /><Polyline points="14 3 14 7 18 7" /></>,
  refresh: () => <><Polyline points="20 5 20 10 15 10" /><Path d="M19 10A8 8 0 1 0 20 14" /></>,
  moon: () => <Path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
  type: () => <><Polyline points="4 7 4 5 20 5 20 7" /><Line x1="12" y1="5" x2="12" y2="19" /><Line x1="9" y1="19" x2="15" y2="19" /></>,
  trash: () => <><Polyline points="4 7 20 7" /><Path d="M6 7l1 13h10l1-13" /><Path d="M9.5 7V4.5h5V7" /></>,
  download: () => <><Path d="M12 4v11" /><Polyline points="7 11 12 16 17 11" /><Line x1="5" y1="20" x2="19" y2="20" /></>,
  zoom: () => <><Circle cx="11" cy="11" r="7" /><Line x1="21" y1="21" x2="16.7" y2="16.7" /><Line x1="11" y1="8.5" x2="11" y2="13.5" /><Line x1="8.5" y1="11" x2="13.5" y2="11" /></>,
};

interface IconProps {
  name: string;
  size?: number;
  stroke?: number;
  fill?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export default function Icon({ name, size = 22, stroke = 1.7, fill = 'none', color = '#000', style }: IconProps) {
  const render = ICONS[name];
  return (
    <Svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={fill} stroke={color} strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" style={style}
    >
      {render ? render(color) : null}
    </Svg>
  );
}
