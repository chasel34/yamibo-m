import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Block, ReadingBook, ReadingChapterIndex, ReadingChapterType,
  ReadingConfidence, ReadingDiagnostics, ReadingIndex, ReadingProgress, ReadingStreamPage,
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
const INDEX_PREFIX = 'yh_rd_index_';
const THEME_KEY = 'yh_rd_theme';
const FONT_KEY = 'yh_rd_font';
const HINT_KEY = 'yh_rd_hint';
const VIEWER_HINT_KEY = 'yh_viewer_hint';

function indexKey(tid: string, authorid: string): string {
  return `${INDEX_PREFIX}${tid}_${authorid}`;
}

export async function getReadingProgress(tid: string): Promise<ReadingProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_PREFIX + tid);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export async function saveReadingProgress(tid: string, progress: ReadingProgress): Promise<void> {
  try { await AsyncStorage.setItem(PROGRESS_PREFIX + tid, JSON.stringify(progress)); } catch (e) {}
}

export async function getReadingIndex(tid: string, authorid: string): Promise<ReadingIndex | null> {
  try {
    const raw = await AsyncStorage.getItem(indexKey(tid, authorid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReadingIndex;
    if (!parsed || parsed.version !== 1 || parsed.tid !== tid || parsed.authorid !== authorid) return null;
    const declared = parsed.diagnostics?.declaredLatestNo || declaredLatestNo(parsed.title);
    if (declared && parsed.chapters.length < Math.max(5, declared * 0.2)) return null;
    return parsed;
  } catch (e) { return null; }
}

export async function saveReadingIndex(index: ReadingIndex): Promise<void> {
  try { await AsyncStorage.setItem(indexKey(index.tid, index.authorid), JSON.stringify(index)); } catch (e) {}
}

export async function clearReadingIndex(tid: string, authorid: string): Promise<void> {
  try { await AsyncStorage.removeItem(indexKey(tid, authorid)); } catch (e) {}
}

export async function getReaderSettings(): Promise<{ theme: ReaderThemeKey; fontIdx: number; hinted: boolean }> {
  try {
    const [theme, font, hinted] = await Promise.all([
      AsyncStorage.getItem(THEME_KEY), AsyncStorage.getItem(FONT_KEY), AsyncStorage.getItem(HINT_KEY),
    ]);
    const parsed = parseInt(font ?? '', 10);
    const fontIdx = Number.isFinite(parsed) ? Math.max(0, Math.min(READER_FONTS.length - 1, parsed)) : 1;
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

export async function getViewerHinted(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(VIEWER_HINT_KEY)) === '1'; } catch (e) { return false; }
}

export function markViewerHinted() {
  AsyncStorage.setItem(VIEWER_HINT_KEY, '1').catch(() => {});
}

const CHINESE_NUM = '零〇一二两兩三四五六七八九十百千';
const CHAPTER_RE = new RegExp(
  `^(?:第\\s*[\\d${CHINESE_NUM}]+(?:\\.\\d+)?\\s*(?:话|話|章|章节|節|节|回|篇|夜|则|則|幕|部)|(?:episode|chapter|chap\\.?|act|part|interlude|extra)\\s*\\d+(?:\\.\\d+)?|\\d{1,4}(?:\\.\\d+)?\\s*[.、．:：-]|[【\\[]?[${CHINESE_NUM}]+[】\\]]?[、.．:：-]|番外(?:\\s*\\d+(?:\\.\\d+)?)?|序章|终章|終章|后日谈|後日談)`,
  'i',
);

export function isWeakChapter(type?: ReadingChapterType): boolean {
  return type === 'note' || type === 'toc';
}

function pidFromHref(href: string): string | null {
  const decoded = href.replace(/&amp;/g, '&');
  return (decoded.match(/[?&]pid=(\d+)/i) || [])[1] || null;
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function blockText(blocks: Block[]): string {
  return blocks.map((block) => {
    if (block.t === 'text' || block.t === 'link' || block.t === 'quote' || block.t === 'notice') return block.v;
    if (block.t === 'rich') return block.runs.map((run) => run.v).join('');
    if (block.t === 'table') return block.rows.map((row) => row.join(' ')).join('\n');
    if (block.t === 'attachment') return block.name;
    return block.cap || '';
  }).join('\n').replace(/\u00a0/g, ' ');
}

function nonEmptyBlocks(blocks: Block[]): Block[] {
  return blocks.filter((block) => {
    if (block.t === 'img') return !!block.src || !!block.cap;
    if (block.t === 'attachment') return !!normalizeTitle(block.name) || !!block.href;
    if (block.t === 'link') return !!normalizeTitle(block.v) || !!block.href;
    if (block.t === 'rich') return block.runs.some((run) => !!normalizeTitle(run.v) || !!run.href);
    if (block.t === 'table') return block.rows.some((row) => row.some((cell) => !!normalizeTitle(cell)));
    if (block.t === 'quote' || block.t === 'notice') return !!normalizeTitle(block.v);
    return !!normalizeTitle(block.v);
  });
}

function simpleHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function readingPageHash(page?: ReadingStreamPage): string | undefined {
  if (!page) return undefined;
  return simpleHash(page.posts.map((post) => `${post.pid}:${post.pos}:${blockText(post.blocks).slice(0, 400)}`).join('|'));
}

function chapterLinks(blocks: Block[]): ReadingChapterIndex[] {
  const seen = new Set<string>();
  return blocks.flatMap((block) => {
    const links = block.t === 'link'
      ? [{ href: block.href, title: block.v }]
      : block.t === 'rich'
        ? block.runs.filter((run) => !!run.href).map((run) => ({ href: run.href || '', title: run.v }))
        : [];
    return links.flatMap((link) => {
      const pid = pidFromHref(link.href);
      const title = normalizeTitle(link.title);
      if (!pid || seen.has(pid) || !looksLikeChapterTitle(title)) return [];
      seen.add(pid);
      return [{ id: pid, pid, no: seen.size, title, type: 'chapter', confidence: 'high' }];
    });
  });
}

function textLines(blocks: Block[]): string[] {
  return blockText(blocks).split(/\n+|[ 　]{3,}/).map(normalizeTitle).filter(Boolean);
}

function looksLikeChapterTitle(value: string): boolean {
  const title = normalizeTitle(value);
  if (!title || title.length > 70) return false;
  return CHAPTER_RE.test(title);
}

function parsePlainToc(blocks: Block[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of textLines(blocks)) {
    const cleaned = line.replace(/^\s*(?:目录|目錄|索引|章节|章節)\s*[:：-]?\s*/i, '').trim();
    if (!looksLikeChapterTitle(cleaned)) continue;
    if (/回复|回覆|评论|評論|收藏|电梯|链接|連結/.test(cleaned) && cleaned.length < 16) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out.slice(0, 300);
}

function chapterTitleFromBlocks(blocks: Block[]): string | null {
  let scanned = 0;
  for (const block of blocks) {
    if (block.t !== 'text' && block.t !== 'rich') continue;
    const text = block.t === 'text' ? block.v : block.runs.map((run) => run.v).join('');
    const lines = text.split(/\n+|[ 　]{3,}/).map(normalizeTitle).filter(Boolean);
    for (const line of lines) {
      scanned += 1;
      if (/^(?:本帖最后由|本帖最後由|编辑|編輯|授权|授權|转载|轉載|译者|譯者|warning|避雷)/i.test(line)) continue;
      if (looksLikeChapterTitle(line)) return line;
      if (scanned >= 8) return null;
    }
  }
  return null;
}

function declaredLatestNo(title: string): number | undefined {
  const match = title.match(/(?:更新至|更新到|至|第)\s*(\d{1,4})(?:\.\d+)?\s*(?:话|話|章|回|节|節)?/);
  if (!match) return undefined;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function classifyPost(blocks: Block[], offset: number, linkedTocCount: number, plainTocCount: number): { type: ReadingChapterType; title: string; confidence: ReadingConfidence; detectedTitle?: string } {
  const blocksReady = nonEmptyBlocks(blocks);
  const normalized = normalizeTitle(blockText(blocksReady));
  const title = chapterTitleFromBlocks(blocksReady);
  if (title) return { type: 'chapter', title, confidence: 'high', detectedTitle: title };
  const imageOnly = blocksReady.length > 0 && blocksReady.every((block) => block.t === 'img');
  if (imageOnly) return { type: 'section', title: `第 ${offset} 段`, confidence: 'low' };
  const shortEnoughForDirectory = normalized.length < 1800;
  const localLinkedTocCount = chapterLinks(blocksReady).length;
  const localPlainTocCount = parsePlainToc(blocksReady).length;
  const hasDirectory = localLinkedTocCount >= 3 || localPlainTocCount >= 3 || (shortEnoughForDirectory && /目录|目錄|索引|电梯|電梯/.test(normalized));
  const isMostlyLinks = blocksReady.length > 0 && blocksReady.filter((block) => block.t === 'link').length >= Math.max(3, blocksReady.length * 0.6);
  if (hasDirectory && (isMostlyLinks || shortEnoughForDirectory)) {
    const hasIntro = normalized.length > 260 && !isMostlyLinks;
    return {
      type: hasIntro ? 'note' : 'toc',
      title: hasIntro ? '作品说明' : '目录说明',
      confidence: linkedTocCount >= 5 || plainTocCount >= 5 ? 'medium' : 'low',
    };
  }
  if (/^(?:占楼|佔樓|占个楼|占坑|待补|待補|mark)$/i.test(normalized)) {
    return { type: 'note', title: `楼主说明 ${offset}`, confidence: 'low' };
  }
  if (/授权|授權|转载|轉載|译者|譯者|公告|请假|請假|停更|补档|補檔|说明|說明|碎碎念/.test(normalized.slice(0, 260))) {
    return { type: 'note', title: offset === 1 ? '作品说明' : `楼主说明 ${offset}`, confidence: 'low' };
  }
  return { type: offset === 1 && normalized.length > 600 ? 'chapter' : 'section', title: offset === 1 ? '第 1 段' : `第 ${offset} 段`, confidence: 'low' };
}

function isStrongExclude(blocks: Block[]): boolean {
  const ready = nonEmptyBlocks(blocks);
  if (!ready.length) return true;
  const text = normalizeTitle(blockText(ready));
  if (!text && ready.every((block) => block.t !== 'img')) return true;
  if (/^(?:占楼|佔樓|占坑|待补|待補|mark|顶|頂)[。.!！\s]*$/i.test(text)) return true;
  if (ready.length <= 2 && ready.every((block) => block.t === 'link' || (block.t === 'rich' && block.runs.every((run) => !!run.href))) && text.length < 40) return true;
  return false;
}

function isReliableLinkedToc(first: ReadingStreamPage, linked: ReadingChapterIndex[], diagnostics?: Pick<ReadingDiagnostics, 'declaredLatestNo'>): boolean {
  if (linked.length < 5) return false;
  const unique = new Set(linked.map((item) => item.pid));
  if (unique.size !== linked.length) return false;
  const chapterish = linked.filter((item) => looksLikeChapterTitle(item.title)).length;
  if (chapterish / linked.length < 0.65) return false;
  const declared = diagnostics?.declaredLatestNo ?? declaredLatestNo(first.title);
  if (declared && linked.length < Math.max(5, declared * 0.45)) return false;
  return true;
}

export function hasReliableLinkedToc(first: ReadingStreamPage): boolean {
  return isReliableLinkedToc(first, chapterLinks(first.posts[0]?.blocks || []));
}

interface AnnotatedPost {
  post: ReadingStreamPage['posts'][number];
  sourcePage: number;
  pageOffset: number;
  authorOffset: number;
}

function annotatedPosts(pages: ReadingStreamPage[]): AnnotatedPost[] {
  let authorOffset = 0;
  return pages.flatMap((page) => page.posts.map((post, index) => {
    authorOffset += 1;
    return { post, sourcePage: page.page, pageOffset: index, authorOffset };
  }));
}

function indexSource(pages: ReadingStreamPage[], scannedPages: number) {
  const first = pages[0];
  const lastPage = pages[pages.length - 1];
  const lastPost = lastPage?.posts[lastPage.posts.length - 1];
  return {
    totalPages: first?.totalPages || 1,
    scannedPages,
    builtAt: Date.now(),
    firstPageHash: readingPageHash(first),
    tocHash: first?.posts[0] ? simpleHash(chapterLinks(first.posts[0].blocks).map((item) => `${item.pid}:${item.title}`).join('|')) : undefined,
    lastPid: lastPost?.pid,
  };
}

function diagnosticsFor(first: ReadingStreamPage, chapters: ReadingChapterIndex[], posts: AnnotatedPost[], linkedTocCount: number, plainTocCount: number, titleDetectedCount: number, fallbackChapterCount: number, droppedPostCount: number): ReadingDiagnostics {
  const declared = declaredLatestNo(first.title);
  const warnings: string[] = [];
  if (!posts.length) warnings.push('楼主楼层流为空，无法整理正文');
  if (fallbackChapterCount > 0) warnings.push('已按楼主楼层保留内容，章节名可能不完整');
  if (droppedPostCount > 0) warnings.push(`已强排除 ${droppedPostCount} 个空白或占楼楼层`);
  if (declared && chapters.filter((item) => item.type === 'chapter').length < declared * 0.65) warnings.push('标题声明的更新进度与已识别章节数量差异较大');
  const confidence: ReadingConfidence = warnings.length === 0 && linkedTocCount >= 5 ? 'high'
    : fallbackChapterCount > Math.max(2, chapters.length * 0.35) || !chapters.length ? 'low' : 'medium';
  return {
    opPostCount: posts.length,
    chapterCount: chapters.length,
    linkedTocCount,
    plainTocCount,
    titleDetectedCount,
    fallbackChapterCount,
    droppedPostCount,
    declaredLatestNo: declared,
    confidence,
    warnings,
  };
}

export function buildTocReadyIndex(first: ReadingStreamPage, authorid: string): ReadingIndex {
  const firstPost = first.posts[0];
  const linked = chapterLinks(firstPost?.blocks || []);
  const plain = parsePlainToc(firstPost?.blocks || []);
  const chapters: ReadingChapterIndex[] = [];
  if (firstPost && !isStrongExclude(firstPost.blocks)) {
    const info = classifyPost(firstPost.blocks, 1, linked.length, plain.length);
    chapters.push({
      id: firstPost.pid,
      pid: firstPost.pid,
      no: 1,
      title: info.title,
      type: info.type,
      confidence: info.confidence,
      pos: firstPost.pos,
      sourcePage: first.page,
      pageOffset: 0,
    });
  }
  linked.forEach((item) => {
    if (!chapters.some((chapter) => chapter.pid === item.pid)) chapters.push({ ...item, no: chapters.length + 1 });
  });
  const posts = annotatedPosts([first]);
  const diagnostics = diagnosticsFor(first, chapters, posts, linked.length, plain.length, 0, chapters.filter((item) => item.confidence === 'low').length, 0);
  return {
    version: 1,
    tid: first.tid,
    fid: String(first.fid || ''),
    authorid,
    title: first.title,
    author: first.author,
    status: 'toc-ready',
    chapters,
    diagnostics: { ...diagnostics, confidence: 'high' },
    source: indexSource([first], 1),
  };
}

export function buildCompleteIndex(pages: ReadingStreamPage[], authorid: string): ReadingIndex {
  const first = pages[0];
  const posts = annotatedPosts(pages);
  const firstPost = first?.posts[0];
  const linked = chapterLinks(firstPost?.blocks || []);
  const plain = parsePlainToc(firstPost?.blocks || []);
  const titleByPid = new Map(linked.map((item) => [item.pid, item.title]));
  let plainOffset = 0;
  let titleDetectedCount = 0;
  let fallbackChapterCount = 0;
  let droppedPostCount = 0;
  const chapters: ReadingChapterIndex[] = [];
  for (const item of posts) {
    const { post, sourcePage, pageOffset } = item;
    if (isStrongExclude(post.blocks)) {
      droppedPostCount += 1;
      continue;
    }
    const linkedTitle = titleByPid.get(post.pid);
    const info = classifyPost(post.blocks, item.authorOffset, linked.length, plain.length);
    if (info.detectedTitle) titleDetectedCount += 1;
    const isFallback = !linkedTitle && !info.detectedTitle;
    if (isFallback) fallbackChapterCount += 1;
    let title = linkedTitle || info.detectedTitle || '';
    if (!title && info.type === 'chapter' && plain[plainOffset]) title = plain[plainOffset++];
    if (!title) title = info.title;
    const type = linkedTitle ? 'chapter' : info.type;
    const confidence: ReadingConfidence = linkedTitle ? 'high' : info.confidence;
    chapters.push({
      id: post.pid,
      pid: post.pid,
      no: chapters.length + 1,
      title,
      type,
      confidence,
      pos: post.pos,
      sourcePage,
      pageOffset,
    });
  }
  const diagnostics = diagnosticsFor(first, chapters, posts, linked.length, plain.length, titleDetectedCount, fallbackChapterCount, droppedPostCount);
  return {
    version: 1,
    tid: first?.tid || '',
    fid: String(first?.fid || ''),
    authorid,
    title: first?.title || '',
    author: first?.author || {},
    status: 'complete',
    chapters,
    diagnostics,
    source: indexSource(pages, pages.length),
  };
}

export function readingIndexToBook(index: ReadingIndex, ppp = 20): ReadingBook {
  const count = index.chapters.length;
  const bodyCount = index.chapters.filter((item) => !isWeakChapter(item.type)).length;
  const shape = bodyCount <= 1 ? '短篇' : bodyCount >= 80 ? '长篇连载' : '中篇连载';
  const complete = /(?:完结|完結|全文完|已完结|已完結|全\s*\d+\s*[话話章]\s*完)/i.test(index.title);
  return {
    tid: index.tid,
    fid: index.fid,
    authorid: index.authorid,
    title: index.title,
    author: index.author,
    shape,
    statusText: complete ? '完结' : '连载中',
    status: index.status,
    diagnostics: index.diagnostics,
    source: index.source,
    ppp,
    totalPages: index.source.totalPages,
    chapters: index.chapters.map((chapter) => ({ ...chapter })),
  };
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
    if (removed || (block.t !== 'text' && block.t !== 'rich')) return [block];
    const rawText = block.t === 'text' ? block.v : block.runs.map((run) => run.v).join('');
    const lines = rawText.split('\n');
    const index = lines.findIndex((line) => normalizeTitle(line) !== '');
    if (index < 0) return [block];
    const raw = lines[index];
    const matched = (titleRe && raw.match(titleRe)) || raw.match(CHAPTER_RE);
    if (!matched) return [block];
    removed = true;
    const rest = raw.slice(matched[0].length).replace(/^[\s·:：\-—]+/, '');
    if (rest.trim()) lines[index] = rest;
    else lines.splice(index, 1);
    const v = lines.join('\n').trim();
    if (!v) return [];
    if (block.t === 'text') return [{ ...block, v }];
    return [{ t: 'rich', runs: [{ v }] }];
  });
}

