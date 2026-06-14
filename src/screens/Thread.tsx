import React from 'react';
import { View, Text, Pressable, ScrollView, Linking, ActivityIndicator } from 'react-native';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import { NavHeader, NavBack, Avatar, Divider, Kicker } from '../components/ui';
import RemoteImage from '../components/RemoteImage';
import { Loader, ErrorView } from '../components/states';
import { useNav } from '../useNav';
import { useTheme, FONTS } from '../theme';
import { getThread } from '../api';
import { recordThread } from '../history';
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
        <Text style={{ fontFamily: FONTS.head, fontSize: 13, fontWeight: '600', color: t.faint }}>{f.floor === 1 ? '' : '#' + f.floor}</Text>
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

export default function ThreadScreen({ route }: NativeStackScreenProps<RootStackParamList, 'thread'>) {
  const paramThread: ThreadNavParam = route.params?.thread || {};
  const tid = (paramThread.tid || paramThread.id) as string;
  const board = route.params?.board;
  const nav = useNav();
  const { t } = useTheme();

  const [data, setData] = React.useState<ThreadData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const load = React.useCallback(async () => {
    setError(null);
    try {
      const d = await getThread(tid, 1);
      setData(d);
      recordThread({ tid, title: d.thread.title || paramThread.title, author: d.thread.author });
    } catch (e) {
      setError(e.message);
    }
  }, [tid]); // eslint-disable-line

  React.useEffect(() => { load(); }, [load]);

  const loadMore = async () => {
    if (!data || loadingMore || !data.hasMore) return;
    setLoadingMore(true);
    try {
      const next = await getThread(tid, data.page + 1);
      setData((prev) => {
        if (!prev) return next;
        const floorMap = new Map(prev.floors.map((f) => [f.pid || String(f.floor), f]));
        next.floors.forEach((f) => floorMap.set(f.pid || String(f.floor), f));
        const imageMap = new Map(prev.images.map((img) => [img.src || img.cap, img]));
        next.images.forEach((img) => imageMap.set(img.src || img.cap, img));
        return {
          ...prev,
          floors: Array.from(floorMap.values()).sort((a, b) => a.floor - b.floor),
          images: Array.from(imageMap.values()),
          page: next.page,
          hasMore: next.hasMore,
        };
      });
    } catch (e) {
      nav.toast(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

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

  return (
    <Screen>
      <NavHeader title="" onBack={nav.pop}
        right={<NavBack onBack={nav.notImplemented}><Icon name="share" size={18} color={t.inkSoft} /></NavBack>} />

      {error ? <ErrorView message={error} onRetry={load} />
        : !data ? <Loader label="加载帖子…" />
        : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            <View style={{ paddingTop: 2, paddingHorizontal: 22, paddingBottom: 18 }}>
              <Kicker style={{ marginBottom: 14 }}>{board ? board.name : '帖子'}{thread.pinned ? '  ·  置顶' : ''}</Kicker>
              <Text style={{ fontFamily: FONTS.head, fontSize: 26, fontWeight: '700', color: t.ink, lineHeight: 34.8, letterSpacing: -0.2, marginBottom: 20 }}>{thread.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                <Avatar user={thread.author} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.head, fontSize: 14.5, fontWeight: '600', color: t.ink }}>{thread.author?.name}</Text>
                  <Text style={{ fontFamily: FONTS.head, fontSize: 12, color: t.muted, fontWeight: '500', marginTop: 2 }}>
                    {thread.author?.group ? thread.author.group + ' · ' : ''}{thread.time}
                  </Text>
                </View>
              </View>
            </View>
            <Divider />
            {/* OP body */}
            {floors[0] ? (
              <View style={{ paddingTop: 22, paddingHorizontal: 22, paddingBottom: 8 }}>
                {floors[0].blocks.map((b, i) => <FloorBlock key={i} b={b} onImg={openImg} onLink={openLink} />)}
              </View>
            ) : null}
            {/* replies */}
            <Kicker style={{ paddingTop: 14, paddingHorizontal: 22 }}>{thread.replies} 条回复</Kicker>
            <Divider style={{ marginTop: 14 }} />
            {floors.slice(1).map((f, i) => (
              <View key={f.pid || f.floor}>
                <Floor f={f} onImg={openImg} onLink={openLink} onUnavailable={nav.notImplemented} />
                {i < floors.length - 2 && <Divider />}
              </View>
            ))}
            {floors.length <= 1 && !data.hasMore ? (
              <Text style={{ fontFamily: FONTS.body, textAlign: 'center', fontSize: 13, color: t.muted, paddingVertical: 28 }}>还没有回复，来抢沙发吧</Text>
            ) : data.hasMore ? (
              <Pressable
                disabled={loadingMore}
                onPress={loadMore}
                style={{ alignSelf: 'center', minWidth: 150, height: 42, marginTop: 20, marginBottom: 18, borderRadius: 999, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}
              >
                {loadingMore
                  ? <ActivityIndicator size="small" color={t.accentInk} />
                  : <Text style={{ fontFamily: FONTS.head, fontSize: 13.5, fontWeight: '600', color: t.accentInk }}>加载更多回复</Text>}
              </Pressable>
            ) : (
              <Text style={{ fontFamily: FONTS.body, textAlign: 'center', fontSize: 12, color: t.faint, paddingTop: 22, paddingBottom: 18 }}>—  到底啦  —</Text>
            )}
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
