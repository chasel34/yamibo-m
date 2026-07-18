import React from 'react';
import { FlatList, View } from 'react-native';
import ZoomableImage from './ZoomableImage';
import type { ViewerGalleryHandle, ViewerGalleryProps, ViewerItem } from './ViewerGallery';

// 只有 ±WINDOW 内的页挂载真实图片，远页渲染空占位，避免大图集一开屏就并发解码全部原图。
const WINDOW = 2;

// 单页包装：memo 让翻页时只有进出预挂载窗口/active 翻转的页重渲染。
const PagerPage = React.memo(function PagerPage({ item, active, mounted, W, H, onZoomChange, onToggleChrome, onEdgeTap, onDismiss }: {
  item: ViewerItem;
  active: boolean;
  mounted: boolean;
  W: number;
  H: number;
  onZoomChange: (zoomed: boolean) => void;
  onToggleChrome: () => void;
  onEdgeTap: (dir: -1 | 1) => void;
  onDismiss: () => void;
}) {
  if (!mounted) return <View style={{ width: W, height: H }} />;
  return (
    <ZoomableImage
      item={item}
      active={active}
      W={W}
      H={H}
      onZoomChange={onZoomChange}
      onToggleChrome={onToggleChrome}
      onEdgeTap={onEdgeTap}
      onDismiss={onDismiss}
    />
  );
});

// Web 兜底：横向 FlatList + pagingEnabled 翻页，每页套 PanResponder 缩放层（ZoomableImage）。
// 仅供浏览器验证流程可用性，手感不在 web 上评判。
function ViewerGallery(
  { images, initialIndex, W, H, onIndex, onZoomChange, onToggleChrome, onEdgeTap, onDismiss, onPanStart }: ViewerGalleryProps,
  ref: React.Ref<ViewerGalleryHandle>,
) {
  const listRef = React.useRef<FlatList<ViewerItem>>(null);
  const [i, setI] = React.useState(initialIndex);
  const [zoomed, setZoomed] = React.useState(false);
  const n = images.length;

  const handleZoom = React.useCallback((z: boolean) => { setZoomed(z); onZoomChange(z); }, [onZoomChange]);

  // 程序化翻页后 RN-web 不总是补发 momentum 结束事件，这里直接把落点回报出去。
  const goTo = React.useCallback((index: number, animated: boolean) => {
    listRef.current?.scrollToIndex({ index, animated });
    setI(index);
    onIndex(index);
  }, [onIndex]);
  React.useImperativeHandle(ref, () => ({
    setPage: (index) => goTo(index, true),
    jumpTo: (index) => goTo(index, false),
  }), [goTo]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList
        ref={listRef}
        data={images}
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed}
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
        keyExtractor={(item, k) => `${k}:${item.src ?? ''}`}
        extraData={i}
        renderItem={({ item, index: k }) => (
          <View style={{ width: W, height: '100%' }}>
            <PagerPage
              item={item}
              active={k === i}
              mounted={Math.abs(k - i) <= WINDOW}
              W={W}
              H={H}
              onZoomChange={handleZoom}
              onToggleChrome={onToggleChrome}
              onEdgeTap={onEdgeTap}
              onDismiss={onDismiss}
            />
          </View>
        )}
        onScrollBeginDrag={onPanStart}
        onMomentumScrollEnd={(e) => {
          const idx = Math.max(0, Math.min(n - 1, Math.round(e.nativeEvent.contentOffset.x / W)));
          setI(idx);
          onIndex(idx);
        }}
      />
    </View>
  );
}

export default React.memo(React.forwardRef(ViewerGallery));
