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

// Column wrapper that paints the theme background and reserves top safe-area
// space for the real system status bar.
export default function Screen({ children, withStatus = true, statusColor, style }: ScreenProps) {
  const { t } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: t.bg }, style]}>
      {withStatus && <StatusBar color={statusColor} />}
      {children}
    </View>
  );
}
