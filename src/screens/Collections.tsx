import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import Screen from '../components/Screen';
import { NavHeader, FeedItem, Divider } from '../components/ui';
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

  const load = React.useCallback(async (isRefresh?: boolean) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try { const r = await getCollections(1); setData(r); }
    catch (e) { if (!data) setError(e.message); else nav.toast(e.message); }
    finally { setRefreshing(false); }
  }, [data, nav]);
  React.useEffect(() => { load(false); }, []); // eslint-disable-line

  return (
    <Screen>
      <NavHeader title="我的收藏" onBack={nav.pop} />
      <Divider />
      {error ? <ErrorView message={error} onRetry={() => load(false)} />
        : !data ? <Loader label="加载收藏…" />
        : data.list.length === 0 ? <EmptyState label="还没有收藏" sub="看到喜欢的帖子，点 ♡ 收藏" />
        : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={t.accent} colors={[t.accent]} />}
          >
            {data.list.map((th, i) => (
              <View key={th.id}>
                <FeedItem t={th} onOpen={(x) => nav.push('thread', { thread: x })} />
                {i < data.list.length - 1 && <Divider />}
              </View>
            ))}
            <Text style={{ fontFamily: FONTS.body, textAlign: 'center', fontSize: 12, color: t.faint, paddingTop: 14, paddingBottom: 24 }}>—  共 {data.count} 篇收藏  —</Text>
          </ScrollView>
        )}
    </Screen>
  );
}
