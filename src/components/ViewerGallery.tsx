// 图片查看器翻页画布的平台分包（镜像 ReaderSurface）：
// - native：react-native-zoom-toolkit 的 Gallery——手势/动画全部跑在 UI 线程 worklet
//   （Reanimated + Gesture Handler），捏合带焦点锚定、放大后 pan 越过图边自动接力翻页、
//   松手带惯性衰减，对标 Telegram/Mihon 的手感。
// - web：横向 FlatList + 每页 PanResponder 缩放层兜底，仅供验证，手感不在 web 上评判。
// 本文件只供 TypeScript 解析 `import … from './ViewerGallery'`，运行时永不加载。

// 单页数据（与 types.ts 的 ThreadImage 结构兼容；src 允许为空 → 占位条纹）。
export interface ViewerItem {
  src?: string | null;
  cap?: string;
}

// 命令式翻页句柄：按钮/边缘点击走 setPage（native 带滑动动画），滑块/目录跳转走 jumpTo（直达）。
export interface ViewerGalleryHandle {
  setPage: (index: number) => void;
  jumpTo: (index: number) => void;
}

export interface ViewerGalleryProps {
  images: ViewerItem[];
  initialIndex: number;
  W: number;
  H: number;
  onIndex: (index: number) => void;          // 页码唯一真相源（翻页吸附后回调）
  onZoomChange: (zoomed: boolean) => void;   // 驱动 chrome 的翻页热区指示显隐
  onToggleChrome: () => void;                // 中央单击（放大态为全屏单击）
  onEdgeTap: (dir: -1 | 1) => void;          // 缩放=1 时左右 30% 热区单击（零延迟）
  onDismiss: () => void;                     // 上下滑动退出
  onPanStart?: () => void;                   // 手指开始拖动（setPage 动画可能被打断，用于回同步意图页）
}

export { default } from './ViewerGallery.native';
