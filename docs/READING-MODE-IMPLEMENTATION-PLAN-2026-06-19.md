# 阅读模式保全式重构实现计划

日期：2026-06-19

## 目标

第一版重构只解决阅读模式的结构可靠性问题：

- 默认保留楼主内容，避免正文漏掉。
- 多楼层正文不再因为标题识别失败而短篇化。
- 有部分目录时，不再漏掉目录外楼主正文。
- 无目录 / 弱目录长篇首次完整整理后再进入。
- 有可靠链接目录的长篇允许先进入，后台补全校验。
- 用结构缓存避免每次进入都重新整理。
- 提供 App 内「查看原楼层」作为阅读模式整理不完美时的安全出口。

核心原则：

> 内容保全优先。宁可多带一点楼主说明、目录维护、作者碎碎念，也不能漏掉可能的正文。

## 第一版范围

### 会做

- 新增阅读结构缓存 `ReadingIndex`。
- 首次无目录 / 弱目录时完整扫描楼主楼层流。
- 可靠链接目录可生成 `toc-ready` 索引先进入，后台完整扫描后升级为 `complete`。
- 合并链接目录、纯文本目录、楼层标题和无标题楼层兜底。
- 所有非空楼主楼层默认保留。
- 首楼默认保留，并按内容弱化为「作品说明」或「目录说明」。
- 目录外内容后台补全时按楼层位置插入，不追加到末尾。
- 阅读进度优先按 `pid` 保持。
- 支持自动轻量检查更新。
- 支持手动「检查更新」和「重新整理全文」。
- 支持 App 内跳转到当前章节对应的原论坛楼层。
- 增加整理进度、整理失败、低置信度提示和目录条目类型弱化。

### 不做

- 正文长期缓存。
- 无目录长篇渐进式阅读。
- 单楼超长文复杂内部拆章。
- 激进删除作者说明、译者注、更新公告。
- 自动删除缓存旧章节。
- 完整离线阅读。
- 手动编辑章节名 / 隐藏章节。
- 复杂章末评论重构。
- 复杂更新 diff。

## 数据结构

新增或调整类型，建议放在 `src/types.ts`，缓存与构建逻辑放在 `src/reading.ts` 或拆出 `src/readingIndex.ts`。

```ts
type ReadingIndexStatus = 'complete' | 'toc-ready';

type ReadingChapterType = 'chapter' | 'section' | 'note' | 'toc';

type ReadingConfidence = 'high' | 'medium' | 'low';

type ReadingChapterIndex = {
  id: string;
  pid: string;
  no: number;
  title: string;
  type: ReadingChapterType;
  confidence: ReadingConfidence;
  pos?: number;
  sourcePage?: number;   // authorid 楼主流页
  pageOffset?: number;   // sourcePage 内的顺序，用于无 pos 时排序
  originalPage?: number; // 普通帖子页，可通过 findpost 后续补
};

type ReadingDiagnostics = {
  opPostCount: number;
  chapterCount: number;
  linkedTocCount: number;
  plainTocCount: number;
  titleDetectedCount: number;
  fallbackChapterCount: number;
  droppedPostCount: number;
  declaredLatestNo?: number;
  confidence: ReadingConfidence;
  warnings: string[];
};

type ReadingIndex = {
  version: 1;
  tid: string;
  fid: string;
  authorid: string;
  title: string;
  author: User;
  status: ReadingIndexStatus;
  chapters: ReadingChapterIndex[];
  diagnostics: ReadingDiagnostics;
  source: {
    totalPages: number;
    scannedPages: number;
    builtAt: number;
    firstPageHash?: string;
    tocHash?: string;
    lastPid?: string;
  };
};
```

缓存：

- key：`yh_rd_index_${tid}_${authorid}`
- 只缓存结构，不缓存正文全文。
- `version` 不匹配时重建。
- 完整缓存下次进入秒开，同时后台检查更新。

阅读进度建议增加 `pid`：

```ts
type ReadingProgress = {
  chapter: number;
  page: number;
  pct: number;
  chapterTitle: string;
  pid?: string;
  ts: number;
};
```

恢复进度时优先用 `pid` 定位章节；找不到再按 `chapter` 序号兜底。

## 构建模型

当前 `buildReadingBook` 的三选一逻辑需要拆成合并式构建器。

建议新增：

- `buildTocReadyIndex(firstPage)`：可靠链接目录专用，快速进入。
- `buildCompleteIndex(pages)`：完整楼主流专用，保证保全。
- `mergeReadingSignals(...)`：合并链接目录、纯文本目录、楼层标题、无标题兜底。
- `isReliableLinkedToc(firstPage, toc, diagnostics)`：判断链接目录是否可先进入。

### 合并规则

楼主 posts 是正文候选全集。每个 post 的结果只能是：

- 生成正式章节。
- 生成无标题正文段。
- 生成说明 / 目录说明条目。
- 强排除。

默认保留，谨慎排除。

标题优先级：

1. 链接目录标题。
2. 楼层标题扫描。
3. 纯文本目录按顺序补名。
4. `第 N 段` / `楼主说明 N` / `作品说明` / `目录说明`。

强排除仅限：

- 完全空白。
- 明确重复目录。
- 纯占楼且无正文 / 图片。
- 纯外链且无正文。

作者注、译者说明、更新公告、短补充默认保留，标记为 `note`。

### 首楼规则

首楼默认保留：

- 正文长：`chapter` 或 `section`。
- 简介 + 目录：`note`，标题 `作品说明`。
- 纯目录：`toc`，标题 `目录说明`。
- 不确定：`section`，标题 `第 1 段`。

### 排序规则

`pid` 是章节身份主键。

排序依据：

1. 有 `pos` 时按 `pos` 排。
2. 无 `pos` 时按 `sourcePage` + `pageOffset` 排。
3. 链接目录提供标题和定位，不决定最终顺序。

`toc-ready` 后台补全完成后，生成新的 `complete` index，所有章节按楼主楼层流顺序重排；当前阅读位置用 `currentPid` 找回。

## 可靠链接目录

第一版规则保守即可。满足以下条件时可认为是可靠链接目录：

- 链接目录数量达到阈值，例如 `>= 5`。
- 多数链接标题像章节。
- `pid` 不重复。
- 标题声明更新进度与目录数量没有严重冲突。
- 不是少量临时链接、番外链接或维护链接。

可靠链接目录：

- 生成 `toc-ready` index。
- 立即进入阅读器。
- 后台扫描楼主流补全，并升级为 `complete`。

弱目录 / 纯文本目录 / 无目录：

- 首次必须完整扫描楼主流。
- 整理完成后进入阅读器。

## Reader 加载流程

首次进入：

```ts
const cached = await getReadingIndex(tid, authorid);

if (cached) {
  openReader(cached);
  checkUpdatesInBackground(cached);
  return;
}

const first = await getReadingStream(tid, authorid, 1);
const toc = parseLinkedToc(first.posts[0]);

if (isReliableLinkedToc(first, toc)) {
  const index = buildTocReadyIndex(first, toc);
  await saveReadingIndex(index);
  openReader(index);
  completeScanInBackground(index);
  return;
}

showOrganizingProgress(first.page, first.totalPages);
const pages = await loadAllAuthorPagesWithProgress(first);
const index = buildCompleteIndex(pages);
await saveReadingIndex(index);
openReader(index);
```

Reader phases 建议：

- `checkingCache`
- `organizing`
- `resume`
- `reading`
- `error`

整理中 UI：

- 标题：`正在整理楼主内容`
- 进度：`已读取 8 / 25 页`
- 说明：`首次整理会稍久，之后将直接打开`
- 操作：`返回`

整理失败 UI：

- 标题：`整理失败`
- 文案：`网络不稳定，已读取 8 / 25 页`
- 操作：`重试`、`返回帖子`

章节正文第一版仍按需加载：

- 优先用 `chapter.sourcePage` 拉 authorid 楼主流对应页。
- 在该页通过 `pid` 找 post。
- 找不到再遍历已缓存 pages 或按现有估算逻辑查找。
- 不做正文长期缓存。

## 更新检查

自动轻量检查：

- 进入阅读器后后台拉楼主流第一页。
- 比较 `totalPages`、`firstPageHash`、`tocHash`。
- 必要时拉最后一页比较 `lastPid`。

处理策略：

- 楼主流页数变大：补扫新增页，按楼层位置插入新章节。
- 首楼目录变化：修正标题或提示重新整理。
- 结构变化很大：提示 `帖子结构可能有变化，建议重新整理`。
- 检查失败：不阻断阅读，提示 `暂时无法检查更新，已使用本地整理结果`。
- 不自动删除旧章节。旧 pid 消失时先保留，等用户手动重新整理确认。

手动操作：

- `检查更新`：轻量检查，不阻断阅读。
- `重新整理全文`：二次确认，清掉该帖结构缓存，完整扫描并重建。

重新整理后尽量用当前 `pid` 恢复阅读位置；找不到再按章节序号兜底。

## 查看原楼层

第一版必须做 App 内原生跳转，不以外部浏览器作为主路径。

每章必须保留 `pid`。

Reader 增加：

- 工具栏入口：`查看原楼层`
- 章末链接：`对照原楼层`
- 点击反馈：`正在打开原楼层…`

导航建议：

```ts
nav.replace('thread', {
  thread: { tid, title },
  targetPid: chapter.pid,
});
```

`ThreadScreen` 支持 `targetPid`：

1. 根据 `targetPid` 解析普通帖子页码。
2. 加载对应页。
3. 渲染后滚动到目标楼层。
4. 短暂高亮目标楼层。

定位页码优先级：

1. 已有 `chapter.originalPage`。
2. 调用 / 封装 `findpost` 解析 `pid -> page`。
3. 如果解析失败，退到帖子页并提示 `无法定位楼层，已打开帖子`。

## UI 改动

第一版必要 UI：

- 帖子详情页阅读入口：
  - 高置信度：`阅读模式`
  - 低置信度：`尝试阅读模式`
- 首次整理进度页。
- 整理失败页。
- 目录抽屉顶部：
  - 上次整理时间。
  - `检查更新`。
  - `重新整理全文`。
  - 低置信度提示。
- 目录条目类型弱化：
  - `chapter`：正常显示。
  - `section`：中性显示，例如 `第 12 段`。
  - `note`：弱化显示，前缀 `说明`。
  - `toc`：弱化显示，前缀 `说明`。
- 阅读器工具栏入口：`查看原楼层`。
- 章末链接：`对照原楼层`。
- 更新检查 toast / 轻提示：
  - `上次整理：今天 14:20`
  - `正在检查更新…`
  - `发现新内容，已加入目录`
  - `已补全楼主内容`
  - `暂时无法检查更新，已使用本地整理结果`
  - `帖子结构可能有变化，建议重新整理`

低置信度提示文案：

- `已按楼主楼层保留内容，章节名可能不完整`
- `部分内容可能是楼主说明，可对照原楼层查看`

## API / 导航改动

预计涉及：

- `src/types.ts`
  - 新增 `ReadingIndex` 系列类型。
  - `ReadingProgress` 增加 `pid`。
  - `RootStackParamList` 的 `thread` 参数支持 `targetPid`。
- `src/reading.ts` 或 `src/readingIndex.ts`
  - 缓存读写。
  - index 构建。
  - 目录可靠性判断。
  - diagnostics。
- `src/api.ts`
  - 如已有 `findpost` 能力则复用；否则新增 `resolvePostPage(tid, pid)`。
- `src/screens/Reader.tsx`
  - 改为消费 `ReadingIndex`。
  - 增加整理状态、缓存加载、更新检查、重新整理。
  - 增加查看原楼层入口。
- `src/screens/Thread.tsx`
  - 支持 `targetPid`。
  - 加载目标页。
  - 滚动并高亮目标楼层。

## 回归验证

实现完成后必须回归 [READING-MODE-AUDIT-2026-06-16.md](READING-MODE-AUDIT-2026-06-16.md) 中的全部 40 篇样本，并额外随机补采 20 篇帖子。

验证目标：

- 确认 audit 中记录的短篇化、漏正文、目录外正文丢失、纯文本目录缺失、标题识别不足、`authorid` 空流等问题是否仍然存在。
- 确认新策略没有引入明显新问题，例如章节错序、重复章节、整理无法完成、缓存无法刷新、原楼层跳转失败。
- 确认“内容保全优先”落地：除强排除外，非空楼主楼层不应静默消失。

### Audit 全量回归

复测 audit 中 40 篇帖子：

- 文学区 20 篇。
- 轻小说 / 译文区 20 篇。
- 每篇都记录旧问题是否修复、剩余问题、是否产生新问题。

重点关注 audit 中的典型样本：

- `521519`：超长篇，有可靠链接目录，应 `toc-ready` 先进入，后台按楼层位置补全。
- `571449`：纯文本目录，应完整整理后进入。
- `551945`：超长无当前可识别标题，应不能短篇化。
- `569741`：`Chapter N` 标题，应识别更多标题。
- `572415`：多楼层短篇，应保留 2 楼以后内容。
- `521647`：单楼超长 + 后续楼层，应保留首楼和后续楼层。
- `568665` / `572202`：`authorid` 流异常为空，应失败清楚，不显示空阅读器。

每篇至少验证：

- 首次进入路径：缓存命中 / `toc-ready` / 完整整理 / 失败。
- `ReadingIndex.status`、`chapters.length`、`diagnostics` 是否符合预期。
- 楼主非空楼层是否被章节、段落、说明或目录说明覆盖。
- 如果有链接目录，目录外楼主内容是否按楼层位置插入。
- 如果没有可靠目录，是否完整整理后再进入。
- 无标题楼层是否生成 `第 N 段` 或说明类条目，而不是丢弃。
- 首楼是否保留为正文、作品说明或目录说明。
- 目录条目顺序是否与楼主楼层顺序一致。
- 继续阅读是否按 `pid` 恢复，不因后台补全重排而跳错章节。
- `查看原楼层` / `对照原楼层` 是否能 App 内跳到对应帖子楼层并高亮。
- 第二次进入是否使用结构缓存秒开，并后台检查更新。
- 手动 `检查更新` 和 `重新整理全文` 是否可用。

建议记录字段：

| tid | 旧问题 | 首次路径 | opPostCount | chapterCount | fallbackChapterCount | droppedPostCount | confidence | 结果 | 剩余问题 |
|---|---|---|---:|---:|---:|---:|---|---|---|

验收底线：

- audit 中“多楼层被短篇化”的帖子不得再只保留首楼。
- audit 中“目录外后续正文丢失”的帖子必须保留目录外楼主内容。
- audit 中“当前正则不识别标题”的帖子即使标题仍不完美，也必须保留楼主正文楼层。
- `authorid` 流异常为空的帖子必须展示明确失败或不可整理状态，不得进入空阅读器。
- `droppedPostCount` 必须可解释；不能因为标题识别失败而增加。

### 随机补采 20 篇

在 audit 全量样本之外，随机补采 20 篇帖子做泛化验证。

采样建议：

- 文学区 10 篇、轻小说 / 译文区 10 篇。
- 覆盖第 1、2、3、5 页及更后页，避免只测首页热帖。
- 尽量覆盖短篇、中篇、长篇、翻译、原创、论坛体、图片较多、繁体、首楼目录、无目录等形态。
- 每篇读取楼主楼层流；长篇至少核对前两页楼主内容，必要时核对末页或声明更新进度附近。

随机样本同样记录：

- 是否完整整理。
- 是否有兜底章节。
- 是否有说明类内容。
- 是否有章节错序 / 重复 / 明显漏文。
- 原楼层跳转是否成功。
- 缓存二次进入是否成功。

随机补采验收：

- 20 篇中不得出现明显漏掉楼主正文的案例。
- 允许章节标题不完美，但必须有兜底标题。
- 允许多带作者说明，但说明类内容应在目录中弱化或标记。
- 新发现问题应补充到后续 backlog 或 audit 追加记录。

验证命令：

- `npm run typecheck`

Web 手动验证：

- `npm run proxy`
- `npm run web`

注意：Metro 改文件后 reload 可能拿到旧 bundle，验证前按需重启 Expo。

## 实施顺序

1. 类型与缓存：新增 `ReadingIndex`、diagnostics、结构缓存读写。
2. 完整构建器：实现 `buildCompleteIndex`，默认保留楼主内容。
3. Reader 无目录 / 弱目录完整整理流程。
4. 可靠链接目录：实现 `toc-ready` 和后台补全升级。
5. 阅读进度改为 pid 优先。
6. App 内查看原楼层：Reader 入口 + Thread `targetPid` 定位。
7. 更新检查与手动刷新。
8. UI 提示和目录类型弱化。
9. 跑 typecheck，回归 audit 40 篇样本，并随机补采 20 篇验证。
