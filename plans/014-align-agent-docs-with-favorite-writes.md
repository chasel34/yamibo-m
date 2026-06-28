# Plan 014: Align agent docs with favorite write support

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`
> unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat afb1985..HEAD -- CLAUDE.md README.md docs/ROADMAP.md docs/API.md plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `afb1985`, 2026-06-28

## Why this matters

This repo uses `AGENTS.md` to point agents at `CLAUDE.md`, so stale guidance there directly affects future implementation work. `CLAUDE.md` still says v1 is read-only and puts "收藏" in the v2 write-operation bucket, while README, ROADMAP, and code show collection browsing plus favorite/unfavorite are already implemented. The roadmap also still lists "收藏分页" as backlog even though plans 003 and 009 have landed collection pagination and bounded favorite lookup work.

## Current state

- Agent entrypoint says to use `CLAUDE.md`:

```md
// AGENTS.md
本仓库的 agent 指引统一维护在 [CLAUDE.md](./CLAUDE.md)，请以那里为准。
```

- `CLAUDE.md` currently says v1 is read-only and includes favorite writes in v2:

```md
// CLAUDE.md:5-7
百合会 (yamibo) 第三方移动端：Expo + React Native + TypeScript，消费 Discuz! X3.5 移动 JSON API。
当前为**只读 v1**（登录 + 浏览 + 个人信息）；写操作（发帖/回帖/收藏/私信…）属 v2，见 @docs/ROADMAP.md。
运行与背景见 @README.md，接口契约见 @docs/API.md。
```

- README already documents favorite writes:

```md
// README.md:13-16
- **个人主页** —— 查看自己与他人资料、积分维度
- **消息** —— 提醒与私信会话列表（只读）、底部未读角标
- **我的收藏** —— 浏览收藏、收藏 / 取消收藏
- **浏览历史** —— 本地记录最近浏览的帖子
```

- ROADMAP has mixed signals:

```md
// docs/ROADMAP.md:3-14
> v1 只读版（登录 + 浏览 + 个人信息）已上线并接入真实 Discuz 移动 API；
> 写操作（发帖 / 回帖 / 私信…）属于 v2，规划见下文。
...
- [x] 我的收藏 + 收藏 / 取消收藏
```

```md
// docs/ROADMAP.md:22-32
- [ ] 发帖 / 回帖 / 编辑、图片附件上传
...
- [ ] 收藏分页 / 历史分页、我的发帖 / 回复
```

- Code implements favorite writes:

```ts
// src/api.ts:704-718
export async function addThreadFavorite(tid: string): Promise<{ favorited: true; favid?: string; message: string }> {
  const formhash = await currentFormhash();
  const r = await request('favthread', { id: tid, idtype: 'tid', formhash }, { method: 'POST', body: '' });
  // ...
}

export async function removeThreadFavorite(tid: string, favid?: string): Promise<{ favorited: false; message: string }> {
```

Repo conventions to match:

- Keep docs concise and in Chinese where surrounding content is Chinese.
- Do not introduce broad roadmap churn; this is a documentation alignment fix.
- Source files must not be edited by this plan.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Markdown grep sanity | `rg -n "只读 v1|发帖/回帖/收藏|收藏分页" CLAUDE.md docs/ROADMAP.md README.md` | no stale phrasing remains |
| Typecheck safety | `npm run typecheck` | exit 0 |
| Tests safety | `npm test -- --runInBand` | all suites pass |

## Scope

**In scope**:

- `CLAUDE.md`
- `docs/ROADMAP.md`
- `README.md` only if needed to keep terminology consistent
- `docs/API.md` only if needed to keep terminology consistent
- `plans/README.md` status row

**Out of scope**:

- Do not edit source code.
- Do not add or remove product commitments beyond aligning existing docs.
- Do not rewrite screenshots, release notes, or design docs.
- Do not mark unimplemented features as implemented.

## Git workflow

- Branch: `docs/align-v1-capabilities`
- Commit style: Conventional Commits, for example `docs: align v1 capability notes`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Update `CLAUDE.md` capability summary

Replace the stale "只读 v1" summary with wording that preserves the important distinction:

- v1 is read-focused.
- Login, browsing, profile, messages read-only list, history, and favorite/unfavorite are implemented.
- v2 write operations are still posting/replying/editing, uploads, scoring/comments, sending private messages, follow/friends, mark read, and similar mutations.

Suggested shape:

```md
当前为**阅读为主的 v1**（登录 + 浏览 + 个人信息 + 收藏/取消收藏）；发帖/回帖/编辑、附件上传、评分/点评、发送私信等写操作属 v2，见 @docs/ROADMAP.md。
```

Keep the rest of `CLAUDE.md` intact.

**Verify**: `rg -n "只读 v1|发帖/回帖/收藏" CLAUDE.md` -> no matches.

### Step 2: Align `docs/ROADMAP.md`

Update the top note and section heading so it no longer calls v1 strictly read-only.

Suggested changes:

- `v1 只读版` -> `v1 阅读为主版本`
- `## ✅ 已实现（v1 只读）` -> `## ✅ 已实现（v1）`
- Ensure `我的收藏 + 收藏 / 取消收藏` stays checked.
- Remove `收藏分页` from the unchecked backlog line, because collection pagination is already implemented. Keep the remaining backlog items, for example:
  `历史分页、我的发帖 / 回复`

Do not mark `历史分页` or `我的发帖 / 回复` complete unless code evidence proves they are implemented.

**Verify**: `rg -n "只读版|v1 只读|收藏分页" docs/ROADMAP.md` -> no matches.

### Step 3: Check README/API consistency

Read the relevant README and API sections after the edit:

- `README.md` feature list should still mention "我的收藏 —— 浏览收藏、收藏 / 取消收藏".
- `docs/API.md` should still document `favthread` and favorite delete behavior.

Only edit these files if wording now conflicts with the updated `CLAUDE.md` and roadmap. Prefer no changes if they are already accurate.

**Verify**: `rg -n "我的收藏|favthread|favorite&op=delete" README.md docs/API.md` -> confirms the favorite behavior is still documented.

### Step 4: Run gates and update status

Run safety gates. If they pass and only docs plus `plans/README.md` changed, update plan 014 in `plans/README.md` from TODO to DONE.

**Verify**:

- `npm run typecheck` -> exit 0.
- `npm test -- --runInBand` -> all suites pass.
- `git status --short` -> only in-scope docs and `plans/README.md` are modified.

## Test plan

- No new tests are needed; this is docs-only.
- Use grep commands to prove stale phrases were removed.
- Run existing typecheck/tests as safety gates because this repo's plans require verification consistency.

## Done criteria

- [ ] `CLAUDE.md` no longer says favorite writes are v2-only.
- [ ] `docs/ROADMAP.md` no longer calls the implemented v1 strictly read-only.
- [ ] `docs/ROADMAP.md` no longer lists collection pagination as backlog.
- [ ] README/API remain consistent with implemented favorite/unfavorite behavior.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test -- --runInBand` exits 0.
- [ ] `plans/README.md` status row for 014 is updated.

## STOP conditions

Stop and report back if:

- The code no longer contains `addThreadFavorite()` and `removeThreadFavorite()`.
- You find contradictory product guidance that intentionally reclassifies favorites as v2.
- Aligning the docs would require deciding the scope of unimplemented features beyond the documented evidence.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

When future write features land, update `CLAUDE.md`, `README.md`, `docs/ROADMAP.md`, and `docs/API.md` in the same PR. Agent-facing docs should describe the actual current product surface, not only the original phase label.
