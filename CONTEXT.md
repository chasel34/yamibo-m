# CONTEXT — 百合会移动端

> 项目领域语境与术语表。工程类 skill 在探查代码前会读这里，统一用词。
> 详细接口契约见 `docs/API.md`，路线图见 `docs/ROADMAP.md`。

## 一句话

百合会（yamibo）论坛的第三方移动端：Expo + React Native + TypeScript，消费
**Discuz! X3.5 内置移动 JSON API**（`bbs.yamibo.com/api/mobile/index.php`）。
当前是**只读 v1**（登录 + 浏览 + 个人信息）；写操作属 v2。

## 数据流与类型边界

后端 JSON 字段松散且命名随模块变化。约定：在 `src/api.ts` 把 Discuz JSON
映射成 `src/types.ts` 的 **UI 模型** 再返回给屏幕——UI 模型是本项目的事实词汇，
屏幕/组件只认 UI 模型，不直接碰原始 JSON。命名一个领域概念时，用 UI 模型里的名字。

## Glossary（术语表）

| 术语 | UI 模型 / 字段 | 含义 |
| --- | --- | --- |
| 板块分组 | `ForumGroup` | 论坛首页的板块大类，含若干板块 |
| 板块 | `BoardSummary` / `BoardInfo` | 一个版块（`fid`），可含子板块 `BoardSub` |
| 主题 | `ThreadRow`（列表）/ `tid` | 一个帖子串（thread），列表行含标题、作者、回复数等 |
| 帖子 / 楼层 | （主题详情内的 post） | 主题下的一条回复（reply）；1 楼为主楼 |
| 作者 | `NavAuthor` | 发帖人（`uid` / `name` / `group`） |
| 登录态 | `auth` + `saltkey` | Discuz 的持久化身份凭证对，需一起保存 |
| formhash | `formhash` | 写操作必带的 CSRF token（v2 才用到） |
| 全局未读 | `Variables.notice` | 推送/私信/提醒/我的帖子 的未读数，做 Tab 角标 |

> 写操作（发帖/回帖/收藏/私信…）的术语属于 **v2**，到时再补。

## 平台差异（关键约束）

- **Web** 禁跨域且不能设 `Cookie` 头 → 所有 JSON 经 `tools/proxy.js` 代理；
  `src/api.ts` 按 `Platform.OS` 切 host。
- **Android 原生** 直连 `bbs.yamibo.com`，Cookie 由系统管理，无需代理。

## 决策记录

架构决策放 `docs/adr/`（目前为空，按需懒创建）。
