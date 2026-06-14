import React from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl } from 'react-native';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import { Avatar, IconBtn, Divider } from '../components/ui';
import { Loader, ErrorView, EmptyState } from '../components/states';
import { useNav } from '../useNav';
import { useTheme, FONTS } from '../theme';
import { getReminders, getPMs } from '../api';

type Seg = 'remind' | 'dm';
const SEGS = {
  remind: { fetch: getReminders },
  dm: { fetch: getPMs },
};

export default function MessagesScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const [seg, setSeg] = React.useState<Seg>('remind');
  const [lists, setLists] = React.useState<{ remind: any[] | null; dm: any[] | null }>({ remind: null, dm: null });
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const listsRef = React.useRef(lists);
  listsRef.current = lists;

  const load = React.useCallback(async (which: Seg, isRefresh?: boolean) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const r = await SEGS[which].fetch(1);
      setLists((prev) => ({ ...prev, [which]: r.list }));
    } catch (e) {
      if (listsRef.current[which] === null) setError(e.message); else nav.toast(e.message);
    } finally {
      setRefreshing(false);
    }
  }, [nav]);

  // load each segment once, the first time it's shown
  React.useEffect(() => {
    if (lists[seg] === null) load(seg, false);
  }, [seg]); // eslint-disable-line

  const reminders = lists.remind;
  const dms = lists.dm;
  const refresh = () => load(seg, true);
  const loadingThis = lists[seg] === null;

  return (
    <Screen>
      <View style={{ paddingTop: 6, paddingHorizontal: 22, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
          <Text style={{ fontFamily: FONTS.head, fontSize: 25, fontWeight: '700', color: t.ink, flex: 1 }}>消息</Text>
          <IconBtn name="check" size={20} onPress={nav.notImplemented} />
        </View>
        <View style={{ flexDirection: 'row', gap: 24 }}>
          {([['remind', '提醒'], ['dm', '私信']] as const).map(([k, l]) => (
            <Pressable key={k} onPress={() => setSeg(k)} style={{ paddingBottom: 3, borderBottomWidth: 2, borderBottomColor: seg === k ? t.accent : 'transparent' }}>
              <Text style={{ fontFamily: FONTS.head, fontSize: 16, fontWeight: seg === k ? '700' : '500', color: seg === k ? t.ink : t.faint }}>{l}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Divider />

      {error ? <ErrorView message={error} onRetry={refresh} />
        : loadingThis ? <Loader label="加载…" />
        : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.accent} colors={[t.accent]} />}
          >
            {seg === 'remind' ? (
              reminders!.length === 0 ? <EmptyState label="还没有提醒" sub="有人找你时会出现在这里" /> : reminders!.map((r, i) => (
                <View key={r.id}>
                  <Pressable onPress={nav.notImplemented} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 18, paddingHorizontal: 22 }}>
                    <View style={{ marginTop: 1 }}><Icon name={r.icon} size={20} color={t.inkSoft} /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <Text style={{ fontFamily: FONTS.head, fontSize: 14.5, fontWeight: '600', color: t.ink }}>{r.who}</Text>
                        {r.unread && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: t.accent }} />}
                      </View>
                      <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: t.inkSoft, marginBottom: 6, lineHeight: 21.7 }}>{r.text}</Text>
                      <Text style={{ fontFamily: FONTS.head, fontSize: 11.5, color: t.muted, fontWeight: '500' }}>{r.time}</Text>
                    </View>
                  </Pressable>
                  {i < reminders!.length - 1 && <View style={{ height: 1, backgroundColor: t.line, marginLeft: 56, marginRight: 22 }} />}
                </View>
              ))
            ) : (
              dms!.length === 0 ? <EmptyState label="还没有私信" sub="安安静静，等一朵花开" /> : dms!.map((d, i) => (
                <View key={d.id}>
                  <Pressable onPress={nav.notImplemented} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, paddingHorizontal: 22 }}>
                    <Avatar user={d.user} size={46} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                        <Text numberOfLines={1} style={{ fontFamily: FONTS.head, fontSize: 15, fontWeight: '600', color: t.ink, flex: 1 }}>{d.user.name}</Text>
                        <Text style={{ fontFamily: FONTS.head, fontSize: 11.5, color: t.muted, fontWeight: '500' }}>{d.time}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text numberOfLines={1} style={{ fontFamily: FONTS.body, fontSize: 14, color: t.inkSoft, flex: 1 }}>{d.last}</Text>
                        {d.unread > 0 && (
                          <View style={{ minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: t.onAccent, fontSize: 11, fontWeight: '700', fontFamily: FONTS.head }}>{d.unread}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                  {i < dms!.length - 1 && <View style={{ height: 1, backgroundColor: t.line, marginLeft: 78, marginRight: 22 }} />}
                </View>
              ))
            )}
            <View style={{ height: 20 }} />
          </ScrollView>
        )}
    </Screen>
  );
}
