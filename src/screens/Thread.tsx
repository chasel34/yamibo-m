import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Linking, LayoutChangeEvent } from 'react-native';
import { StackActions } from '@react-navigation/native';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import { NavHeader, NavBack, Avatar, Divider, Kicker, Pager } from '../components/ui';
import RemoteImage from '../components/RemoteImage';
import { Loader, ErrorView } from '../components/states';
import { useNav } from '../useNav';
import { useTheme, FONTS } from '../theme';
import { getThread, resolvePostPage } from '../api';
import { parseForumLink } from '../forumLinks';
import { recordThread } from '../history';
import { LITERATURE_FIDS } from '../reading';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Block, Floor as FloorType, RichTextRun, ThreadData, ThreadImage, ThreadNavParam, RootStackParamList } from '../types';

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
  const [flash, setFlash] = React.useState<number | null>(null);
  const scRef = React.useRef<ScrollView>(null);
  const floorY = React.useRef<Map<number, number>>(new Map());
  const pending = React.useRef<number | null>(null);
  const targetHandled = React.useRef(false);
  const targetLoadPage = React.useRef<number | null>(null);

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

  const fetchPage = async (n: number, only = opOnly) => {
    if (paging) return;
    const authorid = only ? (data?.thread.author?.uid || paramThread.author?.uid) : undefined;
    if (only && !authorid) {
      nav.toast('无法识别楼主，暂时不能只看楼主');
      return;
    }
    setPaging(true);
    floorY.current.clear();
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

  const openImg = (src: string | null) => {
    const imgs: ThreadImage[] = data?.images?.length ? data.images : [{ src, cap: '图片' }];
    const idx = Math.max(0, imgs.findIndex((i) => i.src === src));
    nav.openViewer(imgs, idx, thread.title);
  };
  const openLink = async (href: string) => {
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
  };

  const thread = data?.thread || paramThread;
  const floors = data?.floors || [];
  const ppp = data?.ppp || 20;
  const totalFloors = (data?.thread.replies || 0) + 1;
  const canOpOnly = opOnly || (!!data?.thread.author?.uid && totalFloors > 1);
  const showOP = !opOnly && !!floors[0]?.op;      // 普通模式下楼主仅第一页
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
      <NavHeader title="" onBack={goBack}
        right={(
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {data && canOpOnly ? <OpOnlyPill active={opOnly} disabled={paging} onPress={toggleOpOnly} /> : null}
            {readingCandidate
              ? <Pressable onPress={() => openReader()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="book" size={18} color={t.onAccent} /></Pressable>
              : <NavBack onBack={nav.notImplemented}><Icon name="share" size={18} color={t.inkSoft} /></NavBack>}
          </View>
        )} />

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
            <Kicker style={{ paddingTop: 16, paddingHorizontal: 22 }}>{opOnly ? `楼主发言 · ${totalFloors} 层` : `${thread.replies} 条回复`}</Kicker>
            <Divider style={{ marginTop: 14 }} />
            {replyFloors.length === 0 ? (
              <Text style={{ fontFamily: FONTS.body, textAlign: 'center', fontSize: 13, color: t.muted, paddingVertical: 30 }}>
                {opOnly ? '本页暂无楼主发言' : totalFloors <= 1 ? '还没有回复，来抢沙发吧' : '本页暂无回复'}
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
                cap={opOnly ? `仅显示楼主 · 共 ${totalFloors} 层` : `共 ${totalFloors} 楼 · 每页 ${ppp} 楼`}
                extra={!opOnly && totalFloors > ppp ? <FloorJump onLocate={locate} /> : null}
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
