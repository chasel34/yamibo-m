import React from 'react';
import { Image as ExpoImage } from 'expo-image';
import type { ImageProps, ImageSource } from 'expo-image';
import { isForumUrl, refreshForumCookieHeader, useForumCookieHeader } from '../imageCookies';

// expo-image 包一层，固化全站统一的性能策略：内存+磁盘缓存 + Coil 式降采样（安卓解码/内存
// 收益）。其余 props（source / contentFit / recyclingKey / onLoad / style …）透传，调用方按需给。
// 调整缓存/降采样策略改这一处即可，避免阅读器、帖子正文图、头像三处各写一份而漂移。
//
// 另外在这里统一给论坛自家的图片补上 `Cookie` 请求头 —— expo-image 的 Glide client 没有 cookie jar，
// 不带 cookie 会被 WAF 的 302 循环卡死，原因详见 src/imageCookies.ts。
function sourceUri(source: ImageProps['source']): string | undefined {
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object' && !Array.isArray(source)) return (source as ImageSource).uri;
  return undefined;
}

export default function CachedImage({ source, onError, ...rest }: ImageProps) {
  const uri = sourceUri(source);
  const cookie = useForumCookieHeader(uri);

  const withCookie = React.useMemo<ImageProps['source']>(() => {
    if (!cookie || !uri) return source;
    const base: ImageSource = typeof source === 'string' ? { uri: source } : { ...(source as ImageSource) };
    return { ...base, headers: { ...base.headers, Cookie: cookie } };
  }, [source, cookie, uri]);

  // cookie 过期/尚未落库时先失败一次是正常的：重读一遍 cookie store，拿到新值就换 header 自动重试
  // （source 变了 expo-image 会自己重新请求），只有确实没有新 cookie 才把失败报给调用方去显示占位图。
  const handleError = React.useCallback(async (e: any) => {
    if (isForumUrl(uri)) {
      const before = cookie;
      const next = await refreshForumCookieHeader();
      if (next && next !== before) return;
    }
    onError?.(e);
  }, [uri, cookie, onError]);

  return <ExpoImage cachePolicy="memory-disk" allowDownscaling source={withCookie} onError={handleError} {...rest} />;
}
