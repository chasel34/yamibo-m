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
    sandbox: 'allow-scripts allow-same-origin',
    style: {
      display: 'block',
      width: '100%',
      height: '100%',
      border: 0,
      backgroundColor,
    },
  });
}
