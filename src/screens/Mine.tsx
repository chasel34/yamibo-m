import React from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import { Avatar, HLine } from '../components/ui';
import MRow from '../components/MRow';
import { Loader } from '../components/states';
import { useNav } from '../useNav';
import { useTheme, FONTS } from '../theme';
import { getSelfProfile, getMe } from '../api';
import type { UserProfile } from '../types';

export default function MineScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const [me, setMe] = React.useState<UserProfile | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const loadedRef = React.useRef(false);

  const load = React.useCallback(async (isRefresh?: boolean) => {
    if (isRefresh) setRefreshing(true);
    try {
      const r = await getSelfProfile();
      setMe(r.user);
    } catch (e) {
      if (!me) setMe({ name: getMe().username || '我', group: '', stats: { collections: 0, themes: 0, replies: 0, follow: 0, fans: 0 }, credits: 0, uid: getMe().uid });
      nav.toast(e.message);
    } finally { setRefreshing(false); }
  }, [me, nav]);

  useFocusEffect(React.useCallback(() => {
    if (!loadedRef.current) { loadedRef.current = true; load(false); }
  }, [load]));

  const divFull = <HLine />;
  const divIndent = <HLine style={{ marginLeft: 56, marginRight: 22 }} />;

  if (!me) return <Screen><Loader label="加载…" /></Screen>;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={t.accent} colors={[t.accent]} />}
      >
        <View style={{ paddingTop: 6, paddingHorizontal: 22, paddingBottom: 8 }}>
          <Text style={{ fontFamily: FONTS.head, fontSize: 25, fontWeight: '700', color: t.ink }}>我的</Text>
        </View>
        <Pressable onPress={() => nav.push('profile', { self: true })} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 22 }}>
          <Avatar user={me} size={58} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: FONTS.head, fontSize: 20, fontWeight: '700', color: t.ink, marginBottom: 5 }}>{me.name}</Text>
            <Text style={{ fontFamily: FONTS.head, fontSize: 12.5, color: t.muted, fontWeight: '500' }}>{me.group}{me.credits != null ? ' · 总积分 ' + me.credits.toLocaleString() : ''}</Text>
          </View>
          <Icon name="chevRight" size={20} color={t.faint} />
        </Pressable>
        <HLine style={{ marginTop: 6 }} />
        <MRow icon="bookmark" label="我的收藏" sub={me.stats.collections + ' 篇'} onPress={() => nav.push('collections', {})} />
        {divIndent}
        <MRow
          icon="doc"
          label="我的发帖"
          sub={me.stats.themes + ' 篇'}
          onPress={() => nav.push('userposts', {
            uid: me.uid, name: me.name, self: true,
            tab: 'threads', stats: { themes: me.stats.themes, replies: me.stats.replies },
          })}
        />
        {divIndent}
        <MRow icon="history" label="浏览历史" onPress={() => nav.push('history', {})} />
        {divFull}
        <MRow icon="gear" label="设置" onPress={() => nav.push('settings', {})} />
        {divIndent}
        <MRow icon="info" label="关于" onPress={() => nav.push('about', {})} />
        {divIndent}
        <MRow icon="logout" label="退出登录" danger onPress={() => nav.logout()} />
        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}
