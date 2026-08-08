import React from 'react';
import { Animated, FlatList, Platform, Pressable, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Icon from '../components/Icon';
import { StatusBar } from '../components/ui';
import ViewerGallery, { ViewerGalleryHandle, ViewerItem } from '../components/ViewerGallery';
import ViewerImage from '../components/ViewerImage';
import { useNav } from '../useNav';
import { FONTS } from '../theme';
import { READER_THEMES, getViewerHinted, markViewerHinted } from '../reading';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { displayImageUrl } from '../api';
import { forumImageHeaders } from '../imageCookies';
import { clamp } from '../util';

// 固定纸白 chrome（贴合阅读模式默认外观，不跟随/切换主题），与 Reader.tsx 的 chrome 同源。
const T = READER_THEMES.paper;
const ANIM = { duration: 300, useNativeDriver: Platform.OS !== 'web' } as const;

// —— 底部进度滑块（复刻 reader 的 slider，按页定位） ——
function PageSlider({ i, n, onJump }: { i: number; n: number; onJump: (k: number) => void }) {
  const width = React.useRef(1);
  const [preview, setPreview] = React.useState<number | null>(null);
  const idx = preview != null ? preview : i;
  const ratio = n <= 1 ? 1 : idx / (n - 1);
  const pick = (x: number) => Math.round(clamp(x / width.current, 0, 1) * (n - 1));
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

  const pagerRef = React.useRef<ViewerGalleryHandle>(null);
  const targetRef = React.useRef(initialIndex);   // 即时记录“意图页”，让快速点击/连点不丢、不依赖滞后的 state
  const iRef = React.useRef(initialIndex);        // 真实落点（chrome 隐藏期间不进 state，展开时再同步）
  const uiRef = React.useRef(ui);
  const panelRef = React.useRef(panel);
  const prefetchTimer = React.useRef<any>(null);
  const uiAnim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => { uiRef.current = ui; }, [ui]);
  React.useEffect(() => { panelRef.current = panel; }, [panel]);
  React.useEffect(() => () => { if (prefetchTimer.current) clearTimeout(prefetchTimer.current); }, []);

  // —— 预读邻页（配合 Gallery windowSize 预挂载的 Mihon 式预读）：大图秒出、翻页不闪旧图 ——
  const prefetchAround = React.useCallback((center: number) => {
    for (const k of [center - 1, center + 1, center - 2, center + 2]) {
      if (k < 0 || k >= n) continue;
      const src = images[k] && images[k].src;
      const url = displayImageUrl(src) || src;
      if (url) forumImageHeaders(url).then((headers) => ExpoImage.prefetch(url, { cachePolicy: 'memory-disk', headers }));
    }
  }, [images, n]);

  // —— 首次提示 / chrome 自动隐藏（镜像 web 的 localStorage 逻辑） ——
  React.useEffect(() => {
    (async () => {
      const seen = await getViewerHinted();
      if (seen) setUi(true); else setHint(true);
      setLoaded(true);
    })();
  }, []);
  React.useEffect(() => { prefetchAround(initialIndex); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const dismissHint = React.useCallback(() => { setHint(false); markViewerHinted(); }, []);
  React.useEffect(() => { if (hint) { const t = setTimeout(dismissHint, 4200); return () => clearTimeout(t); } }, [hint, dismissHint]);
  React.useEffect(() => { if (!hint && ui) { const t = setTimeout(() => setUi(false), 2200); return () => clearTimeout(t); } }, [hint, loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { Animated.timing(uiAnim, { toValue: ui ? 1 : 0, ...ANIM }).start(); }, [ui, uiAnim]);

  // 页码唯一真相源：翻页吸附后回调。settle 帧是连点链里下一次动画的起跑帧，
  // 这里必须尽量零开销：chrome 隐藏时页码只进 ref 不 setState（免整屏重渲染），
  // prefetch 延迟合并——连点时只预读最终落点的邻页。
  const onIndex = React.useCallback((pos: number) => {
    targetRef.current = pos;
    iRef.current = pos;
    // A freshly-settled page is always at scale 1, so clear any zoom flag left stuck
    // by paging via the on-screen prev/next/slider chrome while a page was zoomed
    // (that path doesn't run the leaving page's resetZoom report).
    setZoomed(false);
    if (uiRef.current || panelRef.current) setI(pos);
    if (prefetchTimer.current) clearTimeout(prefetchTimer.current);
    prefetchTimer.current = setTimeout(() => prefetchAround(pos), 150);
  }, [prefetchAround]);
  // 点击/按钮翻页（去重避免重复命令）。动画期间 activeIndex 不动 → 挂载窗口停在
  // 上次落点 ±2，连点把目标推出窗口时降级为直达跳转，避免滑进未挂载的空白页。
  const go = React.useCallback((ni: number) => {
    const t = clamp(ni, 0, n - 1);
    if (t === targetRef.current) return;
    targetRef.current = t;
    if (Math.abs(t - iRef.current) > 2) {
      pagerRef.current?.jumpTo(t);
      return;
    }
    pagerRef.current?.setPage(t);
  }, [n]);
  // 滑块/目录跳转：直达。
  const jump = React.useCallback((ni: number) => {
    const t = clamp(ni, 0, n - 1);
    targetRef.current = t;
    pagerRef.current?.jumpTo(t);
  }, [n]);

  // 手指开始拖动即回收未完成的 setPage 意图：动画可能被这次拖动取消且吸附回原页
  //（此时不触发 onIndex），不回收的话下一次 edgeTap 会从虚高的 targetRef 起算而跳两页。
  const onPanStart = React.useCallback(() => { targetRef.current = iRef.current; }, []);
  const toggleChrome = React.useCallback(() => {
    setI(iRef.current);   // chrome 隐藏期间页码没进 state，展开前补同步（相同值时 React 自动跳过）
    setUi((v) => !v);
  }, []);
  const onDismiss = React.useCallback(() => nav.closeViewer(), [nav]);
  const onEdgeTap = React.useCallback((dir: -1 | 1) => go(targetRef.current + dir), [go]);

  const onLayout = (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width, height } = e.nativeEvent.layout;
    setVp({ W: width, H: height });
  };

  const topTY = uiAnim.interpolate({ inputRange: [0, 1], outputRange: [-150, 0] });
  const botTY = uiAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] });

  return (
    // 背景黑底在 ViewerGallery 内部（native 上下拖拽时渐隐透出下层，配合 transparentModal）。
    <View style={{ flex: 1 }} onLayout={onLayout}>
      {/* —— 翻页画布（UI 线程手势：吸附翻页 + 捏合/双击缩放 + 拖拽退出） —— */}
      {W > 0 && (
        <ViewerGallery
          ref={pagerRef}
          images={images}
          initialIndex={initialIndex}
          W={W}
          H={H}
          onIndex={onIndex}
          onZoomChange={setZoomed}
          onToggleChrome={toggleChrome}
          onEdgeTap={onEdgeTap}
          onDismiss={onDismiss}
          onPanStart={onPanStart}
        />
      )}

      {/* —— 翻页热区指示（暗底上的 chevron） —— */}
      {ui && !zoomed && !panel && (
        <>
          <View style={{ pointerEvents: 'none', position: 'absolute', left: 10, top: '50%', marginTop: -13, opacity: i > 0 ? 1 : 0.2 }}><Icon name="back" size={26} color="rgba(255,255,255,.5)" /></View>
          <View style={{ pointerEvents: 'none', position: 'absolute', right: 10, top: '50%', marginTop: -13, opacity: i < n - 1 ? 1 : 0.2 }}><Icon name="chevRight" size={26} color="rgba(255,255,255,.5)" /></View>
        </>
      )}

      {/* —— 顶栏（对齐 ReaderChrome.top） —— */}
      <Animated.View style={{ pointerEvents: ui ? 'auto' : 'none', position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: T.chrome, borderBottomWidth: 1, borderBottomColor: T.line, transform: [{ translateY: topTY }] }}>
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
      <Animated.View style={{ pointerEvents: ui ? 'auto' : 'none', position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: T.chrome, borderTopWidth: 1, borderTopColor: T.line, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 22, transform: [{ translateY: botTY }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Pressable disabled={i === 0} onPress={() => go(targetRef.current - 1)} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', opacity: i === 0 ? 0.4 : 1 }}><Icon name="back" size={20} color={i === 0 ? T.soft : T.ink} /></Pressable>
          <View style={{ flex: 1 }}><PageSlider i={i} n={n} onJump={jump} /></View>
          <Pressable disabled={i === n - 1} onPress={() => go(targetRef.current + 1)} style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', opacity: i === n - 1 ? 0.4 : 1 }}><Icon name="chevRight" size={20} color={i === n - 1 ? T.soft : T.ink} /></Pressable>
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
            {/* 虚拟化网格：目录一开只挂载视口附近的缩略图，避免大图集一次性拉取/解码全部原图 */}
            <FlatList
              data={images}
              numColumns={3}
              keyExtractor={(item, k) => `${k}:${item.src ?? ''}`}
              style={{ marginHorizontal: -4 }}
              contentContainerStyle={{ paddingHorizontal: 4, paddingBottom: 6 }}
              initialNumToRender={12}
              maxToRenderPerBatch={9}
              windowSize={5}
              extraData={i}
              renderItem={({ item, index: k }) => {
                const cur = k === i;
                return (
                  <View style={{ width: '33.333%', paddingHorizontal: 6, marginBottom: 12 }}>
                    <Pressable onPress={() => { jump(k); setPanel(null); }}>
                      <View style={{ aspectRatio: 0.7, borderRadius: 9, overflow: 'hidden', borderWidth: cur ? 2.5 : 1, borderColor: cur ? T.accent : T.line }}>
                        <ViewerImage item={item} />
                      </View>
                      <Text style={{ textAlign: 'center', marginTop: 5, fontFamily: FONTS.head, fontSize: 11.5, fontWeight: cur ? '700' : '500', color: cur ? T.accent : T.soft, fontVariant: ['tabular-nums'] }}>{cur ? '当前' : k + 1}</Text>
                    </Pressable>
                  </View>
                );
              }}
            />
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
