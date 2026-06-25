import React from 'react';
import { View } from 'react-native';
import PagerView from 'react-native-pager-view';
import type { ImagePagerHandle, ImagePagerProps } from './ImagePager';

// 原生翻页器：ViewPager2 的吸附从结构上杜绝“卡在两页之间”，原生惯性修掉滑动卡，
// setPage 让点击/按钮翻页即时无延迟（对标 Mihon 的 ViewPager2）。
function ImagePager(
  { images, initialIndex, zoomed, onIndex, renderPage }: ImagePagerProps,
  ref: React.Ref<ImagePagerHandle>,
) {
  const pagerRef = React.useRef<PagerView>(null);
  React.useImperativeHandle(ref, () => ({
    setPage: (index) => pagerRef.current?.setPage(index),
    setPageWithoutAnimation: (index) => pagerRef.current?.setPageWithoutAnimation(index),
  }), []);

  return (
    <PagerView
      ref={pagerRef}
      style={{ flex: 1 }}
      initialPage={initialIndex}
      offscreenPageLimit={1}                               // 预挂载相邻页（Mihon 式预读）
      scrollEnabled={!zoomed}                              // 放大时关掉横向翻页，让逐页 pan 生效
      overdrag={false}
      onPageSelected={(e) => onIndex(e.nativeEvent.position)}
    >
      {images.map((item, k) => (
        // key={src} + collapsable={false}：ViewPager2 子项须为真实 View，配合 expo-image
        // 的 recyclingKey 防止回收串图。
        <View key={String(item.src ?? k)} collapsable={false} style={{ flex: 1 }}>
          {renderPage(item, k)}
        </View>
      ))}
    </PagerView>
  );
}

export default React.forwardRef(ImagePager);
