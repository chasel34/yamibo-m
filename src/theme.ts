import React from 'react';
import { Platform, ViewStyle } from 'react-native';
import type { ThemeName } from './types';

// ===== Font stacks (ported from 百合会.html --font-head / --font-body) =====
// Heading: system sans. Body: serif (Songti SC on iOS/web mac, serif on Android).
export const FONTS = {
  head: Platform.select({
    ios: 'PingFang SC',
    android: 'sans-serif',
    default: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", system-ui, sans-serif',
  }),
  headMedium: Platform.select({
    ios: 'PingFang SC',
    android: 'sans-serif-medium',
    default: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", system-ui, sans-serif',
  }),
  body: Platform.select({
    ios: 'Songti SC',
    android: 'serif',
    default: '"Noto Serif SC", "Songti SC", Georgia, "Times New Roman", serif',
  }),
};

// ===== Shared radii / sizes (ported from :root) =====
export const RADII = { lg: 22, md: 16, sm: 11 };
export const TAB_H = 84;

// ===== Light theme (html[data-theme="light"]) =====
export const light = {
  name: 'light',
  bg: '#fcfbfa',
  bgGradTop: '#f7f5f3',
  bgGradBot: '#fcfbfa',
  card: '#ffffff',
  card2: '#f1eeec',
  field: '#f0ecea',
  ink: '#2a221f',
  ink2: '#4a3d37',
  inkSoft: '#806a62',
  muted: '#a08a82',
  faint: '#bcaaa1',
  accent: '#ad473c',
  accentInk: '#ad473c',
  accentSoft: '#f0ddd7',
  accentSoft2: '#f3e6e0',
  line: 'rgba(74,48,40,0.07)',
  lineStrong: 'rgba(74,48,40,0.12)',
  toggleOff: '#d6cbc3',
  statusbar: '#2a221f',
  stripeA: 'rgba(120,90,80,0.09)',
  stripeB: 'rgba(120,90,80,0.04)',
  // accent text on filled accent (pills/buttons): light uses #fff
  onAccent: '#ffffff',
  frame: '#c4c0bc',
};

// A theme is the set of color tokens (shape of `light`).
export type Theme = typeof light;

// ===== Dark theme (html[data-theme="dark"]) =====
export const dark: Theme = {
  name: 'dark',
  bg: '#17120f',
  bgGradTop: '#221915',
  bgGradBot: '#17120f',
  card: '#211a16',
  card2: '#2a221d',
  field: '#2c241f',
  ink: '#f1e8e3',
  ink2: '#dccfc7',
  inkSoft: '#b59e94',
  muted: '#8a746b',
  faint: '#6a564f',
  accent: '#e0897b',
  accentInk: '#e0897b',
  accentSoft: 'rgba(224,137,123,0.15)',
  accentSoft2: 'rgba(224,137,123,0.10)',
  line: 'rgba(255,238,232,0.07)',
  lineStrong: 'rgba(255,238,232,0.13)',
  toggleOff: '#443a33',
  statusbar: '#f1e8e3',
  stripeA: 'rgba(224,137,123,0.14)',
  stripeB: 'rgba(224,137,123,0.06)',
  // dark uses dark ink on the light accent (html[data-theme="dark"] .pill-active{color:#241a16})
  onAccent: '#241a16',
  frame: '#100c0a',
};

export const THEMES: Record<ThemeName, Theme> = { light, dark };

// ===== Theme context =====
export interface ThemeContextValue {
  t: Theme;
  theme: ThemeName;
  setTheme: (name: ThemeName) => void;
}
export const ThemeContext = React.createContext<ThemeContextValue>({ t: light, theme: 'light', setTheme: () => {} });
export const useTheme = () => React.useContext(ThemeContext);

// ===== Shadow helpers (ported from --shadow-card / --shadow-pop) =====
export function cardShadow(theme: string): ViewStyle | undefined {
  if (theme === 'dark') {
    return Platform.select<ViewStyle>({
      android: { elevation: 6 },
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 },
      },
    });
  }
  return Platform.select<ViewStyle>({
    android: { elevation: 2 },
    default: {
      shadowColor: 'rgba(90,52,42,1)',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 4 },
    },
  });
}
