import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LegendList } from '@legendapp/list/react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import { NavHeader, NavBack, Kicker, Divider, HLine } from '../components/ui';
import { EmptyState } from '../components/states';
import { useNav } from '../useNav';
import { useTheme, FONTS } from '../theme';
import { getHistory, clearHistory } from '../history';
import { timeFromUnix } from '../util';
import type { HistoryItem } from '../types';

interface DayGroup {
  day: string;
  items: HistoryItem[];
}

function groupByDay(items: HistoryItem[]): DayGroup[] {
  const today: HistoryItem[] = []; const yesterday: HistoryItem[] = []; const earlier: HistoryItem[] = [];
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const startYest = startToday.getTime() - 86400000;
  items.forEach((it) => {
    if (it.ts >= startToday.getTime()) today.push(it);
    else if (it.ts >= startYest) yesterday.push(it);
    else earlier.push(it);
  });
  return [
    { day: '今天', items: today },
    { day: '昨天', items: yesterday },
    { day: '更早', items: earlier },
  ].filter((g) => g.items.length);
}

// 日期分组拍平成行：组标题 / 记录（组内末行不带 Divider）/ 组间 HLine。
type HistoryRow =
  | { key: string; kind: 'day'; day: string }
  | { key: string; kind: 'item'; item: HistoryItem; last: boolean }
  | { key: string; kind: 'hline' };

function flattenGroups(groups: DayGroup[]): HistoryRow[] {
  const out: HistoryRow[] = [];
  groups.forEach((g, gi) => {
    out.push({ key: `d:${g.day}`, kind: 'day', day: g.day });
    g.items.forEach((it, i) => out.push({ key: `t:${it.tid}`, kind: 'item', item: it, last: i === g.items.length - 1 }));
    if (gi < groups.length - 1) out.push({ key: `h:${g.day}`, kind: 'hline' });
  });
  return out;
}

export default function HistoryScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const [items, setItems] = React.useState<HistoryItem[]>([]);

  const load = React.useCallback(async () => { setItems(await getHistory()); }, []);
  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  const rows = React.useMemo(() => flattenGroups(groupByDay(items)), [items]);

  const renderRow = React.useCallback(({ item: row }: { item: HistoryRow }) => {
    if (row.kind === 'day') return <Kicker style={{ paddingTop: 16, paddingHorizontal: 22, paddingBottom: 4 }}>{row.day}</Kicker>;
    if (row.kind === 'hline') return <HLine />;
    const it = row.item;
    return (
      <View>
        <Pressable onPress={() => nav.push('thread', { thread: { tid: it.tid, title: it.title, author: it.author } })} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 16, paddingHorizontal: 22 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: FONTS.head, fontSize: 16, fontWeight: '700', color: t.ink, lineHeight: 22.4, marginBottom: 6 }}>{it.title}</Text>
            <Text style={{ fontFamily: FONTS.head, fontSize: 12, color: t.muted, fontWeight: '500' }}>{it.author?.name ? it.author.name + ' · ' : ''}{timeFromUnix(Math.floor(it.ts / 1000))}</Text>
          </View>
          <Icon name="chevRight" size={17} color={t.faint} style={{ marginTop: 3 }} />
        </Pressable>
        {!row.last && <Divider />}
      </View>
    );
  }, [nav, t]);

  return (
    <Screen>
      <NavHeader title="浏览历史" onBack={nav.pop}
        right={<NavBack onBack={async () => { await clearHistory(); setItems([]); nav.toast('已清空历史'); }}><Icon name="trash" size={18} color={t.inkSoft} /></NavBack>} />
      {items.length === 0 ? <EmptyState label="还没有浏览记录" sub="读过的帖子会出现在这里" />
        : (
          <LegendList
            data={rows}
            keyExtractor={(row) => row.key}
            renderItem={renderRow}
            recycleItems={false}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={<View style={{ height: 24 }} />}
          />
        )}
    </Screen>
  );
}
