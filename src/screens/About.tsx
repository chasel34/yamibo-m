import { View, Text, ScrollView, Pressable } from 'react-native';
import Screen from '../components/Screen';
import Lily from '../components/Lily';
import { NavHeader, HLine } from '../components/ui';
import MRow from '../components/MRow';
import Icon from '../components/Icon';
import { useNav } from '../useNav';
import { useTheme, FONTS } from '../theme';
import { APP_DISPLAY_VERSION } from '../appInfo';
import { UpdateStatusChip, useAppUpdates } from '../appUpdates';

export default function AboutScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const { staged, openCheck } = useAppUpdates();
  const divFull = <HLine />;
  const divIndent = <HLine style={{ marginLeft: 56, marginRight: 22 }} />;
  return (
    <Screen>
      <NavHeader title="关于" onBack={nav.pop} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingTop: 34, paddingHorizontal: 30 }}>
          <Lily size={56} stroke={1.5} color={t.accent} />
          <Text style={{ fontFamily: FONTS.head, fontSize: 22, fontWeight: '700', letterSpacing: 2, color: t.ink, marginTop: 18 }}>百合会</Text>
          <Text style={{ fontFamily: FONTS.head, fontSize: 13, color: t.muted, fontWeight: '500', marginTop: 7 }}>阅读客户端 {APP_DISPLAY_VERSION}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 14.5, color: t.inkSoft, marginTop: 20, lineHeight: 25.4, maxWidth: 280, textAlign: 'center' }}>
            一个温柔、清爽的第三方阅读客户端。当前版本仅支持浏览与登录，写操作将在后续版本中陆续开放。
          </Text>
        </View>
        <View style={{ height: 34 }} />
        {divFull}
        <Pressable onPress={openCheck} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, paddingHorizontal: 22 }}>
          <Icon name="refresh" size={21} color={staged ? t.accent : t.inkSoft} />
          <Text style={{ flex: 1, fontFamily: FONTS.head, fontSize: 15.5, fontWeight: '500', color: t.ink }}>检查更新</Text>
          {staged ? <UpdateStatusChip /> : <Icon name="chevRight" size={18} color={t.faint} style={{ marginLeft: 8 }} />}
        </Pressable>
        {divIndent}
        <MRow icon="doc" label="社区规范" onPress={nav.notImplemented} />
        {divIndent}
        <MRow icon="info" label="版权声明" onPress={nav.notImplemented} />
        {divIndent}
        <MRow icon="heart" label="鸣谢汉化组与同好" onPress={() => nav.toast('感谢每一位创作者')} />
        {divFull}
        <Text style={{ fontFamily: FONTS.body, textAlign: 'center', fontSize: 11.5, color: t.faint, paddingVertical: 26, lineHeight: 19.5 }}>
          非官方客户端 · 仅供学习交流{'\n'}内容版权归原作者与论坛所有
        </Text>
      </ScrollView>
    </Screen>
  );
}
