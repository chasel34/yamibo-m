# yamibo-m · 百合会移动端客户端

百合会论坛（[bbs.yamibo.com](https://bbs.yamibo.com)）的**非官方第三方移动端客户端**，基于 Expo / React Native / TypeScript 构建。

> ⚠️ **免责声明**：本项目为非官方个人项目，与百合会官方无任何隶属或合作关系。
> 客户端通过论坛内置的 Discuz! 移动 JSON API 获取数据；第三方客户端调用论坛 API

## 功能特性

- **登录与游客浏览** —— 账号密码登录、登录态持久化与冷启动恢复，未登录也可浏览
- **板块与帖子浏览** —— 论坛首页板块树、板块帖子列表（标签筛选 / 下拉刷新 / 上拉加载）
- **帖子详情** —— 富文本（正文 / 图片 / 引用 / 表格 / 链接）渲染、帖内大图查看、分页跳转、楼层定位、只看楼主
- **个人主页** —— 查看自己与他人资料、积分维度
- **消息** —— 提醒与私信会话列表（只读）、底部未读角标
- **我的收藏** —— 浏览收藏、收藏 / 取消收藏
- **浏览历史** —— 本地记录最近浏览的帖子
- **主题** —— 浅 / 深色一键切换并记忆

## 技术栈

Expo + React Native + TypeScript，消费 Discuz! X3.5 论坛内置的移动 JSON API
（`/api/mobile/index.php?version=4&module=...`），无需自研后端或爬虫。鉴权基于
Cookie（`auth` + `saltkey`）。当前主要目标平台为 **Android**，Web 用于开发验证。

## 快速开始

```bash
npm install

# Web 验证（需同时开两个终端）：
npm run proxy      # 终端 1：本地 CORS + Cookie 代理（:8089）
npm run web        # 终端 2：浏览器 375×812 设备视口（:8085）

# Android（原生直连论坛，无需代理）：
npm run android    # 需 Android SDK 或 Expo Go
```

> Web 端需要代理，是因为浏览器有跨域（CORS）限制且禁止脚本设置 `Cookie` 头；
> `tools/proxy.js` 在本地把 JSON 请求转发到论坛并维护 Cookie。Android 原生直连、由系统管理登录态，无需代理。

## 文档

| 文档 | 内容 |
|---|---|
| [docs/API.md](docs/API.md) | 接口文档：Discuz 移动 API 鉴权、各模块请求 / 响应、URL 规则 |
| [docs/ROADMAP.md](docs/ROADMAP.md) | 路线图：v1 已完成功能、v2 写操作与后续计划、已知技术债 |
