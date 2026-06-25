import React from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';
import CachedImage from './CachedImage';
import { StripeImg } from './ui';
import { displayImageUrl } from '../api';
import { clamp } from '../util';
import type { ImagePagerItem } from './ImagePager';

const DOUBLE_MS = 260;        // 双击判定窗口（仅中间带 / 放大态用；边缘点击零延迟）
const MAX_SCALE = 4;          // 捏合上限
const ZOOM_SCALE = 2.4;       // 双击放大目标倍数
const DISMISS_DY = 120;       // 上下滑动退出阈值（px）

// —— 单页 / 缩略图：expo-image 渲染真实图片，失败降级到 StripeImg 占位 ——
// 关键点：recyclingKey 配合 pager 回收防串/闪旧图；allowDownscaling 走 Coil 式降采样
// （安卓上解码/内存最大收益）；transition=0 不淡入让翻页更跟手。
export function ViewerImage({ item, contain }: { item?: ImagePagerItem; contain?: boolean }) {
  const [err, setErr] = React.useState(false);
  React.useEffect(() => { setErr(false); }, [item && item.src]);
  if (item && item.src && !err) {
    return (
      <CachedImage
        source={{ uri: displayImageUrl(item.src) || item.src }}
        onError={() => setErr(true)}
        contentFit={contain ? 'contain' : 'cover'}
        recyclingKey={item.src ?? undefined}
        transition={0}
        priority={contain ? 'high' : 'low'}
        style={{ width: '100%', height: '100%' }}
      />
    );
  }
  return <StripeImg radius={0} cap={item && item.cap ? item.cap : '图片占位'} style={{ width: '100%', height: '100%' }} />;
}

interface ZoomableImageProps {
  item: ImagePagerItem;
  active: boolean;            // 是否当前页（离开页自动还原缩放）
  W: number;
  H: number;
  onZoomChange: (zoomed: boolean) => void;   // 驱动父级 zoomed → pager scrollEnabled
  onToggleChrome: () => void;
  onEdgeTap: (dir: -1 | 1) => void;
  onDismiss: () => void;
}

// 逐页缩放层：只负责捏合缩放、放大后单指 pan、双击放大/还原、上下滑动退出、以及点击。
// 横向翻页交给外层 PagerView——这里**绝不**夺取单指横向手势（见 onMoveShouldSetPanResponderCapture）。
function ZoomableImage({ item, active, W, H, onZoomChange, onToggleChrome, onEdgeTap, onDismiss }: ZoomableImageProps) {
  const zScale = React.useRef(new Animated.Value(1)).current;
  const zTx = React.useRef(new Animated.Value(0)).current;    // 屏幕空间平移
  const zTy = React.useRef(new Animated.Value(0)).current;
  const posY = React.useRef(new Animated.Value(0)).current;   // 竖向退出位移

  const z = React.useRef({ scale: 1, tx: 0, ty: 0 });         // 缩放/平移数值快照（手势读取）
  const g = React.useRef<any>({});                            // 手势状态机
  const tap = React.useRef<{ t: number; x: number; y: number; timer: any }>({ t: 0, x: 0, y: 0, timer: null });
  const activeRef = React.useRef(active);
  React.useEffect(() => { activeRef.current = active; }, [active]);

  // 只有当前页向父级汇报缩放状态（相邻预挂载页恒为 scale 1）。
  const report = React.useCallback((zoomed: boolean) => { if (activeRef.current) onZoomChange(zoomed); }, [onZoomChange]);

  const clampPan = React.useCallback((x: number, y: number, s: number): [number, number] => {
    const mx = ((s - 1) * W) / 2;
    const my = ((s - 1) * H) / 2;
    return [clamp(x, -mx, mx), clamp(y, -my, my)];
  }, [W, H]);

  const setZoom = React.useCallback((s: number, x: number, y: number) => {
    z.current = { scale: s, tx: x, ty: y };
    zScale.setValue(s); zTx.setValue(x); zTy.setValue(y);
    report(s > 1.001);
  }, [zScale, zTx, zTy, report]);

  const resetZoom = React.useCallback((animated = true) => {
    z.current = { scale: 1, tx: 0, ty: 0 };
    report(false);
    if (animated) {
      Animated.parallel([
        Animated.timing(zScale, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(zTx, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(zTy, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start();
    } else { zScale.setValue(1); zTx.setValue(0); zTy.setValue(0); }
  }, [zScale, zTx, zTy, report]);

  // 离开当前页：无动画还原，回来时不残留放大态。
  React.useEffect(() => { if (!active) resetZoom(false); }, [active, resetZoom]);
  React.useEffect(() => () => { if (tap.current.timer) clearTimeout(tap.current.timer); }, []);

  const doubleTap = React.useCallback((locX: number, locY: number) => {
    if (z.current.scale > 1) { resetZoom(); return; }
    const px = locX - W / 2;
    const py = locY - H / 2;
    const [cx, cy] = clampPan(px * (1 - ZOOM_SCALE), py * (1 - ZOOM_SCALE), ZOOM_SCALE);
    Animated.parallel([
      Animated.timing(zScale, { toValue: ZOOM_SCALE, duration: 260, useNativeDriver: true }),
      Animated.timing(zTx, { toValue: cx, duration: 260, useNativeDriver: true }),
      Animated.timing(zTy, { toValue: cy, duration: 260, useNativeDriver: true }),
    ]).start();
    z.current = { scale: ZOOM_SCALE, tx: cx, ty: cy };
    report(true);
  }, [W, H, clampPan, resetZoom, zScale, zTx, zTy, report]);

  // 点击（治本点击延迟）：边缘单击立即翻页、不进双击计时器；中间带/放大态才用双击窗口
  // 区分单击(切 chrome)与双击(放大 / 还原)。
  const handlePress = React.useCallback((locX: number, locY: number) => {
    const frac = W ? locX / W : 0.5;
    if (z.current.scale <= 1.001 && (frac < 0.30 || frac > 0.70)) {
      onEdgeTap(frac < 0.30 ? -1 : 1);
      return;
    }
    const now = Date.now();
    const dt = tap.current;
    if (now - dt.t < DOUBLE_MS && Math.abs(locX - dt.x) < 40 && Math.abs(locY - dt.y) < 40) {
      if (dt.timer) clearTimeout(dt.timer);
      tap.current = { t: 0, x: 0, y: 0, timer: null };
      doubleTap(locX, locY);
    } else {
      const timer = setTimeout(() => { tap.current.t = 0; onToggleChrome(); }, DOUBLE_MS);
      tap.current = { t: now, x: locX, y: locY, timer };
    }
  }, [W, doubleTap, onEdgeTap, onToggleChrome]);

  const springY = React.useCallback(() => {
    Animated.timing(posY, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  }, [posY]);

  const pan = React.useMemo(() => {
    const dist = (ts: any[]) => Math.hypot(ts[0].pageX - ts[1].pageX, ts[0].pageY - ts[1].pageY);
    return PanResponder.create({
      // 按下不抢手势 → 让原生 pager 自由起翻；点击由内层 Pressable 接（无位移）。
      onStartShouldSetPanResponder: () => false,
      // move 捕获阶段：只对捏合 / 放大态pan / 明确竖滑接管，**横向单指永不接管**（留给 pager）。
      onMoveShouldSetPanResponderCapture: (e, gesture) => {
        const ts = e.nativeEvent.touches;
        if (ts && ts.length >= 2) return true;                                       // 捏合（双指）
        if (z.current.scale > 1.001) return true;                                    // 放大态：单指 pan
        return Math.abs(gesture.dy) > 14 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e, gesture) => {
        const ts = e.nativeEvent.touches;
        if (ts && ts.length >= 2) {
          g.current = { mode: 'pinch', d0: dist(ts) || 1, s0: z.current.scale };
          return;
        }
        // 捕获在 move 时才发生 → 用 gesture.dx/dy 的起点做基准，避免接管瞬间跳变。
        g.current = {
          mode: z.current.scale > 1 ? 'pan' : 'vertical',
          tx0: z.current.tx, ty0: z.current.ty,
          gdx0: gesture.dx, gdy0: gesture.dy, dy: 0,
        };
      },
      onPanResponderMove: (e, gesture) => {
        const s = g.current;
        const ts = e.nativeEvent.touches;
        if (s.mode === 'pinch' && ts && ts.length >= 2) {
          const ns = Math.max(1, Math.min(MAX_SCALE, s.s0 * (dist(ts) / s.d0)));
          const [cx, cy] = clampPan(z.current.tx, z.current.ty, ns);
          setZoom(ns, cx, cy);
          return;
        }
        if (s.mode === 'pan') {
          const [cx, cy] = clampPan(s.tx0 + (gesture.dx - s.gdx0), s.ty0 + (gesture.dy - s.gdy0), z.current.scale);
          setZoom(z.current.scale, cx, cy);
          return;
        }
        if (s.mode === 'vertical') {
          s.dy = gesture.dy - s.gdy0;
          posY.setValue(s.dy);
        }
      },
      onPanResponderRelease: () => {
        const s = g.current;
        if (s.mode === 'pinch') { if (z.current.scale < 1.08) resetZoom(); g.current = {}; return; }
        if (s.mode === 'pan') { g.current = {}; return; }
        if (s.mode === 'vertical') {
          if (Math.abs(s.dy || 0) > DISMISS_DY) onDismiss();
          else springY();
        }
        g.current = {};
      },
      onPanResponderTerminate: () => { springY(); g.current = {}; },
    });
  }, [clampPan, setZoom, resetZoom, springY, posY, onDismiss]);

  return (
    <View style={{ width: W, height: H, overflow: 'hidden' }} {...pan.panHandlers}>
      <Pressable
        onPress={(e) => handlePress(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        android_disableSound
        style={{ flex: 1 }}
      >
        <Animated.View style={{ flex: 1, transform: [{ translateX: zTx }, { translateY: Animated.add(zTy, posY) }, { scale: zScale }] }}>
          <ViewerImage item={item} contain />
        </Animated.View>
      </Pressable>
    </View>
  );
}

// React.memo：每页 turn 时父级 renderPage 会重建，但 active/item/W/H/回调皆稳定，
// memo 让 N 页里只有 active 翻转的 2 页真正重渲染（其余跳过 PanResponder/Animated 重建）。
export default React.memo(ZoomableImage);
