import React from 'react';
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, TextStyle } from 'react-native';
import Screen from '../components/Screen';
import Lily from '../components/Lily';
import Icon from '../components/Icon';
import { Toggle } from '../components/ui';
import { useNav } from '../useNav';
import { useTheme, FONTS } from '../theme';
import { login as apiLogin } from '../api';

function loginError(message?: string) {
  const m = String(message || '');
  if (/password_wrong|login_invalid/.test(m)) return '用户名或密码错误';
  if (/seccode|secqaa/.test(m)) return '需要验证码，请稍后到网页端登录';
  if (/login_strike|attempt/.test(m)) return '登录尝试过多，请稍后再试';
  return '登录失败，请检查账号或网络';
}

export default function LoginScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const [remember, setRemember] = React.useState(true);
  const [u, setU] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [pwFocus, setPwFocus] = React.useState(false);
  const [uFocus, setUFocus] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const doLogin = async () => {
    if (loading) return;
    if (!u.trim() || !pw) { nav.toast('请输入用户名和密码'); return; }
    setLoading(true);
    try {
      const r = await apiLogin(u.trim(), pw);
      if (r.ok) { nav.enter(); }
      else { nav.toast(loginError(r.message)); }
    } catch (e) {
      nav.toast(e.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const field = (focus: boolean): TextStyle => ({
    width: '100%', height: 52, backgroundColor: focus ? t.card : t.field,
    borderWidth: 1, borderColor: focus ? t.accent : 'transparent', borderRadius: 16,
    paddingHorizontal: 16, fontSize: 16, color: t.ink, fontFamily: FONTS.head,
  });

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 30, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ height: 72 }} />
        <View style={{ alignItems: 'center' }}>
          <Lily size={66} stroke={1.5} color={t.accent} />
          <Text style={{ fontFamily: FONTS.head, fontWeight: '700', color: t.ink, fontSize: 30, letterSpacing: 3, marginTop: 22, marginBottom: 10 }}>百合会</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 15, color: t.muted }}>温柔的第三方阅读客户端</Text>
        </View>
        <View style={{ height: 54 }} />
        <View style={{ gap: 12 }}>
          <TextInput
            style={field(uFocus)} placeholder="用户名 / 邮箱" placeholderTextColor={t.faint}
            value={u} onChangeText={setU} onFocus={() => setUFocus(true)} onBlur={() => setUFocus(false)}
            autoCapitalize="none"
          />
          <TextInput
            style={field(pwFocus)} placeholder="密码" placeholderTextColor={t.faint} secureTextEntry
            value={pw} onChangeText={setPw} onFocus={() => setPwFocus(true)} onBlur={() => setPwFocus(false)}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 26, marginHorizontal: 2 }}>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => setRemember(!remember)}>
            <Toggle on={remember} onChange={setRemember} />
            <Text style={{ fontFamily: FONTS.head, fontSize: 14, color: t.inkSoft, fontWeight: '500' }}>记住我</Text>
          </Pressable>
          <Pressable onPress={() => nav.toast('找回密码将跳转网页')}>
            <Text style={{ fontFamily: FONTS.head, fontSize: 14, color: t.inkSoft, fontWeight: '600' }}>找回密码</Text>
          </Pressable>
        </View>
        <Pressable disabled={loading} onPress={doLogin} style={({ pressed }) => ({
          height: 52, borderRadius: 999, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center',
          transform: [{ scale: pressed ? 0.98 : 1 }], opacity: loading ? 0.7 : 1,
        })}>
          {loading
            ? <ActivityIndicator size="small" color={t.onAccent} />
            : <Text style={{ color: t.onAccent, fontFamily: FONTS.head, fontSize: 16.5, fontWeight: '600' }}>登录</Text>}
        </Pressable>
        <Pressable onPress={() => nav.login()} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, marginBottom: 8, gap: 5 }}>
          <Text style={{ fontFamily: FONTS.head, fontSize: 14.5, color: t.inkSoft, fontWeight: '600' }}>游客浏览</Text>
          <Icon name="chevRight" size={16} color={t.faint} />
        </Pressable>
        <View style={{ height: 30 }} />
        <Text style={{ fontFamily: FONTS.body, textAlign: 'center', fontSize: 11.5, color: t.faint, lineHeight: 21 }}>
          登录即表示同意社区规范与版权声明{'\n'}v1.0 · 仅供阅读
        </Text>
      </ScrollView>
    </Screen>
  );
}
