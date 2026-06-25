import type { ReactNode } from 'react';

// 单页数据（与 types.ts 的 ThreadImage 结构兼容；src 允许为空 → 占位条纹）。
export interface ImagePagerItem {
  src?: string | null;
  cap?: string;
}

// 命令式翻页句柄：点击/按钮翻页走 setPage（带动画），滑块/目录跳转走无动画版本。
export interface ImagePagerHandle {
  setPage: (index: number) => void;
  setPageWithoutAnimation: (index: number) => void;
}

export interface ImagePagerProps {
  images: ImagePagerItem[];
  initialIndex: number;
  zoomed: boolean;                                          // 放大态：禁用横向翻页，让逐页 pan 生效
  onIndex: (index: number) => void;                         // 页码唯一真相源（原生吸附后回调）
  renderPage: (item: ImagePagerItem, index: number) => ReactNode;
}

// 平台分包（镜像 ReaderSurface）：原生用 react-native-pager-view（ViewPager2 原生吸附），
// web 用横向 FlatList 兜底。Metro 在 native/web 自动选 .native/.web；本文件只供 TypeScript
// 解析 `import … from './ImagePager'`，运行时永不加载。
export { default } from './ImagePager.native';
