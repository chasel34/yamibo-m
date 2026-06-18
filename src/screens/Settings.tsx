import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Screen from '../components/Screen';
import Icon from '../components/Icon';
import { NavHeader, Toggle, Kicker, HLine } from '../components/ui';
import { useNav } from '../useNav';
import { useTheme, FONTS, cardShadow } from '../theme';

// iOS-style grouped card + row (the only place cards appear, per the design).
function Card({ children }: { children?: React.ReactNode }) {
  const { t, theme } = useTheme();
  return <View style={[{ backgroundColor: t.card, borderRadius: 18, marginHorizontal: 16, overflow: 'hidden' }, cardShadow(theme)]}>{children}</View>;
}
function ListRow({ children, onPress }: { children?: React.ReactNode; onPress?: () => void }) {
  const inner = <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15, paddingHorizontal: 18 }}>{children}</View>;
  return onPress ? <Pressable onPress={onPress}>{inner}</Pressable> : inner;
}
const InnerHr = () => <HLine style={{ marginLeft: 57, marginRight: 18 }} />;

function FontSizePicker() {
  const { t, uiFontLevel, setUiFontLevel } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {['小', '中', '大'].map((l, i) => (
        <Pressable key={i} onPress={() => setUiFontLevel(i)} style={{
          width: 34, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 8,
          backgroundColor: uiFontLevel === i ? t.accent : t.card2,
        }}>
          <Text style={{ fontFamily: FONTS.head, fontSize: 13, fontWeight: '600', color: uiFontLevel === i ? t.onAccent : t.inkSoft }}>{l}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function SettingsScreen() {
  const nav = useNav();
  const { t, theme } = useTheme();
  const lrIc = (name: string) => <View style={{ width: 26, alignItems: 'center' }}><Icon name={name} size={20} color={t.inkSoft} /></View>;
  const lrTitle = (txt: string, color?: string) => <Text style={{ fontFamily: FONTS.head, fontSize: 15.5, fontWeight: '500', color: color || t.ink, flex: 1 }}>{txt}</Text>;

  return (
    <Screen>
      <NavHeader title="设置" onBack={nav.pop} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <Kicker style={{ paddingTop: 6, paddingHorizontal: 22, paddingBottom: 11 }}>外观</Kicker>
        <Card>
          <ListRow>
            {lrIc('moon')}{lrTitle('深色模式')}
            <Toggle on={theme === 'dark'} onChange={(v) => nav.setTheme(v ? 'dark' : 'light')} />
          </ListRow>
          <InnerHr />
          <ListRow>
            {lrIc('type')}{lrTitle('字号')}
            <FontSizePicker />
          </ListRow>
        </Card>

        <Kicker style={{ paddingTop: 24, paddingHorizontal: 22, paddingBottom: 11 }}>阅读</Kicker>
        <Card>
          <ListRow onPress={nav.notImplemented}>
            {lrIc('trash')}{lrTitle('清除缓存')}
            <Text style={{ fontFamily: FONTS.head, fontSize: 12.5, color: t.muted }}>42.6 MB</Text>
          </ListRow>
        </Card>

        <Kicker style={{ paddingTop: 24, paddingHorizontal: 22, paddingBottom: 11 }}>账户</Kicker>
        <Card>
          <ListRow onPress={() => nav.push('about', {})}>
            {lrIc('info')}{lrTitle('关于百合会客户端')}
            <Icon name="chevRight" size={18} color={t.faint} />
          </ListRow>
          <InnerHr />
          <ListRow onPress={() => nav.logout()}>
            <View style={{ width: 26, alignItems: 'center' }}><Icon name="logout" size={20} color={t.accent} /></View>
            {lrTitle('退出登录', t.accent)}
          </ListRow>
        </Card>
        <View style={{ height: 24 }} />
      </ScrollView>
    </Screen>
  );
}
