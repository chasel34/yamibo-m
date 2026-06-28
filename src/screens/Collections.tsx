import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import Screen from '../components/Screen';
import { NavHeader, FeedItem, Divider, Pager } from '../components/ui';
import { Loader, ErrorView, EmptyState } from '../components/states';
import { useNav } from '../useNav';
import { useTheme, FONTS } from '../theme';
import { getCollections } from '../api';
import type { CollectionItem, ListResult } from '../types';

export default function CollectionsScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const [data, setData] = React.useState<ListResult<CollectionItem> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [paging, setPaging] = React.useState(false);
  const dataRef = React.useRef(data);
  const requestVersion = React.useRef(0);
  dataRef.current = data;

  const load = React.useCallback(async (targetPage = 1, isRefresh?: boolean) => {
    const version = ++requestVersion.current;
    if (isRefresh) setRefreshing(true);
    else if (dataRef.current) setPaging(true);
    setError(null);
    try {
      const r = await getCollections(targetPage);
      if (version !== requestVersion.current) return;
      setData(r);
    } catch (e) {
      if (version !== requestVersion.current) return;
      if (!dataRef.current) setError(e.message); else nav.toast(e.message);
    } finally {
      if (version === requestVersion.current) {
        setRefreshing(false);
        setPaging(false);
      }
    }
  }, [nav]);
  React.useEffect(() => { load(1, false); }, []); // eslint-disable-line

  const goPage = React.useCallback((targetPage: number) => {
    if (!data || paging || targetPage === data.page) return;
    load(targetPage, false);
  }, [data, load, paging]);

  return (
    <Screen>
      <NavHeader title="我的收藏" onBack={nav.pop} />
      <Divider />
      {error ? <ErrorView message={error} onRetry={() => load(1, false)} />
        : !data ? <Loader label="加载收藏…" />
        : data.list.length === 0 ? <EmptyState label="还没有收藏" sub="看到喜欢的帖子，点 ♡ 收藏" />
        : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(1, true)} tintColor={t.accent} colors={[t.accent]} />}
          >
            {data.list.map((th, i) => (
              <View key={th.id}>
                <FeedItem t={th} onOpen={(x) => nav.push('thread', { thread: x })} />
                {i < data.list.length - 1 && <Divider />}
              </View>
            ))}
            <Pager
              page={data.page}
              totalPages={data.totalPages}
              onJump={goPage}
              cap={`—  共 ${data.count} 篇收藏  —`}
              extra={paging ? <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: t.faint }}>加载中…</Text> : null}
            />
          </ScrollView>
        )}
    </Screen>
  );
}
