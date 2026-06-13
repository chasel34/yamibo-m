import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { StatusBar } from './ui';

interface ScreenProps {
  children?: React.ReactNode;
  withStatus?: boolean;
  statusColor?: string;
  style?: StyleProp<ViewStyle>;
}

// Column wrapper that paints the theme background and renders the faux status bar
// at the top, mirroring how every screen in the design starts with <StatusBar/>.
export default function Screen({ children, withStatus = true, statusColor, style }: ScreenProps) {
  const { t } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: t.bg }, style]}>
      {withStatus && <StatusBar color={statusColor} />}
      {children}
    </View>
  );
}
