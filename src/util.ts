// Helpers for turning Discuz mobile API payloads into the shapes the UI wants:
// resource URLs, time formatting, group-title color text, and HTML → block parsing.
import type { Block } from './types';

export const HOST = 'https://bbs.yamibo.com';

// ---- avatar (§5.1). avatar.php follows the redirect to the real/default image. ----
export function avatarUrl(uid?: string | null, size = 'middle'): string | null {
  if (!uid || uid === '0') return null;
  return `${HOST}/uc_server/avatar.php?uid=${uid}&size=${size}`;
}

// ---- absolute-ize a possibly-relative forum URL ----
export function absUrl(u?: string | null): string | null {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return HOST + '/' + String(u).replace(/^\//, '');
}

// ---- decode the HTML entities emitted by Discuz (sometimes double-encoded) ----
const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&rsaquo;': '›', '&lsaquo;': '‹', '&hellip;': '…', '&mdash;': '—',
};
const ENTITY_RE = /&(?:nbsp|amp|lt|gt|quot|#39|apos|rsaquo|lsaquo|hellip|mdash);/g;
export function decodeEntities(s?: string | null): string {
  if (!s) return '';
  let decoded = s;
  for (let i = 0; i < 3; i += 1) {
    const next = decoded.replace(ENTITY_RE, (m) => ENTITIES[m] ?? m);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

// Discuz smiley codes leak into text when not rendered as images, e.g. {:1_740:}.
const SMILEY_CODE_RE = /\{:[\w]+_\d+:\}/g;

// ---- strip tags → plain text (keeps line breaks) ----
export function stripHtml(html?: string | null): string {
  if (!html) return '';
  let s = String(html)
    // Drop <style>/<script> blocks entirely — their inner CSS/JS text must not
    // leak into the body (e.g. Discuz 折叠/showcollapse injects a <style> block).
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(?:span|font)\b[^>]*(?:display\s*:\s*none|class\s*=\s*["']jammer["'])[^>]*>[\s\S]*?<\/(?:span|font)>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s).replace(SMILEY_CODE_RE, '');
  return s.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---- one-line preview snippet for list rows (board / collections) ----
// forumdisplay's `message` is the OP body: it carries the "本帖最后由 … 编辑" edit
// marker, attachment placeholders, and hard line breaks that the forum's own list
// view strips. Collapse it to a clean single line.
export function excerptText(html?: string | null): string {
  return stripHtml(html)
    .replace(/^本帖最后由[^\n]*?编辑\s*/, '')          // drop leading edit marker
    .replace(/\[(?:图片附件|附件|本帖隐藏的内容|媒体)\]/g, '') // drop placeholders
    .replace(/\s+/g, ' ')
    .trim();
}

// group{grouptitle} is HTML like <font color="6E2B19">百合幼苗</font>
export function groupTitleText(group?: string | { grouptitle?: string } | null): string {
  if (!group) return '';
  const raw = typeof group === 'string' ? group : (group.grouptitle || '');
  return stripHtml(raw);
}

// ---- relative time from a unix-seconds string/number ----
export function timeFromUnix(sec?: string | number | null): string {
  const n = parseInt(String(sec), 10);
  if (!n) return '';
  const now = Date.now() / 1000;
  const diff = now - n;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  if (diff < 86400 * 2) return '昨天';
  if (diff < 86400 * 30) return Math.floor(diff / 86400) + '天前';
  const d = new Date(n * 1000);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const SMILEY_RE = /(\/static\/image\/smiley\/|none\.gif|spacer\.gif)/i;

function imgUrlFromTag(tag: string): string | null {
  // Discuz lazy-loads big images via file="..."; src may be a placeholder.
  const file = (tag.match(/\bfile="([^"]+)"/i) || [])[1];
  const src = (tag.match(/\bsrc="([^"]+)"/i) || [])[1];
  let url = file || src;
  if (file && src && SMILEY_RE.test(src) && !SMILEY_RE.test(file)) url = file;
  return url ? absUrl(url) : null;
}

// ---- a Discuz postlist[].attachments[aid] entry (only fields we use) ----
export interface Attachment {
  aid?: string;
  attachment?: string;
  url?: string;
  remote?: string;
  isimage?: string;
  description?: string;
  filename?: string;
  width?: string;
  height?: string;
}

// ---- full URL for a postlist[].attachments[aid] entry ----
export function attachmentUrl(att?: Attachment | null): string | null {
  if (!att) return null;
  const path = att.attachment || '';
  if (/^https?:\/\//i.test(path)) return path;
  return absUrl((att.url || 'data/attachment/forum/') + path);
}

// ---- parse a postlist[].message HTML into ordered blocks ----
// blocks: {t:'text',v} | {t:'img',src,cap} | {t:'quote',who,v}
// `attachments`/`imagelist` come from the same post: image attachments that the
// author uploaded but did NOT embed inline are appended after the body, the way
// Discuz renders them on the web.
export function parseMessage(
  html?: string | null,
  attachments?: Record<string, Attachment> | null,
  imagelist?: string[] | null,
): Block[] {
  if (!html && !attachments) return [];
  const body = html || '';
  const blocks: Block[] = [];
  const pushText = (chunk: string) => {
    const v = stripHtml(chunk);
    if (!v) return;
    const urlRe = /https?:\/\/[^\s<>"']+/gi;
    let lastUrl = 0;
    let urlMatch: RegExpExecArray | null;
    while ((urlMatch = urlRe.exec(v))) {
      const before = v.slice(lastUrl, urlMatch.index);
      if (before) blocks.push({ t: 'text', v: before });
      let href = urlMatch[0];
      const trailing = href.match(/[),.;!?，。；！？）]+$/)?.[0] || '';
      if (trailing) href = href.slice(0, -trailing.length);
      blocks.push({ t: 'link', v: href, href });
      if (trailing) blocks.push({ t: 'text', v: trailing });
      lastUrl = urlMatch.index + urlMatch[0].length;
    }
    const rest = v.slice(lastUrl);
    if (rest) blocks.push({ t: 'text', v: rest });
  };
  const re = /<blockquote[\s\S]*?<\/blockquote>|<a\b[^>]*>[\s\S]*?<\/a>|<img\b[^>]*>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    pushText(body.slice(last, m.index));
    const tag = m[0];
    if (/^<blockquote/i.test(tag)) {
      const fontMatch = tag.match(/<font[^>]*>([\s\S]*?)<\/font>/i);
      let who = '';
      let bodyHtml = tag;
      if (fontMatch) {
        const attribution = stripHtml(fontMatch[1]);
        who = attribution.split(/\s*发表于\s*/)[0].trim();
        bodyHtml = tag.replace(fontMatch[0], '');
      }
      const v = stripHtml(bodyHtml);
      blocks.push({ t: 'quote', who, v });
    } else if (/^<a/i.test(tag)) {
      const href = decodeEntities((tag.match(/\bhref=["']([^"']+)["']/i) || [])[1] || '');
      const v = stripHtml(tag) || href;
      if (href) blocks.push({ t: 'link', v, href: absUrl(href) || href });
      else pushText(tag);
    } else {
      const src = imgUrlFromTag(tag);
      if (src && !SMILEY_RE.test(src)) blocks.push({ t: 'img', src, cap: '图片' });
    }
    last = re.lastIndex;
  }
  pushText(body.slice(last));

  // Append image attachments that weren't embedded inline above.
  if (attachments) {
    const shown = blocks.filter((b) => b.t === 'img').map((b) => b.src || '');
    const order = (Array.isArray(imagelist) && imagelist.length) ? imagelist : Object.keys(attachments);
    order.forEach((aid) => {
      const a = attachments[aid];
      if (!a || a.isimage !== '1') return;
      const url = attachmentUrl(a);
      const path = a.attachment || '';
      const inline = shown.some((s) => s !== '' && (s === url || (path !== '' && s.indexOf(path) >= 0)));
      if (!inline) blocks.push({
        t: 'img',
        src: url,
        cap: a.description || a.filename || '图片',
        width: parseInt(a.width || '0', 10) || undefined,
        height: parseInt(a.height || '0', 10) || undefined,
      });
    });
  }

  return blocks.length ? blocks : [{ t: 'text', v: stripHtml(body) }];
}
