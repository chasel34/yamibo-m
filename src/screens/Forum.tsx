import React from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import { IconBtn, Kicker } from '../components/ui';
import { Loader, ErrorView } from '../components/states';
import { useNav } from '../useNav';
import { useTheme, FONTS } from '../theme';
import { getForumIndex } from '../api';
import type { ForumIndexData, BoardSummary } from '../types';

function BoardRow({ b, onOpen, last }: { b: BoardSummary; onOpen: (b: BoardSummary) => void; last?: boolean }) {
  const { t } = useTheme();
  const [iconErr, setIconErr] = React.useState(false);
  return (
    <View>
      <Pressable onPress={() => onOpen(b)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, paddingHorizontal: 22 }}>
        {b.iconUrl && !iconErr
          ? <Image source={{ uri: b.iconUrl }} onError={() => setIconErr(true)} style={{ width: 24, height: 24, borderRadius: 6 }} />
          : <Icon name="forum" size={22} stroke={1.6} color={t.inkSoft} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 3 }}>
            <Text style={{ fontFamily: FONTS.head, fontSize: 16.5, fontWeight: '700', color: t.ink }}>{b.name}</Text>
            {b.today > 0 ? <Text style={{ fontFamily: FONTS.head, fontSize: 12, fontWeight: '600', color: t.accentInk }}>{b.today}</Text> : null}
          </View>
          {b.desc ? <Text numberOfLines={1} style={{ fontFamily: FONTS.body, fontSize: 13.5, color: t.muted }}>{b.desc}</Text> : null}
        </View>
        <Icon name="chevRight" size={18} color={t.faint} />
      </Pressable>
      {!last && <View style={{ height: 1, backgroundColor: t.line, marginLeft: 58, marginRight: 22 }} />}
    </View>
  );
}

export default function ForumScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const [data, setData] = React.useState<ForumIndexData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const loadedRef = React.useRef(false);

  const load = React.useCallback(async (isRefresh?: boolean) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const d = await getForumIndex();
      setData(d);
    } catch (e) {
      if (!data) setError(e.message);
      else nav.toast(e.message);
    } finally {
      setRefreshing(false);
    }
  }, [data, nav]);

  useFocusEffect(React.useCallback(() => {
    if (!loadedRef.current) { loadedRef.current = true; load(false); }
  }, [load]));

  const openBoard = (b: BoardSummary) => nav.push('board', { board: { fid: b.fid, name: b.name, desc: b.desc } });

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={t.accent} colors={[t.accent]} />}
      >
        <View style={{ paddingTop: 6, paddingHorizontal: 22, paddingBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.head, fontSize: 25, fontWeight: '700', letterSpacing: 1.5, color: t.ink, lineHeight: 25 }}>百合会</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: t.muted, marginTop: 6 }}>
                晚上好{data?.me?.name ? '，' + data.me.name : ''}
              </Text>
            </View>
            <IconBtn name="search" size={20} onPress={() => nav.toast('搜索：敬请期待')} />
          </View>
        </View>

        {error ? <ErrorView message={error} onRetry={() => load(false)} />
          : !data ? <Loader label="加载板块…" />
          : (
            <>
              {data.groups.map((g, gi) => (
                <View key={g.id} style={{ marginBottom: 14 }}>
                  <Kicker style={{ paddingTop: 14, paddingBottom: 12, paddingHorizontal: 22 }}>{g.name}</Kicker>
                  {g.boards.map((b, i) => <BoardRow key={b.id} b={b} onOpen={openBoard} last={i === g.boards.length - 1} />)}
                  {gi < data.groups.length - 1 && <View style={{ height: 8 }} />}
                </View>
              ))}
              <Text style={{ fontFamily: FONTS.body, textAlign: 'center', fontSize: 12, color: t.faint, paddingTop: 10, paddingBottom: 30 }}>—  到底啦  —</Text>
            </>
          )}
      </ScrollView>
    </Screen>
  );
}
