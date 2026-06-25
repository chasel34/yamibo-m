import React from 'react';
import { Image as ExpoImage } from 'expo-image';
import type { ImageProps } from 'expo-image';

// expo-image 包一层，固化全站统一的性能策略：内存+磁盘缓存 + Coil 式降采样（安卓解码/内存
// 收益）。其余 props（source / contentFit / recyclingKey / onLoad / style …）透传，调用方按需给。
// 调整缓存/降采样策略改这一处即可，避免阅读器、帖子正文图、头像三处各写一份而漂移。
export default function CachedImage(props: ImageProps) {
  return <ExpoImage cachePolicy="memory-disk" allowDownscaling {...props} />;
}
