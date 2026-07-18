import React from 'react';
import CachedImage from './CachedImage';
import { StripeImg } from './ui';
import { displayImageUrl } from '../api';
import type { ViewerItem } from './ViewerGallery';

// —— 查看器单页 / 缩略图：expo-image 渲染真实图片，失败降级到 StripeImg 占位 ——
// 关键点：recyclingKey 配合窗口回收防串/闪旧图；CachedImage 自带 Coil 式降采样
// （安卓上解码/内存最大收益）；transition=0 不淡入让翻页更跟手。
export default function ViewerImage({ item, contain, onSize }: {
  item?: ViewerItem;
  contain?: boolean;
  onSize?: (w: number, h: number) => void;   // 真实像素尺寸（供 contain 页收紧缩放边界）
}) {
  const [err, setErr] = React.useState(false);
  React.useEffect(() => { setErr(false); }, [item && item.src]);
  if (item && item.src && !err) {
    return (
      <CachedImage
        source={{ uri: displayImageUrl(item.src) || item.src }}
        onError={() => setErr(true)}
        onLoad={(e) => { if (onSize && e.source) onSize(e.source.width, e.source.height); }}
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
