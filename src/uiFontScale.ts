import { StyleSheet, Text } from 'react-native';

// 全局界面字号缩放（设置页「外观 · 字号」用，独立于阅读模式自带的字号）。
// 小 / 中 / 大 三档；「中」= 1（设计稿原始像素值），不付出任何渲染开销。
export const UI_FONT_SCALES = [0.9, 1, 1.12];
export const UI_FONT_LEVEL_KEY = 'yh_ui_font';

const state = { scale: 1 };
export function setUiFontScale(scale: number) { state.scale = scale; }
export function uiFontScaleForLevel(level: number) { return UI_FONT_SCALES[level] ?? 1; }

// 一次性给 Text 打补丁：在 Text 自身解析样式**之前**，把显式 fontSize/lineHeight × 当前档位
// 注入到 props.style（追加一条胜出的覆盖）。在 `.render` 输出端改样式只对原生 RN 生效，
// react-native-web 的 Text 是从输入 props 内部解析出 fontSize 再生成 <div> 的，必须改输入端。
const TextAny = Text as any;
if (!TextAny.__uiScalePatched && typeof TextAny.render === 'function') {
  TextAny.__uiScalePatched = true;
  const orig = TextAny.render;
  TextAny.render = function patchedTextRender(props: any, ref: any) {
    if (state.scale === 1 || !props || !props.style) return orig.call(this, props, ref);
    const flat = StyleSheet.flatten(props.style);
    if (!flat || typeof flat.fontSize !== 'number') return orig.call(this, props, ref);
    const override: { fontSize: number; lineHeight?: number } = { fontSize: flat.fontSize * state.scale };
    if (typeof flat.lineHeight === 'number') override.lineHeight = flat.lineHeight * state.scale;
    return orig.call(this, { ...props, style: [props.style, override] }, ref);
  };
}
