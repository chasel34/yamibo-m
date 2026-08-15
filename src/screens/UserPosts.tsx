import React from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { LegendList } from '@legendapp/list/react-native';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import { NavHeader, TagPill, Avatar, Divider, HLine } from '../components/ui';
import type { AvatarUser } from '../components/ui';
import { Loader, ErrorView, EmptyState } from '../components/states';
import { useNav } from '../useNav';
import { useTheme, FONTS } from '../theme';
import { getMe, getUserThreads, getUserReplies } from '../api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CursorPage, RootStackParamList, UserPostsTab, UserReplyItem, UserThreadItem } from '../types';

// 论坛的 space 列表页只给「有没有下一页」，给不出总页数，所以这一屏走无限滚动而不是 Pager。
// 它还会把无权限板块的帖子过滤掉，于是**整页被滤空但仍有下一页**是可能的——那种页不会撑高
// 列表，onEndReached 也就不会再触发，所以取到空页时在这里直接往后翻，最多连翻 3 页兜底。
const MAX_EMPTY_PAGES = 3;

interface ListState<T> {
  items: T[];
  page: number;                                          // 已加载到第几页（0 = 还没加载）
  hasMore: boolean;
  status: 'idle' | 'loading' | 'paging' | 'refreshing';
  error: string | null;
}
const INITIAL: ListState<any> = { items: [], page: 0, hasMore: true, status: 'idle', error: null };

function RowSeparator() { return <Divider />; }

function MetaBit({ icon, v }: { icon: string; v: number }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Icon name={icon} size={13.5} color={t.faint} stroke={1.8} />
      <Text style={{ fontFamily: FONTS.head, fontSize: 12, fontWeight: '600', color: t.faint }}>{v}</Text>
    </View>
  );
}

const ThemeRow = React.memo(function ThemeRow({ item, user, onOpen }: { item: UserThreadItem; user?: AvatarUser; onOpen: (t: UserThreadItem) => void }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={() => onOpen(item)} style={{ paddingVertical: 16, paddingHorizontal: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <Avatar user={user} size={22} />
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: FONTS.head, fontSize: 12.5, fontWeight: '600', color: t.inkSoft }}>{user?.name}</Text>
        <Text style={{ fontFamily: FONTS.head, fontSize: 12.5, color: t.muted, fontWeight: '500', marginLeft: 'auto' }}>{item.time}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 11 }}>
        {item.flag ? <TagPill tone="accent" style={{ marginTop: 2 }}>{item.flag}</TagPill> : null}
        <Text style={{ flex: 1, fontFamily: FONTS.head, color: t.ink, fontWeight: '700', fontSize: 17, lineHeight: 22.8, letterSpacing: -0.2 }}>{item.title}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <TagPill>{item.boardName}</TagPill>
        <View style={{ flexDirection: 'row', gap: 14, marginLeft: 'auto' }}>
          <MetaBit icon="eye" v={item.views} />
          <MetaBit icon="reply" v={item.replies} />
        </View>
      </View>
    </Pressable>
  );
});

const ReplyRow = React.memo(function ReplyRow({ item, onOpen }: { item: UserReplyItem; onOpen: (r: UserReplyItem) => void }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={() => onOpen(item)} style={{ paddingVertical: 16, paddingHorizontal: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        {item.flag ? <TagPill tone="accent" style={{ marginTop: 2 }}>{item.flag}</TagPill> : null}
        <Text numberOfLines={2} style={{ flex: 1, minWidth: 0, fontFamily: FONTS.head, fontSize: 15.5, fontWeight: '600', color: t.ink, lineHeight: 22.5 }}>{item.title}</Text>
        <Icon name="chevRight" size={16} color={t.faint} />
      </View>
      {item.text ? (
        <View style={{ backgroundColor: t.card2, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 }}>
          <Text numberOfLines={3} style={{ fontFamily: FONTS.body, fontSize: 14.5, color: t.ink2, lineHeight: 23.2 }}>{item.text}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 9 }}>
        <Text style={{ fontFamily: FONTS.head, fontSize: 11.5, color: t.muted, fontWeight: '500' }}>{item.time}</Text>
        <Text style={{ fontFamily: FONTS.head, fontSize: 11.5, color: t.muted, fontWeight: '500', marginLeft: 'auto' }}>{item.boardName}</Text>
      </View>
    </Pressable>
  );
});

function SegTab({ label, count, active, onPress }: { label: string; count?: number; active: boolean; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'baseline', gap: 7, paddingBottom: 4,
        borderBottomWidth: 2, borderBottomColor: active ? t.accent : 'transparent',
      }}
    >
      <Text style={{ fontFamily: FONTS.head, fontSize: 16, fontWeight: active ? '700' : '500', color: active ? t.ink : t.faint }}>{label}</Text>
      {count != null ? (
        <Text style={{ fontFamily: FONTS.head, fontSize: 12, fontWeight: '600', color: active ? t.accentInk : t.faint }}>{count}</Text>
      ) : null}
    </Pressable>
  );
}

export default function UserPostsScreen({ route }: NativeStackScreenProps<RootStackParamList, 'userposts'>) {
  const nav = useNav();
  const { t } = useTheme();
  const uid = route.params?.uid || getMe().uid;
  const self = !!route.params?.self;
  const stats = route.params?.stats;
  const [tab, setTab] = React.useState<UserPostsTab>(route.params?.tab || 'threads');

  const [threads, setThreads] = React.useState<ListState<UserThreadItem>>(INITIAL);
  const [replies, setReplies] = React.useState<ListState<UserReplyItem>>(INITIAL);
  // 加载器在回调里读的是「此刻」的列表，不能依赖闭包捕获的 state。
  const stateRef = React.useRef({ threads, replies });
  stateRef.current = { threads, replies };
  const busy = React.useRef<Record<UserPostsTab, boolean>>({ threads: false, replies: false });

  const fetchTab = React.useCallback(async (which: UserPostsTab, mode: 'init' | 'more' | 'refresh') => {
    if (busy.current[which]) return;
    const prev = stateRef.current[which];
    if (mode === 'more' && (!prev.hasMore || prev.status !== 'idle')) return;
    busy.current[which] = true;

    const setter = (which === 'threads' ? setThreads : setReplies) as React.Dispatch<React.SetStateAction<ListState<any>>>;
    const fetchPage = (p: number): Promise<CursorPage<any>> => (which === 'threads' ? getUserThreads(uid, p) : getUserReplies(uid, p));
    const base = mode === 'more' ? prev.items : [];
    setter((s) => ({ ...s, status: mode === 'refresh' ? 'refreshing' : mode === 'more' ? 'paging' : 'loading', error: mode === 'more' ? s.error : null }));

    try {
      const seen = new Set(base.map((x) => x.id));
      const added: any[] = [];
      let page = mode === 'more' ? prev.page + 1 : 1;
      let hasMore = true;
      // 被过滤空的页不撑高列表 → onEndReached 不会再触发，所以就地往后翻，别把停下来交给用户。
      for (let empty = 0; empty <= MAX_EMPTY_PAGES; empty += 1) {
        const r = await fetchPage(page);
        hasMore = r.hasMore;
        r.list.forEach((x) => { if (!seen.has(x.id)) { seen.add(x.id); added.push(x); } });
        if (added.length > 0 || !hasMore) break;
        page += 1;
      }
      setter(() => ({ items: base.concat(added), page, hasMore, status: 'idle', error: null }));
    } catch (e) {
      setter((s) => ({ ...s, status: 'idle', error: s.items.length ? null : e.message }));
      if (stateRef.current[which].items.length) nav.toast(e.message);
    } finally {
      busy.current[which] = false;
    }
  }, [uid, nav]);

  // 切到某个 tab 时才拉它的第一页，两个 tab 各自留存自己的列表和游标。
  React.useEffect(() => {
    const s = stateRef.current[tab];
    if (s.page === 0 && !s.error && s.status === 'idle') fetchTab(tab, 'init');
  }, [tab, fetchTab]);

  const openThread = React.useCallback((x: UserThreadItem) => {
    nav.push('thread', {
      thread: { tid: x.tid, title: x.title, replies: x.replies, views: String(x.views), time: x.time },
      board: x.fid ? { fid: x.fid, name: x.boardName } : undefined,
    });
  }, [nav]);

  // 有 pid 才能定位到我回复的那一楼；拿不到就退回帖子第 1 页。
  const openReply = React.useCallback((r: UserReplyItem) => {
    nav.push('thread', {
      thread: { tid: r.tid, title: r.title, time: r.time },
      board: r.fid ? { fid: r.fid, name: r.boardName } : undefined,
      targetPid: r.pid,
    });
  }, [nav]);

  const data: ListState<any> = tab === 'threads' ? threads : replies;
  const isThreads = tab === 'threads';
  const total = isThreads ? stats?.themes : stats?.replies;

  const footer = React.useMemo(() => {
    if (data.status === 'paging') {
      return <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: t.faint, textAlign: 'center', paddingVertical: 18 }}>加载中…</Text>;
    }
    if (data.hasMore || data.items.length === 0) return <View style={{ height: 20 }} />;
    const cap = total != null
      ? `—  共 ${total} ${isThreads ? '篇主题' : '条回复'}  —`
      : `—  ${isThreads ? '主题' : '回复'}到底了  —`;
    return <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: t.faint, textAlign: 'center', paddingTop: 16, paddingBottom: 28 }}>{cap}</Text>;
  }, [data.status, data.hasMore, data.items.length, total, isThreads, t]);

  const author = React.useMemo(() => ({ uid, name: route.params?.name }), [uid, route.params?.name]);
  const renderItem = React.useCallback(({ item }: { item: any }) => (
    isThreads
      ? <ThemeRow item={item as UserThreadItem} user={author} onOpen={openThread} />
      : <ReplyRow item={item as UserReplyItem} onOpen={openReply} />
  ), [isThreads, author, openThread, openReply]);

  return (
    <Screen>
      <NavHeader title={self ? '我的发言' : (route.params?.name || ' ')} onBack={nav.pop} />
      <View style={{ flexDirection: 'row', gap: 26, paddingHorizontal: 22, paddingBottom: 14 }}>
        <SegTab label="主题" count={stats?.themes} active={isThreads} onPress={() => setTab('threads')} />
        <SegTab label="回复" count={stats?.replies} active={!isThreads} onPress={() => setTab('replies')} />
      </View>
      <HLine />
      {data.error ? <ErrorView message={data.error} onRetry={() => fetchTab(tab, 'init')} />
        : data.status === 'loading' ? <Loader label="加载…" />
        : data.items.length === 0 ? (
          <EmptyState
            label={isThreads ? '还没有发过主题' : '还没有回复过帖子'}
            sub={self ? '去论坛逛逛吧' : '这位同好还没有留下痕迹'}
          />
        ) : (
          <LegendList
            data={data.items}
            dataKey={tab}
            keyExtractor={(item) => item.id}
            recycleItems={false}
            renderItem={renderItem}
            ItemSeparatorComponent={RowSeparator}
            ListFooterComponent={footer}
            onEndReached={() => fetchTab(tab, 'more')}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
            refreshControl={(
              <RefreshControl
                refreshing={data.status === 'refreshing'}
                onRefresh={() => fetchTab(tab, 'refresh')}
                tintColor={t.accent}
                colors={[t.accent]}
              />
            )}
          />
        )}
    </Screen>
  );
}
