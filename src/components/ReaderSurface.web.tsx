import React from 'react';

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
    const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
    React.useImperativeHandle(ref, () => ({
      // sandbox="allow-scripts" 的 iframe 是不透明 origin，只能 postMessage 通信（不能 eval/contentDocument）。
      post(cmd) {
        iframeRef.current?.contentWindow?.postMessage({ __yamiboReaderCmd: cmd }, '*');
      },
    }), []);
    React.useEffect(() => {
      const receive = (event: MessageEvent) => {
        if (event.source !== iframeRef.current?.contentWindow) return;
        const payload = event.data;
        if (payload && payload.__yamiboReader && typeof payload.data === 'string') onMessage(payload.data);
      };
      window.addEventListener('message', receive);
      return () => window.removeEventListener('message', receive);
    }, [onMessage]);

    return React.createElement('iframe', {
      ref: iframeRef,
      srcDoc: html,
      title: '阅读正文',
      // Drop allow-same-origin: an allow-scripts+allow-same-origin srcDoc iframe inherits
      // the app's origin and could reach parent DOM/storage if any forum-controlled field
      // ever slipped past esc(). The reader script only needs postMessage(…, '*') (which
      // works from an opaque origin) and the parent authenticates by event.source, so
      // isolating the frame to an opaque origin is functionally inert but safer.
      sandbox: 'allow-scripts',
      style: {
        display: 'block',
        width: '100%',
        height: '100%',
        border: 0,
        backgroundColor,
      },
    });
  },
);

export default ReaderSurface;
