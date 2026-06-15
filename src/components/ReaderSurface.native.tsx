import React from 'react';
import { WebView } from 'react-native-webview';

export interface ReaderSurfaceProps {
  html: string;
  backgroundColor: string;
  onMessage: (data: string) => void;
}

export default function ReaderSurface({ html, backgroundColor, onMessage }: ReaderSurfaceProps) {
  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      onMessage={(event) => onMessage(event.nativeEvent.data)}
      javaScriptEnabled
      bounces={false}
      overScrollMode="never"
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1, backgroundColor }}
    />
  );
}
