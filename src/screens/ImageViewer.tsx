import React from 'react';
import {
  Animated, Image, PanResponder, Pressable, ScrollView, Text, View,
} from 'react-native';
import Icon from '../components/Icon';
import { StatusBar, StripeImg } from '../components/ui';
import { useNav } from '../useNav';
import { FONTS } from '../theme';
import { READER_THEMES, getViewerHinted, markViewerHinted } from '../reading';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { displayImageUrl } from '../api';

interface ViewerItem {
  src?: string | null;
  cap?: string;
}

// 固定纸白 chrome（贴合阅读模式默认外观，不跟随/切换主题），与 Reader.tsx 的 chrome 同源。
const T = READER_THEMES.paper;
const ANIM = { duration: 300, useNativeDriver: true } as const;

// —— 单页/缩略图：渲染真实图片，失败降级到 StripeImg 占位 ——
function ViewerImage({ item, contain }: { item?: ViewerItem; contain?: boolean }) {
  const [err, setErr] = React.useState(false);
  React.useEffect(() => { setErr(false); }, [item && item.src]);
  if (item && item.src && !err) {
    return (
      <Image
        source={{ uri: displayImageUrl(item.src) || item.src }}
        onError={() => setErr(true)}
        resizeMode={contain ? 'contain' : 'cover'}
        style={{ width: '100%', height: '100%' }}
      />
    );
  }
  return <StripeImg h={9999} radius={0} cap={item && item.cap ? item.cap : '图片占位'} style={{ width: '100%', height: '100%' }} />;
}

// —— 底部进度滑块（复刻 reader 的 slider，按页定位） ——
function PageSlider({ i, n, onJump }: { i: number; n: number; onJump: (k: number) => void }) {
  const width = React.useRef(1);
  const [preview, setPreview] = React.useState<number | null>(null);
  const idx = preview != null ? preview : i;
  const ratio = n <= 1 ? 1 : idx / (n - 1);
  const pick = (x: number) => Math.round(Math.max(0, Math.min(1, x / width.current)) * (n - 1));
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 }}>
        <Text style={{ color: preview != null ? T.accent : T.soft, fontFamily: FONTS.head, fontSize: 12.5, fontWeight: preview != null ? '700' : '500' }}>第 {idx + 1} 页</Text>
        <Text style={{ color: T.soft, fontFamily: FONTS.head, fontSize: 12.5, fontVariant: ['tabular-nums'] }}>{n <= 1 ? '单页' : `${idx + 1} / ${n}`}</Text>
      </View>
      <View
        onLayout={(e) => { width.current = e.nativeEvent.layout.width; }}
        onStartShouldSetResponder={() => n > 1}
        onMoveShouldSetResponder={() => n > 1}
        onResponderGrant={(e) => setPreview(pick(e.nativeEvent.locationX))}
        onResponderMove={(e) => setPreview(pick(e.nativeEvent.locationX))}
        onResponderRelease={() => { const target = preview; setPreview(null); if (target != null && target !== i) onJump(target); }}
        onResponderTerminate={() => setPreview(null)}
        style={{ height: 26, justifyContent: 'center' }}
      >
        <View style={{ height: 3, borderRadius: 2, backgroundColor: T.line }} />
        <View style={{ position: 'absolute', left: 0, width: `${ratio * 100}%`, height: 3, borderRadius: 2, backgroundColor: T.accent, opacity: 0.85 }} />
        <View style={{ position: 'absolute', left: `${ratio * 100}%`, marginLeft: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: T.accent }} />
      </View>
    </View>
  );
}

export default function ImageViewerScreen({ route }: NativeStackScreenProps<RootStackParamList, 'viewer'>) {
  const nav = useNav();
  const title = route.params?.title;
  const images: ViewerItem[] = route.params?.images?.length ? route.params.images : [{ cap: '图片占位' }];
  const n = images.length;
  const initialIndex = Math.min(Math.max(route.params?.index || 0, 0), n - 1);

  const [i, setI] = React.useState(initialIndex);
  const [ui, setUi] = React.useState(false);
  const [panel, setPanel] = React.useState<'grid' | null>(null);
  const [hint, setHint] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [zoomed, setZoomed] = React.useState(false);
  const [vp, setVp] = React.useState({ W: 0, H: 0 });
  const { W, H } = vp;

  const iRef = React.useRef(i);
  React.useEffect(() => { iRef.current = i; }, [i]);

  // —— 翻页轨道 / 下拉退出 用 Animated.Value 平滑过渡 ——
  const posX = React.useRef(new Animated.Value(0)).current;   // 横向：-i*W + dx
  const posY = React.useRef(new Animated.Value(0)).current;   // 纵向：dy
  const zScale = React.useRef(new Animated.Value(1)).current;
  const zTx = React.useRef(new Animated.Value(0)).current;    // 屏幕空间平移
  const zTy = React.useRef(new Animated.Value(0)).current;
  const uiAnim = React.useRef(new Animated.Value(0)).current;

  const z = React.useRef({ scale: 1, tx: 0, ty: 0 });   // 缩放/平移数值快照（手势读取用）
  const g = React.useRef<any>({});                      // 手势状态机（镜像 viewer.jsx 的 g.current）
  const tap = React.useRef<any>({ t: 0, x: 0, y: 0, timer: null });

  // —— 首次提示 / chrome 自动隐藏（镜像 web 的 localStorage 逻辑） ——
  React.useEffect(() => {
    (async () => {
      const seen = await getViewerHinted();
      if (seen) setUi(true); else setHint(true);
      setLoaded(true);
    })();
  }, []);
  const dismissHint = React.useCallback(() => { setHint(false); markViewerHinted(); }, []);
  React.useEffect(() => { if (hint) { const t = setTimeout(dismissHint, 4200); return () => clearTimeout(t); } }, [hint, dismissHint]);
  React.useEffect(() => { if (!hint && ui) { const t = setTimeout(() => setUi(false), 2200); return () => clearTimeout(t); } }, [hint, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { Animated.timing(uiAnim, { toValue: ui ? 1 : 0, ...ANIM }).start(); }, [ui, uiAnim]);

  const clampPan = React.useCallback((x: number, y: number, s: number): [number, number] => {
    const mx = ((s - 1) * W) / 2;
    const my = ((s - 1) * H) / 2;
    return [Math.max(-mx, Math.min(mx, x)), Math.max(-my, Math.min(my, y))];
  }, [W, H]);

  const setZoom = React.useCallback((s: number, x: number, y: number) => {
    z.current = { scale: s, tx: x, ty: y };
    zScale.setValue(s); zTx.setValue(x); zTy.setValue(y);
    setZoomed(s > 1.001);
  }, [zScale, zTx, zTy]);

  const resetZoom = React.useCallback((animated = true) => {
    z.current = { scale: 1, tx: 0, ty: 0 };
    setZoomed(false);
    if (animated) {
      Animated.parallel([
        Animated.timing(zScale, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(zTx, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(zTy, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start();
    } else { zScale.setValue(1); zTx.setValue(0); zTy.setValue(0); }
  }, [zScale, zTx, zTy]);

  const go = React.useCallback((ni: number) => {
    if (!W || ni < 0 || ni > n - 1) return;
    resetZoom();
    setI(ni);
    Animated.timing(posX, { toValue: -ni * W, duration: 320, useNativeDriver: true }).start();
    Animated.timing(posY, { toValue: 0, ...ANIM }).start();
  }, [W, n, posX, posY, resetZoom]);

  const springX = React.useCallback(() => {
    Animated.timing(posX, { toValue: -iRef.current * W, ...ANIM }).start();
  }, [posX, W]);
  const springY = React.useCallback(() => {
    Animated.timing(posY, { toValue: 0, ...ANIM }).start();
  }, [posY]);

  const singleTap = React.useCallback((locX: number) => {
    if (z.current.scale > 1) { setUi((v) => !v); return; }
    const f = W ? locX / W : 0.5;
    if (f < 0.30) go(iRef.current - 1);
    else if (f > 0.70) go(iRef.current + 1);
    else setUi((v) => !v);
  }, [W, go]);

  const doubleTap = React.useCallback((locX: number, locY: number) => {
    if (z.current.scale > 1) { resetZoom(); return; }
    const ns = 2.4;
    const px = locX - W / 2;
    const py = locY - H / 2;
    const [cx, cy] = clampPan(px * (1 - ns), py * (1 - ns), ns);
    Animated.parallel([
      Animated.timing(zScale, { toValue: ns, duration: 260, useNativeDriver: true }),
      Animated.timing(zTx, { toValue: cx, duration: 260, useNativeDriver: true }),
      Animated.timing(zTy, { toValue: cy, duration: 260, useNativeDriver: true }),
    ]).start();
    z.current = { scale: ns, tx: cx, ty: cy };
    setZoomed(true);
  }, [W, H, clampPan, resetZoom, zScale, zTx, zTy]);

  const handleTap = React.useCallback(() => {
    const now = Date.now();
    const dt = tap.current;
    const { locX, locY } = g.current;
    if (now - dt.t < 280 && Math.abs(locX - dt.x) < 40 && Math.abs(locY - dt.y) < 40) {
      clearTimeout(dt.timer); dt.t = 0;
      doubleTap(locX, locY);
    } else {
      tap.current = { t: now, x: locX, y: locY, timer: setTimeout(() => singleTap(locX), 280) };
    }
  }, [doubleTap, singleTap]);

  const pan = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      posX.stopAnimation(); posY.stopAnimation();
      const ts = e.nativeEvent.touches;
      if (ts && ts.length >= 2) {
        const d = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
        g.current = { mode: 'pinch', d0: d || 1, s0: z.current.scale };
        return;
      }
      g.current = {
        mode: z.current.scale > 1 ? 'pan' : 'idle',
        tx0: z.current.tx, ty0: z.current.ty,
        locX: e.nativeEvent.locationX, locY: e.nativeEvent.locationY,
        axis: null, moved: false, dx: 0, dy: 0,
      };
    },
    onPanResponderMove: (e, gesture) => {
      const s = g.current;
      const ts = e.nativeEvent.touches;
      if (s.mode === 'pinch' && ts && ts.length >= 2) {
        const d = Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
        const ns = Math.max(1, Math.min(4, s.s0 * (d / s.d0)));
        const [cx, cy] = clampPan(z.current.tx, z.current.ty, ns);
        setZoom(ns, cx, cy);
        return;
      }
      const mx = gesture.dx, my = gesture.dy;
      if (Math.abs(mx) > 6 || Math.abs(my) > 6) s.moved = true;
      if (s.mode === 'pan') {
        const [cx, cy] = clampPan(s.tx0 + mx, s.ty0 + my, z.current.scale);
        setZoom(z.current.scale, cx, cy);
        return;
      }
      if (s.mode === 'idle') {
        if (s.axis == null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
          s.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
        }
        if (s.axis === 'x') {
          let d = mx;
          if ((iRef.current === 0 && d > 0) || (iRef.current === n - 1 && d < 0)) d *= 0.32;
          s.dx = d;
          posX.setValue(-iRef.current * W + d);
        } else if (s.axis === 'y') {
          s.dy = my;
          posY.setValue(my);
        }
      }
    },
    onPanResponderRelease: () => {
      const s = g.current;
      if (s.mode === 'pinch') { if (z.current.scale < 1.08) resetZoom(); g.current = {}; return; }
      if (s.mode === 'pan') { g.current = {}; return; }
      if (s.axis === 'x') {
        const th = Math.min(90, W * 0.22);
        if (s.dx <= -th && iRef.current < n - 1) go(iRef.current + 1);
        else if (s.dx >= th && iRef.current > 0) go(iRef.current - 1);
        else springX();
      } else if (s.axis === 'y') {
        if (Math.abs(s.dy) > 120) nav.closeViewer();
        else springY();
      } else if (!s.moved) {
        handleTap();
      }
      g.current = {};
    },
    onPanResponderTerminate: () => { springX(); springY(); g.current = {}; },
  }), [W, n, clampPan, setZoom, resetZoom, go, springX, springY, handleTap, nav, posX, posY]);

  const onLayout = (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = e.nativeEvent.layout;
    setVp({ W: width, H: height });
    posX.setValue(-iRef.current * width);
  };

  const bgOpacity = posY.interpolate({ inputRange: [-600, 0, 600], outputRange: [0.4, 1, 0.4], extrapolate: 'clamp' });
  const topTY = uiAnim.interpolate({ inputRange: [0, 1], outputRange: [-150, 0] });
  const botTY = uiAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] });

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', opacity: bgOpacity }} />

      {/* —— 翻页画布 —— */}
      <Animated.View
        onLayout={onLayout}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transform: [{ translateY: posY }] }}
        {...pan.panHandlers}
      >
        {W > 0 && (
          <Animated.View style={{ flexDirection: 'row', width: W * n, height: '100%', transform: [{ translateX: posX }] }}>
            {images.map((item, k) => (
              <View key={k} style={{ width: W, height: '100%', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View style={{ width: '100%', height: '100%', transform: k === i ? [{ translateX: zTx }, { translateY: zTy }, { scale: zScale }] : undefined }}>
                  <ViewerImage item={item} contain />
                </Animated.View>
              </View>
            ))}
          </Animated.View>
        )}
      </Animated.View>

      {/* —— 翻页热区指示（暗底上的 chevron） —— */}
      {ui && !zoomed && !panel && (
        <>
          <View pointerEvents="none" style={{ position: 'absolute', left: 10, top: '50%', marginTop: -13, opacity: i > 0 ? 1 : 0.2 }}><Icon name="back" size={26} color="rgba(255,255,255,.5)" /></View>
          <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: '50%', marginTop: -13, opacity: i < n - 1 ? 1 : 0.2 }}><Icon name="chevRight" size={26} color="rgba(255,255,255,.5)" /></View>
        </>
      )}

      {/* —— 顶栏（对齐 ReaderChrome.top） —— */}
      <Animated.View pointerEvents={ui ? 'auto' : 'none'} style={{ position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: T.chrome, borderBottomWidth: 1, borderBottomColor: T.line, transform: [{ translateY: topTY }] }}>
        <StatusBar color={T.ink} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, gap: 6 }}>
          <Pressable onPress={nav.closeViewer} style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" size={22} color={T.ink} /></Pressable>
          <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
            <Text numberOfLines={1} style={{ fontFamily: FONTS.head, fontSize: 15, fontWeight: '700', color: T.ink }}>{title || '汉化图集'}</Text>
            <Text style={{ fontFamily: FONTS.head, fontSize: 11.5, color: T.soft, marginTop: 2, fontVariant: ['tabular-nums'] }}>{i + 1} / {n}</Text>
          </View>
          <Pressable onPress={nav.notImplemented} style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}><Icon name="download" size={21} color={T.ink} /></Pressable>
        </View>
      </Animated.View>

      {/* —— 底栏（导航行 + 目录） —— */}
      <Animated.View pointerEvents={ui ? 'auto' : 'none'} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: T.chrome, borderTopWidth: 1, borderTopColor: T.line, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 22, transform: [{ translateY: botTY }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Pressable disabled={i === 0} onPress={() => go(i - 1)} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', opacity: i === 0 ? 0.4 : 1 }}><Icon name="back" size={20} color={i === 0 ? T.soft : T.ink} /></Pressable>
          <View style={{ flex: 1 }}><PageSlider i={i} n={n} onJump={go} /></View>
          <Pressable disabled={i === n - 1} onPress={() => go(i + 1)} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', opacity: i === n - 1 ? 0.4 : 1 }}><Icon name="chevRight" size={20} color={i === n - 1 ? T.soft : T.ink} /></Pressable>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', borderTopWidth: 1, borderTopColor: T.line, marginTop: 10, paddingTop: 6 }}>
          <Pressable onPress={() => setPanel('grid')} style={{ flexDirection: 'column', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 40 }}>
            <Icon name="doc" size={21} color={T.ink} />
            <Text style={{ color: T.ink, fontFamily: FONTS.head, fontSize: 11.5, fontWeight: '600' }}>目录</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* —— 网格目录（复用 reader 的 BottomSheet） —— */}
      {panel === 'grid' && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' }}>
          <Pressable onPress={() => setPanel(null)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,12,8,.34)' }} />
          <View style={{ maxHeight: '78%', backgroundColor: T.chrome, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 22 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ color: T.ink, fontFamily: FONTS.head, fontSize: 16, fontWeight: '700' }}>目录 · 共 {n} 页</Text>
              <Pressable onPress={() => setPanel(null)} style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={18} color={T.soft} /></Pressable>
            </View>
            <ScrollView style={{ marginHorizontal: -4 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4, paddingBottom: 6 }}>
                {images.map((item, k) => {
                  const cur = k === i;
                  return (
                    <View key={k} style={{ width: '33.333%', paddingHorizontal: 6, marginBottom: 12 }}>
                      <Pressable onPress={() => { go(k); setPanel(null); }}>
                        <View style={{ aspectRatio: 0.7, borderRadius: 9, overflow: 'hidden', borderWidth: cur ? 2.5 : 1, borderColor: cur ? T.accent : T.line }}>
                          <ViewerImage item={item} />
                        </View>
                        <Text style={{ textAlign: 'center', marginTop: 5, fontFamily: FONTS.head, fontSize: 11.5, fontWeight: cur ? '700' : '500', color: cur ? T.accent : T.soft, fontVariant: ['tabular-nums'] }}>{cur ? '当前' : k + 1}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {/* —— 首次提示遮罩（对齐 reader 的首次提示） —— */}
      {hint && (
        <Pressable onPress={dismissHint} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,10,8,.82)' }}>
          <View style={{ flex: 1, flexDirection: 'row' }}>
            {[
              { ic: 'back', t: '上一页', s: '轻点左侧' },
              { ic: 'forum', t: '切换菜单', s: '轻点中央' },
              { ic: 'chevRight', t: '下一页', s: '轻点右侧' },
            ].map((zone, k) => (
              <View key={k} style={{ flex: k === 1 ? 1.18 : 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: k === 1 ? 'rgba(20,14,11,.34)' : 'rgba(20,14,11,.18)', borderLeftWidth: k ? 1 : 0, borderLeftColor: 'rgba(255,255,255,.22)' }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: 'rgba(255,255,255,.4)', alignItems: 'center', justifyContent: 'center' }}><Icon name={zone.ic} size={24} color="#fff" /></View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontFamily: FONTS.head, fontSize: 14, fontWeight: '700' }}>{zone.t}</Text>
                  <Text style={{ color: 'rgba(255,255,255,.6)', fontFamily: FONTS.head, fontSize: 11.5, marginTop: 3 }}>{zone.s}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={{ paddingHorizontal: 26, paddingTop: 20, paddingBottom: 28, alignItems: 'center', backgroundColor: 'rgba(20,14,11,.34)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,.1)' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="zoom" size={16} color="rgba(255,255,255,.85)" /><Text style={{ color: 'rgba(255,255,255,.85)', fontFamily: FONTS.head, fontSize: 12.5, fontWeight: '600' }}>双击 / 捏合放大</Text></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="chevDown" size={16} color="rgba(255,255,255,.85)" /><Text style={{ color: 'rgba(255,255,255,.85)', fontFamily: FONTS.head, fontSize: 12.5, fontWeight: '600' }}>上下滑动退出</Text></View>
            </View>
            <View style={{ height: 40, paddingHorizontal: 22, borderRadius: 999, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontFamily: FONTS.head, fontSize: 14, fontWeight: '600' }}>知道了</Text>
            </View>
          </View>
        </Pressable>
      )}
    </View>
  );
}
