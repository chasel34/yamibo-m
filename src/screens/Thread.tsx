import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Linking } from 'react-native';
import { LegendList, type LegendListRef } from '@legendapp/list/react-native';
import { StackActions } from '@react-navigation/native';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import { NavHeader, Avatar, Divider, Kicker, Pager } from '../components/ui';
import RemoteImage from '../components/RemoteImage';
import { Loader, ErrorView } from '../components/states';
import { useNav } from '../useNav';
import { useTheme, FONTS } from '../theme';
import { getThread, getThreadFavorite, resolvePostPage, setThreadFavorite } from '../api';
import { parseForumLink } from '../forumLinks';
import { recordThread } from '../history';
import { LITERATURE_FIDS } from '../reading';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Block, Floor as FloorType, NavAuthor, RichTextRun, ThreadData, ThreadImage, ThreadNavParam, RootStackParamList } from '../types';

function RichText({ runs, onLink }: { runs: RichTextRun[]; onLink?: (href: string) => void }) {
  const { t } = useTheme();
  return (
    <Text style={{ fontFamily: FONTS.body, fontSize: 16, marginBottom: 12, color: t.ink2, lineHeight: 27.5 }}>
      {runs.map((run, index) => (
        <Text
          key={index}
          accessibilityRole={run.href ? 'link' : undefined}
          onPress={run.href ? () => onLink && onLink(run.href || '') : undefined}
          style={{
            color: run.href ? t.accentInk : run.tone === 'accent' ? t.accentInk : run.tone === 'muted' ? t.muted : t.ink2,
            fontFamily: run.bold ? FONTS.head : FONTS.body,
            fontWeight: run.bold ? '700' : '400',
            fontSize: run.size === 'large' ? 18 : run.size === 'small' ? 13.5 : 16,
            textDecorationLine: run.href ? 'underline' : 'none',
          }}
        >
          {run.v}
        </Text>
      ))}
    </Text>
  );
}

function TableBlock({ rows }: { rows: string[][] }) {
  const { t } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
      <View style={{ borderWidth: 1, borderColor: t.line, borderRadius: 8, overflow: 'hidden', minWidth: 260 }}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={{ flexDirection: 'row', backgroundColor: rowIndex === 0 ? t.card : 'transparent', borderTopWidth: rowIndex === 0 ? 0 : 1, borderTopColor: t.line }}>
            {row.map((cell, cellIndex) => (
              <View key={cellIndex} style={{ minWidth: 96, maxWidth: 190, paddingVertical: 8, paddingHorizontal: 10, borderLeftWidth: cellIndex === 0 ? 0 : 1, borderLeftColor: t.line }}>
                <Text style={{ fontFamily: rowIndex === 0 ? FONTS.head : FONTS.body, fontSize: 13, fontWeight: rowIndex === 0 ? '700' : '400', color: rowIndex === 0 ? t.ink : t.ink2, lineHeight: 19 }}>{cell}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function FloorBlock({ b, onImg, onLink }: { b: Block; onImg?: (src: string | null) => void; onLink?: (href: string) => void }) {
  const { t } = useTheme();
  if (b.t === 'text') return <Text style={{ fontFamily: FONTS.body, fontSize: 16, marginBottom: 12, color: t.ink2, lineHeight: 27.5 }}>{b.v}</Text>;
  if (b.t === 'rich') return <RichText runs={b.runs} onLink={onLink} />;
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
      {b.href ? (
        <Text accessibilityRole="link" onPress={() => onLink && onLink(b.href || '')} style={{ fontFamily: FONTS.head, fontSize: 12, fontWeight: '600', color: t.accentInk, marginTop: 6 }}>
          查看原楼层
        </Text>
      ) : null}
    </View>
  );
  if (b.t === 'notice') return (
    <View style={{ borderRadius: 12, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12 }}>
      <Text style={{ fontFamily: FONTS.head, fontSize: 12.5, fontWeight: '600', color: t.muted }}>{b.kind === 'hidden' ? '隐藏内容' : '折叠内容'}</Text>
      <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: t.muted, lineHeight: 21, marginTop: 3 }}>{b.v}</Text>
    </View>
  );
  if (b.t === 'attachment') return (
    <Pressable
      disabled={!b.href}
      onPress={() => b.href && onLink && onLink(b.href)}
      style={{ borderRadius: 12, borderWidth: 1, borderColor: t.line, backgroundColor: t.card, paddingVertical: 11, paddingHorizontal: 12, marginBottom: 12 }}
    >
      <Text style={{ fontFamily: FONTS.head, fontSize: 14, fontWeight: '700', color: b.href ? t.accentInk : t.muted }}>附件 · {b.name}</Text>
      <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: t.muted, marginTop: 4 }}>{b.href ? `${b.size ? `${b.size} · ` : ''}点按打开` : '暂无可用下载地址'}</Text>
    </Pressable>
  );
  if (b.t === 'table') return <TableBlock rows={b.rows} />;
  if (b.t === 'img') return <RemoteImage src={b.src} cap={b.cap} width={b.width} height={b.height} onPress={() => onImg && onImg(b.src)} />;
  return null;
}

const Floor = React.memo(function Floor({ f, onImg, onLink, onUnavailable }: { f: FloorType; onImg?: (src: string | null) => void; onLink?: (href: string) => void; onUnavailable: () => void }) {
  const { t } = useTheme();
  const nav = useNav();
  const openProfile = React.useCallback((u?: NavAuthor) => { if (u?.uid) nav.push('profile', { uid: u.uid }); }, [nav]);
  return (
    <View style={{ paddingTop: 20, paddingBottom: 6, paddingHorizontal: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 }}>
        <Pressable onPress={() => openProfile(f.user)} disabled={!f.user?.uid} hitSlop={4}>
          <Avatar user={f.user} size={36} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={() => openProfile(f.user)} disabled={!f.user?.uid} hitSlop={4} style={{ flexShrink: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: FONTS.head, fontSize: 14.5, fontWeight: '600', color: t.ink }}>{f.user.name}</Text>
            </Pressable>
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
});

// 回复行：memo 隔离 flash 定位高亮等父级状态变化，只有高亮进/出的那一行重渲染。
const FloorRow = React.memo(function FloorRow({ f, flashBg, onImg, onLink, onUnavailable }: {
  f: FloorType;
  flashBg: string | null;
  onImg: (src: string | null) => void;
  onLink: (href: string) => void;
  onUnavailable: () => void;
}) {
  return (
    <View style={{ backgroundColor: flashBg || 'transparent' }}>
      <Floor f={f} onImg={onImg} onLink={onLink} onUnavailable={onUnavailable} />
    </View>
  );
});

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

function OpOnlyPill({ active, disabled, onPress }: { active: boolean; disabled?: boolean; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        height: 40,
        paddingHorizontal: 15,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: active ? t.accent : t.card2,
        opacity: disabled ? 0.55 : pressed ? 0.72 : 1,
        transform: [{ scale: pressed && !disabled ? 0.96 : 1 }],
      })}
    >
      <Icon name={active ? 'check' : 'user'} size={14} color={active ? t.onAccent : t.inkSoft} />
      <Text style={{ fontFamily: FONTS.head, fontSize: 12.5, fontWeight: '600', color: active ? t.onAccent : t.inkSoft }}>
        只看楼主
      </Text>
    </Pressable>
  );
}

function routeTid(route: any): string {
  return String(route?.params?.tid || route?.params?.thread?.tid || route?.params?.thread?.id || '');
}

// 列表行模型：楼主正文 / 回复分界 / 空态 / 回复楼层各占一行。此前整页塞在一个
// ScrollView 里，一页 20 楼的原图（贴图帖普遍 2000px+）全部同时挂载解码，低端安卓滚动
// 掉帧严重；按楼层虚拟化后只挂载视口附近的楼层/图片。
type ListRow =
  | { key: string; kind: 'op'; f: FloorType }
  | { key: string; kind: 'kicker' }
  | { key: string; kind: 'empty' }
  | { key: string; kind: 'floor'; f: FloorType };

const EMPTY_FLOORS: FloorType[] = [];

function FloorSeparator({ leadingItem }: { leadingItem?: ListRow }) {
  return leadingItem?.kind === 'floor' ? <Divider /> : null;
}

export default function ThreadScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'thread'>) {
  const paramThread: ThreadNavParam = route.params?.thread || {};
  const tid = routeTid(route);
  const targetPid = route.params?.targetPid;
  const targetPage = route.params?.targetPage;
  const board = route.params?.board;
  const nav = useNav();
  const { t } = useTheme();

  const [data, setData] = React.useState<ThreadData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [paging, setPaging] = React.useState(false);
  const [opOnly, setOpOnly] = React.useState(false);
  const [favorited, setFavorited] = React.useState(false);
  const [favoriteId, setFavoriteId] = React.useState<string | undefined>(undefined);
  const [favoriteBusy, setFavoriteBusy] = React.useState(false);
  const [flash, setFlash] = React.useState<number | null>(null);
  const listRef = React.useRef<LegendListRef>(null);
  const pending = React.useRef<number | null>(null);
  const targetHandled = React.useRef(false);
  const targetLoadPage = React.useRef<number | null>(null);
  const favoriteVersion = React.useRef(0);

  const goBack = React.useCallback(() => {
    const state = typeof navigation.getState === 'function' ? navigation.getState() : null;
    const routes = state?.routes || [];
    const index = typeof state?.index === 'number' ? state.index : routes.length - 1;
    let popCount = 1;
    for (let i = index - 1; i >= 0; i -= 1) {
      const previous = routes[i];
      if (previous?.name === 'reader') {
        const beforeReader = routes[i - 1];
        if (beforeReader?.name === 'thread' && routeTid(beforeReader) === tid) {
          popCount += 2;
          i -= 1;
          continue;
        }
        break;
      }
      if (previous?.name === 'thread' && routeTid(previous) === tid) {
        popCount += 1;
        continue;
      }
      break;
    }
    if (index - popCount >= 0) {
      navigation.dispatch(StackActions.pop(popCount));
    } else {
      nav.switchTab('forum');
    }
  }, [nav, navigation, tid]);

  const load = React.useCallback(async () => {
    setError(null);
    setOpOnly(false);
    try {
      const firstPage = targetPage || (targetPid ? await resolvePostPage(tid, targetPid) : 1);
      if (targetPid) {
        targetLoadPage.current = firstPage;
        targetHandled.current = false;
      } else {
        targetLoadPage.current = null;
      }
      const d = await getThread(tid, firstPage);
      setData(d);
      setPage(firstPage);
      setTotalPages(d.totalPages);
      recordThread({ tid, title: d.thread.title || paramThread.title, author: d.thread.author });
    } catch (e) {
      setError(e.message);
    }
  }, [tid, targetPid, targetPage]); // eslint-disable-line

  React.useEffect(() => { load(); }, [load]);

  React.useEffect(() => {
    if (!data?.thread.tid) return;
    let alive = true;
    const version = ++favoriteVersion.current;
    getThreadFavorite(tid)
      .then((next) => {
        if (!alive || version !== favoriteVersion.current) return;
        setFavorited(next.favorited);
        setFavoriteId(next.favid);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [data?.thread.tid, tid]);

  const fetchPage = async (n: number, only = opOnly) => {
    if (paging) return;
    const authorid = only ? (data?.thread.author?.uid || paramThread.author?.uid) : undefined;
    if (only && !authorid) {
      nav.toast('无法识别楼主，暂时不能只看楼主');
      return;
    }
    setPaging(true);
    try {
      const d = await getThread(tid, n, authorid);
      setData(d);
      setOpOnly(only);
      setPage(n);
      setTotalPages(d.totalPages);
    } catch (e) {
      nav.toast(e.message);
    } finally {
      setPaging(false);
    }
  };
  const goPage = (n: number) => { pending.current = null; if (n !== page) fetchPage(n); };
  const toggleOpOnly = () => {
    const next = !opOnly;
    pending.current = null;
    targetHandled.current = true;
    fetchPage(1, next);
  };

  const scrollToFloor = (f: number, smooth: boolean) => {
    const run = () => {
      const index = rows.findIndex((row) => (row.kind === 'op' || row.kind === 'floor') && row.f.floor === f);
      if (index >= 0) listRef.current?.scrollToIndex({ index, viewOffset: 54, animated: smooth });
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
    else { listRef.current?.scrollToOffset({ offset: 0, animated: false }); }
  }, [page]); // eslint-disable-line

  React.useEffect(() => {
    if (!targetPid || !data || targetHandled.current) return;
    if (targetLoadPage.current && page !== targetLoadPage.current) return;
    const floor = data.floors.find((item) => item.pid === targetPid);
    if (floor) {
      targetHandled.current = true;
      scrollToFloor(floor.floor, false);
    } else if (!paging) {
      targetHandled.current = true;
      nav.toast('无法定位楼层，已打开帖子');
    }
  }, [data, nav, paging, targetPid]); // eslint-disable-line

  const openImg = React.useCallback((src: string | null) => {
    const imgs: ThreadImage[] = data?.images?.length ? data.images : [{ src, cap: '图片' }];
    const idx = Math.max(0, imgs.findIndex((i) => i.src === src));
    nav.openViewer(imgs, idx, data?.thread.title || paramThread.title);
  }, [data, nav, paramThread.title]);
  const openLink = React.useCallback(async (href: string) => {
    const target = parseForumLink(href);
    if (target?.kind === 'thread') {
      nav.push('thread', {
        thread: { tid: target.tid, title: '帖子' },
        targetPid: target.pid,
        targetPage: target.page,
      });
      return;
    }
    if (target?.kind === 'board') {
      nav.push('board', { fid: target.fid });
      return;
    }
    if (target?.kind === 'profile') {
      nav.push('profile', { uid: target.uid });
      return;
    }
    try {
      await Linking.openURL(href);
    } catch (e) {
      nav.toast('无法打开这个链接');
    }
  }, [nav]);

  const thread = data?.thread || paramThread;
  const floors = data?.floors || EMPTY_FLOORS;
  const ppp = data?.ppp || 20;
  const totalFloors = (data?.thread.replies || 0) + 1;
  const canOpOnly = opOnly || (!!data?.thread.author?.uid && totalFloors > 1);
  const showOP = !opOnly && !!floors[0]?.op;      // 普通模式下楼主仅第一页
  const replyFloors = React.useMemo(() => (showOP ? floors.slice(1) : floors), [floors, showOP]);
  const rows = React.useMemo<ListRow[]>(() => {
    const out: ListRow[] = [];
    if (showOP) out.push({ key: `op:${floors[0].pid || 1}`, kind: 'op', f: floors[0] });
    out.push({ key: 'kicker', kind: 'kicker' });
    if (replyFloors.length === 0) out.push({ key: 'empty', kind: 'empty' });
    else replyFloors.forEach((f) => out.push({ key: `f:${f.pid || f.floor}`, kind: 'floor', f }));
    return out;
  }, [showOP, floors, replyFloors]);
  // 文学区（小说/翻译）帖子一律提供阅读模式入口，只需楼主 uid 可做 authorid 过滤。
  const readingCandidate = !!data
    && LITERATURE_FIDS.has(String(data.thread.fid || board?.fid || ''))
    && !!data.thread.author?.uid;
  const openReader = (fresh?: boolean) => {
    if (!data?.thread.author?.uid) return;
    nav.push('reader', { tid, authorid: data.thread.author.uid, fresh });
  };
  const toggleFavorite = async () => {
    if (favoriteBusy || !data?.thread.tid) return;
    const next = !favorited;
    const prevFavorited = favorited;
    const prevFavoriteId = favoriteId;
    const version = ++favoriteVersion.current;
    setFavoriteBusy(true);
    setFavorited(next);
    try {
      const result = await setThreadFavorite(tid, next, favoriteId);
      if (version !== favoriteVersion.current) return;
      setFavorited(result.favorited);
      setFavoriteId(result.favid);
      nav.toast(result.message);
    } catch (e) {
      if (version !== favoriteVersion.current) return;
      setFavorited(prevFavorited);
      setFavoriteId(prevFavoriteId);
      nav.toast(e.message || '收藏操作失败');
    } finally {
      if (version === favoriteVersion.current) setFavoriteBusy(false);
    }
  };

  const renderRow = React.useCallback(({ item }: { item: ListRow }) => {
    if (item.kind === 'op') return (
      /* OP body — 仅第一页 */
      <View style={{ backgroundColor: flash === 1 ? t.accentSoft : 'transparent' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 12, paddingHorizontal: 22 }}>
          <Text style={{ fontFamily: FONTS.head, fontSize: 12, fontWeight: '600', color: t.faint }}>1楼 · 楼主</Text>
        </View>
        <View style={{ paddingTop: 6, paddingHorizontal: 22, paddingBottom: 8 }}>
          {item.f.blocks.map((b, i) => <FloorBlock key={i} b={b} onImg={openImg} onLink={openLink} />)}
        </View>
      </View>
    );
    if (item.kind === 'kicker') return (
      <View>
        <Kicker style={{ paddingTop: 16, paddingHorizontal: 22 }}>{opOnly ? `楼主发言 · ${totalFloors} 层` : `${thread.replies} 条回复`}</Kicker>
        <Divider style={{ marginTop: 14 }} />
      </View>
    );
    if (item.kind === 'empty') return (
      <Text style={{ fontFamily: FONTS.body, textAlign: 'center', fontSize: 13, color: t.muted, paddingVertical: 30 }}>
        {opOnly ? '本页暂无楼主发言' : totalFloors <= 1 ? '还没有回复，来抢沙发吧' : '本页暂无回复'}
      </Text>
    );
    return (
      <FloorRow
        f={item.f}
        flashBg={flash === item.f.floor ? t.accentSoft : null}
        onImg={openImg}
        onLink={openLink}
        onUnavailable={nav.notImplemented}
      />
    );
  }, [flash, t, opOnly, totalFloors, thread.replies, openImg, openLink, nav.notImplemented]);

  const openAuthor = React.useCallback(() => {
    if (thread.author?.uid) nav.push('profile', { uid: thread.author.uid });
  }, [nav, thread.author]);

  const header = React.useMemo(() => (
    <View>
      <View style={{ paddingTop: 2, paddingHorizontal: 22, paddingBottom: 18 }}>
        <Kicker style={{ marginBottom: 14 }}>
          {board ? board.name : '帖子'}{thread.pinned ? '  ·  置顶' : ''}{totalPages > 1 ? `  ·  第 ${page}/${totalPages} 页` : ''}
        </Kicker>
        <Text style={{ fontFamily: FONTS.head, fontSize: 26, fontWeight: '700', color: t.ink, lineHeight: 34.8, letterSpacing: -0.2, marginBottom: 20 }}>{thread.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <Pressable onPress={openAuthor} disabled={!thread.author?.uid} hitSlop={4}>
            <Avatar user={thread.author} size={38} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable onPress={openAuthor} disabled={!thread.author?.uid} hitSlop={4} style={{ flexShrink: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: FONTS.head, fontSize: 14.5, fontWeight: '600', color: t.ink }}>{thread.author?.name}</Text>
              </Pressable>
              <Text style={{ fontFamily: FONTS.head, fontSize: 11, fontWeight: '700', color: t.accentInk }}>楼主</Text>
            </View>
            <Text style={{ fontFamily: FONTS.head, fontSize: 12, color: t.muted, fontWeight: '500', marginTop: 2 }}>
              {thread.author?.group ? thread.author.group + ' · ' : ''}{thread.time}
            </Text>
          </View>
        </View>
      </View>
      <Divider />
    </View>
  ), [board, thread, page, totalPages, t, openAuthor]);

  return (
    <Screen>
      <NavHeader title="" onBack={goBack}
        right={(
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {data && canOpOnly ? <OpOnlyPill active={opOnly} disabled={paging} onPress={toggleOpOnly} /> : null}
            {readingCandidate &&
              <Pressable onPress={() => openReader()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="book" size={18} color={t.onAccent} /></Pressable>}
          </View>
        )} />

      {error ? <ErrorView message={error} onRetry={load} />
        : !data ? <Loader label="加载帖子…" />
        : (
          <LegendList
            ref={listRef}
            data={rows}
            renderItem={renderRow}
            keyExtractor={(item) => item.key}
            recycleItems={false}
            ItemSeparatorComponent={FloorSeparator}
            ListHeaderComponent={header}
            ListFooterComponent={(
              /* pager（含按楼层定位） */
              <View>
                <View style={{ opacity: paging ? 0.5 : 1, pointerEvents: paging ? 'none' : 'auto' }}>
                  <Pager
                    page={page}
                    totalPages={totalPages}
                    onJump={goPage}
                    cap={opOnly ? `仅显示楼主 · 共 ${totalFloors} 层` : `共 ${totalFloors} 楼 · 每页 ${ppp} 楼`}
                    extra={!opOnly && totalFloors > ppp ? <FloorJump onLocate={locate} /> : null}
                  />
                </View>
                <View style={{ height: 8 }} />
              </View>
            )}
            extraData={flash}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          />
        )}

      {/* fixed action bar — v1 read only */}
      <View style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14, borderTopWidth: 1, borderTopColor: t.line, flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: t.bg }}>
        <Pressable onPress={nav.notImplemented}
          style={{ flex: 1, height: 46, borderRadius: 999, backgroundColor: t.field, justifyContent: 'center', paddingHorizontal: 20 }}>
          <Text style={{ color: t.faint, fontFamily: FONTS.head, fontSize: 14.5 }}>暂无实现此功能</Text>
        </Pressable>
        <Pressable onPress={toggleFavorite} disabled={favoriteBusy || !data} style={({ pressed }) => ({ opacity: favoriteBusy ? 0.55 : pressed ? 0.65 : 1 })}>
          <Icon name="heart" size={24} color={favorited ? t.accent : t.inkSoft} fill={favorited ? t.accent : 'none'} />
        </Pressable>
        <Pressable onPress={nav.notImplemented}>
          <Icon name="share" size={22} color={t.inkSoft} />
        </Pressable>
      </View>
    </Screen>
  );
}
