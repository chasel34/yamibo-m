import React from 'react';
import { FlatList, View } from 'react-native';
import type { ImagePagerHandle, ImagePagerProps } from './ImagePager';

// Web 兜底：横向 FlatList + pagingEnabled，命令式 ref 对齐原生（setPage→animated，
// setPageWithoutAnimation→非 animated）。仅供验证，手感不在 web 上评判。
function ImagePager(
  { images, initialIndex, zoomed, onIndex, renderPage }: ImagePagerProps,
  ref: React.Ref<ImagePagerHandle>,
) {
  const listRef = React.useRef<FlatList<any>>(null);
  const [w, setW] = React.useState(0);

  React.useImperativeHandle(ref, () => ({
    setPage: (index) => listRef.current?.scrollToIndex({ index, animated: true }),
    setPageWithoutAnimation: (index) => listRef.current?.scrollToIndex({ index, animated: false }),
  }), []);

  return (
    <View style={{ flex: 1 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: w, offset: w * index, index })}
          keyExtractor={(item, k) => `${k}:${item.src ?? ''}`}
          renderItem={({ item, index }) => (
            <View style={{ width: w, height: '100%' }}>{renderPage(item, index)}</View>
          )}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / w);
            onIndex(Math.max(0, Math.min(images.length - 1, idx)));
          }}
        />
      )}
    </View>
  );
}

export default React.forwardRef(ImagePager);
