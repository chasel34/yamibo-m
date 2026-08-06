// Web 版 WAF 质询遮罩（仅开发验证用）：本地代理是纯 Node 转发、无法执行
// BAIDU_WAF 的 JS 质询，引导开发者从已通过验证的浏览器标签页复制 nox cookie，
// 注入代理 cookie jar（/__cookie）后自动重试。原生实现见 WafGate.native.tsx。
import React from 'react';
import { Modal, View, Text, TextInput, Pressable, ActivityIndicator, Linking } from 'react-native';
import { useTheme, FONTS } from '../theme';
import { setWafChallengeHandler, probeWafCleared, PROXY } from '../api';
import { HOST } from '../util';

interface PendingChallenge {
  resolve: (cleared: boolean) => void;
}

export default function WafGate() {
  const { t } = useTheme();
  const [pending, setPending] = React.useState<PendingChallenge | null>(null);
  const [value, setValue] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    setWafChallengeHandler(() => new Promise<boolean>((resolve) => {
      setValue('');
      setError('');
      setPending({ resolve });
    }));
    return () => setWafChallengeHandler(null);
  }, []);

  const finish = React.useCallback((cleared: boolean) => {
    setPending((prev) => {
      prev?.resolve(cleared);
      return null;
    });
  }, []);

  const submit = async () => {
    if (busy) return;
    const raw = value.trim();
    if (!raw) { setError('请先粘贴 cookie'); return; }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${PROXY}/__cookie`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: raw });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.stored?.length) {
        setError('没有找到有效的 nox cookie，请确认复制了 nox_jst_v1=… 的完整键值');
        return;
      }
      if (await probeWafCleared()) finish(true);
      else setError('注入后仍未通过验证，令牌可能已过期，请重新到论坛页取一份');
    } catch (e) {
      setError('无法连接本地代理，请确认 npm run proxy 正在运行');
    } finally {
      setBusy(false);
    }
  };

  if (!pending) return null;

  return (
    <Modal transparent animationType="fade" onRequestClose={() => finish(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 340, backgroundColor: t.card, borderRadius: 20, padding: 22 }}>
          <Text style={{ fontFamily: FONTS.head, fontSize: 17, fontWeight: '700', color: t.ink, marginBottom: 10 }}>站点安全验证</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 21, color: t.inkSoft }}>
            论坛的 WAF 拦截了本地代理。请在浏览器打开论坛让它先通过验证，然后在该标签页控制台复制 document.cookie 中的 nox_jst_v1 粘贴到下面。
          </Text>
          <Pressable onPress={() => Linking.openURL(HOST)}>
            <Text style={{ fontFamily: FONTS.head, fontSize: 13, color: t.accent, marginTop: 8, fontWeight: '600' }}>打开 bbs.yamibo.com</Text>
          </Pressable>
          <TextInput
            style={{
              marginTop: 14, minHeight: 72, backgroundColor: t.field, borderRadius: 12,
              paddingHorizontal: 12, paddingVertical: 10, fontSize: 12, color: t.ink, fontFamily: FONTS.body,
              textAlignVertical: 'top',
            }}
            multiline
            placeholder="nox_jst_v1=…（粘贴整串 document.cookie 也可以）"
            placeholderTextColor={t.faint}
            value={value}
            onChangeText={setValue}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!error && (
            <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: t.accent, marginTop: 8 }}>{error}</Text>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 18, marginTop: 18, alignItems: 'center' }}>
            <Pressable onPress={() => finish(false)} disabled={busy}>
              <Text style={{ fontFamily: FONTS.head, fontSize: 14, color: t.muted, fontWeight: '600' }}>取消</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={busy}
              style={{ height: 38, paddingHorizontal: 20, borderRadius: 999, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.7 : 1 }}
            >
              {busy
                ? <ActivityIndicator size="small" color={t.onAccent} />
                : <Text style={{ color: t.onAccent, fontFamily: FONTS.head, fontSize: 14, fontWeight: '600' }}>注入并重试</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
