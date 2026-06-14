import React from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import { NavHeader, NavBack, FeedItem, SubBoardChip, PinnedRow, Kicker, Divider, HLine } from '../components/ui';
import { Loader, ErrorView, EmptyState } from '../components/states';
import { useNav } from '../useNav';
import { useTheme, FONTS } from '../theme';
import { getBoard } from '../api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ThreadRow, ThreadType, BoardSub, SortMode, PinnedItem, RootStackParamList } from '../types';
import { SORT_MODES } from '../types';

export default function BoardScreen({ route }: NativeStackScreenProps<RootStackParamList, 'board'>) {
  const board0 = route.params?.board || { name: '板块', desc: '', fid: route.params?.fid };
  const fid = board0.fid as string;
  const nav = useNav();
  const { t } = useTheme();

  const [board, setBoard] = React.useState<any>(board0);
  const [types, setTypes] = React.useState<ThreadType[]>([]);
  const [subs, setSubs] = React.useState<BoardSub[]>([]);
  const [pinned, setPinned] = React.useState<PinnedItem[]>([]);
  const [typeid, setTypeid] = React.useState<string | number>(0);
  const [sort, setSort] = React.useState<SortMode>('全部');
  const [items, setItems] = React.useState<ThreadRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const load = React.useCallback(async (tid: string | number, srt: SortMode, isRefresh?: boolean) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const r = await getBoard(fid, 1, tid, srt);
      setBoard((b: any) => ({ ...b, ...r.board }));
      setTypes(r.types);
      setSubs(r.subs);
      setPinned(r.pinned);
      setItems(r.threads);
      setPage(1);
      setHasMore(r.hasMore);
    } catch (e) {
      if (items === null) setError(e.message); else nav.toast(e.message);
    } finally {
      setRefreshing(false);
    }
  }, [fid, items, nav]);

  React.useEffect(() => { load(typeid, sort, false); /* on mount + typeid/sort change */ }, [typeid, sort]); // eslint-disable-line

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const r = await getBoard(fid, next, typeid, sort);
      setItems((prev) => [...(prev || []), ...r.threads]);
      setPage(next);
      setHasMore(r.hasMore);
    } catch (e) {
      nav.toast(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 60) loadMore();
  };

  const openSub = (s: BoardSub) => nav.push('board', { board: { fid: s.fid, name: s.name } });

  return (
    <Screen>
      <NavHeader
        title={board.name}
        onBack={nav.pop}
        right={<NavBack onBack={() => nav.toast(board.desc || '版规：友善交流')}><Icon name="info" size={19} color={t.inkSoft} /></NavBack>}
      />

      {error ? <ErrorView message={error} onRetry={() => load(typeid, sort, false)} />
        : items === null ? <Loader label="加载帖子…" />
        : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onScroll}
            stickyHeaderIndices={[1]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(typeid, sort, true)} tintColor={t.accent} colors={[t.accent]} />}
          >
            {/* 0 — scrollable header: 板块简介 */}
            <View>
              {board.desc ? (
                <View style={{ paddingHorizontal: 22, paddingBottom: 12 }}>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: t.muted }}>{board.desc}</Text>
                </View>
              ) : null}
            </View>

            {/* 1 — sticky filter bar: 排序模式（主）+ 作品分类（次） */}
            <View style={{ backgroundColor: t.bg }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, gap: 22, alignItems: 'flex-end' }}>
                {SORT_MODES.map((s) => (
                  <Pressable key={s} onPress={() => setSort(s)} style={{ paddingTop: 4, paddingBottom: 9, borderBottomWidth: 2, borderBottomColor: sort === s ? t.accent : 'transparent' }}>
                    <Text style={{ fontFamily: FONTS.head, fontSize: 15.5, fontWeight: sort === s ? '700' : '500', color: sort === s ? t.ink : t.faint }}>{s}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {types.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 11, paddingBottom: 12, gap: 17 }}>
                  {types.map((c) => {
                    const on = typeid === c.id;
                    return (
                      <Pressable key={c.id} onPress={() => setTypeid(on ? 0 : c.id)}>
                        <Text style={{ fontFamily: FONTS.head, fontSize: 13.5, fontWeight: on ? '700' : '500', color: on ? t.accentInk : t.faint }}>{c.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
              <HLine />
            </View>

            {/* 2 — 子板块（等分一排 chips）+ 置顶/公告 + feed */}
            <View>
              {subs.length > 0 ? (
                <>
                  <Kicker style={{ paddingHorizontal: 22, paddingTop: 13, paddingBottom: 10 }}>子板块</Kicker>
                  <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 22, paddingBottom: 14 }}>
                    {subs.map((s) => <SubBoardChip key={s.fid} s={s} onOpen={openSub} />)}
                  </View>
                  <HLine />
                </>
              ) : null}

              {sort === '全部' && pinned.length > 0 ? (
                <>
                  {pinned.map((p) => <PinnedRow key={p.id} item={p} onOpen={(x) => nav.push('thread', { thread: { tid: x.tid, title: x.title }, board })} />)}
                  {items.length > 0 ? <Divider /> : null}
                </>
              ) : null}

              {items.length === 0 ? (
                <EmptyState label={sort === '精华' ? '这个分类下还没有精华帖' : '这里还没有帖子'} sub="换个分类看看吧" />
              ) : items.map((th, i) => (
                <View key={th.id}>
                  <FeedItem t={th} onOpen={(x) => nav.push('thread', { thread: x, board })} />
                  {i < items.length - 1 && <Divider />}
                </View>
              ))}
              <View style={{ height: loadingMore ? 44 : 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {loadingMore ? (
                  <><ActivityIndicator size="small" color={t.accent} /><Text style={{ color: t.muted, fontFamily: FONTS.head, fontSize: 12.5 }}>加载更多…</Text></>
                ) : (items.length > 0 && !hasMore ? <Text style={{ color: t.muted, fontFamily: FONTS.head, fontSize: 12.5 }}>—  没有更多了  —</Text> : null)}
              </View>
              <View style={{ height: 12 }} />
            </View>
          </ScrollView>
        )}
    </Screen>
  );
}
