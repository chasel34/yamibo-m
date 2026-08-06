// Web（开发验证用）不渲染质询遮罩：本地代理会用 headless Chrome 自动过
// BAIDU_WAF 的 JS 质询（tools/proxy.js），app 感知不到，无需任何交互。
// 真正的原生实现见 WafGate.native.tsx（隐藏 WebView 静默过质询）。
export default function WafGate() {
  return null;
}
