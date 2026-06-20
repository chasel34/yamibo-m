// Helpers for turning Discuz mobile API payloads into the shapes the UI wants:
// resource URLs, time formatting, group-title color text, and HTML → block parsing.
import type { Block, RichTextRun } from './types';

export const HOST = 'https://bbs.yamibo.com';

// ---- avatar (§5.1). avatar.php follows the redirect to the real/default image. ----
export function avatarUrl(uid?: string | null, size = 'middle'): string | null {
  if (!uid || uid === '0') return null;
  return `${HOST}/uc_server/avatar.php?uid=${uid}&size=${size}`;
}

// ---- absolute-ize a possibly-relative forum URL ----
export function absUrl(u?: string | null): string | null {
  if (!u) return null;
  const value = decodeEntities(String(u)).trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^\/\//.test(value)) return `https:${value}`;
  // Discuz often uses javascript:; for UI-only toggles. Keep non-web schemes
  // out of app link handlers; ordinary relative paths continue through URL().
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  try {
    const url = new URL(value, `${HOST}/`);
    return /^https?:$/i.test(url.protocol) ? url.toString() : null;
  } catch (e) {
    return HOST + '/' + value.replace(/^\//, '');
  }
}

// ---- decode the HTML entities emitted by Discuz (sometimes double-encoded) ----
const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&rsaquo;': '›', '&lsaquo;': '‹', '&hellip;': '…', '&mdash;': '—',
};
const ENTITY_RE = /&(?:nbsp|amp|lt|gt|quot|#39|apos|rsaquo|lsaquo|hellip|mdash);/g;
export function decodeEntities(s?: string | null): string {
  if (!s) return '';
  const decodeCodePoint = (_m: string, n: string, radix: number) => {
    const cp = parseInt(n, radix);
    if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return _m;
    try {
      return String.fromCodePoint(cp);
    } catch (e) {
      return _m;
    }
  };
  let decoded = s;
  for (let i = 0; i < 3; i += 1) {
    const next = decoded
      .replace(/&#(\d+);/g, (m, n) => decodeCodePoint(m, n, 10))
      .replace(/&#x([0-9a-f]+);/gi, (m, n) => decodeCodePoint(m, n, 16))
      .replace(ENTITY_RE, (m) => ENTITIES[m] ?? m);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

// Discuz smiley codes leak into text when not rendered as images, e.g. {:1_740:}.
const SMILEY_CODE_RE = /\{:[\w]+_\d+:\}/g;

// ---- strip tags → plain text (keeps line breaks) ----
function stripHtmlText(html?: string | null, trim = true): string {
  if (!html) return '';
  let s = sanitizeHtml(String(html))
    // Drop <style>/<script> blocks entirely — their inner CSS/JS text must not
    // leak into the body (e.g. Discuz 折叠/showcollapse injects a <style> block).
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(?:span|font)\b[^>]*(?:display\s*:\s*none|class\s*=\s*["']jammer["'])[^>]*>[\s\S]*?<\/(?:span|font)>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s).replace(SMILEY_CODE_RE, '');
  const normalized = s.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return trim ? normalized.trim() : normalized;
}

export function stripHtml(html?: string | null): string {
  return stripHtmlText(html, true);
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
const IMAGE_EXT_RE = /\.(?:jpe?g|png|gif|webp|bmp|avif)(?:[?#].*)?$/i;

function sanitizeHtml(html: string): string {
  return html
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(?:span|font)\b[^>]*(?:display\s*:\s*none|class\s*=\s*["']jammer["'])[^>]*>[\s\S]*?<\/(?:span|font)>/gi, '');
}

function attr(tag: string, name: string): string {
  return decodeEntities((tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i')) || [])[1] || '');
}

function imgUrlFromTag(tag: string): string | null {
  // Discuz lazy-loads big images via file="..."; src may be a placeholder.
  const file = attr(tag, 'file');
  const src = attr(tag, 'src');
  let url = file || src;
  if (file && src && SMILEY_RE.test(src) && !SMILEY_RE.test(file)) url = file;
  return url ? absUrl(url) : null;
}

function isImageAttachment(att?: Attachment | null): boolean {
  if (!att) return false;
  const width = parseInt(att.width || '0', 10);
  const height = parseInt(att.height || '0', 10);
  const filename = att.filename || att.imgalt || att.attachment || '';
  return att.isimage === '1'
    || att.attachimg === '1'
    || IMAGE_EXT_RE.test(filename)
    || IMAGE_EXT_RE.test(att.attachment || '')
    || ((width > 0 || height > 0) && IMAGE_EXT_RE.test(filename || att.attachment || ''));
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
  filesize?: string;
  size?: string;
  attachimg?: string;
  ext?: string;
  imgalt?: string;
  attachsize?: string;
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

function sameRunStyle(a: RichTextRun, b: RichTextRun): boolean {
  return a.href === b.href && a.bold === b.bold && a.tone === b.tone && a.size === b.size;
}

function pushRun(runs: RichTextRun[], run: RichTextRun) {
  const v = stripHtmlText(run.v, false);
  if (!v.trim()) return;
  const clean: RichTextRun = { ...run, v };
  const prev = runs[runs.length - 1];
  if (prev && sameRunStyle(prev, clean)) {
    prev.v += clean.v;
    return;
  }
  runs.push(clean);
}

function pushRunsWithUrls(runs: RichTextRun[], value: string, style: Omit<RichTextRun, 'v'>) {
  const v = stripHtmlText(value, false);
  if (!v.trim()) return;
  const urlRe = /https?:\/\/[^\s<>"']+/gi;
  let lastUrl = 0;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlRe.exec(v))) {
    const before = v.slice(lastUrl, urlMatch.index);
    if (before) pushRun(runs, { ...style, v: before });
    let href = urlMatch[0];
    const trailing = href.match(/[),.;!?，。；！？）]+$/)?.[0] || '';
    if (trailing) href = href.slice(0, -trailing.length);
    pushRun(runs, { ...style, v: href, href });
    if (trailing) pushRun(runs, { ...style, v: trailing });
    lastUrl = urlMatch.index + urlMatch[0].length;
  }
  const rest = v.slice(lastUrl);
  if (rest) pushRun(runs, { ...style, v: rest });
}

function tagStyle(tag: string): Omit<RichTextRun, 'v'> {
  const lower = tag.toLowerCase();
  const style = attr(tag, 'style').toLowerCase();
  const color = (attr(tag, 'color') || (style.match(/color\s*:\s*([^;]+)/i) || [])[1] || '').toLowerCase();
  const fontSize = (attr(tag, 'size') || (style.match(/font-size\s*:\s*([^;]+)/i) || [])[1] || '').toLowerCase();
  const run: Omit<RichTextRun, 'v'> = {};
  if (/^<(?:strong|b)\b/i.test(tag) || /font-weight\s*:\s*(?:bold|[6-9]00)/i.test(style)) run.bold = true;
  if (color) {
    if (/999|888|777|666|gray|grey|inherit/.test(color)) run.tone = 'muted';
    else run.tone = 'accent';
  }
  if (/^[-+]?[1-2]$|1[0-3]px|x-small|small/i.test(fontSize)) run.size = 'small';
  if (/^\+?[5-9]$|2[0-9]px|large|x-large/i.test(fontSize)) run.size = 'large';
  return run;
}

function mergeStyle(base: Omit<RichTextRun, 'v'>, next: Omit<RichTextRun, 'v'>): Omit<RichTextRun, 'v'> {
  return {
    href: next.href || base.href,
    bold: base.bold || next.bold || undefined,
    tone: next.tone || base.tone,
    size: next.size || base.size,
  };
}

function richRunsFromHtml(html: string, baseStyle: Omit<RichTextRun, 'v'> = {}): RichTextRun[] {
  const source = sanitizeHtml(html);
  const runs: RichTextRun[] = [];
  const stack: Omit<RichTextRun, 'v'>[] = [baseStyle];
  const current = () => stack[stack.length - 1] || {};
  const re = /<\/?(?:a|strong|b|font|span)\b[^>]*>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    pushRunsWithUrls(runs, source.slice(last, m.index), current());
    const tag = m[0];
    if (/^<\//.test(tag)) {
      if (stack.length > 1) stack.pop();
    } else {
      const href = /^<a\b/i.test(tag) ? (absUrl(attr(tag, 'href')) || undefined) : undefined;
      stack.push(mergeStyle(current(), { ...tagStyle(tag), href }));
    }
    last = re.lastIndex;
  }
  pushRunsWithUrls(runs, source.slice(last), current());
  return runs;
}

function hasRichMarkup(html: string): boolean {
  return /<(?:strong|b|font|span|a)\b/i.test(sanitizeHtml(html)) || /https?:\/\//i.test(stripHtml(html));
}

function richTextFromHtml(html: string): string {
  return richRunsFromHtml(html).map((run) => run.v).join('');
}

function tableFromHtml(html: string): string[][] {
  const rows: string[][] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html))) {
    const cells: string[] = [];
    const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      const text = richTextFromHtml(cellMatch[1]).replace(/\s+/g, ' ').trim();
      if (text) cells.push(text);
    }
    if (cells.length) rows.push(cells);
  }
  return rows.filter((row) => row.some(Boolean));
}

function quoteBlockFromHtml(html: string): Block | null {
  const href = attr(html, 'href') || attr((html.match(/<a\b[^>]*>/i) || [])[0] || '', 'href');
  const fontMatch = html.match(/<font[^>]*>([\s\S]*?)<\/font>/i);
  let who = '';
  let bodyHtml = html;
  if (fontMatch) {
    const attribution = stripHtml(fontMatch[1]);
    who = attribution.split(/\s*(?:发表于|發表於)\s*/)[0].trim();
    bodyHtml = bodyHtml.replace(fontMatch[0], '');
  }
  const v = stripHtml(bodyHtml);
  if (!v) return null;
  return { t: 'quote', who, v, href: href ? (absUrl(href) || undefined) : undefined };
}

// ---- parse a postlist[].message HTML into ordered blocks ----
// blocks: text/link/img/quote plus Discuz-specific notices and attachments.
// `attachments`/`imagelist` come from the same post: image attachments that the
// author uploaded but did NOT embed inline are appended after the body, the way
// Discuz renders them on the web.
export function parseMessage(
  html?: string | null,
  attachments?: Record<string, Attachment> | null,
  imagelist?: string[] | null,
): Block[] {
  if (!html && !attachments) return [];
  const body = sanitizeHtml(html || '');
  const blocks: Block[] = [];
  let pushedCollapseNotice = false;
  const pushNotice = (kind: 'hidden' | 'collapse', v: string) => {
    const prev = blocks[blocks.length - 1];
    if (prev && prev.t === 'notice' && prev.kind === kind && prev.v === v) return;
    blocks.push({ t: 'notice', kind, v });
  };
  const pushText = (chunk: string) => {
    let v = stripHtml(chunk);
    if (!v) return;
    if (/本帖隐藏的内容|隐藏内容|回复可见|回覆可见|需要回复/i.test(v)) {
      pushNotice('hidden', '这里有回复可见或权限限制内容，移动 API 暂时无法直接展开。');
      v = v
        .replace(/\[(?:本帖隐藏的内容|隐藏内容)\]/g, '')
        .replace(/本帖隐藏的内容[\s\S]*?(?:浏览|查看|$)/g, '')
        .replace(/(?:回复|回覆)可见|需要回复/g, '')
        .trim();
      if (!v) return;
    }
    if (/折叠|展开隐藏|showcollapse|collapse/i.test(chunk) && !pushedCollapseNotice) {
      pushNotice('collapse', '下方内容来自折叠区域，已按普通正文显示。');
      pushedCollapseNotice = true;
    }
    if (hasRichMarkup(chunk)) {
      const runs = richRunsFromHtml(chunk);
      if (runs.length === 1 && !runs[0].href && !runs[0].bold && !runs[0].tone && !runs[0].size) {
        blocks.push({ t: 'text', v: runs[0].v });
      } else if (runs.length) {
        blocks.push({ t: 'rich', runs });
      }
      return;
    }
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
  if (/showcollapse|class=["'][^"']*(?:collapse|showhide|t_fsz)[^"']*["']|\[collapse\]|\[\/collapse\]/i.test(body)) {
    pushNotice('collapse', '正文包含折叠内容，已尽量展开为普通文本。');
    pushedCollapseNotice = true;
  }

  const re = /<div\b[^>]*class=["'][^"']*(?:reply_wrap|quote)[^"']*["'][^>]*>[\s\S]*?<\/div>|<blockquote[\s\S]*?<\/blockquote>|<table\b[\s\S]*?<\/table>|<a\b[^>]*>[\s\S]*?<\/a>|<img\b[^>]*>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    pushText(body.slice(last, m.index));
    const tag = m[0];
    if (/^<div\b[^>]*class=["'][^"']*(?:reply_wrap|quote)/i.test(tag) || /^<blockquote/i.test(tag)) {
      const quote = quoteBlockFromHtml(tag);
      if (quote) blocks.push(quote);
    } else if (/^<table/i.test(tag)) {
      const rows = tableFromHtml(tag);
      if (rows.length) blocks.push({ t: 'table', rows });
    } else if (/^<a/i.test(tag)) {
      const href = decodeEntities((tag.match(/\bhref=["']([^"']+)["']/i) || [])[1] || '');
      const safeHref = absUrl(href);
      const v = stripHtml(tag) || href;
      const src = imgUrlFromTag(tag);
      if (src && !SMILEY_RE.test(src)) blocks.push({ t: 'img', src, cap: v && v !== href ? v : '图片' });
      else if (safeHref && hasRichMarkup(tag.replace(/^<a\b[^>]*>|<\/a>$/gi, ''))) {
        const runs = richRunsFromHtml(tag.replace(/^<a\b[^>]*>|<\/a>$/gi, ''), { href: safeHref });
        if (runs.length) blocks.push({ t: 'rich', runs });
      } else if (safeHref) blocks.push({ t: 'link', v, href: safeHref });
      else pushText(tag);
    } else {
      const src = imgUrlFromTag(tag);
      if (src && !SMILEY_RE.test(src)) blocks.push({ t: 'img', src, cap: '图片' });
    }
    last = re.lastIndex;
  }
  pushText(body.slice(last));

  // Append attachments that weren't embedded inline above.
  if (attachments) {
    const shown = blocks.filter((b) => b.t === 'img').map((b) => b.src || '');
    const order = (Array.isArray(imagelist) && imagelist.length) ? imagelist : Object.keys(attachments);
    const appended = new Set<string>();
    order.forEach((aid) => {
      const a = attachments[aid];
      if (!a) return;
      appended.add(aid);
      const url = attachmentUrl(a);
      const path = a.attachment || '';
      if (!isImageAttachment(a)) {
        blocks.push({
          t: 'attachment',
          name: a.description || a.filename || a.imgalt || path.split('/').pop() || '附件',
          href: url,
          size: a.attachsize || a.filesize || a.size,
        });
        return;
      }
      const inline = shown.some((s) => s !== '' && (s === url || (path !== '' && s.indexOf(path) >= 0)));
      if (!inline) blocks.push({
        t: 'img',
        src: url,
        cap: a.description || a.imgalt || a.filename || '图片',
        width: parseInt(a.width || '0', 10) || undefined,
        height: parseInt(a.height || '0', 10) || undefined,
      });
    });
    Object.keys(attachments).forEach((aid) => {
      if (appended.has(aid)) return;
      const a = attachments[aid];
      if (!a) return;
      const path = a.attachment || '';
      const url = attachmentUrl(a);
      if (isImageAttachment(a)) {
        const inline = shown.some((s) => s !== '' && (s === url || (path !== '' && s.indexOf(path) >= 0)));
        if (!inline) blocks.push({
          t: 'img',
          src: url,
          cap: a.description || a.imgalt || a.filename || '图片',
          width: parseInt(a.width || '0', 10) || undefined,
          height: parseInt(a.height || '0', 10) || undefined,
        });
        return;
      }
      blocks.push({
        t: 'attachment',
        name: a.description || a.filename || a.imgalt || path.split('/').pop() || '附件',
        href: url,
        size: a.attachsize || a.filesize || a.size,
      });
    });
  }

  return blocks.length ? blocks : [{ t: 'text', v: stripHtml(body) }];
}
