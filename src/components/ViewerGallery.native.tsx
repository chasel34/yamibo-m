import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Gallery, type GalleryRefType, type GalleryTransitionState } from 'react-native-zoom-toolkit';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import ViewerImage from './ViewerImage';
import type { ViewerGalleryHandle, ViewerGalleryProps, ViewerItem } from './ViewerGallery';

const EDGE_FRAC = 0.30;     // 左右各 30% 为翻页热区（与首次提示的三分区一致）
const MAX_SCALE = 4;        // 捏合/双击上限
const DISMISS_DY = 120;     // 上下拖拽退出阈值（px）

// 单页：拿到真实尺寸后把子视图收紧成 contain 后的实际显示矩形，Gallery 以子视图测量
// 缩放边界——不收紧的话 letterbox 空白也算进 pan 范围，放大后能把图平移出屏。
function GalleryPage({ item, W, H }: { item: ViewerItem; W: number; H: number }) {
  const [ar, setAr] = React.useState<number | null>(null);
  const onSize = React.useCallback((w: number, h: number) => { if (w > 0 && h > 0) setAr(w / h); }, []);
  let w = W;
  let h = H;
  if (ar) {
    if (W / H > ar) { h = H; w = H * ar; } else { w = W; h = W / ar; }
  }
  return (
    <View style={{ width: w, height: h }}>
      <ViewerImage item={item} contain onSize={onSize} />
    </View>
  );
}

// —— 翻页画布（UI 线程手势版） ——
// zoom-toolkit Gallery 负责：横向滚动吸附、捏合（焦点锚定+双指平移）、双击放大/还原、
// 放大态单指 pan（越过图边自动接力到翻页）、惯性衰减、windowSize 窗口化挂载。
// 外层再包一个零延迟"边缘单击翻页"手势：在缩放=1 且落点在左右热区时抢先激活，
// 从根上避开"单击要等双击判定超时"的延迟，也让快速连点永远只翻页——不会凑成
// 双击触发缩放，更不会冒出菜单（这正是旧 PanResponder 版误触菜单的病根）。
function ViewerGallery(
  { images, initialIndex, W, H, onIndex, onZoomChange, onToggleChrome, onEdgeTap, onDismiss, onPanStart }: ViewerGalleryProps,
  ref: React.Ref<ViewerGalleryHandle>,
) {
  const galleryRef = React.useRef<GalleryRefType>(null);
  const scaleSV = useSharedValue(1);   // 当前缩放（worklet 侧判定热区是否生效）
  const pullY = useSharedValue(0);     // 上下拖拽位移（驱动背景渐隐）
  const dismissed = React.useRef(false);

  const dismiss = React.useCallback(() => {
    if (dismissed.current) return;   // onSwipe 与 onVerticalPull 可能对同一次松手各报一次
    dismissed.current = true;
    onDismiss();
  }, [onDismiss]);

  // setPage（点击/上下页按钮）带滑动动画——animate 参数来自 patches/ 里对 zoom-toolkit
  // 的补丁（上游 setIndex 只有瞬时跳转）；jumpTo（滑块/目录）直达。瞬时路径下库的
  // setIndex 会把内部 scale 归 0（上游怪癖），紧跟一个无动画 reset 恢复到 1，否则新页不可见。
  const setTo = React.useCallback((index: number, animate: boolean) => {
    if (animate) {
      galleryRef.current?.setIndex(index, true);
      return;
    }
    galleryRef.current?.setIndex(index);
    galleryRef.current?.reset(false);
  }, []);
  React.useImperativeHandle(ref, () => ({
    setPage: (index) => setTo(index, true),
    jumpTo: (index) => setTo(index, false),
  }), [setTo]);

  // 边缘单击（零延迟）：touch down 阶段就按缩放/落点决定去留，不满足立即 fail 让给
  // Gallery（其内部单击/双击/长按互斥组）；满足则在抬指瞬间激活并吃掉这次点击。
  const edgeTap = Gesture.Tap()
    .maxDuration(250)
    .onTouchesDown((e, mgr) => {
      const t = e.allTouches[0];
      if (!t || e.numberOfTouches > 1 || scaleSV.value > 1.001 || W <= 0) { mgr.fail(); return; }
      const frac = t.x / W;
      if (frac >= EDGE_FRAC && frac <= 1 - EDGE_FRAC) mgr.fail();
    })
    .onEnd((e) => {
      scheduleOnRN(onEdgeTap, e.x < W / 2 ? -1 : 1);
    });

  // 能走到 Gallery 自身 onTap 的正常只剩：缩放=1 的中央带、或放大态的任意位置 → 切换菜单。
  // （经过内部 Exclusive(双击, 单击) 判定，快速连点会被吸收成双击缩放，不再误触菜单。）
  // 保险：若某次边缘点击没被外层手势吃掉（手势树竞争的边界情况），这里按落点直接丢弃，
  // 绝不让"翻页"点击串成"切菜单"。
  const onGalleryTap = React.useCallback((e: { x: number }) => {
    const s = galleryRef.current?.getState().scale ?? 1;
    if (s <= 1.001 && W > 0) {
      const frac = e.x / W;
      if (frac < EDGE_FRAC || frac > 1 - EDGE_FRAC) return;
    }
    onToggleChrome();
  }, [onToggleChrome, W]);

  const onZoomBegin = React.useCallback(() => onZoomChange(true), [onZoomChange]);
  const onZoomEnd = React.useCallback(() => onZoomChange(false), [onZoomChange]);

  // 缩放=1 时的上下拖拽：跟手位移由库直接加在当前页上，这里镜像到 pullY 做背景渐隐；
  // 松手超过阈值退出，否则库自动弹回。
  const onVerticalPull = React.useCallback((opts: { translateY: number; released: boolean; velocityY: number }) => {
    'worklet';
    pullY.value = opts.translateY;
    if (opts.released && Math.abs(opts.translateY) > DISMISS_DY) scheduleOnRN(dismiss);
  }, [pullY, dismiss]);

  // 快速上下一甩（距离没到阈值但速度够）也退出；左右方向是翻页信号，忽略。
  const onSwipe = React.useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    if (dir !== 'up' && dir !== 'down') return;
    const s = galleryRef.current?.getState().scale ?? 1;
    if (s <= 1.001) dismiss();
  }, [dismiss]);

  // 缩放值镜像到 shared value，供边缘手势在 UI 线程即时判定（不经 JS 状态绕行）。
  const onUpdate = React.useCallback((state: { scale: number }) => {
    'worklet';
    scaleSV.value = state.scale;
  }, [scaleSV]);

  // 默认 transition 每帧给窗口内每一页都提交新 transform（120Hz 下动画相位实测 4~9ms/帧）。
  // 这里把完全在视口外的页固定停到“车位”：样式恒等 → reanimated diff 后零原生提交，
  // 每帧真正更新的只剩正在进出视口的 2~3 页。仅横向 LTR（本 app 不用 rtl/vertical/gap）。
  const pageTransition = React.useCallback((opts: GalleryTransitionState): ViewStyle => {
    'worklet';
    const { index, activeIndex, scroll, gallerySize } = opts;
    const size = gallerySize.width;
    if (size === 0) return { opacity: index === activeIndex ? 1 : 0 };
    const translateX = index * size - scroll;
    if (Math.abs(translateX) > size * 1.05) {
      return { transform: [{ translateX: size * 2 }], opacity: 1 };
    }
    return { transform: [{ translateX }], opacity: 1 };
  }, []);

  const renderItem = React.useCallback(
    (item: ViewerItem, _index: number) => <GalleryPage item={item} W={W} H={H} />,
    [W, H],
  );
  const keyExtractor = React.useCallback((item: ViewerItem, k: number) => `${k}:${item.src ?? ''}`, []);

  // 上下拖拽时黑底渐隐，透出下层帖子页（viewer 以 transparentModal 呈现）。
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(pullY.value), [0, 320], [1, 0.25], Extrapolation.CLAMP),
  }), [pullY]);

  return (
    <GestureDetector gesture={edgeTap}>
      <View style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, backdropStyle]} />
        <Gallery
          ref={galleryRef}
          data={images}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          initialIndex={initialIndex}
          windowSize={5}
          maxScale={MAX_SCALE}
          tapOnEdgeToItem={false}
          customTransition={pageTransition}
          onIndexChange={onIndex}
          onPanStart={onPanStart}
          onTap={onGalleryTap}
          onZoomBegin={onZoomBegin}
          onZoomEnd={onZoomEnd}
          onVerticalPull={onVerticalPull}
          onSwipe={onSwipe}
          onUpdate={onUpdate}
        />
      </View>
    </GestureDetector>
  );
}

// memo：屏幕的 chrome/页码状态频繁翻转，而这里的 props 全部稳定，整棵手势层跳过重渲染。
export default React.memo(React.forwardRef(ViewerGallery));
