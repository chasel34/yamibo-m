import React from 'react';
import {
  ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View,
} from 'react-native';
import { StackActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar, Avatar } from '../components/ui';
import Icon from '../components/Icon';
import ReaderSurface, { type ReaderSurfaceHandle } from '../components/ReaderSurface';
import { createChapterFragment, createReaderShellHtml } from '../readerHtml';
import { getChapterComments, getReadingStream, resolvePostPage } from '../api';
import { parseForumLink } from '../forumLinks';
import {
  buildCompleteIndex, buildTocReadyIndex, clearReadingIndex, getReaderSettings,
  getReadingIndex, getReadingProgress, hasReliableLinkedToc, isWeakChapter, LITERATURE_FIDS,
  markReaderHinted, markReaderLowConfidenceHinted, READER_FONTS, READER_THEMES, saveReaderFont,
  saveReaderTheme, saveReadingIndex, saveReadingProgress, readingIndexToBook,
  stripLeadingChapterTitle, type ReaderThemeKey,
} from '../reading';
import { FONTS } from '../theme';
import { useNav } from '../useNav';
import type {
  Block, ReadingBook, ReadingComment, ReadingProgress, ReadingStreamPage, RootStackParamList,
} from '../types';

type Phase = 'checkingCache' | 'loading' | 'organizing' | 'organizeError' | 'resume' | 'reading' | 'error';
type Panel = null | 'toc' | 'font' | 'theme' | 'comments' | 'actions';

export default function ReaderScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'reader'>) {
  const { tid, authorid, fresh } = route.params;
  const nav = useNav();
  const [phase, setPhase] = React.useState<Phase>('loading');
  const [book, setBookState] = React.useState<ReadingBook | null>(null);
  const bookRef = React.useRef<ReadingBook | null>(null);
  const pagesRef = React.useRef(new Map<number, ReadingStreamPage>());
  const [saved, setSaved] = React.useState<ReadingProgress | null>(null);
  const [chapterIdx, setChapterIdx] = React.useState(0);
  const [pageIdx, setPageIdx] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [pageReady, setPageReady] = React.useState(false);
  // 首次进入 reading 后置 true 且换章/加载期间保持：ReaderSurface（含 shell 文档）从此常驻，
  // 换章只注入内容，绝不 unmount/换 source —— 这是本屏性能与无白闪的根基。
  const [surfaceLive, setSurfaceLive] = React.useState(false);
  const [chrome, setChrome] = React.useState(false);
  const [panel, setPanel] = React.useState<Panel>(null);
  const [themeKey, setThemeKey] = React.useState<ReaderThemeKey>('paper');
  const [fontIdx, setFontIdx] = React.useState(1);
  const [hint, setHint] = React.useState(false);
  const [comments, setComments] = React.useState<ReadingComment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = React.useState(false);
  const [tocReverse, setTocReverse] = React.useState(false);
  const [organize, setOrganize] = React.useState({ read: 0, total: 0 });
  const [updateHint, setUpdateHint] = React.useState<string | null>(null);
  const [lowHint, setLowHint] = React.useState(false);
  const autoUpdateChecked = React.useRef(false);
  const chapterIdxRef = React.useRef(0);
  const surfaceRef = React.useRef<ReaderSurfaceHandle>(null);
  // shell 收到并渲染后应处于的位置。ready（含 WebView 进程重启后的重载）时按它重建窗口。
  const targetRef = React.useRef({ idx: 0, page: 0 });
  const readyRef = React.useRef(false);
  // 已注入 shell 的章节集合。以 page 事件回传的 win 为准同步（shell 会自行裁窗）。
  const postedRef = React.useRef(new Set<number>());
  const needInflightRef = React.useRef(new Map<number, Promise<boolean>>());
  const streamInflightRef = React.useRef(new Map<number, Promise<ReadingStreamPage>>());
  const shellRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    chapterIdxRef.current = chapterIdx;
  }, [chapterIdx]);

  const setBook = React.useCallback((next: ReadingBook) => {
    bookRef.current = next;
    setBookState(next);
  }, []);

  const hydrateChapterFromCachedPages = React.useCallback((nextBook: ReadingBook, pid?: string) => {
    if (!pid) return nextBook;
    const chapterIndex = nextBook.chapters.findIndex((item) => item.pid === pid);
    if (chapterIndex < 0) return nextBook;
    let streamMatch: ReadingStreamPage | undefined;
    let postMatch: ReadingStreamPage['posts'][number] | undefined;
    for (const stream of pagesRef.current.values()) {
      const post = stream.posts.find((item) => item.pid === pid);
      if (post) {
        streamMatch = stream;
        postMatch = post;
        break;
      }
    }
    if (!streamMatch || !postMatch) return nextBook;
    const chapter = nextBook.chapters[chapterIndex];
    return {
      ...nextBook,
      ppp: streamMatch.ppp || nextBook.ppp,
      chapters: nextBook.chapters.map((item, index) => (index === chapterIndex
        ? {
          ...item,
          pos: postMatch.pos,
          sourcePage: streamMatch.page,
          blocks: stripLeadingChapterTitle(postMatch.blocks, chapter.title),
        }
        : item)),
    };
  }, []);

  const popToThread = React.useCallback((params: { targetPid?: string; targetPage?: number } = {}) => {
    navigation.dispatch(StackActions.popTo('thread', { tid, ...params }, { merge: true }));
  }, [navigation, tid]);

  const goBack = React.useCallback(() => {
    if (typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    popToThread();
  }, [navigation, popToThread]);

  // 相邻章预取与用户跳章可能并发拉同一页：in-flight 去重，网络请求只发一次。
  const fetchStreamPage = React.useCallback((pageNo: number): Promise<ReadingStreamPage> => {
    const cached = pagesRef.current.get(pageNo);
    if (cached) return Promise.resolve(cached);
    let inflight = streamInflightRef.current.get(pageNo);
    if (!inflight) {
      inflight = getReadingStream(tid, authorid, pageNo).then((stream) => {
        pagesRef.current.set(pageNo, stream);
        streamInflightRef.current.delete(pageNo);
        return stream;
      }, (e) => {
        streamInflightRef.current.delete(pageNo);
        throw e;
      });
      streamInflightRef.current.set(pageNo, inflight);
    }
    return inflight;
  }, [authorid, tid]);

  const ensureChapter = React.useCallback(async (index: number): Promise<Block[]> => {
    const current = bookRef.current;
    if (!current) throw new Error('阅读数据尚未载入');
    const ready = current.chapters[index]?.blocks;
    if (ready) return ready;
    const target = current.chapters[index];
    const estimated = Math.max(1, Math.min(current.totalPages, target.sourcePage || (target.pos ? Math.ceil(target.pos / current.ppp) : Math.floor((index + 1) / current.ppp) + 1)));
    const order: number[] = [];
    for (let page = estimated; page <= current.totalPages; page += 1) order.push(page);
    for (let page = estimated - 1; page >= 1; page -= 1) order.push(page);
    for (const page of order) {
      const stream = await fetchStreamPage(page);
      const postMap = new Map(stream.posts.map((post) => [post.pid, post]));
      const latest = bookRef.current!;
      let changed = false;
      const chapters = latest.chapters.map((chapter) => {
        if (chapter.blocks) return chapter;
        const post = postMap.get(chapter.pid);
        if (!post) return chapter;
        changed = true;
        return { ...chapter, pos: post.pos, sourcePage: page, blocks: stripLeadingChapterTitle(post.blocks, chapter.title) };
      });
      if (changed) setBook({ ...latest, ppp: stream.ppp || latest.ppp, chapters });
      const found = chapters[index]?.blocks;
      if (found) return found;
    }
    throw new Error('没有找到这一章的正文');
  }, [fetchStreamPage, setBook]);

  const fragmentFor = React.useCallback((index: number): string | null => {
    const current = bookRef.current;
    const target = current?.chapters[index];
    if (!current || !target || !target.blocks) return null;
    return createChapterFragment({
      chapterNo: target.no,
      chapterTitle: target.title.replace(/^(?:第\s*\d+\s*[话話]\s*[·:：\-]?\s*)/i, ''),
      chapterType: target.type,
      blocks: target.blocks,
      isLast: index === current.chapters.length - 1,
      complete: current.statusText === '完结',
      floorLabel: target.pos ? `${target.pos} 楼` : undefined,
    });
  }, []);

  // 整窗重建（初次进入、跳章、重新整理后）：同一 shell 文档内替换 DOM，无 reload。
  const postWindow = React.useCallback((index: number, pageNo: number) => {
    const current = bookRef.current;
    if (!current || !readyRef.current) return;
    const html = fragmentFor(index);
    if (html == null) return;
    postedRef.current = new Set([index]);
    surfaceRef.current?.post({
      type: 'window',
      total: current.chapters.length,
      idx: index,
      page: pageNo,
      chapters: [{ idx: index, html }],
    });
  }, [fragmentFor]);

  // 预注入相邻章：blocks 就绪后 add 进 shell，用户滑到章边界时下一章已在多列流里，
  // 跨章翻页与章内翻页完全一致。失败静默——用户真滑到边界时 blocked 会带重试。
  const pushNeighbor = React.useCallback((index: number): Promise<boolean> => {
    const current = bookRef.current;
    if (!current || index < 0 || index >= current.chapters.length) return Promise.resolve(false);
    if (postedRef.current.has(index)) return Promise.resolve(true);
    const inflight = needInflightRef.current.get(index);
    if (inflight) return inflight;
    const task = (async () => {
      try {
        await ensureChapter(index);
        if (!readyRef.current) return false;
        const html = fragmentFor(index);
        if (html == null) return false;
        if (!postedRef.current.has(index)) {
          postedRef.current.add(index);
          surfaceRef.current?.post({ type: 'add', idx: index, html });
        }
        return true;
      } catch (e) {
        return false;
      } finally {
        needInflightRef.current.delete(index);
      }
    })();
    needInflightRef.current.set(index, task);
    return task;
  }, [ensureChapter, fragmentFor]);

  const loadAllAuthorPages = React.useCallback(async (first: ReadingStreamPage, progress = true) => {
    const pages = [first];
    pagesRef.current.set(first.page, first);
    if (progress) setOrganize({ read: 1, total: first.totalPages });
    for (let page = 2; page <= first.totalPages; page += 1) {
      const stream = await getReadingStream(tid, authorid, page);
      pages.push(stream);
      pagesRef.current.set(stream.page, stream);
      if (progress) setOrganize({ read: page, total: first.totalPages });
    }
    return pages;
  }, [authorid, tid]);

  const scanAndSaveIndex = React.useCallback(async (first: ReadingStreamPage, progress: boolean) => {
    const pages = await loadAllAuthorPages(first, progress);
    const index = buildCompleteIndex(pages, authorid);
    await saveReadingIndex(index);
    return index;
  }, [authorid, loadAllAuthorPages]);

  const initialFromProgress = React.useCallback((nextBook: ReadingBook, progress: ReadingProgress | null) => {
    if (!progress) return 0;
    if (progress.pid) {
      const byPid = nextBook.chapters.findIndex((item) => item.pid === progress.pid);
      if (byPid >= 0) return byPid;
    }
    const byTitle = nextBook.chapters.findIndex((item) => item.title === progress.chapterTitle);
    if (byTitle >= 0) return byTitle;
    return Math.min(nextBook.chapters.length - 1, progress.chapter);
  }, []);

  const completeScanInBackground = React.useCallback(async (base: ReadingBook, force = false) => {
    if (base.status !== 'toc-ready') return;
    if (!force && base.source?.builtAt && Date.now() - base.source.builtAt < 60 * 60 * 1000) return;
    try {
      setUpdateHint('正在补全楼主内容…');
      const first = pagesRef.current.get(1) || await getReadingStream(tid, authorid, 1);
      const index = await scanAndSaveIndex(first, false);
      const currentPid = bookRef.current?.chapters[chapterIdxRef.current]?.pid;
      const latest = hydrateChapterFromCachedPages(readingIndexToBook(index, first.ppp || base.ppp), currentPid);
      setBook(latest);
      const nextIdx = currentPid ? latest.chapters.findIndex((item) => item.pid === currentPid) : -1;
      const targetIdx = Math.max(0, Math.min(nextIdx >= 0 ? nextIdx : chapterIdxRef.current, latest.chapters.length - 1));
      if (targetIdx !== chapterIdxRef.current) setChapterIdx(targetIdx);
      // readingIndexToBook 返回的章节不带 blocks；pagesRef 在扫描后是满的，re-ensure 当前章
      // 只是一次无网络重映射。窗口内片段按旧章节序渲染，整窗重建（同文档、无 reload）。
      try { await ensureChapter(targetIdx); } catch (e) {}
      const keepPage = nextIdx >= 0 ? targetRef.current.page : 0;
      targetRef.current = { idx: targetIdx, page: keepPage };
      postWindow(targetIdx, keepPage);
      setUpdateHint('已补全楼主内容');
      setTimeout(() => setUpdateHint(null), 2800);
    } catch (e) {
      setUpdateHint('暂时无法检查更新，已使用本地整理结果');
      setTimeout(() => setUpdateHint(null), 3200);
    }
  }, [authorid, ensureChapter, hydrateChapterFromCachedPages, postWindow, scanAndSaveIndex, setBook, tid]);

  const openLoadedBook = React.useCallback(async (nextBook: ReadingBook, settings: Awaited<ReturnType<typeof getReaderSettings>>, progress: ReadingProgress | null, skipResume = false) => {
    if (!nextBook.chapters.length) throw new Error('没有识别到可阅读的正文');
    setBook(nextBook);
    setThemeKey(settings.theme);
    setFontIdx(settings.fontIdx);
    setHint(!settings.hinted);
    setLowHint(nextBook.diagnostics?.confidence === 'low' && !settings.lowConfidenceHinted);
    setSaved(progress);
    const initial = !fresh && progress ? initialFromProgress(nextBook, progress) : 0;
    setChapterIdx(initial);
    const initialPage = !fresh && progress ? progress.page : 0;
    setPageIdx(initialPage);
    targetRef.current = { idx: initial, page: initialPage };
    setPageReady(false);
    if (!fresh && progress && !skipResume) setPhase('resume');
    else {
      await ensureChapter(initial);
      setSurfaceLive(true);
      setPhase('reading');
    }
  }, [ensureChapter, fresh, initialFromProgress, setBook]);

  const load = React.useCallback(async () => {
    setPhase('checkingCache');
    setSurfaceLive(false);
    readyRef.current = false;
    postedRef.current = new Set();
    needInflightRef.current = new Map();
    streamInflightRef.current = new Map();
    let organizingStarted = false;
    try {
      if (fresh) await clearReadingIndex(tid, authorid);
      const [settings, progress, cached] = await Promise.all([
        getReaderSettings(), getReadingProgress(tid), fresh ? Promise.resolve(null) : getReadingIndex(tid, authorid),
      ]);
      if (cached) {
        const nextBook = readingIndexToBook(cached);
        await openLoadedBook(nextBook, settings, progress);
        completeScanInBackground(nextBook);
        return;
      }
      setPhase('loading');
      const first = await getReadingStream(tid, authorid, 1);
      if (!LITERATURE_FIDS.has(String(first.fid || ''))) throw new Error('阅读模式仅支持文学区帖子');
      pagesRef.current = new Map([[1, first]]);
      if (!fresh && hasReliableLinkedToc(first)) {
        const index = buildTocReadyIndex(first, authorid);
        await saveReadingIndex(index);
        const nextBook = readingIndexToBook(index, first.ppp);
        await openLoadedBook(nextBook, settings, progress, true);
        completeScanInBackground(nextBook, true);
        return;
      }
      organizingStarted = true;
      setPhase('organizing');
      const index = await scanAndSaveIndex(first, true);
      const nextBook = readingIndexToBook(index, first.ppp);
      await openLoadedBook(nextBook, settings, progress);
    } catch (e) {
      nav.toast(e.message || '载入失败');
      setPhase(organizingStarted ? 'organizeError' : 'error');
    }
  }, [authorid, completeScanInBackground, fresh, nav, openLoadedBook, scanAndSaveIndex, tid]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (phase !== 'reading' || !hint) return;
    const timer = setTimeout(() => { setHint(false); markReaderHinted(); }, 3200);
    return () => clearTimeout(timer);
  }, [hint, phase]);

  const dismissLowHint = React.useCallback(() => {
    setLowHint(false);
    markReaderLowConfidenceHinted();
  }, []);

  React.useEffect(() => {
    if (book?.diagnostics?.confidence !== 'low' || !lowHint || chrome || phase !== 'reading' || hint) return;
    const timer = setTimeout(dismissLowHint, 3000);
    return () => clearTimeout(timer);
  }, [book?.diagnostics?.confidence, chrome, dismissLowHint, hint, lowHint, phase]);

  const chapter = book?.chapters[chapterIdx];
  const pct = book ? Math.max(1, Math.min(100, Math.round(((chapterIdx + (pageIdx + 1) / Math.max(1, pageCount)) / book.chapters.length) * 100))) : 1;

  // 每翻一页都写 AsyncStorage 太频繁：trailing debounce 800ms 只落最后一次，
  // 卸载时把最新一笔 flush 掉，避免快速翻页后离开丢进度。
  const pendingProgress = React.useRef<{ tid: string; payload: ReadingProgress } | null>(null);
  const progressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (phase !== 'reading' || !pageReady || !book || !chapter) return;
    pendingProgress.current = {
      tid,
      payload: { chapter: chapterIdx, page: pageIdx, pct, chapterTitle: chapter.title, pid: chapter.pid, ts: Date.now() },
    };
    if (progressTimer.current) clearTimeout(progressTimer.current);
    progressTimer.current = setTimeout(() => {
      progressTimer.current = null;
      const next = pendingProgress.current;
      if (next) { pendingProgress.current = null; saveReadingProgress(next.tid, next.payload); }
    }, 800);
  }, [book, chapter, chapterIdx, pageIdx, pageReady, pct, phase, tid]);

  React.useEffect(() => () => {
    if (progressTimer.current) clearTimeout(progressTimer.current);
    const next = pendingProgress.current;
    if (next) { pendingProgress.current = null; saveReadingProgress(next.tid, next.payload); }
  }, []);

  // 目标章无需联网即可就绪：blocks 已挂在章节上，或该楼层已躺在 pagesRef 页缓存里（整理扫描后
  // readingIndexToBook 会丢弃 blocks 只回填当前章，但页缓存是满的——ensureChapter 只是无网络重映射）。
  const chapterReady = React.useCallback((index: number) => {
    const target = bookRef.current?.chapters[index];
    if (!target) return false;
    if (target.blocks) return true;
    for (const stream of pagesRef.current.values()) {
      if (stream.posts.some((post) => post.pid === target.pid)) return true;
    }
    return false;
  }, []);

  const jumpChapter = React.useCallback(async (index: number, targetPage = 0) => {
    if (!book || index < 0 || index >= book.chapters.length) return;
    setPanel(null);
    setChrome(false);
    setPageReady(false);
    // 跳章 = 同一 shell 文档内整窗重建，surface 常驻不卸载；仅确需联网时叠一层 loading 遮罩。
    const needsFetch = !chapterReady(index);
    if (needsFetch) setPhase('loading');
    try {
      await ensureChapter(index);
      const pageNo = Math.max(0, targetPage);
      targetRef.current = { idx: index, page: pageNo };
      setChapterIdx(index);
      setPageIdx(pageNo);
      setPageCount(1);
      setComments(null);
      postWindow(index, pageNo);
      setPhase('reading');
    } catch (e) {
      // 加载失败不再整屏报错：保留当前窗口继续可读，toast 提示后可重试。
      nav.toast(e.message || '章节加载失败');
      setPhase('reading');
    }
  }, [book, chapterReady, ensureChapter, nav, postWindow]);

  const openComments = React.useCallback(async () => {
    if (!chapter) return;
    setPanel('comments');
    if (comments != null || commentsLoading) return;
    setCommentsLoading(true);
    try {
      const pageHint = chapter.pos && book ? Math.ceil(chapter.pos / book.ppp) : undefined;
      setComments(await getChapterComments(tid, chapter.pid, authorid, pageHint));
    } catch (e) {
      nav.toast('评论加载失败');
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [authorid, book, chapter, comments, commentsLoading, nav, tid]);

  const viewOriginalFloor = React.useCallback(async () => {
    if (!chapter) return;
    nav.toast('正在打开原楼层…');
    try {
      // Derive the unfiltered page from the known floor position (same as openComments)
      // to skip a resolvePostPage round-trip; fall back to resolving when pos is absent
      // (e.g. toc-ready linked chapters before the full scan populates pos).
      const page = chapter.pos && book ? Math.ceil(chapter.pos / book.ppp) : await resolvePostPage(tid, chapter.pid);
      popToThread({ targetPid: chapter.pid, targetPage: page });
    } catch (e) {
      popToThread();
      nav.toast('无法定位楼层，已打开帖子');
    }
  }, [book, chapter, nav, popToThread, tid]);

  const checkUpdates = React.useCallback(async (manual = true) => {
    if (!book) return;
    if (manual) {
      setPanel(null);
      setUpdateHint('正在检查更新…');
    }
    try {
      const first = await getReadingStream(tid, authorid, 1);
      if (book.status === 'toc-ready' || first.totalPages > (book.source?.totalPages || 1)) {
        const index = await scanAndSaveIndex(first, false);
        const currentPid = chapter?.pid;
        const nextBook = hydrateChapterFromCachedPages(readingIndexToBook(index, first.ppp), currentPid);
        setBook(nextBook);
        const nextIdx = currentPid ? nextBook.chapters.findIndex((item) => item.pid === currentPid) : -1;
        const targetIdx = Math.max(0, Math.min(nextIdx >= 0 ? nextIdx : chapterIdxRef.current, nextBook.chapters.length - 1));
        if (targetIdx !== chapterIdxRef.current) setChapterIdx(targetIdx);
        // Re-hydrate blocks for the now-current chapter (see completeScanInBackground).
        try { await ensureChapter(targetIdx); } catch (e) {}
        const keepPage = nextIdx >= 0 ? targetRef.current.page : 0;
        targetRef.current = { idx: targetIdx, page: keepPage };
        postWindow(targetIdx, keepPage);
        setUpdateHint('发现新内容，已加入目录');
      } else if (manual) {
        setUpdateHint('已是最新整理结果');
      }
    } catch (e) {
      if (manual) setUpdateHint('暂时无法检查更新，已使用本地整理结果');
    } finally {
      if (manual) setTimeout(() => setUpdateHint(null), 3200);
    }
  }, [authorid, book, chapter?.pid, ensureChapter, hydrateChapterFromCachedPages, postWindow, scanAndSaveIndex, setBook, tid]);

  React.useEffect(() => {
    if (phase !== 'reading' || !book || book.status === 'toc-ready' || autoUpdateChecked.current) return;
    autoUpdateChecked.current = true;
    const timer = setTimeout(() => { checkUpdates(false); }, 1200);
    return () => clearTimeout(timer);
  }, [book, checkUpdates, phase]);

  const rebuildAll = React.useCallback(async () => {
    const run = async () => {
      setPanel(null);
      setChrome(false);
      setUpdateHint(null);
      // 重整是重活：卸载 surface 走整理进度屏，完成后重挂载，shell ready 时按 targetRef 重建窗口。
      setSurfaceLive(false);
      readyRef.current = false;
      postedRef.current = new Set();
      setPhase('organizing');
      try {
        await clearReadingIndex(tid, authorid);
        const first = await getReadingStream(tid, authorid, 1);
        const index = await scanAndSaveIndex(first, true);
        const nextBook = readingIndexToBook(index, first.ppp);
        const currentPid = chapter?.pid;
        setBook(nextBook);
        const nextIdx = currentPid ? nextBook.chapters.findIndex((item) => item.pid === currentPid) : 0;
        const target = Math.max(0, nextIdx >= 0 ? nextIdx : Math.min(chapterIdx, nextBook.chapters.length - 1));
        setChapterIdx(target);
        setPageIdx(0);
        targetRef.current = { idx: target, page: 0 };
        setPageReady(false);
        await ensureChapter(target);
        setSurfaceLive(true);
        setPhase('reading');
        nav.toast('已重新整理全文');
      } catch (e) {
        nav.toast(e.message || '重新整理失败');
        setPhase('organizeError');
      }
    };
    if (typeof Alert?.alert === 'function') {
      Alert.alert('重新整理全文？', '会清除该帖结构缓存并重新扫描楼主楼层，当前阅读位置会尽量按楼层保留。', [
        { text: '取消', style: 'cancel' },
        { text: '重新整理', style: 'destructive', onPress: run },
      ]);
    } else {
      run();
    }
  }, [authorid, chapter?.pid, chapterIdx, ensureChapter, nav, scanAndSaveIndex, setBook, tid]);

  const onReaderMessage = React.useCallback((raw: string) => {
    let msg: any;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (msg.type === 'ready') {
      // shell 载入（含 WebView 进程被杀后的自动重载）：同步样式并按 targetRef 重建窗口。
      readyRef.current = true;
      surfaceRef.current?.post({ type: 'style', fs: READER_FONTS[fontIdx], colors: READER_THEMES[themeKey] });
      postWindow(targetRef.current.idx, targetRef.current.page);
    } else if (msg.type === 'page') {
      if (Array.isArray(msg.win)) postedRef.current = new Set(msg.win.map((value: any) => value | 0));
      const idx = Math.max(0, msg.idx | 0);
      targetRef.current = { idx, page: msg.page || 0 };
      setPageIdx(msg.page || 0);
      setPageCount(Math.max(1, msg.pages || 1));
      setPageReady(true);
      if (idx !== chapterIdxRef.current) {
        setChapterIdx(idx);
        setComments(null);
      }
    } else if (msg.type === 'need') {
      pushNeighbor(msg.idx | 0);
    } else if (msg.type === 'blocked') {
      // 用户滑到边界但邻章尚未注入：提示加载中并重试；成功后 shell 会收到 add，再滑即连续。
      const idx = msg.idx | 0;
      setUpdateHint(msg.dir > 0 ? '正在载入下一章…' : '正在载入上一章…');
      pushNeighbor(idx).then((ok) => {
        if (ok) { setUpdateHint(null); return; }
        setUpdateHint('章节加载失败，请检查网络后重试');
        setTimeout(() => setUpdateHint(null), 2600);
      });
    } else if (msg.type === 'toggleChrome') {
      setChrome((value) => !value);
    } else if (msg.type === 'comments') {
      openComments();
    } else if (msg.type === 'floor') {
      viewOriginalFloor();
    } else if (msg.type === 'image') {
      const sourceIdx = typeof msg.idx === 'number' && msg.idx >= 0 ? msg.idx : chapterIdxRef.current;
      const blocks = bookRef.current?.chapters[sourceIdx]?.blocks || [];
      const images = blocks.filter((block) => block.t === 'img').map((block: any) => ({ src: block.src, cap: block.cap }));
      const index = Math.max(0, images.findIndex((image) => image.src === msg.src));
      nav.openViewer(images.length ? images : [{ src: msg.src, cap: '图片' }], index, book?.title);
    } else if (msg.type === 'link') {
      const href = String(msg.href || '');
      if (!/^https?:\/\//i.test(href)) return;
      const target = parseForumLink(href);
      if (target?.kind === 'thread') {
        nav.push('thread', { tid: target.tid, targetPid: target.pid, targetPage: target.page });
      } else if (target?.kind === 'board') {
        nav.push('board', { fid: target.fid });
      } else if (target?.kind === 'profile') {
        nav.push('profile', { uid: target.uid });
      } else {
        Linking.openURL(href).catch(() => nav.toast('无法打开这个链接'));
      }
    }
  }, [book?.title, fontIdx, nav, openComments, postWindow, pushNeighbor, themeKey, viewOriginalFloor]);

  // 相邻章预取：当前章一变（含滑动跨章）就把 ±1 章准备好并注入 shell，
  // 让绝大多数跨章翻页发生时下一章早已在多列流里。
  React.useEffect(() => {
    if (phase !== 'reading' || !surfaceLive) return;
    pushNeighbor(chapterIdx + 1);
    pushNeighbor(chapterIdx - 1);
  }, [chapterIdx, phase, pushNeighbor, surfaceLive]);

  const T = READER_THEMES[themeKey];

  // 字号/主题变化时注入更新：shell 只改 CSS 变量并原地重排（保持当前章与章内页），不 reload。
  // ready 之前的注入会被静默丢弃，shell ready 时会主动同步一次当前样式，因此无需跳过首帧。
  React.useEffect(() => {
    surfaceRef.current?.post({ type: 'style', fs: READER_FONTS[fontIdx], colors: READER_THEMES[themeKey] });
  }, [fontIdx, themeKey]);

  const continueReading = async (restart = false) => {
    const target = restart ? 0 : Math.min((book?.chapters.length || 1) - 1, saved?.chapter || 0);
    setPageReady(false);
    // 与 jumpChapter 同理：目标章免网络就绪时直接进 reading，省掉 loading 中转的一次闪屏。
    const needsFetch = !chapterReady(target);
    if (needsFetch) setPhase('loading');
    try {
      await ensureChapter(target);
      setChapterIdx(target);
      const targetPage = restart ? 0 : saved?.page || 0;
      setPageIdx(targetPage);
      targetRef.current = { idx: target, page: targetPage };
      setSurfaceLive(true);
      setPhase('reading');
    } catch (e) { setPhase('error'); }
  };

  // surface 一旦常驻（surfaceLive），loading 只作遮罩叠加，不再整屏早退——那会卸载 WebView。
  if (phase === 'checkingCache' || (phase === 'loading' && !surfaceLive)) {
    return <ReaderState T={T} icon="loading" title={phase === 'checkingCache' ? '正在检查整理结果…' : '正在载入…'} onBack={goBack} />;
  }
  if (phase === 'organizing') {
    return <OrganizeState T={T} read={organize.read} total={organize.total} onBack={goBack} />;
  }
  if (phase === 'organizeError') {
    return <ReaderState T={T} icon="wave" title="整理失败" detail={`网络不稳定，已读取 ${organize.read || 0} / ${organize.total || 0} 页`} action="重试" onAction={load} onBack={goBack} />;
  }
  if (!book) {
    return <ReaderState T={T} icon="loading" title="正在载入…" onBack={goBack} />;
  }
  if (phase === 'error') {
    return <ReaderState T={T} icon="wave" title="网络开小差了" detail="本章加载失败，请检查网络后重试。" action="重试" onAction={load} onBack={goBack} />;
  }
  if (phase === 'resume' && saved) {
    return (
      <View style={{ flex: 1, zIndex: 100, backgroundColor: T.bg }}>
        <StatusBar color={T.ink} />
        <Pressable onPress={goBack} style={{ width: 42, height: 42, marginLeft: 14, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" size={22} color={T.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, paddingBottom: 80 }}>
          <View style={{ width: 58, height: 58, borderRadius: 16, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
            <Icon name="history" size={28} color="#fff" />
          </View>
          <Text style={{ color: T.accent, fontFamily: FONTS.head, fontSize: 13, fontWeight: '700', letterSpacing: 2 }}>上次读到</Text>
          <Text style={{ color: T.ink, fontFamily: FONTS.body, fontSize: 19, fontWeight: '600', lineHeight: 27.5, textAlign: 'center', marginTop: 14 }}>{saved.chapterTitle}</Text>
          <Text style={{ color: T.soft, fontFamily: FONTS.head, fontSize: 13.5, marginTop: 8 }}>已读 {saved.pct}% · {book.title}</Text>
          <Pressable onPress={() => continueReading(false)} style={{ width: '100%', maxWidth: 300, height: 52, borderRadius: 999, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center', marginTop: 34 }}>
            <Text style={{ color: '#fff', fontFamily: FONTS.head, fontSize: 16, fontWeight: '600' }}>继续阅读</Text>
          </Pressable>
          <Pressable onPress={() => continueReading(true)} style={{ width: '100%', maxWidth: 300, height: 50, borderRadius: 999, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
            <Text style={{ color: T.soft, fontFamily: FONTS.head, fontSize: 15, fontWeight: '600' }}>从头开始</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  if (!chapter) {
    return <ReaderState T={T} icon="wave" title="没有找到这一章" action="返回" onAction={goBack} onBack={goBack} />;
  }

  // shell 只生成一次（含此刻的主题/字号作首帧初始值），此后 surface 常驻、内容全走注入。
  if (shellRef.current == null) {
    shellRef.current = createReaderShellHtml({ theme: themeKey, fontSize: READER_FONTS[fontIdx] });
  }

  return (
    <View style={{ flex: 1, zIndex: 100, backgroundColor: T.bg }}>
      <View style={{ flex: 1, zIndex: 0 }}>
        <ReaderSurface ref={surfaceRef} html={shellRef.current} backgroundColor={T.bg} onMessage={onReaderMessage} />
      </View>
      {phase === 'loading' && (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: `${T.bg}b3`, zIndex: 70, elevation: 70 }}>
          <ActivityIndicator color={T.accent} size="large" />
        </View>
      )}
      {updateHint && (
        <View pointerEvents="none" style={{ position: 'absolute', top: chrome ? 136 : 58, left: 20, right: 20, alignItems: 'center', zIndex: 60, elevation: 60 }}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: T.chrome, borderWidth: 1, borderColor: T.line }}>
            <Text style={{ color: T.ink, fontFamily: FONTS.head, fontSize: 12.5, fontWeight: '600' }}>{updateHint}</Text>
          </View>
        </View>
      )}
      {!chrome && pageReady && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 27, right: 27, bottom: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text numberOfLines={1} style={{ maxWidth: '60%', color: T.soft, fontFamily: FONTS.head, fontSize: 11.5 }}>{chapter.title}</Text>
          <Text style={{ color: T.soft, fontFamily: FONTS.head, fontSize: 11.5, fontVariant: ['tabular-nums'] }}>{pageIdx + 1}/{pageCount} · {pct}%</Text>
        </View>
      )}
      {hint && !chrome && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: '20%', height: '60%', flexDirection: 'row' }}>
          {['上一页', '唤出菜单', '下一页'].map((label, index) => (
            <View key={label} style={{ flex: index === 1 ? 1.18 : 1, backgroundColor: index === 1 ? 'rgba(20,14,11,.42)' : 'rgba(20,14,11,.30)', alignItems: 'center', justifyContent: 'center', gap: 8, borderLeftWidth: index ? 1 : 0, borderLeftColor: 'rgba(255,255,255,.15)' }}>
              <Icon name={index === 1 ? 'forum' : index ? 'chevRight' : 'back'} size={22} color="#fff" />
              <Text style={{ color: '#fff', fontFamily: FONTS.head, fontSize: 12.5, fontWeight: '600' }}>{label}</Text>
            </View>
          ))}
        </View>
      )}
      {book.diagnostics?.confidence === 'low' && lowHint && !chrome && phase === 'reading' && !hint && (
        <View style={{ position: 'absolute', left: 18, right: 18, bottom: 58, padding: 14, borderRadius: 16, backgroundColor: T.chrome, borderWidth: 1, borderColor: T.line, flexDirection: 'row', gap: 10, alignItems: 'flex-start', zIndex: 20, elevation: 20 }}>
          <Icon name="info" size={17} color={T.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: T.ink, fontFamily: FONTS.head, fontSize: 13, fontWeight: '700' }}>已按楼主楼层保留内容</Text>
            <Text style={{ color: T.soft, fontFamily: FONTS.head, fontSize: 12, lineHeight: 18, marginTop: 3 }}>章节名可能不完整，部分内容可能是楼主说明，可对照原楼层查看。</Text>
          </View>
          <Pressable onPress={dismissLowHint} style={{ padding: 4 }}><Icon name="close" size={15} color={T.soft} /></Pressable>
        </View>
      )}
      {chrome && (
        <>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: T.chrome, borderBottomWidth: 1, borderBottomColor: T.line, zIndex: 30, elevation: 30 }}>
            <StatusBar color={T.ink} />
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, gap: 6 }}>
              <RoundButton icon="back" color={T.ink} onPress={goBack} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text numberOfLines={1} style={{ color: T.ink, fontFamily: FONTS.head, fontSize: 15, fontWeight: '700' }}>{book.title}</Text>
                <Text numberOfLines={1} style={{ color: T.soft, fontFamily: FONTS.head, fontSize: 11.5, marginTop: 2 }}>{chapter.title}</Text>
              </View>
              <RoundButton icon="forum" color={T.ink} onPress={() => setPanel('toc')} />
              <RoundButton icon="more" color={T.ink} onPress={() => setPanel('actions')} />
            </View>
          </View>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: T.chrome, borderTopWidth: 1, borderTopColor: T.line, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 22, zIndex: 30, elevation: 30 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <RoundButton icon="back" color={chapterIdx === 0 ? T.soft : T.ink} onPress={() => chapterIdx > 0 && jumpChapter(chapterIdx - 1)} />
              <ChapterSlider T={T} chapterIdx={chapterIdx} total={book.chapters.length} onJump={jumpChapter} />
              <RoundButton icon="chevRight" color={chapterIdx === book.chapters.length - 1 ? T.soft : T.ink} onPress={() => chapterIdx < book.chapters.length - 1 && jumpChapter(chapterIdx + 1)} />
            </View>
            <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: T.line, marginTop: 10, paddingTop: 6 }}>
              <ToolButton icon="doc" label="目录" T={T} onPress={() => setPanel('toc')} />
              <ToolButton icon="type" label="字号" T={T} onPress={() => setPanel('font')} />
              <ToolButton icon="eye" label="主题" T={T} onPress={() => setPanel('theme')} />
              <ToolButton icon="external" label="原楼层" T={T} onPress={viewOriginalFloor} />
            </View>
          </View>
        </>
      )}
      {panel === 'toc' && (
        <View style={{ position: 'absolute', inset: 0, zIndex: 50, elevation: 50 }}>
          <Pressable onPress={() => setPanel(null)} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(20,12,8,.34)' }} />
          <View style={{ width: '84%', maxWidth: 330, height: '100%', backgroundColor: T.chrome }}>
            <StatusBar color={T.ink} />
            <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: T.line }}>
              <Text numberOfLines={2} style={{ color: T.ink, fontFamily: FONTS.head, fontSize: 18, fontWeight: '700' }}>{book.title}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={{ color: T.soft, fontFamily: FONTS.head, fontSize: 12.5 }}>{book.shape === '短篇' ? '短篇' : `全 ${book.chapters.length} 话`} · {book.statusText}</Text>
                <Pressable onPress={() => setTocReverse((value) => !value)}>
                  <Text style={{ color: T.accent, fontFamily: FONTS.head, fontSize: 12.5, fontWeight: '600' }}>{tocReverse ? '倒序' : '正序'} ⇅</Text>
                </Pressable>
              </View>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: T.line }}>
              <Text style={{ color: T.soft, fontFamily: FONTS.head, fontSize: 11.5, marginBottom: 9 }}>
                上次整理：{book.source?.builtAt ? new Date(book.source.builtAt).toLocaleString() : '尚未整理'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={() => checkUpdates()} style={{ flex: 1, height: 38, borderRadius: 11, borderWidth: 1, borderColor: T.line, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                  <Icon name="refresh" size={15} color={T.ink} />
                  <Text style={{ color: T.ink, fontFamily: FONTS.head, fontSize: 12.5, fontWeight: '600' }}>检查更新</Text>
                </Pressable>
                <Pressable onPress={rebuildAll} style={{ flex: 1, height: 38, borderRadius: 11, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                  <Icon name="layers" size={15} color="#fff" />
                  <Text style={{ color: '#fff', fontFamily: FONTS.head, fontSize: 12.5, fontWeight: '600' }}>重新整理全文</Text>
                </Pressable>
              </View>
            </View>
            {book.diagnostics?.confidence === 'low' && (
              <View style={{ paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.line, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Icon name="info" size={15} color={T.accent} />
                <Text style={{ flex: 1, color: T.ink, fontFamily: FONTS.head, fontSize: 12, lineHeight: 18 }}>已按楼主楼层保留内容，章节名可能不完整。</Text>
              </View>
            )}
            <ScrollView>
              {(tocReverse ? [...book.chapters].reverse() : book.chapters).map((item, index) => {
                const actual = tocReverse ? book.chapters.length - index - 1 : index;
                const current = actual === chapterIdx;
                const weak = isWeakChapter(item.type);
                const isSection = item.type === 'section';
                const label = weak ? '说明' : String(item.no).padStart(2, '0');
                const title = weak ? `说明 · ${item.title}` : item.title;
                return (
                  <Pressable key={item.id} onPress={() => jumpChapter(actual)} style={{ minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderLeftWidth: 3, borderLeftColor: current ? T.accent : 'transparent', backgroundColor: current ? T.bg : 'transparent' }}>
                    <Text style={{ width: 38, color: current ? T.accent : T.soft, fontFamily: FONTS.head, fontSize: weak ? 10.5 : 12.5, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{label}</Text>
                    <Text numberOfLines={1} style={{ flex: 1, color: current ? T.accent : weak || isSection ? T.soft : T.ink, fontFamily: FONTS.head, fontSize: 14.2, fontWeight: current ? '700' : '500' }}>{title}</Text>
                    {current && <Text style={{ color: T.accent, fontFamily: FONTS.head, fontSize: 11, fontWeight: '600' }}>在读</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}
      {(panel === 'font' || panel === 'theme' || panel === 'comments' || panel === 'actions') && (
        <BottomSheet T={T} title={panel === 'font' ? '字号' : panel === 'theme' ? '阅读主题' : panel === 'actions' ? '更多操作' : `本章评论 · ${comments?.length || 0}`} onClose={() => setPanel(null)}>
          {panel === 'actions' && (
            <View style={{ marginHorizontal: -4 }}>
              <ActionRow
                T={T}
                icon="refresh"
                title="检查更新"
                detail="轻量检查新增楼层和目录变化"
                onPress={() => checkUpdates()}
              />
              <ActionRow
                T={T}
                icon="layers"
                accent
                title="重新整理全文"
                detail="清理并重建阅读结构，尽量保留进度"
                onPress={rebuildAll}
              />
              <ActionRow
                T={T}
                icon="external"
                title="查看原楼层"
                detail="退出阅读，打开本章对应的论坛楼层"
                last
                onPress={() => { setPanel(null); viewOriginalFloor(); }}
              />
            </View>
          )}
          {panel === 'font' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <StepButton label="A−" disabled={fontIdx === 0} T={T} onPress={() => { const next = Math.max(0, fontIdx - 1); setFontIdx(next); saveReaderFont(next); }} />
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 }}>
                  {READER_FONTS.map((_, index) => <Pressable key={index} onPress={() => { setFontIdx(index); saveReaderFont(index); }} style={{ width: index === fontIdx ? 14 : 9, height: index === fontIdx ? 14 : 9, borderRadius: 7, backgroundColor: index <= fontIdx ? T.accent : T.line }} />)}
                </View>
                <StepButton label="A" large disabled={fontIdx === READER_FONTS.length - 1} T={T} onPress={() => { const next = Math.min(READER_FONTS.length - 1, fontIdx + 1); setFontIdx(next); saveReaderFont(next); }} />
              </View>
              <View style={{ marginTop: 18, padding: 16, borderRadius: 14, backgroundColor: T.bg, borderWidth: 1, borderColor: T.line }}>
                <Text style={{ color: T.ink, fontFamily: FONTS.body, fontSize: READER_FONTS[fontIdx], lineHeight: READER_FONTS[fontIdx] * 1.95 }}>　　天台的风比楼下要凉一些。她把校服外套往身上拢了拢，正文会按当前字号实时重排。</Text>
                <Text style={{ color: T.soft, fontFamily: FONTS.head, fontSize: 12, textAlign: 'right', marginTop: 8 }}>当前 {READER_FONTS[fontIdx]}px</Text>
              </View>
            </>
          )}
          {panel === 'theme' && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {(Object.keys(READER_THEMES) as ReaderThemeKey[]).map((key) => {
                const item = READER_THEMES[key];
                const current = key === themeKey;
                return (
                  <Pressable key={key} onPress={() => { setThemeKey(key); saveReaderTheme(key); }} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ width: '100%', height: 64, borderRadius: 14, backgroundColor: item.bg, borderWidth: current ? 2.5 : 1, borderColor: current ? T.accent : item.line, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: item.ink, fontFamily: FONTS.body, fontSize: 19, fontWeight: '600' }}>文</Text>
                    </View>
                    <Text style={{ color: current ? T.accent : T.soft, fontFamily: FONTS.head, fontSize: 12.5, fontWeight: current ? '700' : '500', marginTop: 8 }}>{item.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {panel === 'comments' && (
            <ScrollView style={{ maxHeight: 430 }}>
              {commentsLoading ? <ActivityIndicator color={T.accent} style={{ alignSelf: 'center', paddingVertical: 40 }} />
                : !comments?.length ? <Text style={{ color: T.soft, fontFamily: FONTS.body, fontSize: 14.5, textAlign: 'center', alignSelf: 'stretch', paddingVertical: 36 }}>还没有评论，来抢沙发吧～</Text>
                : comments.map((item) => (
                  <View key={item.id} style={{ flexDirection: 'row', gap: 11, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.line }}>
                    <Avatar user={item.user} size={34} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: T.ink, fontFamily: FONTS.head, fontSize: 13.5, fontWeight: '600' }}>{item.user.name}</Text>
                        <Text style={{ color: T.soft, fontFamily: FONTS.head, fontSize: 11.5 }}>{item.time}</Text>
                      </View>
                      <Text style={{ color: T.ink, fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 23.2, marginTop: 3 }}>{item.text}</Text>
                    </View>
                  </View>
                ))}
              <View style={{ height: 46, borderRadius: 999, backgroundColor: T.bg, borderWidth: 1, borderColor: T.line, justifyContent: 'center', paddingHorizontal: 18, marginTop: 12 }}>
                <Text style={{ color: T.soft, fontFamily: FONTS.head, fontSize: 14 }}>写下本章评论…（v1 仅阅读）</Text>
              </View>
            </ScrollView>
          )}
        </BottomSheet>
      )}
    </View>
  );
}

function ReaderState({ T, icon, title, detail, action, onAction, onBack }: any) {
  return (
    <View style={{ flex: 1, zIndex: 100, backgroundColor: T.bg }}>
      {icon !== 'loading' && <><StatusBar color={T.ink} /><Pressable onPress={onBack} style={{ width: 42, height: 42, marginLeft: 14, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={22} color={T.ink} /></Pressable></>}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 18 }}>
        {icon === 'loading' ? <ActivityIndicator color={T.soft} size="large" /> : <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, borderColor: T.line, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={28} color={T.soft} /></View>}
        <Text style={{ color: icon === 'loading' ? T.soft : T.ink, fontFamily: FONTS.head, fontSize: icon === 'loading' ? 14 : 17, fontWeight: icon === 'loading' ? '500' : '700' }}>{title}</Text>
        {detail && <Text style={{ color: T.soft, fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 24.5, textAlign: 'center' }}>{detail}</Text>}
        {action && <Pressable onPress={onAction} style={{ width: '100%', maxWidth: 280, height: 50, borderRadius: 999, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}><Text style={{ color: '#fff', fontFamily: FONTS.head, fontSize: 15.5, fontWeight: '600' }}>{action}</Text></Pressable>}
      </View>
    </View>
  );
}

function OrganizeState({ T, read, total, onBack }: any) {
  const pct = total > 0 ? Math.max(4, Math.min(100, Math.round((read / total) * 100))) : 8;
  return (
    <View style={{ flex: 1, zIndex: 100, backgroundColor: T.bg }}>
      <StatusBar color={T.ink} />
      <Pressable onPress={onBack} style={{ width: 42, height: 42, marginLeft: 14, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="back" size={22} color={T.ink} />
      </Pressable>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 38, paddingBottom: 80 }}>
        <View style={{ width: 58, height: 58, borderRadius: 16, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
          <Icon name="layers" size={28} color="#fff" />
        </View>
        <Text style={{ color: T.ink, fontFamily: FONTS.head, fontSize: 18, fontWeight: '700' }}>正在整理楼主内容</Text>
        <Text style={{ color: T.soft, fontFamily: FONTS.head, fontSize: 13.5, marginTop: 9 }}>已读取 {read || 0} / {total || 0} 页</Text>
        <View style={{ width: '100%', height: 6, borderRadius: 999, backgroundColor: T.line, marginTop: 22, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: 6, borderRadius: 999, backgroundColor: T.accent }} />
        </View>
        <Text style={{ color: T.soft, fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 24, textAlign: 'center', marginTop: 20 }}>首次整理会稍久，之后将直接打开。</Text>
      </View>
    </View>
  );
}

// 章节滑块拖动时每帧 setState，若留在 ReaderScreen 里会整屏重渲染（含 WebView 外的所有 chrome）。
// 收成 memo 子组件，preview 只在这里 setState；对外只暴露 onJump，父组件 props 不变即跳过重渲染。
const ChapterSlider = React.memo(function ChapterSlider({ T, chapterIdx, total, onJump }: {
  T: (typeof READER_THEMES)[ReaderThemeKey]; chapterIdx: number; total: number; onJump: (index: number) => void;
}) {
  const [preview, setPreview] = React.useState<number | null>(null);
  const trackWidth = React.useRef(1);
  const value = preview ?? chapterIdx;
  const fill = total <= 1 ? 100 : (value / (total - 1)) * 100;
  const at = (x: number) => Math.round(Math.max(0, Math.min(1, x / trackWidth.current)) * (total - 1));
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: preview != null ? T.accent : T.soft, fontFamily: FONTS.head, fontSize: 12.5 }}>第 {value + 1} 话</Text>
        <Text style={{ color: T.soft, fontFamily: FONTS.head, fontSize: 12.5 }}>{total === 1 ? '短篇' : `${value + 1} / ${total}`}</Text>
      </View>
      <View
        onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => setPreview(at(e.nativeEvent.locationX))}
        onResponderMove={(e) => setPreview(at(e.nativeEvent.locationX))}
        onResponderRelease={() => { const target = preview; setPreview(null); if (target != null && target !== chapterIdx) onJump(target); }}
        style={{ height: 26, justifyContent: 'center' }}
      >
        <View style={{ height: 3, borderRadius: 2, backgroundColor: T.line }} />
        <View style={{ position: 'absolute', left: 0, width: `${fill}%`, height: 3, borderRadius: 2, backgroundColor: T.accent }} />
        <View style={{ position: 'absolute', left: `${fill}%`, marginLeft: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: T.accent }} />
      </View>
    </View>
  );
});

function RoundButton({ icon, color, onPress }: { icon: string; color: string; onPress: () => void }) {
  return <Pressable hitSlop={8} onPress={onPress} style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}><Icon name={icon} size={21} color={color} /></Pressable>;
}

function ToolButton({ icon, label, T, onPress }: any) {
  return <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 5, paddingVertical: 6 }}><Icon name={icon} size={21} color={T.ink} /><Text style={{ color: T.ink, fontFamily: FONTS.head, fontSize: 11.5, fontWeight: '600' }}>{label}</Text></Pressable>;
}

function ActionRow({ T, icon, title, detail, onPress, accent, last }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        paddingHorizontal: 6,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: T.line,
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 11, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={accent ? T.accent : T.ink} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: T.ink, fontFamily: FONTS.head, fontSize: 15, fontWeight: '600' }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: T.soft, fontFamily: FONTS.head, fontSize: 12, marginTop: 2 }}>{detail}</Text>
      </View>
      <Icon name="chevRight" size={17} color={T.soft} />
    </Pressable>
  );
}

function BottomSheet({ T, title, onClose, children }: any) {
  return (
    <View style={{ position: 'absolute', inset: 0, justifyContent: 'flex-end', zIndex: 50, elevation: 50 }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(20,12,8,.34)' }} />
      <View style={{ maxHeight: '78%', backgroundColor: T.chrome, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 22 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ color: T.ink, fontFamily: FONTS.head, fontSize: 16, fontWeight: '700' }}>{title}</Text>
          <Pressable onPress={onClose} style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={18} color={T.soft} /></Pressable>
        </View>
        {children}
      </View>
    </View>
  );
}

function StepButton({ label, large, disabled, T, onPress }: any) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={{ width: 52, height: 52, borderRadius: 14, borderWidth: 1, borderColor: T.line, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1 }}>
      <Text style={{ color: disabled ? T.soft : T.ink, fontFamily: FONTS.head, fontSize: large ? 24 : 16, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
