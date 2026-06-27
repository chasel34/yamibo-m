# Plan 008: Ignore stale board filter and pagination responses

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report instead of improvising. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 03b455a..HEAD -- src/screens/Board.tsx __tests__ plans/README.md`
> If any in-scope file changed since this plan was written, compare the excerpts below against the live code before proceeding. If they no longer match, stop and report.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/001-add-test-baseline.md`
- **Category**: bug
- **Planned at**: commit `03b455a`, 2026-06-27

## Why this matters

`BoardScreen` lets users quickly change sort mode, type filters, refresh, and jump pages. Each action starts an async `getBoard()` request, but the screen currently lets any response update state. If an older request resolves after a newer one, the UI can show a newer filter selection with older list data. `ThreadScreen` already uses a simple version ref to ignore stale favorite responses; `BoardScreen` should use the same pattern for board loads and pagination.

## Current state

- Board state is updated directly after each load:

```tsx
// src/screens/Board.tsx:36-55
const load = React.useCallback(async (tid: string | number, srt: SortMode, isRefresh?: boolean) => {
  if (isRefresh) setRefreshing(true);
  setError(null);
  try {
    const r = await getBoard(fid, 1, tid, srt);
    setBoard((b: any) => ({ ...b, ...r.board }));
    setTypes(r.types);
    setSubs(r.subs);
    setPinned(r.pinned);
    setItems(r.threads);
    setPage(1);
    setTotalPages(r.totalPages);
    setTotalThreads(r.totalThreads);
    setTpp(r.tpp);
  } catch (e) {
    if (items === null) setError(e.message); else nav.toast(e.message);
  } finally {
    setRefreshing(false);
  }
}, [fid, items, nav]);
```

- Pagination also updates state directly:

```tsx
// src/screens/Board.tsx:59-74
const goPage = async (n: number) => {
  if (paging || n === page) return;
  setPaging(true);
  try {
    const r = await getBoard(fid, n, typeid, sort);
    setItems(r.threads);
    setPage(n);
    setTotalPages(r.totalPages);
    setTotalThreads(r.totalThreads);
    setTpp(r.tpp);
    scRef.current?.scrollTo({ y: 0, animated: false });
  } catch (e) {
    nav.toast(e.message);
  } finally {
    setPaging(false);
  }
};
```

- `ThreadScreen` has the local stale-response pattern to copy:

```tsx
// src/screens/Thread.tsx:277-288
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

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| UI smoke | `npm test -- --runInBand __tests__/ui.smoke.test.tsx` | UI smoke passes |
| Full tests | `npm test -- --runInBand` | all suites pass |

## Scope

**In scope**:
- `src/screens/Board.tsx`
- Optional focused React Native test under `__tests__/` if practical
- `plans/README.md` status row

**Out of scope**:
- Do not change `getBoard()` or API response shapes.
- Do not replace the screen with a reducer unless the version guard cannot be expressed cleanly.
- Do not change visual layout or filter labels.
- Do not add new dependencies.

## Git workflow

- Branch: `fix/board-stale-responses`
- Commit style: Conventional Commits, for example `fix: ignore stale board responses`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add request version refs

In `BoardScreen`, add a ref near `scRef`, for example:

```tsx
const requestVersion = React.useRef(0);
```

Use one shared version counter for initial loads, refreshes, filter changes, and pagination. A newer filter load should invalidate an older pagination request, and a newer pagination request should invalidate an older refresh.

**Verify**: `npm run typecheck` -> exit 0.

### Step 2: Guard `load()`

At the start of `load()`, increment the ref and capture the local version:

```tsx
const version = ++requestVersion.current;
```

Before every state mutation after `await getBoard(...)`, check `if (version !== requestVersion.current) return;`.

Apply the same guard in `catch` before `setError()` or `nav.toast()`, and in `finally` before `setRefreshing(false)`. Do not leave stale requests able to clear the current spinner.

Keep the current dependency shape unless TypeScript or linting requires a change.

**Verify**: `npm run typecheck` -> exit 0.

### Step 3: Guard `goPage()`

Use the same `requestVersion` pattern in `goPage()`.

Required behavior:
- `setPaging(true)` may run immediately for the latest page request.
- After `await getBoard(...)`, stale responses must not update list state or scroll position.
- In `catch`, stale errors must not toast.
- In `finally`, stale requests must not clear `paging` for the latest request.

**Verify**: `npm run typecheck` -> exit 0.

### Step 4: Add a focused test if practical

If existing Jest setup can render `BoardScreen` with mocked navigation and `getBoard`, add a test that:
- starts one slow `getBoard()` call,
- changes filter or triggers a second load,
- resolves the second call first and the first call last,
- asserts the stale first result is not rendered.

If this test requires large navigation scaffolding or brittle timers, skip it and add no test; rely on the simple pattern plus typecheck/full existing tests. Do not spend this plan turning the smoke test setup into a full screen harness.

**Verify**:
- If a test is added: `npm test -- --runInBand <new test file>` -> passes.
- If no test is added: `npm test -- --runInBand __tests__/ui.smoke.test.tsx` -> passes.

### Step 5: Run full gates and update status

Run all gates. If they pass and only in-scope files changed, update plan 008 in `plans/README.md` from TODO to DONE.

**Verify**:
- `npm run typecheck` -> exit 0.
- `npm test -- --runInBand` -> all suites pass.
- `git status --short` -> only `src/screens/Board.tsx`, optional tests, and `plans/README.md` are modified.

## Test plan

- Prefer a focused mocked `BoardScreen` stale-response test if it stays small.
- Otherwise, validate with TypeScript and existing UI smoke tests.
- Full verification is `npm run typecheck` plus `npm test -- --runInBand`.

## Done criteria

- [ ] `BoardScreen` has a monotonic request version guard.
- [ ] Stale `load()` responses cannot update board/list/pager/error/refreshing state.
- [ ] Stale `goPage()` responses cannot update list/pager/toast/paging state or scroll.
- [ ] Current initial load, pull-to-refresh, filter changes, and paging behavior remain intact.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test -- --runInBand` exits 0.
- [ ] `plans/README.md` status row for plan 008 is updated to DONE.

## STOP conditions

Stop and report if:
- `BoardScreen` has drifted into a reducer or data-fetching abstraction where a local ref guard is no longer the right pattern.
- Correctly guarding stale responses requires changing `src/api.ts` or navigation behavior.
- A focused test becomes larger than the implementation change or requires real network.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Any future screen with filterable or pageable async requests should use the same version-guard pattern or a shared cancellation abstraction if one is introduced later. Reviewers should focus on `finally` blocks; stale requests clearing loading state is the easy bug to miss.
