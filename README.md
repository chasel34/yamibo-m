# yamibo-m · 百合会移动端 App

百合会论坛（https://bbs.yamibo.com，Discuz! X3.5）的第三方移动端客户端。
**第一期（登录 + 只读浏览 + 个人信息）已完成并接入真实接口。**

## 文档

| 文档 | 内容 |
|---|---|
| [docs/02-API.md](docs/02-API.md) | 接口文档：Discuz 移动 API 鉴权、各模块请求/响应、URL 规则 |
| [docs/04-BACKLOG.md](docs/04-BACKLOG.md) | 已完成项 + **未完成功能**与已知技术债 |

## 核心结论（一句话）

论坛自带 **Discuz 移动 JSON API**（`/api/mobile/index.php?version=4&module=...`），
覆盖登录、首页、板块、帖子、个人页、消息、提醒、收藏，返回结构化 JSON，
**App 直接消费即可，无需自研后端或爬虫**。鉴权基于 Cookie（`auth`+`saltkey`）。

## 主链路

```
登录(login) → 论坛首页(forumindex) → 板块列表(forumdisplay)
  → 帖子详情(viewthread) → 图片大图
个人主页(profile) · 我的收藏(myfavthread) · 提醒(mynotelist) · 私信会话(mypm)
```

> 运营方授权已取得。上线前仍需完善风控频率适配与验证码降级，详见
> [docs/04-BACKLOG.md](docs/04-BACKLOG.md)。

## 移动端 App（Expo / React Native）

第一期已按 Claude Design 设计稿（`百合会.html`）**一比一还原**为 Expo 应用，
当前目标平台 **Android**，**Web 用于测试验证**。

### 运行

已接入真实 **Discuz 移动 API**（`bbs.yamibo.com`），数据全部来自论坛实时接口。

```bash
npm install

# Web 验证（需同时开两个终端）：
npm run proxy      # 终端 1：CORS + Cookie 代理（浏览器无法直连论坛、也无法设置 Cookie）
npm run web        # 终端 2：浏览器 375×812 设备视口

# Android（无需代理，原生直连论坛、系统管理 Cookie）：
npm run android    # 需 Android SDK 或 Expo Go
```

> **为什么 Web 需要代理**：浏览器有跨域（CORS）限制，且禁止脚本手动设置 `Cookie` 头。
> `tools/proxy.js` 在本地转发请求到 `bbs.yamibo.com`，维护 Cookie jar（`auth`/`saltkey`/
> `sid`/`acw_tc` 等）并补上 CORS 头。Android 原生直连，由系统 Cookie 存储管理登录态，无需代理。

### 鉴权与数据

- 登录走 `module=login`（先取 `formhash` 再 POST），成功后服务端下发 `EeqY_2132_auth` Cookie 维持登录态。
- 冷启动通过 `checkAuth()`（请求 `forumindex` 看 `member_uid`）自动恢复登录态。
- 头像、帖内图片直接从 `bbs.yamibo.com` 加载（`<img>` 跨域允许），仅 JSON 接口走代理。
- 浏览历史为本地存储（论坛无该接口，见 BACKLOG）。

### 已实现页面（第一期全部）

登录 / 游客浏览 · 论坛首页（板块树）· 板块帖子列表（标签筛选 + 下拉刷新 + 上拉加载）·
帖子详情（富文本：正文 / 图片 / 引用 + 只读操作条）· 图片大图查看器 ·
个人主页（自己 / 他人）· 消息（提醒 / 私信分段）· 我的 · 我的收藏 · 浏览历史 ·
设置（深色模式 / 字号 / 清缓存）· 关于。

底部 Tab（论坛 / 消息 / 我的，含未读角标）、滑入式页面堆栈、浅 / 深色一键切换并记忆。

> **未完成功能**（发帖/回帖/收藏写入/私信发送/签到/原生搜索/推送等）见
> [docs/04-BACKLOG.md](docs/04-BACKLOG.md)。

### 代码结构

```
App.js                 导航(Stack+Tab) / 主题 / Toast / 登录态 / 手机外框
tools/proxy.js         Web 端 CORS + Cookie 代理（仅开发/验证）
src/api.js             Discuz 移动 API 客户端 + 各模块 → UI 形状的映射
src/util.js            头像/附件 URL、时间格式化、楼层 HTML → 富文本块解析
src/history.js         本地浏览历史
src/theme.js           设计稿 :root 变量 → 浅/深色 token、字体栈、阴影
src/context.js         Toast / 登录态 Context
src/useNav.js          把设计稿的 nav API 桥接到 React Navigation
src/components/        Icon(SVG) · Lily · 状态栏 / Toggle / Avatar / 条纹占位图 / RemoteImage / NavHeader / TabBar / 加载·空·错误态 …
src/screens/           12 个页面（均接真实接口，含 loading / empty / error / 重试）
src/data.js            （历史 Mock 数据，已不再被引用，保留作字段参照）
```

> 数据全部来自真实接口。各页面通过 `src/api.js` 拉取并映射 `docs/02-API.md` 的响应；
> 富文本楼层经 `parseMessage` 解析为「文本 / 图片 / 引用」块，图片懒加载并支持大图查看。
> ⚠️ 第三方客户端调用论坛 API 须取得运营方授权（已取得）。
