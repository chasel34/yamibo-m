import React from 'react';

export interface ReaderSurfaceProps {
  html: string;
  backgroundColor: string;
  onMessage: (data: string) => void;
}

export default function ReaderSurface({ html, backgroundColor, onMessage }: ReaderSurfaceProps) {
  const ref = React.useRef<HTMLIFrameElement | null>(null);
  React.useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== ref.current?.contentWindow) return;
      const payload = event.data;
      if (payload && payload.__yamiboReader && typeof payload.data === 'string') onMessage(payload.data);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onMessage]);

  return React.createElement('iframe', {
    ref,
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
}
