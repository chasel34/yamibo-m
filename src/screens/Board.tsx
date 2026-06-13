import React from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import { NavHeader, NavBack, FeedItem, Divider } from '../components/ui';
import { Loader, ErrorView, EmptyState } from '../components/states';
import { useNav } from '../useNav';
import { useTheme, FONTS } from '../theme';
import { getBoard } from '../api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ThreadRow, ThreadType, RootStackParamList } from '../types';

export default function BoardScreen({ route }: NativeStackScreenProps<RootStackParamList, 'board'>) {
  const board0 = route.params?.board || { name: '板块', desc: '', fid: route.params?.fid };
  const fid = board0.fid as string;
  const nav = useNav();
  const { t } = useTheme();

  const [board, setBoard] = React.useState<any>(board0);
  const [types, setTypes] = React.useState<ThreadType[]>([]);
  const [typeid, setTypeid] = React.useState<string | number>(0);
  const [items, setItems] = React.useState<ThreadRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const load = React.useCallback(async (tid: string | number, isRefresh?: boolean) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const r = await getBoard(fid, 1, tid);
      setBoard((b: any) => ({ ...b, ...r.board }));
      setTypes(r.types);
      setItems(r.threads);
      setPage(1);
      setHasMore(r.hasMore);
    } catch (e) {
      if (items === null) setError(e.message); else nav.toast(e.message);
    } finally {
      setRefreshing(false);
    }
  }, [fid, items, nav]);

  React.useEffect(() => { load(typeid, false); /* on mount + typeid change */ }, [typeid]); // eslint-disable-line

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const r = await getBoard(fid, next, typeid);
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

  const tags = ['全部', ...types.map((x) => x.name)];
  const selectTag = (name: string) => {
    if (name === '全部') setTypeid(0);
    else { const found = types.find((x) => x.name === name); setTypeid(found ? found.id : 0); }
  };
  const activeName = typeid === 0 ? '全部' : (types.find((x) => x.id === typeid)?.name || '全部');

  return (
    <Screen>
      <NavHeader
        title={board.name}
        onBack={nav.pop}
        right={<NavBack onBack={() => nav.toast(board.desc || '版规：友善交流')}><Icon name="info" size={19} color={t.inkSoft} /></NavBack>}
      />
      {board.desc ? (
        <View style={{ paddingHorizontal: 22, paddingBottom: 14 }}>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: t.muted }}>{board.desc}</Text>
        </View>
      ) : null}
      {tags.length > 1 ? (
        <View style={{ flexGrow: 0 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 12, gap: 18 }}>
            {tags.map((tg) => (
              <Pressable key={tg} onPress={() => selectTag(tg)} style={{ paddingBottom: 2, borderBottomWidth: 2, borderBottomColor: activeName === tg ? t.accent : 'transparent' }}>
                <Text style={{ fontFamily: FONTS.head, fontSize: 14, fontWeight: activeName === tg ? '700' : '500', color: activeName === tg ? t.ink : t.faint }}>{tg}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      <Divider />

      {error ? <ErrorView message={error} onRetry={() => load(typeid, false)} />
        : items === null ? <Loader label="加载帖子…" />
        : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={onScroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(typeid, true)} tintColor={t.accent} colors={[t.accent]} />}
          >
            {items.length === 0 ? <EmptyState label="这里还没有帖子" sub="换个分类看看吧" /> : items.map((th, i) => (
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
          </ScrollView>
        )}
    </Screen>
  );
}
