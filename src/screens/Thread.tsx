import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Linking, LayoutChangeEvent } from 'react-native';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import { NavHeader, NavBack, Avatar, Divider, Kicker, Pager } from '../components/ui';
import RemoteImage from '../components/RemoteImage';
import { Loader, ErrorView } from '../components/states';
import { useNav } from '../useNav';
import { useTheme, FONTS } from '../theme';
import { getThread } from '../api';
import { recordThread } from '../history';
import { LITERATURE_FIDS } from '../reading';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Block, Floor as FloorType, ThreadData, ThreadImage, ThreadNavParam, RootStackParamList } from '../types';

function FloorBlock({ b, onImg, onLink }: { b: Block; onImg?: (src: string | null) => void; onLink?: (href: string) => void }) {
  const { t } = useTheme();
  if (b.t === 'text') return <Text style={{ fontFamily: FONTS.body, fontSize: 16, marginBottom: 12, color: t.ink2, lineHeight: 27.5 }}>{b.v}</Text>;
  if (b.t === 'link') return (
    <Text
      accessibilityRole="link"
      onPress={() => onLink && onLink(b.href)}
      style={{ fontFamily: FONTS.body, fontSize: 16, marginBottom: 12, color: t.accentInk, lineHeight: 27.5, textDecorationLine: 'underline' }}
    >
      {b.v}
    </Text>
  );
  if (b.t === 'quote') return (
    <View style={{ borderLeftWidth: 2, borderLeftColor: t.lineStrong, paddingLeft: 14, paddingVertical: 2, marginVertical: 12 }}>
      {b.who ? <Text style={{ fontFamily: FONTS.head, fontSize: 12, fontWeight: '600', color: t.muted, marginBottom: 4 }}>{b.who} 写道</Text> : null}
      <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: t.muted }}>{b.v}</Text>
    </View>
  );
  if (b.t === 'img') return <RemoteImage src={b.src} cap={b.cap} width={b.width} height={b.height} onPress={() => onImg && onImg(b.src)} />;
  return null;
}

function Floor({ f, onImg, onLink, onUnavailable }: { f: FloorType; onImg?: (src: string | null) => void; onLink?: (href: string) => void; onUnavailable: () => void }) {
  const { t } = useTheme();
  return (
    <View style={{ paddingTop: 20, paddingBottom: 6, paddingHorizontal: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 }}>
        <Avatar user={f.user} size={36} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: FONTS.head, fontSize: 14.5, fontWeight: '600', color: t.ink }}>{f.user.name}</Text>
            {f.op && <Text style={{ fontFamily: FONTS.head, fontSize: 11, fontWeight: '700', color: t.accentInk }}>楼主</Text>}
          </View>
          <Text style={{ fontFamily: FONTS.head, fontSize: 12, color: t.muted, fontWeight: '500', marginTop: 2 }}>{f.time}</Text>
        </View>
        <Text style={{ fontFamily: FONTS.head, fontSize: 12, fontWeight: '600', color: t.faint }}>{f.floor === 1 ? '' : f.floor + '楼'}</Text>
      </View>
      <View style={{ paddingLeft: 2 }}>
        {f.blocks.map((b, i) => <FloorBlock key={i} b={b} onImg={onImg} onLink={onLink} />)}
      </View>
      {!f.op && (
        <View style={{ flexDirection: 'row', gap: 22, paddingTop: 2, paddingBottom: 8 }}>
          <Pressable onPress={onUnavailable} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="heart" size={16} color={t.muted} /><Text style={{ fontFamily: FONTS.head, fontSize: 12.5, color: t.muted, fontWeight: '500' }}>赞</Text>
          </Pressable>
          <Pressable onPress={onUnavailable} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="reply" size={16} color={t.muted} /><Text style={{ fontFamily: FONTS.head, fontSize: 12.5, color: t.muted, fontWeight: '500' }}>回复</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// 按楼层定位（内联文字风, ported from .fjrow）
function FloorJump({ onLocate }: { onLocate: (f: number) => void }) {
  const { t } = useTheme();
  const [v, setV] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const go = () => { const n = parseInt(v, 10); if (n) { onLocate(n); setV(''); } };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
      <Text style={{ fontFamily: FONTS.head, fontSize: 12, color: t.faint, fontWeight: '500' }}>跳至</Text>
      <TextInput
        value={v}
        onChangeText={(s) => setV(s.replace(/[^0-9]/g, ''))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSubmitEditing={go}
        keyboardType="number-pad"
        returnKeyType="go"
        style={{
          width: 26, textAlign: 'center', paddingVertical: 0, paddingBottom: 1,
          borderBottomWidth: 1.5, borderBottomColor: focused ? t.accent : t.lineStrong,
          color: t.ink, fontFamily: FONTS.head, fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums'],
        }}
      />
      <Text style={{ fontFamily: FONTS.head, fontSize: 12, color: t.faint, fontWeight: '500' }}>楼</Text>
      <Pressable onPress={go} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingLeft: 2 })}>
        <Text style={{ fontFamily: FONTS.head, fontSize: 12, fontWeight: '600', color: t.accentInk }}>定位</Text>
      </Pressable>
    </View>
  );
}

export default function ThreadScreen({ route }: NativeStackScreenProps<RootStackParamList, 'thread'>) {
  const paramThread: ThreadNavParam = route.params?.thread || {};
  const tid = (route.params?.tid || paramThread.tid || paramThread.id) as string;
  const board = route.params?.board;
  const nav = useNav();
  const { t } = useTheme();

  const [data, setData] = React.useState<ThreadData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [paging, setPaging] = React.useState(false);
  const [flash, setFlash] = React.useState<number | null>(null);
  const scRef = React.useRef<ScrollView>(null);
  const floorY = React.useRef<Map<number, number>>(new Map());
  const pending = React.useRef<number | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const d = await getThread(tid, 1);
      setData(d);
      setPage(1);
      setTotalPages(d.totalPages);
      recordThread({ tid, title: d.thread.title || paramThread.title, author: d.thread.author });
    } catch (e) {
      setError(e.message);
    }
  }, [tid]); // eslint-disable-line

  React.useEffect(() => { load(); }, [load]);

  const fetchPage = async (n: number) => {
    if (paging) return;
    setPaging(true);
    floorY.current.clear();
    try {
      const d = await getThread(tid, n);
      setData((prev) => (prev ? { ...prev, floors: d.floors, images: d.images, page: d.page, hasMore: d.hasMore, totalPages: d.totalPages } : d));
      setPage(n);
      setTotalPages(d.totalPages);
    } catch (e) {
      nav.toast(e.message);
    } finally {
      setPaging(false);
    }
  };
  const goPage = (n: number) => { pending.current = null; if (n !== page) fetchPage(n); };

  const scrollToFloor = (f: number, smooth: boolean) => {
    const run = () => {
      const y = floorY.current.get(f);
      if (y != null) scRef.current?.scrollTo({ y: Math.max(0, y - 54), animated: smooth });
    };
    // 等新渲染的楼层完成布局后再滚动；翻页后布局可能延迟，instant 再补一次。
    setTimeout(() => { run(); setFlash(f); }, 40);
    if (!smooth) setTimeout(run, 220);
    setTimeout(() => setFlash(null), 1900);
  };
  const locate = (f: number) => {
    const total = (data?.thread.replies || 0) + 1;
    f = Math.max(1, Math.min(total, (f | 0) || 1));
    const tp = Math.ceil(f / ppp);
    if (tp === page) scrollToFloor(f, true);
    else { pending.current = f; fetchPage(tp); }
  };

  React.useEffect(() => {
    if (pending.current != null) { const f = pending.current; pending.current = null; scrollToFloor(f, false); }
    else { scRef.current?.scrollTo({ y: 0, animated: false }); }
  }, [page]); // eslint-disable-line

  const openImg = (src: string | null) => {
    const imgs: ThreadImage[] = data?.images?.length ? data.images : [{ src, cap: '图片' }];
    const idx = Math.max(0, imgs.findIndex((i) => i.src === src));
    nav.openViewer(imgs, idx);
  };
  const openLink = async (href: string) => {
    const threadMatch = href.match(/[?&](?:tid|ptid)=(\d+)/);
    if (/^https?:\/\/bbs\.yamibo\.com\//i.test(href) && threadMatch) {
      nav.push('thread', { thread: { tid: threadMatch[1], title: '帖子' } });
      return;
    }
    try {
      await Linking.openURL(href);
    } catch (e) {
      nav.toast('无法打开这个链接');
    }
  };

  const thread = data?.thread || paramThread;
  const floors = data?.floors || [];
  const ppp = data?.ppp || 20;
  const totalFloors = (data?.thread.replies || 0) + 1;
  const showOP = !!floors[0]?.op;                 // 楼主仅第一页
  const replyFloors = showOP ? floors.slice(1) : floors;
  // 文学区（小说/翻译）帖子一律提供阅读模式入口，只需楼主 uid 可做 authorid 过滤。
  const readingCandidate = !!data
    && LITERATURE_FIDS.has(String(data.thread.fid || board?.fid || ''))
    && !!data.thread.author?.uid;
  const openReader = (fresh?: boolean) => {
    if (!data?.thread.author?.uid) return;
    nav.push('reader', { tid, authorid: data.thread.author.uid, fresh });
  };

  return (
    <Screen>
      <NavHeader title="" onBack={nav.pop}
        right={readingCandidate
          ? <Pressable onPress={() => openReader()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="book" size={18} color="#fff" /></Pressable>
          : <NavBack onBack={nav.notImplemented}><Icon name="share" size={18} color={t.inkSoft} /></NavBack>} />

      {error ? <ErrorView message={error} onRetry={load} />
        : !data ? <Loader label="加载帖子…" />
        : (
          <ScrollView ref={scRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            <View style={{ paddingTop: 2, paddingHorizontal: 22, paddingBottom: 18 }}>
              <Kicker style={{ marginBottom: 14 }}>
                {board ? board.name : '帖子'}{thread.pinned ? '  ·  置顶' : ''}{totalPages > 1 ? `  ·  第 ${page}/${totalPages} 页` : ''}
              </Kicker>
              <Text style={{ fontFamily: FONTS.head, fontSize: 26, fontWeight: '700', color: t.ink, lineHeight: 34.8, letterSpacing: -0.2, marginBottom: 20 }}>{thread.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                <Avatar user={thread.author} size={38} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontFamily: FONTS.head, fontSize: 14.5, fontWeight: '600', color: t.ink }}>{thread.author?.name}</Text>
                    <Text style={{ fontFamily: FONTS.head, fontSize: 11, fontWeight: '700', color: t.accentInk }}>楼主</Text>
                  </View>
                  <Text style={{ fontFamily: FONTS.head, fontSize: 12, color: t.muted, fontWeight: '500', marginTop: 2 }}>
                    {thread.author?.group ? thread.author.group + ' · ' : ''}{thread.time}
                  </Text>
                </View>
              </View>
            </View>
            <Divider />
            {/* OP body — 仅第一页 */}
            {showOP ? (
              <View
                onLayout={(e: LayoutChangeEvent) => floorY.current.set(1, e.nativeEvent.layout.y)}
                style={{ backgroundColor: flash === 1 ? t.accentSoft : 'transparent' }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 12, paddingHorizontal: 22 }}>
                  <Text style={{ fontFamily: FONTS.head, fontSize: 12, fontWeight: '600', color: t.faint }}>1楼 · 楼主</Text>
                </View>
                <View style={{ paddingTop: 6, paddingHorizontal: 22, paddingBottom: 8 }}>
                  {floors[0].blocks.map((b, i) => <FloorBlock key={i} b={b} onImg={openImg} onLink={openLink} />)}
                </View>
              </View>
            ) : null}
            {/* replies */}
            <Kicker style={{ paddingTop: 16, paddingHorizontal: 22 }}>{thread.replies} 条回复</Kicker>
            <Divider style={{ marginTop: 14 }} />
            {replyFloors.length === 0 ? (
              <Text style={{ fontFamily: FONTS.body, textAlign: 'center', fontSize: 13, color: t.muted, paddingVertical: 30 }}>
                {totalFloors <= 1 ? '还没有回复，来抢沙发吧' : '本页暂无回复'}
              </Text>
            ) : replyFloors.map((f, i) => (
              <View key={f.pid || f.floor} onLayout={(e: LayoutChangeEvent) => floorY.current.set(f.floor, e.nativeEvent.layout.y)}>
                <View style={{ backgroundColor: flash === f.floor ? t.accentSoft : 'transparent' }}>
                  <Floor f={f} onImg={openImg} onLink={openLink} onUnavailable={nav.notImplemented} />
                </View>
                {i < replyFloors.length - 1 && <Divider />}
              </View>
            ))}
            {/* pager（含按楼层定位） */}
            <View style={{ opacity: paging ? 0.5 : 1 }} pointerEvents={paging ? 'none' : 'auto'}>
              <Pager
                page={page}
                totalPages={totalPages}
                onJump={goPage}
                cap={`共 ${totalFloors} 楼 · 每页 ${ppp} 楼`}
                extra={totalFloors > ppp ? <FloorJump onLocate={locate} /> : null}
              />
            </View>
            <View style={{ height: 8 }} />
          </ScrollView>
        )}

      {/* fixed action bar — v1 read only */}
      <View style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14, borderTopWidth: 1, borderTopColor: t.line, flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: t.bg }}>
        <Pressable onPress={nav.notImplemented}
          style={{ flex: 1, height: 46, borderRadius: 999, backgroundColor: t.field, justifyContent: 'center', paddingHorizontal: 20 }}>
          <Text style={{ color: t.faint, fontFamily: FONTS.head, fontSize: 14.5 }}>暂无实现此功能</Text>
        </Pressable>
        <Pressable onPress={nav.notImplemented}>
          <Icon name="heart" size={24} color={t.inkSoft} fill="none" />
        </Pressable>
        <Pressable onPress={nav.notImplemented}>
          <Icon name="share" size={22} color={t.inkSoft} />
        </Pressable>
      </View>
    </Screen>
  );
}
