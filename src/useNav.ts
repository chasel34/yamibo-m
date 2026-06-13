import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useToast, useAuth } from './context';
import { useTheme } from './theme';
import type { ThreadImage } from './types';

// Bridges the design's `nav` API (push/pop/switchTab/openViewer/toast/login/logout/theme)
// onto React Navigation, so the ported screens read 1:1 against app/*.jsx.
export function useNav() {
  const navigation = useNavigation<any>();
  const { toast } = useToast();
  const { enter, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  return React.useMemo(() => ({
    push: (screen: string, params?: object) => {
      if (typeof navigation.push === 'function') navigation.push(screen, params || {});
      else navigation.navigate(screen, params || {});
    },
    pop: () => navigation.goBack(),
    switchTab: (tab: string) => navigation.navigate('tabs', { screen: tab }),
    openViewer: (images: ThreadImage[], index?: number) => navigation.navigate('viewer', { images, index: index || 0 }),
    closeViewer: () => navigation.goBack(),
    toast,
    enter,         // mark session active (guest or after real login)
    login: enter,  // alias kept for guest-browse button
    logout,
    theme,
    setTheme,
  }), [navigation, toast, enter, logout, theme, setTheme]);
}
