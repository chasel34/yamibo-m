import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Icon from './Icon';
import { useTheme, FONTS, TAB_H } from '../theme';
import { subscribeNotice, getNotice } from '../api';
import type { Notice } from '../types';

// Bottom tab bar ported from .tabbar / .tabitem (论坛 / 消息 / 我的).
const TABS = [
  { id: 'forum', label: '论坛', icon: 'forum' },
  { id: 'messages', label: '消息', icon: 'bell' },
  { id: 'mine', label: '我的', icon: 'user' },
];

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTheme();
  const [notice, setNotice] = React.useState<Notice>(getNotice());
  React.useEffect(() => subscribeNotice(setNotice), []);
  const unread = (n: Notice) => (parseInt(n.newprompt || '0', 10) + parseInt(n.newpm || '0', 10));
  const badges: Record<string, number> = { messages: unread(notice) };
  return (
    <View style={{
      height: TAB_H, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around',
      paddingTop: 9, paddingHorizontal: 14, gap: 4, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.line,
    }}>
      {TABS.map((tab, idx) => {
        const active = state.index === idx;
        const badge = badges[tab.id] || 0;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: state.routes[idx].key, canPreventDefault: true });
          if (!active && !event.defaultPrevented) (navigation as any).navigate(tab.id);
        };
        return (
          <Pressable key={tab.id} onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 4, paddingTop: 6 }}>
            <View>
              <Icon name={tab.icon} size={25} stroke={active ? 2 : 1.7} color={active ? t.ink : t.faint} />
              {badge ? (
                <View style={{
                  position: 'absolute', top: 2, right: -14, minWidth: 16, height: 16, paddingHorizontal: 4,
                  borderRadius: 9, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2, borderColor: t.bg,
                }}>
                  <Text style={{ color: t.onAccent, fontSize: 10, fontWeight: '700', fontFamily: FONTS.head }}>{badge > 99 ? '99+' : badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontSize: 10.5, fontWeight: '600', letterSpacing: 0.3, color: active ? t.ink : t.faint, fontFamily: FONTS.head }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
