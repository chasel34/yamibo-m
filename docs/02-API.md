# 百合会移动端 App · 接口文档 (API)

> 来源：百合会论坛 Discuz! X3.5 **内置移动 API**（实测于 2026-06-10，已登录态验证）
> 所有结论均通过 CDP 实际请求 `bbs.yamibo.com` 返回的真实 JSON 整理。

---

## 0. 总览

- **统一入口**：`GET|POST https://bbs.yamibo.com/api/mobile/index.php`
- **公共 Query 参数**：
  - `version=4`（必填，移动 API 版本）
  - `module=<模块名>`（必填，决定接口）
  - 其余参数随模块不同（fid、tid、uid、page…）
- **返回格式**：`Content-Type: application/json`，统一包裹：

```jsonc
{
  "Version": "4",
  "Charset": "UTF-8",
  "Variables": {
    // 公共身份字段（每个响应都有）
    "cookiepre": "EeqY_2132_",
    "auth": "486f...UU4",          // 登录态加密串（持久化它）
    "saltkey": "uVv334rv",         // 与 auth 配对
    "member_uid": "123456",
    "member_username": "your_username",
    "member_avatar": "https://.../56_avatar_small.jpg",
    "groupid": "14",
    "formhash": "09b7f6a9",        // 写操作必带的 CSRF token
    "readaccess": "20",
    "notice": { "newpush":"0","newpm":"0","newprompt":"0","newmypost":"0" },
    // ...模块专属业务字段
  },
  "Message": { "messageval": "...", "messagestr": "..." } // 部分接口有
}
```

> **要点**：`Variables.notice` 是全局未读数（推送/私信/提醒/我的帖子），
> 适合做底部 Tab 角标，几乎所有接口都会返回，无需单独轮询。

---

## 1. 鉴权机制

### 1.1 原理
Discuz 移动 API 基于 **Cookie** 鉴权，登录态由两条 Cookie 表达：
- `EeqY_2132_auth`（= 响应里的 `auth`）
- `EeqY_2132_saltkey`（= 响应里的 `saltkey`）

> `EeqY_2132_` 即 `cookiepre`，是站点实例前缀（勿硬编码，从响应读取）。

### 1.2 App 端实现要点
1. 用系统 HTTP 栈 + **持久化 CookieJar**（iOS Keychain / Android Keystore 保护）。
2. 登录成功后，服务端通过 `Set-Cookie` 下发 `auth`/`saltkey`/`sid` 等，
   也会在 `Variables.auth`/`saltkey` 回吐，二者一致——**保存 Cookie 即可**。
3. 之后每个请求带上 CookieJar，即为登录态。冷启动从安全存储恢复 Cookie。
4. 退出登录：清空 CookieJar + 调 `logout` 模块（可选）。
5. 风控 Cookie：首次访问站点会下发 `acw_tc` / `cdn_sec_tc`（ESA 风控）、
   `EeqY_2132_sid`，需一并保留并随请求回传，否则可能被拦。
6. **写操作**需带 `formhash`（从任意响应的 `Variables.formhash` 取）。

### 1.3 登录接口
```
POST /api/mobile/index.php?version=4&module=login&loginsubmit=yes&loginfield=username
Content-Type: application/x-www-form-urlencoded
```
表单字段：
| 字段 | 必填 | 说明 |
|---|---|---|
| `username` | ✓ | 用户名 / 邮箱（`loginfield` 决定）|
| `password` | ✓ | 明文密码（HTTPS 传输）|
| `questionid` | | 安全提问 id，无则 `0` |
| `answer` | | 安全提问答案，无则空 |
| `cookietime` | | `2592000` 记住登录（30 天）|
| `formhash` | △ | 从 GET `module=login` 先取 |

成功：`Variables.member_uid` 变为真实 uid，`Message.messageval = "login_succeed"`，
并下发登录 Cookie。失败：`Message` 返回 `login_invalid` / `login_password_wrong` 等，
多次失败可能要求验证码（`seccode`）→ v1 降级 WebView 登录。

> GET `module=login` 还会返回 `loginUrl`（wsq.discuz.com 漫游登录），v1 不用。

---

## 2. 内容浏览接口

### 2.1 论坛首页 / 板块树 — `forumindex`
```
GET ?version=4&module=forumindex
```
返回 `Variables`：
- `catlist[]`：分类（顶层分区）
  ```jsonc
  { "fid":"14", "name":"庙堂", "forums":["16","370"] }
  ```
- `forumlist[]`：板块（带子板块）
  ```jsonc
  {
    "fid":"5", "name":"動漫區",
    "threads":"31552", "posts":"1618890", "todayposts":"33",
    "description":"请不要在莉莉安女子学院里狂奔……",
    "icon":"https://bbs.yamibo.com/data/attachment/common/e4/common_5_icon.gif",
    "sublist":[ { "fid":"52","name":"...","threads":"...","posts":"...","todayposts":"0" } ]
  }
  ```
- 渲染：用 `catlist` 分组，`forums` 里的 fid 映射到 `forumlist` 项。

### 2.2 板块帖子列表 — `forumdisplay`
```
GET ?version=4&module=forumdisplay&fid=49&page=1
        [&typeid=173]            // 按作品 tag 筛选
        [&filter=typeid&orderby=dateline|lastpost|replies|views]
```
返回 `Variables`：
| 字段 | 说明 |
|---|---|
| `forum` | 板块信息：`fid,name,description,icon,rules(HTML版规),threads(板块总主题数),posts,fup(父),threadcount(按当前筛选的总主题数：无筛选=threads，选 typeid/精华/热门 等会同步变小→用它算总页数)` |
| `forum_threadlist[]` | 帖子列表（见下）|
| `threadtypes` | 作品分类标签：`types{ "173":"摇曳百合", ... }`、`required`、`listable` |
| `sublist` | 子板块 |
| `tpp` | 每页帖子数（threads per page）|
| `page` | 当前页 |
| `group` | 当前用户在本版的权限 |

`forum_threadlist[]` 单项：
```jsonc
{
  "tid":"533721", "typeid":"0",
  "author":"hongyuny", "authorid":"165700",
  "subject":"如何找回账号/如何修改密码",
  "dateline":"2023-3-13 02:21",          // 发帖时间(已格式化)
  "lastpost":"2026-5-9 10:54", "lastposter":"16686161108",
  "views":"72900", "replies":"4",
  "displayorder":"3",                     // >0 置顶, -1/-2/-3/-4 各类
  "digest":"0", "special":"0",            // special: 0普通 1投票 2交易 3悬赏 4活动 5辩论
  "attachment":"1",                       // 是否有附件
  "dbdateline":"1678645277", "dblastpost":"1778295243", // 原始时间戳
  // 列表预览增强（部分主题带）：
  "reply":[ {"pid":"...","author":"...","authorid":"...","message":"楼层摘要"} ],
  "attachmentImageNumber":"2",
  "attachmentImagePreviewList":[ { "aid":"...","attachment":"202303/13/xxx.png","isimage":"1","width":"889" } ],
  "message":"首楼正文摘要（纯文本截断）"
}
```
> 列表已自带首楼摘要 + 图片预览，可做"信息流"卡片，无需先进详情。

### 2.3 帖子详情 — `viewthread`
```
GET ?version=4&module=viewthread&tid=572235&page=1
```
返回 `Variables`：
| 字段 | 说明 |
|---|---|
| `thread` | 主题元信息（subject、author、views、replies、fid、typeid、closed、digest、favtimes…）|
| `postlist[]` | 楼层列表（见下）|
| `ppp` | 每页楼层数（posts per page）|
| `fid` | 所属板块 |
| `allowpostcomment` / `comments` / `commentcount` | 点评 |
| `forum` | 板块上下文（password 等）|

`postlist[]` 单项：
```jsonc
{
  "pid":"41557298", "tid":"572235",
  "first":"1",                  // 1=楼主首楼
  "author":"FridgE.", "authorid":"716302",
  "username":"FridgE.",
  "dateline":"2026-6-9 22:05",
  "message":"<富文本HTML>",      // 含 <br> 图片/引用/表情；需 HTML 渲染
  "number":"1", "position":"1", // 楼层号
  "groupid":"14", "groupiconid":"2", "adminid":"0",
  "attachment":"0", "status":"8",
  "dbdateline":"1781013917"
  // 头像需用 authorid 拼接（见 §5），message 内图片为相对/绝对混合
}
```

### 2.4 搜索 — `search`（v1 注意）
```
POST ?version=4&module=search&srchtxt=<关键词>&searchsubmit=yes&formhash=<hash>
```
> 实测移动 API 的 `search` 返回 `Variables` 为空 / 需 searchid 二跳，**不稳定**。
> **v1 降级策略**：用内置 WebView 打开
> `https://bbs.yamibo.com/search.php?mod=forum&searchsubmit=yes&srchtxt=<kw>`，
> 或仅提供"板块内筛选 typeid"。完整原生搜索列入 BACKLOG。

---

## 3. 个人信息接口

### 3.1 用户主页 — `profile`
```
GET ?version=4&module=profile&uid=123456
   ( 不带 uid 默认当前登录用户；space.self=1 表示是本人 )
```
返回 `Variables.space{}`（字段极多，按需取）：
| 分组 | 字段 |
|---|---|
| 身份 | `uid, username, spacename, groupid, group{grouptitle 含HTML颜色}, adminid, regdate, self` |
| 头像/状态 | `avatarstatus, emailstatus, freeze, status` |
| 积分 | `credits` 总积分；`extcredits1..8` 多维积分（本站：1=金钱? 6=贡献等，名称见站点积分设置）|
| 统计 | `posts(回复数), threads(主题数), digestposts, friends, follower, following, favtimes, sharetimes, oltime(在线时长), views` |
| 资料 | `gender, birthyear/month/day, constellation, zodiac, residecity, bio, interest, site, signature(sightml)` |
| 勋章/头衔 | `medals, customstatus, customshow, groupiconid` |
| 升级 | `upgradecredit, upgradeprogress, profileprogress` |

> 他人主页：传对方 `uid`，返回公开字段（隐私项按对方设置可能为空）。
> 用户名 → uid：列表/楼层里都带 `authorid`，直接用它请求 profile。

### 3.2 我的收藏 — `myfavthread`
```
GET ?version=4&module=myfavthread[&page=1]
```
返回 `Variables.list[]`：
```jsonc
{
  "favid":"2596083", "id":"571041", "idtype":"tid",
  "title":"【提灯喵汉化组】[結野ちり]...17",
  "author":"magtine", "replies":"15",
  "dateline":"1779033377",
  "url":"forum.php?mod=viewthread&tid=571041"   // 取 id 作为 tid 跳详情
}
```
另有 `count`、`perpage`。

### 3.2.1 收藏 / 取消收藏
新增收藏走移动 API：
```
POST ?version=4&module=favthread&id=<tid>&idtype=tid&formhash=<hash>
```

成功：`Message.messageval = "favorite_do_success"`；重复收藏：
`Message.messageval = "favorite_repeat"`，可视为已收藏。

取消收藏实测移动 API 参数组合不稳定，使用标准网页表单接口：
```
POST /home.php?mod=spacecp&ac=favorite&op=delete&favid=<favid>
Content-Type: application/x-www-form-urlencoded

deletesubmit=true&formhash=<hash>
```

成功返回 HTML，正文包含 `操作成功`。`favid` 来自 `myfavthread` 的收藏列表项。

### 3.3 我的主题/回复 — `mythread`
```
GET ?version=4&module=mythread&view=thread   // 我的主题
GET ?version=4&module=mythread&view=reply    // 我的回复(部分版本 myreply)
```
返回 `Variables.data[]` / `list[]`、`perpage`（当前账号为空，需用有发帖的账号验证字段）。

---

## 4. 消息与提醒接口（只读）

### 4.1 提醒列表 — `mynotelist`
```
GET ?version=4&module=mynotelist[&page=1]
```
返回 `Variables.list[]`：
```jsonc
{
  "id":"3769952", "uid":"123456",
  "type":"system",                 // system / post / pcomment / friend ...
  "new":"0",                       // 1=未读
  "note":"您的用户组升级为 <a ...>百合幼苗</a> ...",  // 含HTML
  "dateline":"1674645517",
  "from_id":"0", "from_idtype":"changeusergroup", "from_num":"0"
}
```
另有 `count`、`perpage`、`page`。未读总数同时见全局 `notice.newprompt`。

### 4.2 私信会话列表 — `mypm`
```
GET ?version=4&module=mypm[&page=1]      // 会话列表
GET ?version=4&module=pmlist&touid=<对方uid>   // 某会话内消息(发送在v2)
```
返回 `Variables.list[]`、`count`、`perpage`、`page`（当前账号 count=0）。
未读私信数见全局 `notice.newpm`。

---

## 5. 资源 URL 规则（头像 / 附件 / 图片）

### 5.1 头像
按 uid 补零到 9 位，每 3/2/2/2 切分：
```
uid=123456 → "000123456" → 000 / 12 / 34 / 56
https://bbs.yamibo.com/uc_server/data/avatar/000/12/34/56_avatar_<size>.jpg
<size> ∈ { small(48) | middle(90) | big(200) }
```
> `member_avatar` 字段已给出当前用户头像 URL，可直接用；他人按上式拼接。
> `avatarstatus=0` 时用默认头像占位。

### 5.2 帖子图片附件
`forum_threadlist[].attachmentImagePreviewList[].attachment` 或楼层附件的 `attachment` 字段
形如 `202303/13/020501afya0ce4zb8ep1he.png`，完整地址：
```
https://bbs.yamibo.com/data/attachment/forum/<attachment>
```
相册类前缀为 `album/`，公共图标为 `common/`。

### 5.3 楼层正文内图片
`postlist[].message` 是 HTML，内联 `<img src>` 可能是相对路径，
渲染前需对相对路径补全为 `https://bbs.yamibo.com/...`，并对 `[图片附件]` 占位做处理。

---

## 6. 时间字段约定
- `dateline`（已格式化，如 `2026-6-9 22:05`，受用户时区 `timeoffset` 影响）可直接显示。
- `dbdateline` / `dblastpost`（Unix 秒级时间戳）适合做"x 分钟前"相对时间计算。

---

## 7. v1 接口清单（按页面）

| # | 页面 | 方法 | 接口 |
|---|---|---|---|
| 1 | 登录 | POST | `module=login&loginsubmit=yes&loginfield=username` |
| 2 | 退出 | GET | `module=logout`（+ 清 Cookie）|
| 3 | 论坛首页 | GET | `module=forumindex` |
| 4 | 板块列表 | GET | `module=forumdisplay&fid=&page=&typeid=` |
| 5 | 帖子详情 | GET | `module=viewthread&tid=&page=` |
| 6 | 我的/他人主页 | GET | `module=profile&uid=` |
| 7 | 我的收藏 | GET | `module=myfavthread&page=` |
| 8 | 我的主题/回复 | GET | `module=mythread&view=thread|reply` |
| 9 | 提醒 | GET | `module=mynotelist&page=` |
| 10 | 私信会话 | GET | `module=mypm&page=` |
| 11 | 全局未读 | — | 任意响应 `Variables.notice` |
| 12 | 搜索(降级) | WebView | `search.php?mod=forum&srchtxt=` |

---

## 8. 请求头建议
```
User-Agent: <移动端真实 UA，建议带 App 标识>
Accept: application/json
Cookie: <持久化的全部站点 Cookie，含 acw_tc/sid/auth/saltkey>
Referer: https://bbs.yamibo.com/
```
失败重试：429/风控页（非 JSON）→ 指数退避，最多 3 次；解析失败上报。
