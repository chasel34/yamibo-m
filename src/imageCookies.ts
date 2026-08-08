import React from 'react';
import { Platform } from 'react-native';
import { readForumCookieHeader } from './sessionCookies';
import { HOST } from './util';

// ---- 为什么图片要手动带 cookie（native 专有）----
// 论坛的 BAIDU_WAF 对**任何**不带 cookie 的请求先回 302 → 同一个 URL + `Set-Cookie: abymg_id=…`，
// 有 cookie jar 的客户端一跳就过，没有的则原地打转。浏览器和 tools/proxy.js 都有 jar，所以 web 正常。
// 而 expo-image 在 Android 走 Glide → `OkHttpClientProvider.createClient()`：那是个**新**的 client，
// 它的 ReactCookieJarContainer 从没被装上 ForwardingCookieHandler（只有 NetworkingModule 持有的单例
// 才会被装），于是既不带也不存 cookie —— 20 跳后 OkHttp 抛 ProtocolException，论坛的图全部加载失败
// （头像退回字母占位，正文图退回条纹占位）。
// 解决办法：从原生 cookie store（RN fetch 用的同一个 android.webkit.CookieManager）读出 cookie，
// 作为请求头交给 expo-image。CachedImage 统一处理，调用方无感。

let header = '';
let inflight: Promise<string> | null = null;
const listeners = new Set<() => void>();

export function forumCookieHeader(): string {
  return header;
}

// 重新读一次原生 cookie store；值变了就通知所有挂载中的 CachedImage 重新发请求。
export function refreshForumCookieHeader(): Promise<string> {
  if (Platform.OS === 'web') return Promise.resolve('');
  if (!inflight) {
    inflight = readForumCookieHeader().then((next) => {
      inflight = null;
      if (next && next !== header) {
        header = next;
        listeners.forEach((fn) => fn());
      }
      return header;
    }, () => {
      inflight = null;
      return header;
    });
  }
  return inflight;
}

// 退出登录后立刻丢掉手上的会话 cookie（refresh 会忽略空结果，防止偶发读空把好值冲掉）。
export function resetForumCookieHeader(): void {
  if (!header) return;
  header = '';
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// 只给论坛自家的 URL 带 cookie，别把会话泄给第三方图床。
export function isForumUrl(uri?: string | null): boolean {
  return !!uri && (uri === HOST || uri.startsWith(`${HOST}/`));
}

// 预取（ExpoImage.prefetch）走的是同一个没有 cookie jar 的 Glide client，不补头就会在 WAF 的
// 302 循环里空跑一趟、预读全白费，所以这里给出当前该带的请求头。
export async function forumImageHeaders(uri?: string | null): Promise<Record<string, string> | undefined> {
  if (Platform.OS === 'web' || !isForumUrl(uri)) return undefined;
  const cookie = header || await refreshForumCookieHeader();
  return cookie ? { Cookie: cookie } : undefined;
}

export function useForumCookieHeader(uri?: string | null): string {
  const enabled = Platform.OS !== 'web' && isForumUrl(uri);
  const value = React.useSyncExternalStore(subscribe, forumCookieHeader, forumCookieHeader);
  React.useEffect(() => {
    if (enabled && !value) refreshForumCookieHeader();
  }, [enabled, value]);
  return enabled ? value : '';
}
