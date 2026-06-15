import React from 'react';
import {
  ActivityIndicator, Linking, Pressable, ScrollView, Text, View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar, Avatar } from '../components/ui';
import Icon from '../components/Icon';
import ReaderSurface from '../components/ReaderSurface';
import { createReaderHtml } from '../readerHtml';
import { getChapterComments, getReadingStream } from '../api';
import {
  buildReadingBook, getReaderSettings, getReadingProgress, LITERATURE_FIDS,
  markReaderHinted, READER_FONTS, READER_THEMES, saveReaderFont,
  saveReaderTheme, saveReadingProgress, stripLeadingChapterTitle, type ReaderThemeKey,
} from '../reading';
import { FONTS } from '../theme';
import { useNav } from '../useNav';
import type {
  Block, ReadingBook, ReadingComment, ReadingProgress, ReadingStreamPage, RootStackParamList,
} from '../types';

type Phase = 'loading' | 'resume' | 'reading' | 'error';
type Panel = null | 'toc' | 'font' | 'theme' | 'comments';

export default function ReaderScreen({ route }: NativeStackScreenProps<RootStackParamList, 'reader'>) {
  const { tid, authorid, fresh } = route.params;
  const nav = useNav();
  const [phase, setPhase] = React.useState<Phase>('loading');
  const [book, setBookState] = React.useState<ReadingBook | null>(null);
  const bookRef = React.useRef<ReadingBook | null>(null);
  const pagesRef = React.useRef(new Map<number, ReadingStreamPage>());
  const [saved, setSaved] = React.useState<ReadingProgress | null>(null);
  const [chapterIdx, setChapterIdx] = React.useState(0);
  const [pageIdx, setPageIdx] = React.useState(0);
  const [sourcePage, setSourcePage] = React.useState(0);
  const [pageCount, setPageCount] = React.useState(1);
  const [chrome, setChrome] = React.useState(false);
  const [panel, setPanel] = React.useState<Panel>(null);
  const [themeKey, setThemeKey] = React.useState<ReaderThemeKey>('paper');
  const [fontIdx, setFontIdx] = React.useState(1);
  const [hint, setHint] = React.useState(false);
  const [comments, setComments] = React.useState<ReadingComment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = React.useState(false);
  const [tocReverse, setTocReverse] = React.useState(false);
  const [sliderPreview, setSliderPreview] = React.useState<number | null>(null);
  const trackWidth = React.useRef(1);

  const setBook = React.useCallback((next: ReadingBook) => {
    bookRef.current = next;
    setBookState(next);
  }, []);

  const ensureChapter = React.useCallback(async (index: number): Promise<Block[]> => {
    const current = bookRef.current;
    if (!current) throw new Error('阅读数据尚未载入');
    const ready = current.chapters[index]?.blocks;
    if (ready) return ready;
    const target = current.chapters[index];
    const estimated = Math.max(1, Math.min(current.totalPages, Math.floor((index + 1) / current.ppp) + 1));
    const order: number[] = [];
    for (let page = estimated; page <= current.totalPages; page += 1) order.push(page);
    for (let page = estimated - 1; page >= 1; page -= 1) order.push(page);
    for (const page of order) {
      let stream = pagesRef.current.get(page);
      if (!stream) {
        stream = await getReadingStream(tid, authorid, page);
        pagesRef.current.set(page, stream);
      }
      const postMap = new Map(stream.posts.map((post) => [post.pid, post]));
      const latest = bookRef.current!;
      let changed = false;
      const chapters = latest.chapters.map((chapter) => {
        if (chapter.blocks) return chapter;
        const post = postMap.get(chapter.pid);
        if (!post) return chapter;
        changed = true;
        return { ...chapter, pos: post.pos, blocks: stripLeadingChapterTitle(post.blocks, chapter.title) };
      });
      if (changed) setBook({ ...latest, chapters });
      const found = chapters[index]?.blocks;
      if (found) return found;
    }
    throw new Error('没有找到这一章的正文');
  }, [authorid, setBook, tid]);

  const load = React.useCallback(async () => {
    setPhase('loading');
    try {
      const [settings, progress, first] = await Promise.all([
        getReaderSettings(), getReadingProgress(tid), getReadingStream(tid, authorid, 1),
      ]);
      if (!LITERATURE_FIDS.has(String(first.fid || ''))) throw new Error('阅读模式仅支持文学区帖子');
      pagesRef.current = new Map([[1, first]]);
      let nextBook = buildReadingBook(first);
      const directoryBacked = nextBook.chapters.some((item) => !item.blocks);
      if (!directoryBacked && first.totalPages > 1) {
        const rest = await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) => getReadingStream(tid, authorid, index + 2)));
        rest.forEach((stream) => pagesRef.current.set(stream.page, stream));
        nextBook = buildReadingBook({ ...first, posts: [first.posts, ...rest.map((stream) => stream.posts)].flat() });
      }
      if (!nextBook.chapters.length) throw new Error('没有识别到可阅读的正文');
      setBook(nextBook);
      setThemeKey(settings.theme);
      setFontIdx(settings.fontIdx);
      setHint(!settings.hinted);
      setSaved(progress);
      const initial = !fresh && progress ? Math.min(nextBook.chapters.length - 1, progress.chapter) : 0;
      setChapterIdx(initial);
      const initialPage = !fresh && progress ? progress.page : 0;
      setPageIdx(initialPage);
      setSourcePage(initialPage);
      if (!fresh && progress) setPhase('resume');
      else {
        await ensureChapter(initial);
        setPhase('reading');
      }
    } catch (e) {
      nav.toast(e.message || '载入失败');
      setPhase('error');
    }
  }, [authorid, ensureChapter, fresh, nav, setBook, tid]);

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (phase !== 'reading' || !hint) return;
    const timer = setTimeout(() => { setHint(false); markReaderHinted(); }, 3200);
    return () => clearTimeout(timer);
  }, [hint, phase]);

  const chapter = book?.chapters[chapterIdx];
  const pct = book ? Math.max(1, Math.min(100, Math.round(((chapterIdx + (pageIdx + 1) / Math.max(1, pageCount)) / book.chapters.length) * 100))) : 1;

  React.useEffect(() => {
    if (phase !== 'reading' || !book || !chapter) return;
    saveReadingProgress(tid, { chapter: chapterIdx, page: pageIdx, pct, chapterTitle: chapter.title, ts: Date.now() });
  }, [book, chapter, chapterIdx, pageIdx, pct, phase, tid]);

  const jumpChapter = React.useCallback(async (index: number, targetPage = 0) => {
    if (!book || index < 0 || index >= book.chapters.length) return;
    setPanel(null);
    setChrome(false);
    setPhase('loading');
    try {
      await ensureChapter(index);
      setChapterIdx(index);
      setPageIdx(targetPage);
      setSourcePage(targetPage);
      setPageCount(1);
      setComments(null);
      setPhase('reading');
    } catch (e) {
      nav.toast(e.message || '章节加载失败');
      setPhase('error');
    }
  }, [book, ensureChapter, nav]);

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

  const onReaderMessage = React.useCallback((raw: string) => {
    let msg: any;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    if (msg.type === 'page') {
      setPageIdx(msg.page || 0);
      setPageCount(Math.max(1, msg.pages || 1));
    } else if (msg.type === 'toggleChrome') {
      setChrome((value) => !value);
    } else if (msg.type === 'nextChapter') {
      if (book && chapterIdx < book.chapters.length - 1) jumpChapter(chapterIdx + 1);
    } else if (msg.type === 'prevChapter') {
      if (chapterIdx > 0) jumpChapter(chapterIdx - 1, 9999);
    } else if (msg.type === 'comments') {
      openComments();
    } else if (msg.type === 'image') {
      const images = (chapter?.blocks || []).filter((block) => block.t === 'img').map((block: any) => ({ src: block.src, cap: block.cap }));
      const index = Math.max(0, images.findIndex((image) => image.src === msg.src));
      nav.openViewer(images.length ? images : [{ src: msg.src, cap: '图片' }], index);
    } else if (msg.type === 'link') {
      const href = String(msg.href || '');
      if (!/^https?:\/\//i.test(href)) return;
      const match = href.match(/[?&](?:tid|ptid)=(\d+)/);
      if (/^https?:\/\/bbs\.yamibo\.com\//i.test(href) && match) nav.push('thread', { thread: { tid: match[1], title: '帖子' } });
      else Linking.openURL(href).catch(() => nav.toast('无法打开这个链接'));
    }
  }, [book, chapter, chapterIdx, jumpChapter, nav, openComments]);

  const T = READER_THEMES[themeKey];
  const html = React.useMemo(() => {
    if (!book || !chapter?.blocks) return '';
    return createReaderHtml({
      title: book.title,
      chapterNo: chapter.no,
      chapterTitle: chapter.title.replace(/^(?:第\s*\d+\s*[话話]\s*[·:：\-]?\s*)/i, ''),
      blocks: chapter.blocks,
      theme: themeKey,
      fontSize: READER_FONTS[fontIdx],
      initialPage: sourcePage,
      comments: comments?.length ?? null,
      isLast: chapterIdx === book.chapters.length - 1,
      complete: book.statusText === '完结',
    });
  }, [book, chapter, chapterIdx, fontIdx, sourcePage, themeKey]);

  const continueReading = async (restart = false) => {
    const target = restart ? 0 : Math.min((book?.chapters.length || 1) - 1, saved?.chapter || 0);
    setPhase('loading');
    try {
      await ensureChapter(target);
      setChapterIdx(target);
      const targetPage = restart ? 0 : saved?.page || 0;
      setPageIdx(targetPage);
      setSourcePage(targetPage);
      setPhase('reading');
    } catch (e) { setPhase('error'); }
  };

  if (!book || phase === 'loading') {
    return <ReaderState T={T} icon="loading" title="正在载入…" onBack={nav.pop} />;
  }
  if (phase === 'error') {
    return <ReaderState T={T} icon="wave" title="网络开小差了" detail="本章加载失败，请检查网络后重试。" action="重试" onAction={load} onBack={nav.pop} />;
  }
  if (phase === 'resume' && saved) {
    return (
      <View style={{ flex: 1, zIndex: 100, backgroundColor: T.bg }}>
        <StatusBar color={T.ink} />
        <Pressable onPress={nav.pop} style={{ width: 42, height: 42, marginLeft: 14, alignItems: 'center', justifyContent: 'center' }}>
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
    return <ReaderState T={T} icon="wave" title="没有找到这一章" action="返回" onAction={nav.pop} onBack={nav.pop} />;
  }

  return (
    <View style={{ flex: 1, zIndex: 100, backgroundColor: T.bg }}>
      <ReaderSurface html={html} backgroundColor={T.bg} onMessage={onReaderMessage} />
      {!chrome && (
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
      {chrome && (
        <>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: T.chrome, borderBottomWidth: 1, borderBottomColor: T.line }}>
            <StatusBar color={T.ink} />
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, gap: 6 }}>
              <RoundButton icon="back" color={T.ink} onPress={nav.pop} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text numberOfLines={1} style={{ color: T.ink, fontFamily: FONTS.head, fontSize: 15, fontWeight: '700' }}>{book.title}</Text>
                <Text numberOfLines={1} style={{ color: T.soft, fontFamily: FONTS.head, fontSize: 11.5, marginTop: 2 }}>{chapter.title}</Text>
              </View>
              <RoundButton icon="forum" color={T.ink} onPress={() => setPanel('toc')} />
            </View>
          </View>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: T.chrome, borderTopWidth: 1, borderTopColor: T.line, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 22 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <RoundButton icon="back" color={chapterIdx === 0 ? T.soft : T.ink} onPress={() => chapterIdx > 0 && jumpChapter(chapterIdx - 1)} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: sliderPreview != null ? T.accent : T.soft, fontFamily: FONTS.head, fontSize: 12.5 }}>第 {(sliderPreview ?? chapterIdx) + 1} 话</Text>
                  <Text style={{ color: T.soft, fontFamily: FONTS.head, fontSize: 12.5 }}>{book.chapters.length === 1 ? '短篇' : `${(sliderPreview ?? chapterIdx) + 1} / ${book.chapters.length}`}</Text>
                </View>
                <View
                  onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={(e) => setSliderPreview(Math.round(Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidth.current)) * (book.chapters.length - 1)))}
                  onResponderMove={(e) => setSliderPreview(Math.round(Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidth.current)) * (book.chapters.length - 1)))}
                  onResponderRelease={() => { const target = sliderPreview; setSliderPreview(null); if (target != null && target !== chapterIdx) jumpChapter(target); }}
                  style={{ height: 26, justifyContent: 'center' }}
                >
                  <View style={{ height: 3, borderRadius: 2, backgroundColor: T.line }} />
                  <View style={{ position: 'absolute', left: 0, width: `${book.chapters.length <= 1 ? 100 : ((sliderPreview ?? chapterIdx) / (book.chapters.length - 1)) * 100}%`, height: 3, borderRadius: 2, backgroundColor: T.accent }} />
                  <View style={{ position: 'absolute', left: `${book.chapters.length <= 1 ? 100 : ((sliderPreview ?? chapterIdx) / (book.chapters.length - 1)) * 100}%`, marginLeft: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: T.accent }} />
                </View>
              </View>
              <RoundButton icon="chevRight" color={chapterIdx === book.chapters.length - 1 ? T.soft : T.ink} onPress={() => chapterIdx < book.chapters.length - 1 && jumpChapter(chapterIdx + 1)} />
            </View>
            <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: T.line, marginTop: 10, paddingTop: 6 }}>
              <ToolButton icon="doc" label="目录" T={T} onPress={() => setPanel('toc')} />
              <ToolButton icon="type" label="字号" T={T} onPress={() => setPanel('font')} />
              <ToolButton icon="eye" label="主题" T={T} onPress={() => setPanel('theme')} />
            </View>
          </View>
        </>
      )}
      {panel === 'toc' && (
        <View style={{ position: 'absolute', inset: 0 }}>
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
            <ScrollView>
              {(tocReverse ? [...book.chapters].reverse() : book.chapters).map((item, index) => {
                const actual = tocReverse ? book.chapters.length - index - 1 : index;
                const current = actual === chapterIdx;
                return (
                  <Pressable key={item.id} onPress={() => jumpChapter(actual)} style={{ minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderLeftWidth: 3, borderLeftColor: current ? T.accent : 'transparent', backgroundColor: current ? T.bg : 'transparent' }}>
                    <Text style={{ width: 38, color: current ? T.accent : T.soft, fontFamily: FONTS.head, fontSize: 12.5, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{String(item.no).padStart(2, '0')}</Text>
                    <Text numberOfLines={1} style={{ flex: 1, color: current ? T.accent : T.ink, fontFamily: FONTS.head, fontSize: 14.5, fontWeight: current ? '700' : '500' }}>{item.title}</Text>
                    {current && <Text style={{ color: T.accent, fontFamily: FONTS.head, fontSize: 11, fontWeight: '600' }}>在读</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}
      {(panel === 'font' || panel === 'theme' || panel === 'comments') && (
        <BottomSheet T={T} title={panel === 'font' ? '字号' : panel === 'theme' ? '阅读主题' : `本章评论 · ${comments?.length || 0}`} onClose={() => setPanel(null)}>
          {panel === 'font' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <StepButton label="A−" disabled={fontIdx === 0} T={T} onPress={() => { const next = Math.max(0, fontIdx - 1); setSourcePage(pageIdx); setFontIdx(next); saveReaderFont(next); }} />
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 }}>
                  {READER_FONTS.map((_, index) => <Pressable key={index} onPress={() => { setSourcePage(pageIdx); setFontIdx(index); saveReaderFont(index); }} style={{ width: index === fontIdx ? 14 : 9, height: index === fontIdx ? 14 : 9, borderRadius: 7, backgroundColor: index <= fontIdx ? T.accent : T.line }} />)}
                </View>
                <StepButton label="A" large disabled={fontIdx === READER_FONTS.length - 1} T={T} onPress={() => { const next = Math.min(READER_FONTS.length - 1, fontIdx + 1); setSourcePage(pageIdx); setFontIdx(next); saveReaderFont(next); }} />
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
                  <Pressable key={key} onPress={() => { setSourcePage(pageIdx); setThemeKey(key); saveReaderTheme(key); }} style={{ flex: 1, alignItems: 'center' }}>
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

function RoundButton({ icon, color, onPress }: { icon: string; color: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={21} color={color} /></Pressable>;
}

function ToolButton({ icon, label, T, onPress }: any) {
  return <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 5, paddingVertical: 6 }}><Icon name={icon} size={21} color={T.ink} /><Text style={{ color: T.ink, fontFamily: FONTS.head, fontSize: 11.5, fontWeight: '600' }}>{label}</Text></Pressable>;
}

function BottomSheet({ T, title, onClose, children }: any) {
  return (
    <View style={{ position: 'absolute', inset: 0, justifyContent: 'flex-end' }}>
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
