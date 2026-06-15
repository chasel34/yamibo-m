import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Block, ReadingBook, ReadingChapter, ReadingProgress, ReadingStreamPage,
} from './types';

export const LITERATURE_FIDS = new Set(['49', '55', '60', '350']);
export const READER_FONTS = [16, 18, 20, 22, 24];

export const READER_THEMES = {
  paper: { key: 'paper', name: '纸白', bg: '#fbf9f6', ink: '#2c2420', soft: '#9a8980', line: 'rgba(60,40,32,.10)', chrome: '#ffffff', accent: '#ad473c' },
  sepia: { key: 'sepia', name: '米黄', bg: '#f0e3c9', ink: '#4a3a26', soft: '#9c8559', line: 'rgba(80,55,25,.13)', chrome: '#f6ecd8', accent: '#9c5a2e' },
  green: { key: 'green', name: '护眼', bg: '#d2e2cb', ink: '#2f3d29', soft: '#647a58', line: 'rgba(40,60,30,.14)', chrome: '#dcebd6', accent: '#4a7a3e' },
  night: { key: 'night', name: '夜间', bg: '#14110e', ink: '#c6b7ac', soft: '#7c6a5f', line: 'rgba(255,240,230,.10)', chrome: '#211a16', accent: '#e0897b' },
} as const;

export type ReaderThemeKey = keyof typeof READER_THEMES;

const PROGRESS_PREFIX = 'yh_rd_pos_';
const THEME_KEY = 'yh_rd_theme';
const FONT_KEY = 'yh_rd_font';
const HINT_KEY = 'yh_rd_hint';

export async function getReadingProgress(tid: string): Promise<ReadingProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_PREFIX + tid);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export async function saveReadingProgress(tid: string, progress: ReadingProgress): Promise<void> {
  try { await AsyncStorage.setItem(PROGRESS_PREFIX + tid, JSON.stringify(progress)); } catch (e) {}
}

export async function getReaderSettings(): Promise<{ theme: ReaderThemeKey; fontIdx: number; hinted: boolean }> {
  try {
    const [theme, font, hinted] = await Promise.all([
      AsyncStorage.getItem(THEME_KEY), AsyncStorage.getItem(FONT_KEY), AsyncStorage.getItem(HINT_KEY),
    ]);
    const fontIdx = Math.max(0, Math.min(READER_FONTS.length - 1, parseInt(font || '1', 10) || 1));
    return {
      theme: theme && theme in READER_THEMES ? theme as ReaderThemeKey : 'paper',
      fontIdx,
      hinted: hinted === '1',
    };
  } catch (e) {
    return { theme: 'paper', fontIdx: 1, hinted: false };
  }
}

export function saveReaderTheme(theme: ReaderThemeKey) {
  AsyncStorage.setItem(THEME_KEY, theme).catch(() => {});
}

export function saveReaderFont(fontIdx: number) {
  AsyncStorage.setItem(FONT_KEY, String(fontIdx)).catch(() => {});
}

export function markReaderHinted() {
  AsyncStorage.setItem(HINT_KEY, '1').catch(() => {});
}

const CHAPTER_RE = /^(?:第\s*\d+\s*[话話章节節回]|episode\s*\d+|番外|序章|终章|終章|后日谈|後日談)/i;
// Leading chapter marker (no trailing subtitle) — used to peel the title off the
// first body line when title and body share one line (源帖常用 &nbsp; 缩进、无 <br>).
const CHAPTER_MARKER_RE = /^\s*(?:第\s*\d+\s*[话話章节節回]|episode\s*\d+|番外|序章|终章|終章|后日谈|後日談)/i;

function pidFromHref(href: string): string | null {
  const decoded = href.replace(/&amp;/g, '&');
  return (decoded.match(/[?&]pid=(\d+)/i) || [])[1] || null;
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function chapterLinks(blocks: Block[]): ReadingChapter[] {
  const seen = new Set<string>();
  return blocks.flatMap((block) => {
    if (block.t !== 'link') return [];
    const pid = pidFromHref(block.href);
    const title = normalizeTitle(block.v);
    if (!pid || seen.has(pid) || !CHAPTER_RE.test(title)) return [];
    seen.add(pid);
    return [{ id: pid, pid, no: seen.size, title }];
  });
}

function chapterTitleFromBlocks(blocks: Block[]): string | null {
  for (const block of blocks) {
    if (block.t !== 'text') continue;
    const first = block.v.split(/\n+/).map(normalizeTitle).find(Boolean);
    if (first && CHAPTER_RE.test(first)) return first;
  }
  return null;
}

// Build a whitespace-tolerant, case-insensitive prefix regex from a chapter title
// so it matches the same title at the start of a body line regardless of spacing.
function titlePrefixRe(title: string): RegExp | null {
  const tokens = normalizeTitle(title).split(' ').filter(Boolean);
  if (!tokens.length) return null;
  const body = tokens.map((tok) => tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
  return new RegExp('^\\s*' + body + '\\s*', 'i');
}

// Peel the chapter title off the START of the first body line, KEEPING the rest of
// that line. 源帖里章节标题常和正文同处一行（"Episode 2   舌尖…"，无 <br>），旧实现
// 会把整行删掉、清空正文，这里只去掉标题前缀。
export function stripLeadingChapterTitle(blocks: Block[], title: string): Block[] {
  let removed = false;
  const titleRe = titlePrefixRe(title);
  return blocks.flatMap((block) => {
    if (removed || block.t !== 'text') return [block];
    const lines = block.v.split('\n');
    const index = lines.findIndex((line) => normalizeTitle(line) !== '');
    if (index < 0) return [block];
    const raw = lines[index];
    const matched = (titleRe && raw.match(titleRe)) || raw.match(CHAPTER_MARKER_RE);
    if (!matched) return [block];
    removed = true;
    const rest = raw.slice(matched[0].length).replace(/^[\s·:：\-—]+/, '');
    if (rest.trim()) lines[index] = rest;
    else lines.splice(index, 1);
    const v = lines.join('\n').trim();
    return v ? [{ ...block, v }] : [];
  });
}

export function buildReadingBook(first: ReadingStreamPage): ReadingBook {
  const firstPost = first.posts[0];
  let chapters = firstPost ? chapterLinks(firstPost.blocks) : [];
  if (!chapters.length) {
    const candidates = first.posts.slice(first.posts.length > 1 ? 1 : 0).flatMap((post) => {
      const title = chapterTitleFromBlocks(post.blocks);
      return title ? [{ id: post.pid, pid: post.pid, no: 0, title, pos: post.pos, blocks: stripLeadingChapterTitle(post.blocks, title) }] : [];
    });
    chapters = candidates.map((chapter, index) => ({ ...chapter, no: index + 1 }));
  }
  if (!chapters.length && firstPost) {
    chapters = [{ id: firstPost.pid, pid: firstPost.pid, no: 1, title: first.title, blocks: firstPost.blocks }];
  }
  const pagePosts = new Map(first.posts.map((post) => [post.pid, post]));
  chapters = chapters.map((chapter) => {
    const post = pagePosts.get(chapter.pid);
    return post ? { ...chapter, pos: post.pos, blocks: stripLeadingChapterTitle(post.blocks, chapter.title) } : chapter;
  });
  const count = chapters.length;
  const shape = count <= 1 ? '短篇' : count >= 80 ? '长篇连载' : '中篇连载';
  const complete = count === 1 || /(?:完结|完結|全文完|全\s*\d+\s*[话話]\s*完)/i.test(first.title);
  return {
    tid: first.tid,
    fid: first.fid,
    title: first.title,
    author: first.author,
    shape,
    statusText: complete ? '完结' : '连载中',
    chapters,
    ppp: first.ppp,
    totalPages: first.totalPages,
  };
}
