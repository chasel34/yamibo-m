# Plan 012: Ignore stale collection and message responses

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`
> unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat afb1985..HEAD -- src/screens/Collections.tsx src/screens/Messages.tsx __tests__/collections.test.tsx __tests__/messages.test.tsx plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: `plans/011-scope-message-errors-per-tab.md`
- **Category**: bug
- **Planned at**: commit `afb1985`, 2026-06-28

## Why this matters

The app talks to a live forum API where requests can return out of order. `BoardScreen` already protects filter and pagination state with a request version guard, but `CollectionsScreen` and `MessagesScreen` do not. A slow refresh or page request can overwrite a newer user action, making the visible list, page number, error state, and loading indicators inconsistent.

## Current state

- `BoardScreen` has the intended local pattern: increment a ref before each request, then ignore stale success/catch/finally paths.

```tsx
// src/screens/Board.tsx:35-58
const requestVersion = React.useRef(0);

const load = React.useCallback(async (tid: string | number, srt: SortMode, isRefresh?: boolean) => {
  const version = ++requestVersion.current;
  if (isRefresh) setRefreshing(true);
  setPaging(false);
  setError(null);
  try {
    const r = await getBoard(fid, 1, tid, srt);
    if (version !== requestVersion.current) return;
    setBoard((b: any) => ({ ...b, ...r.board }));
    // ...
  } catch (e) {
    if (version !== requestVersion.current) return;
    if (items === null) setError(e.message); else nav.toast(e.message);
  } finally {
    if (version === requestVersion.current) setRefreshing(false);
  }
}, [fid, items, nav]);
```

- `CollectionsScreen` currently applies every response:

```tsx
// src/screens/Collections.tsx:18-28
const dataRef = React.useRef(data);
dataRef.current = data;

const load = React.useCallback(async (targetPage = 1, isRefresh?: boolean) => {
  if (isRefresh) setRefreshing(true);
  else if (dataRef.current) setPaging(true);
  setError(null);
  try { const r = await getCollections(targetPage); setData(r); }
  catch (e) { if (!dataRef.current) setError(e.message); else nav.toast(e.message); }
  finally { setRefreshing(false); setPaging(false); }
}, [nav]);
```

- `MessagesScreen` also applies every response. After plan 011, the exact error variable should be per-tab, but the request ordering problem remains:

```tsx
// src/screens/Messages.tsx:30-42
const load = React.useCallback(async (which: Seg, targetPage = 1, isRefresh?: boolean) => {
  if (isRefresh) setRefreshing(true);
  else if (listsRef.current[which]) setPaging(which);
  setError(null);
  try {
    const r = await SEGS[which].fetch(targetPage);
    setLists((prev) => ({ ...prev, [which]: r }));
  } catch (e) {
    if (listsRef.current[which] === null) setError(e.message); else nav.toast(e.message);
  } finally {
    setRefreshing(false);
    setPaging(null);
  }
}, [nav]);
```

Repo conventions to match:

- Use `React.useRef()` counters for stale response guards, as in `BoardScreen`.
- Keep state local to each screen.
- Keep tests deterministic with mocked API promises; no real network.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Focused tests | `npm test -- --runInBand __tests__/collections.test.tsx __tests__/messages.test.tsx` | focused tests pass |
| Full tests | `npm test -- --runInBand` | all suites pass |

## Scope

**In scope**:

- `src/screens/Collections.tsx`
- `src/screens/Messages.tsx`
- `__tests__/collections.test.tsx` (create if absent)
- `__tests__/messages.test.tsx` (extend the file created by plan 011)
- `plans/README.md` status row

**Out of scope**:

- Do not change API mapper behavior in `src/api.ts`.
- Do not add cancellation or `AbortController`; this plan only ignores stale results.
- Do not restyle list or pager UI.
- Do not combine reminders and private messages into one data model.

## Git workflow

- Branch: `fix/ignore-stale-list-responses`
- Commit style: Conventional Commits, for example `fix: ignore stale list responses`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add collection stale-response regression coverage

Create `__tests__/collections.test.tsx`.

Test idea:

1. Mock `getCollections()` to return manually controlled promises.
2. Render `CollectionsScreen` with the minimal providers needed by `useNav()` and `useTheme()`.
3. Resolve page 1 with an item and wait for it.
4. Trigger a page 2 load, then trigger a refresh/page 1 load before page 2 resolves.
5. Resolve the newer page 1 request first, then resolve the older page 2 request.
6. Assert the screen still shows page 1's newer item/state and not page 2's stale item/state.

Use labels already rendered by the screen, such as item titles and pager text.

**Verify**: `npm test -- --runInBand __tests__/collections.test.tsx` -> the new test should fail before implementation.

### Step 2: Guard `CollectionsScreen` requests

In `src/screens/Collections.tsx`, add:

```ts
const requestVersion = React.useRef(0);
```

At the start of `load()`, increment it:

```ts
const version = ++requestVersion.current;
```

Then guard each async branch:

- After `await getCollections(targetPage)`, return without setting state if `version !== requestVersion.current`.
- In `catch`, return before setting error/toast if stale.
- In `finally`, only clear `refreshing` and `paging` when the version is current.

Match the `BoardScreen` style. Do not remove `dataRef`; it is still useful for deciding initial error vs toast.

**Verify**: `npm run typecheck` -> exit 0.

### Step 3: Add message stale-response regression coverage

Extend `__tests__/messages.test.tsx`.

Cover one of these deterministic scenarios:

- Same tab: reminders page 2 starts, then refresh page 1 starts; page 1 resolves first and must not be overwritten by late page 2.
- Cross tab: a stale request for the inactive tab must not clear active tab loading/error state. If this is awkward to observe, keep the test to same-tab behavior.

This test assumes plan 011 already made errors per-tab. Do not undo that work.

**Verify**: `npm test -- --runInBand __tests__/messages.test.tsx` -> stale-response test fails before implementation and plan 011 tests still pass.

### Step 4: Guard `MessagesScreen` requests per segment

In `src/screens/Messages.tsx`, add a request version per segment:

```ts
const requestVersions = React.useRef<Record<Seg, number>>({ remind: 0, dm: 0 });
```

At the start of `load(which, ...)`, increment only that segment:

```ts
const version = ++requestVersions.current[which];
```

Guard success/catch/finally with:

```ts
if (version !== requestVersions.current[which]) return;
```

Important details:

- Stale reminder responses should not modify `lists.remind`, reminder errors, `refreshing`, or `paging`.
- Stale private-message responses should not modify `lists.dm`, private-message errors, `refreshing`, or `paging`.
- If `paging` is a segment value, only clear it when the current request for that same segment completes.
- Preserve plan 011's per-tab error behavior.

**Verify**: `npm run typecheck` -> exit 0.

### Step 5: Run focused and full gates

Run focused tests, then full local gates. If they pass and only in-scope files changed, update plan 012 in `plans/README.md` from TODO to DONE.

**Verify**:

- `npm test -- --runInBand __tests__/collections.test.tsx __tests__/messages.test.tsx` -> focused tests pass.
- `npm run typecheck` -> exit 0.
- `npm test -- --runInBand` -> all suites pass.
- `git status --short` -> only in-scope files are modified.

## Test plan

- Add controlled-promise component tests for collections and messages.
- Use existing `BoardScreen` request-version pattern as the production exemplar.
- Do not mock timers unless the test actually depends on timers.

## Done criteria

- [ ] `CollectionsScreen` ignores stale success, error, and finally paths.
- [ ] `MessagesScreen` ignores stale success, error, and finally paths per segment.
- [ ] Regression tests prove late older responses cannot overwrite newer state.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test -- --runInBand` exits 0.
- [ ] `plans/README.md` status row for 012 is updated.

## STOP conditions

Stop and report back if:

- Plan 011 has not landed and `MessagesScreen` still has a single shared `error`; finish plan 011 first.
- The screen was refactored away from local `load()` functions and the excerpts no longer match.
- The fix requires changing API functions or adding request cancellation.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Any future screen with filter, refresh, and pagination should copy the same request-version guard. If later work adds actual request cancellation, keep these stale guards anyway; cancellation is best-effort, but response ordering still needs protection.
