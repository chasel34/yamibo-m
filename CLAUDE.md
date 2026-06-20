# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

百合会 (yamibo) 第三方移动端：Expo + React Native + TypeScript，消费 Discuz! X3.5 移动 JSON API。
当前为**只读 v1**（登录 + 浏览 + 个人信息）；写操作（发帖/回帖/收藏/私信…）属 v2，见 @docs/ROADMAP.md。
运行与背景见 @README.md，接口契约见 @docs/API.md。

## Commands

- `npm run typecheck` —— `tsc --noEmit`，类型门禁。Metro/Babel 打包**不做类型检查**，改完必须单独跑。
- Web 验证需**同时开两个进程**：`npm run proxy`（:8089）+ `npm run web`（:8085）。Android 用 `npm run android`，原生直连、无需代理。

## Web vs native

- 浏览器禁跨域且不能设 `Cookie` 头 → 所有 JSON 经 `tools/proxy.js` 代理；`src/api.ts` 按 `Platform.OS` 切换 host。Android 原生直连，系统管理 Cookie。

## Gotcha: Metro 不热重载

本机 Metro 改文件后 reload 常拿到旧 bundle。改完代码要**重启 `expo start`** 再验证，否则看到的是旧行为。

## TypeScript

- tsconfig 故意为 `strict: true` + `noImplicitAny: false` + `useUnknownInCatchVariables: false`（务实平衡：保住 null 安全，又不必给每个回调/catch 标注）。**不要**为"更严格"盲目打开它们，会引入大量噪音。
- 数据层即类型边界：新接口在 `src/api.ts` 把 Discuz JSON 映射成 `src/types.ts` 的 UI 模型再返回；`request()` 返回 `any` 是有意为之，松散字段在 mapper 里收口。富文本/URL/时间解析在 `src/util.ts`；导航参数类型见 `src/types.ts` 的 `RootStackParamList`（screens 不要再用 `route: any`）。

## Design

- `design/` 是 Claude Design 的设计交付（HTML/JSX 原型 + 截图），是 UI 的**唯一事实来源**，不是要运行的代码——目标是把 `design/project/百合会.html` 及其引入的 `app/*.jsx` 在 RN 里**像素级复刻**。
- 设计**会迭代**：用户更新设计后，先看 `git diff design/`（重点 `app/screens_*.jsx`）弄清这次改了什么，再据此改 `src/`。不要凭旧印象重做整屏。

## Conventions

- Conventional Commits（`feat:`/`fix:`/`chore:`/`docs:`…）；仅在被明确要求时提交。
- 后续功能开发不要直接推送到 `main`：从 feature branch 开发，通过 PR 合并到 `main`。
- 发布版本使用 `v*` tag 触发 GitHub Release 流程；`main` 合并不自动构建 APK，以节省 Expo 免费额度。
