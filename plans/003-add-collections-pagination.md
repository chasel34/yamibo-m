# Plan 003: Add pagination to the collections screen

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report instead of improvising. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 59697b2..HEAD -- src/api.ts src/screens/Collections.tsx src/components/ui.tsx src/types.ts docs/ROADMAP.md scripts`
> If any in-scope file changed since this plan was written, compare the excerpts below against the live code before proceeding. If they no longer match, stop and report.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/001-add-test-baseline.md`
- **Category**: bug
- **Planned at**: commit `59697b2`, 2026-06-21

## Why this matters

The app advertises “我的收藏 + 收藏 / 取消收藏” as implemented, and the roadmap separately notes 收藏分页 is still open. The API layer already accepts a page argument, but the screen always fetches page 1. Users with more than one page of favorites see the total count but cannot reach older favorites.

## Current state

- `src/api.ts:518-529` maps `myfavthread`:

```ts
export async function getCollections(page = 1): Promise<ListResult<CollectionItem>> {
  const v = variablesOf(await request('myfavthread', { page }));
  // ...
  return { list, count: asInt(v.count, list.length) };
}
```

- `src/screens/Collections.tsx:18-24` always calls `getCollections(1)`.
- `src/screens/Collections.tsx:45` displays `共 {data.count} 篇收藏`.
- `src/components/ui.tsx` already provides `Pager`, used by `BoardScreen` and `ThreadScreen`; reuse it rather than inventing new pagination controls.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0 |

## Scope

**In scope**:
- `src/api.ts`
- `src/screens/Collections.tsx`
- `src/types.ts` only if `ListResult` needs optional pagination metadata
- Test/verifier scripts from plan 001

**Out of scope**:
- Do not change favorite add/remove behavior.
- Do not implement history pagination here.
- Do not redesign the collection row UI.

## Git workflow

- Branch: `fix/collections-pagination`
- Commit style: Conventional Commits, for example `fix: paginate collections screen`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add mapper coverage for collection pagination metadata

Before changing UI, add or update tests to assert that the collection mapper can expose enough metadata to compute pagination. If the API payload has `count` and `perpage`, return both or return `totalPages`; if `perpage` is absent, use the page list length as a fallback.

**Verify**: `npm test` -> the new test should fail until the mapper exposes metadata, then pass after Step 2.

### Step 2: Return pagination metadata from `getCollections`

Update `getCollections(page)` to return enough information for a pager. Preferred shape if compatible with `ListResult`:

```ts
return {
  list,
  count: asInt(v.count, list.length),
  page,
  perpage,
  totalPages,
};
```

Use the same defensive parsing conventions as `getThreadFavorite()`: `asPositiveInt(v.perpage, list.length || 20)` and `Math.max(1, Math.ceil(count / perpage))`.

**Verify**: `npm run typecheck` -> exits 0.

### Step 3: Add page state and `Pager` to `CollectionsScreen`

Mirror the existing board pattern:
- state for `page`, `totalPages`, `paging`, and optionally `perpage`;
- `load(page, isRefresh)` fetches the requested page;
- pull-to-refresh reloads the current page or resets to page 1. Prefer page 1 for freshness unless the UX strongly suggests preserving the page;
- `goPage(n)` ignores duplicate requests and disables the pager while loading.

Reuse `Pager` from `src/components/ui.tsx` and keep the footer text accurate.

**Verify**: `npm run typecheck` -> exits 0.

### Step 4: Preserve empty/error behavior

Keep the existing empty state for zero favorites. If page N unexpectedly returns empty while `count > 0`, show a normal empty state plus a pager so the user can jump back, or clamp to the last valid page if `totalPages` is known.

**Verify**: `npm test` -> exits 0.

## Test plan

Add a mapper-level test with fake `myfavthread` payloads for:
- count greater than first-page length,
- absent `perpage` fallback,
- empty collection.

If UI tests do not exist, rely on typecheck and mapper tests. Manual check: create/fake an account with more than one page of favorites and verify pager navigation loads page 2.

## Done criteria

- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` exits 0.
- [ ] Collections screen can navigate beyond page 1 when `count > perpage`.
- [ ] Pull-to-refresh still works.
- [ ] Favorite add/remove APIs are untouched.
- [ ] `plans/README.md` status row for plan 003 is updated.

## STOP conditions

Stop and report if:
- The live `myfavthread` payload does not include any count/per-page signal and cannot support total-page calculation.
- The change requires redesigning shared `Pager`.
- Fixing this would require changing favorite mutation semantics.

## Maintenance notes

When history pagination is implemented later, reuse the same list pagination shape and screen-state pattern introduced here.
