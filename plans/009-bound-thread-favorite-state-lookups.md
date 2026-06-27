# Plan 009: Avoid full collection scans for thread favorite state

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report instead of improvising. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 03b455a..HEAD -- src/api.ts src/screens/Thread.tsx __tests__/api.mappers.test.ts plans/README.md`
> If any in-scope file changed since this plan was written, compare the excerpts below against the live code before proceeding. If they no longer match, stop and report.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-add-test-baseline.md`
- **Category**: perf
- **Planned at**: commit `03b455a`, 2026-06-27

## Why this matters

Every opened thread currently asks `getThreadFavorite(tid)` whether the heart should be active. That function scans `myfavthread` from page 1 through the last page until it finds the thread. Accounts with many favorites will pay multiple API requests on ordinary thread opens, and favorite add/remove can trigger another scan. A small in-memory index can reuse collection pages the app has already loaded and bound passive lookups so normal reading does not turn into a full collection crawl.

## Current state

- Passive thread open triggers `getThreadFavorite(tid)`:

```tsx
// src/screens/Thread.tsx:277-287
React.useEffect(() => {
  if (!data?.thread.tid) return;
  let alive = true;
  const version = ++favoriteVersion.current;
  getThreadFavorite(tid)
    .then((next) => {
      if (!alive || version !== favoriteVersion.current) return;
      setFavorited(next.favorited);
      setFavoriteId(next.favid);
    })
    .catch(() => {});
  return () => { alive = false; };
}, [data?.thread.tid, tid]);
```

- `getThreadFavorite()` scans all collection pages until found or exhausted:

```ts
// src/api.ts:551-564
export async function getThreadFavorite(tid: string): Promise<{ favorited: boolean; favid?: string }> {
  let page = 1;
  while (true) {
    const v = variablesOf(await request('myfavthread', { page }));
    const list = asArray(v.list).map(asRecord);
    const found = list.find((it: any) => it.idtype === 'tid' && asString(it.id) === tid);
    if (found) return { favorited: true, favid: asString(found.favid) || undefined };
    const perpage = asPositiveInt(v.perpage, list.length || 20);
    const count = asInt(v.count, list.length);
    const totalPages = count > 0 ? Math.max(1, Math.ceil(count / perpage)) : page;
    if (page >= totalPages || list.length === 0) break;
    page += 1;
  }
  return { favorited: false };
}
```

- Favorite mutation relies on `getThreadFavorite()` to recover `favid`:

```ts
// src/api.ts:571-585
export async function addThreadFavorite(tid: string): Promise<{ favorited: true; favid?: string; message: string }> {
  const formhash = await currentFormhash();
  const r = await request('favthread', { id: tid, idtype: 'tid', formhash }, { method: 'POST', body: '' });
  const val = messageCode(r.Message);
  const favorite = await getThreadFavorite(tid).catch(() => ({ favorited: true as const, favid: undefined }));
  return {
    favorited: true,
    favid: favorite.favid,
    message: val === 'favorite_repeat' ? '已经收藏过了' : '已收藏',
  };
}

export async function removeThreadFavorite(tid: string, favid?: string): Promise<{ favorited: false; message: string }> {
  const favorite = favid ? { favorited: true, favid } : await getThreadFavorite(tid);
```

- Collection pages already map `favid` and pagination metadata:

```ts
// src/api.ts:533-548
export async function getCollections(page = 1): Promise<ListResult<CollectionItem>> {
  const v = variablesOf(await request('myfavthread', { page }));
  return mapCollections(v, page);
}

function mapCollections(v: Record<string, any>, page = 1): ListResult<CollectionItem> {
  const list: CollectionItem[] = asArray(v.list).map(asRecord).filter((it: any) => it.idtype === 'tid').map((it: any) => ({
    id: asString(it.id), tid: asString(it.id), favid: asString(it.favid) || undefined,
    // ...
  }));
  return { list, ...paginationFor(v, list.length, page) };
}
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Focused API tests | `npm test -- --runInBand __tests__/api.mappers.test.ts` | API tests pass |
| Full tests | `npm test -- --runInBand` | all suites pass |

## Scope

**In scope**:
- `src/api.ts`
- `src/screens/Thread.tsx` only if needed to pass a lookup mode or preserve optimistic behavior
- `__tests__/api.mappers.test.ts` or a new focused API test
- `plans/README.md` status row

**Out of scope**:
- Do not persist the favorite cache to AsyncStorage.
- Do not change `CollectionItem`, `ListResult`, or navigation param shapes.
- Do not change the visual behavior of the heart button.
- Do not add new API endpoints.

## Git workflow

- Branch: `perf/bound-thread-favorite-lookups`
- Commit style: Conventional Commits, for example `perf: bound thread favorite lookups`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add an in-memory favorite index

In `src/api.ts`, add a module-level index near the collections helpers.

Required shape:
- Keyed by `tid`.
- Stores `{ favorited: boolean; favid?: string }` for known thread IDs.
- Tracks which collection pages have been observed, for example a `Set<number>`.
- Tracks the last known `totalPages` for collections if available.

Add small pure helpers under `__private` if needed for tests, for example:
- `rememberFavoritePage(result: ListResult<CollectionItem>)`
- `rememberFavoriteState(tid: string, state)`
- `clearFavoriteIndexForTests()`

**Verify**: `npm run typecheck` -> exit 0.

### Step 2: Hydrate the index from loaded collection pages

After `getCollections(page)` maps its result, call the cache helper before returning.

Required behavior:
- Every item in the loaded page records `favorited: true` with its `favid`.
- The page number is marked as observed.
- If page 1 is loaded and a thread is not present, do not mark every absent thread as false. Absence is only known for a thread after the bounded lookup checks its pages.

**Verify**: `npm run typecheck` -> exit 0.

### Step 3: Bound passive favorite lookup

Change `getThreadFavorite()` to accept an optional mode, for example:

```ts
export async function getThreadFavorite(
  tid: string,
  opts: { fullScan?: boolean } = {},
): Promise<{ favorited: boolean; favid?: string }>
```

Required behavior:
- If the tid exists in the in-memory index, return it without network.
- For default passive lookups, scan at most 3 collection pages.
- For `fullScan: true`, keep the old exhaustive behavior for mutation recovery.
- As pages are scanned, hydrate the index from each page.
- If passive lookup reaches the 3-page cap without finding the tid, return `{ favorited: false }` and store that negative state for the tid so the same thread does not repeat the bounded scan in the same app session.
- Do not mark unrelated absent tids false.

**Verify**: `npm run typecheck` -> exit 0.

### Step 4: Update mutation paths to keep cache correct

In `addThreadFavorite()`:
- After successful `favthread`, call `getThreadFavorite(tid, { fullScan: true })` only to recover `favid`.
- If recovery fails, store `{ favorited: true }` for the tid and return the existing fallback.

In `removeThreadFavorite()`:
- If no `favid` is provided, call `getThreadFavorite(tid, { fullScan: true })` because deletion needs the concrete `favid`.
- After successful delete or "already gone", store `{ favorited: false }` for the tid.

In `setThreadFavorite()`, preserve the existing return shape.

`ThreadScreen` should continue calling `getThreadFavorite(tid)` with no options for passive open and should keep its existing optimistic rollback logic unless a TypeScript change requires a tiny adjustment.

**Verify**: `npm run typecheck` -> exit 0.

### Step 5: Add focused tests

Add tests that exercise pure cache helpers if direct request mocking would be brittle.

Cover:
- A loaded collections page marks listed tids as favorited with `favid`.
- Cached tid lookup does not require a scan helper.
- Default lookup policy is capped at 3 pages. If testing `request()` directly is too invasive, test an exported `FAVORITE_LOOKUP_PAGE_LIMIT` or helper that computes whether to continue.
- `fullScan: true` uses the old exhaustive intent. This can be covered by unit-level helper behavior if fetch/request mocking is too large.

Prefer deterministic tests under `__tests__/api.mappers.test.ts` if the helpers are exported via `__private`. Do not add real network calls.

**Verify**: `npm test -- --runInBand __tests__/api.mappers.test.ts` -> passes.

### Step 6: Run full gates and update status

Run all gates. If they pass and only in-scope files changed, update plan 009 in `plans/README.md` from TODO to DONE.

**Verify**:
- `npm run typecheck` -> exit 0.
- `npm test -- --runInBand` -> all suites pass.
- `git status --short` -> only `src/api.ts`, optional `src/screens/Thread.tsx`, tests, and `plans/README.md` are modified.

## Test plan

- Add deterministic cache/policy tests with no real network.
- Keep existing API mapper tests passing.
- Full verification is `npm run typecheck` plus `npm test -- --runInBand`.

## Done criteria

- [ ] `getCollections()` hydrates an in-memory favorite index.
- [ ] Passive `getThreadFavorite(tid)` returns cached results without network when possible.
- [ ] Passive lookup scans no more than 3 collection pages.
- [ ] Mutation paths may use full scans only when needed to recover `favid`.
- [ ] Add/remove favorite updates the cache so ThreadScreen optimistic state remains consistent.
- [ ] Focused tests cover cache hydration and bounded lookup policy.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test -- --runInBand` exits 0.
- [ ] `plans/README.md` status row for plan 009 is updated to DONE.

## STOP conditions

Stop and report if:
- Discuz `myfavthread` pagination metadata is missing in a way that makes a safe 3-page cap ambiguous.
- The cache requires persistent storage to avoid visible regressions.
- Recovering `favid` after add/remove cannot be done without changing the UI return shape.
- Testing requires real forum credentials or live network.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

This cache is intentionally session-local. If future work adds offline cache or multi-account switching, favorite state must be keyed by account uid or cleared on logout/account switch to avoid cross-account leakage.
