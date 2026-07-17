import React from 'react';
import { WebView } from 'react-native-webview';

export interface ReaderSurfaceProps {
  html: string;
  backgroundColor: string;
  onMessage: (data: string) => void;
}

export interface ReaderSurfaceHandle {
  post(cmd: object): void;
}

const ReaderSurface = React.forwardRef<ReaderSurfaceHandle, ReaderSurfaceProps>(
  ({ html, backgroundColor, onMessage }, ref) => {
    const webViewRef = React.useRef<WebView>(null);
    React.useImperativeHandle(ref, () => ({
      // 字号/主题走注入更新，不换 source（换 source 会 reload 白闪）。
      post(cmd) {
        webViewRef.current?.injectJavaScript(`window.__readerCmd && window.__readerCmd(${JSON.stringify(cmd)});true;`);
      },
    }), []);
    return (
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={(event) => onMessage(event.nativeEvent.data)}
        javaScriptEnabled
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        // WebView 渲染进程被系统回收（安卓低内存/iOS 后台）时自动重载 shell；
        // shell 重新发 ready，Reader 侧会按 targetRef 重建窗口，阅读位置不丢。
        onRenderProcessGone={() => webViewRef.current?.reload()}
        onContentProcessDidTerminate={() => webViewRef.current?.reload()}
        style={{ flex: 1, backgroundColor }}
      />
    );
  },
);

export default ReaderSurface;
