// 原生版 WAF 质询遮罩：弹一个 WebView 加载论坛手机版页面，由系统 WebView 内核
// 执行 BAIDU_WAF 的 JS 质询并种下 nox cookie。RN Android 的 fetch 与 WebView 共享
// android.webkit.CookieManager，所以质询通过后 API 请求自动携带令牌；这里每 2s 用
// probeWafCleared() 探测放行，成功即收起并让 api.ts 重试原请求（issue #19）。
// 思路借鉴 LittleSurvival/yamibo-app 的「WebView 过质询 + HTTP 验证后再退出」。
import React from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme, FONTS } from '../theme';
import { setWafChallengeHandler, probeWafCleared } from '../api';
import { HOST } from '../util';

const PROBE_INTERVAL_MS = 2000;
const CHALLENGE_TIMEOUT_MS = 90_000;
// 质询是纯 JS 计算、无需交互，先用隐藏 WebView 静默通过；只有超过这个时间还没
// 放行（说明站点升级成了交互式验证）才弹出可视窗口。
const HIDDEN_PHASE_MS = 12_000;

interface PendingChallenge {
  resolve: (cleared: boolean) => void;
}

export default function WafGate() {
  const { t } = useTheme();
  const [pending, setPending] = React.useState<PendingChallenge | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    setWafChallengeHandler(() => new Promise<boolean>((resolve) => setPending({ resolve })));
    return () => setWafChallengeHandler(null);
  }, []);

  React.useEffect(() => {
    if (!pending) { setVisible(false); return; }
    const timer = setTimeout(() => setVisible(true), HIDDEN_PHASE_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  const finish = React.useCallback((cleared: boolean) => {
    setPending((prev) => {
      prev?.resolve(cleared);
      return null;
    });
  }, []);

  React.useEffect(() => {
    if (!pending) return;
    let stopped = false;
    let probing = false;
    const startedAt = Date.now();
    const timer = setInterval(async () => {
      if (stopped || probing) return;
      probing = true;
      try {
        if (await probeWafCleared()) {
          if (!stopped) finish(true);
          return;
        }
        if (Date.now() - startedAt > CHALLENGE_TIMEOUT_MS && !stopped) finish(false);
      } finally {
        probing = false;
      }
    }, PROBE_INTERVAL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, [pending, finish]);

  if (!pending) return null;

  if (!visible) {
    return (
      <View pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }}>
        <WebView
          source={{ uri: `${HOST}/forum.php?mobile=2` }}
          style={{ width: 1, height: 1, opacity: 0 }}
          sharedCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
        />
      </View>
    );
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={() => finish(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 340, backgroundColor: t.card, borderRadius: 20, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 14 }}>
            <ActivityIndicator size="small" color={t.accent} />
            <Text style={{ flex: 1, fontFamily: FONTS.head, fontSize: 14.5, fontWeight: '600', color: t.ink }}>正在通过站点安全验证…</Text>
            <Pressable onPress={() => finish(false)} hitSlop={10}>
              <Text style={{ fontFamily: FONTS.head, fontSize: 13, color: t.muted, fontWeight: '600' }}>取消</Text>
            </Pressable>
          </View>
          <WebView
            source={{ uri: `${HOST}/forum.php?mobile=2` }}
            style={{ height: 300, backgroundColor: t.bg }}
            sharedCookiesEnabled
            javaScriptEnabled
            domStorageEnabled
          />
          <Text style={{ fontFamily: FONTS.body, fontSize: 11.5, color: t.faint, paddingHorizontal: 18, paddingVertical: 12, lineHeight: 18 }}>
            论坛开启了防护检查，通过后会自动继续，无需操作。
          </Text>
        </View>
      </View>
    </Modal>
  );
}
