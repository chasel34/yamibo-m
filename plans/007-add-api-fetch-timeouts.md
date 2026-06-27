# Plan 007: Add timeout handling to API fetches

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report instead of improvising. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 03b455a..HEAD -- src/api.ts __tests__ plans/README.md`
> If any in-scope file changed since this plan was written, compare the excerpts below against the live code before proceeding. If they no longer match, stop and report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-add-test-baseline.md`
- **Category**: bug
- **Planned at**: commit `03b455a`, 2026-06-27

## Why this matters

The API layer currently calls `fetch` directly. If the network, forum, or local web proxy accepts a request but never completes it, login, boot auth, board loading, thread paging, favorite deletion, and reading-mode redirects can remain busy indefinitely. A small timeout wrapper in `src/api.ts` gives every API-layer request a bounded failure mode while preserving the existing `ApiError` and GET retry behavior.

## Current state

- `requestOnce()` directly awaits `fetch` and maps all fetch failures to `proxy_unavailable` on web or `network` on native:

```ts
// src/api.ts:204-212
let res: Response;
try {
  res = await fetch(`${BASE}?${qs}`, opts);
} catch (e) {
  throw new ApiError(
    Platform.OS === 'web' ? 'proxy_unavailable' : 'network',
    Platform.OS === 'web' ? '无法连接本地代理，请确认 npm run proxy 正在运行' : '网络连接失败，请稍后重试',
    { module },
  );
}
```

- Existing retry behavior is centralized and should remain intact:

```ts
// src/api.ts:188-192
function shouldRetry(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.code === 'network' || err.code === 'proxy_unavailable') return true;
  if (err.code === 'http') return err.status === 502 || err.status === 503 || err.status === 504;
  return err.code === 'non_json';
}
```

- Additional API-layer direct fetches exist outside `requestOnce()`:

```ts
// src/api.ts:455-463
if (Platform.OS === 'web') {
  const res = await fetch(`${PROXY}/__resolve?url=${encodeURIComponent(target)}`);
  if (!res.ok) throw new Error('无法定位章节评论');
  const data = await res.json();
  // ...
}
const res = await fetch(target, { redirect: 'follow' });
```

```ts
// src/api.ts:592-597
res = await fetch(url, {
  method: 'POST',
  headers: { Accept: 'text/html,*/*', 'Content-Type': 'application/x-www-form-urlencoded' },
  body,
  credentials: Platform.OS === 'web' ? 'omit' : undefined,
} as RequestInit);
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Focused tests | `npm test -- --runInBand __tests__/api.mappers.test.ts` | API tests pass |
| Full tests | `npm test -- --runInBand` | all suites pass |

## Scope

**In scope**:
- `src/api.ts`
- Existing or new Jest tests under `__tests__/`
- `plans/README.md` status row

**Out of scope**:
- Do not change public API return shapes in `src/types.ts`.
- Do not add a new dependency.
- Do not change UI loading components.
- Do not change retry count beyond preserving the current single retry for retryable GET failures.

## Git workflow

- Branch: `fix/api-fetch-timeouts`
- Commit style: Conventional Commits, for example `fix: add api request timeouts`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add a timeout-aware fetch helper

In `src/api.ts`, add constants near the request helpers:

- `const API_TIMEOUT_MS = 15000;`
- `const HTML_TIMEOUT_MS = 20000;`

Add a helper such as `async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = API_TIMEOUT_MS): Promise<Response>`.

Required behavior:
- Use `AbortController` when available.
- Preserve any caller-provided `signal` by treating either signal as a cancellation reason. If composing signals becomes awkward in React Native typings, STOP and report rather than removing caller signal support. There are no current caller-provided signals in `src/api.ts`.
- Clear the timeout in `finally`.
- If the abort was caused by the helper timeout, throw a recognizable internal error marker, for example an `Error` with `name = 'TimeoutError'`.
- If `AbortController` is unavailable, fall back to a `Promise.race` timeout that rejects with the same marker.

Export timeout internals only under `__private` if tests need them.

**Verify**: `npm run typecheck` -> exit 0.

### Step 2: Map timeout errors to existing API errors

Add a small helper such as `apiNetworkError(module: string, timedOut: boolean): ApiError`.

Required messages:
- Web timeout: `请求超时，请确认本地代理仍在运行后重试`
- Native timeout: `请求超时，请检查网络后重试`
- Existing non-timeout messages stay unchanged:
  - web: `无法连接本地代理，请确认 npm run proxy 正在运行`
  - native: `网络连接失败，请稍后重试`

Use code `proxy_unavailable` on web and `network` on native, so `shouldRetry()` still retries GET timeouts once.

**Verify**: `npm run typecheck` -> exit 0.

### Step 3: Replace API-layer direct fetches

In `requestOnce()`, replace direct `fetch(`${BASE}?${qs}`, opts)` with `fetchWithTimeout(..., API_TIMEOUT_MS)`.

In `resolvePostPage()`, use `fetchWithTimeout(..., HTML_TIMEOUT_MS)` for both web proxy `__resolve` and native redirect fetches. Convert timeout failures into `new Error('定位请求超时，请稍后重试')`; keep existing `无法定位章节评论` behavior for non-timeout failures.

In `removeThreadFavorite()`, use `fetchWithTimeout(..., HTML_TIMEOUT_MS)` and map timeout failures through `ApiError` with module `favorite_delete`.

Do not change `displayImageUrl()` or image component fetching; this plan only covers the API layer.

**Verify**: `npm run typecheck` -> exit 0.

### Step 4: Add focused tests

Add tests to the existing API test file or create `__tests__/api.fetchTimeout.test.ts`.

Cover:
- The timeout helper rejects with the recognizable timeout marker when an injected or mocked fetch never settles.
- `shouldRetry()` remains true for `network` and `proxy_unavailable` ApiErrors.
- If `__private` exposes an error mapper, web/native branches are difficult to test in one Jest runtime; cover the default Platform branch and keep branch-specific behavior documented in the plan if Platform mocking is brittle.

Do not introduce real timers that make the suite wait 15 seconds. Use fake timers or export a helper that accepts a small timeout.

**Verify**: `npm test -- --runInBand __tests__/api.fetchTimeout.test.ts` if a new file is created, or the focused existing API test file if tests are added there.

### Step 5: Run full gates and update status

Run all gates. If they pass and only in-scope files changed, update plan 007 in `plans/README.md` from TODO to DONE.

**Verify**:
- `npm run typecheck` -> exit 0.
- `npm test -- --runInBand` -> all suites pass.
- `git status --short` -> only `src/api.ts`, tests, and `plans/README.md` are modified.

## Test plan

- Unit-test timeout behavior without real network and without waiting for production timeout durations.
- Keep existing mapper tests passing.
- Full verification is `npm run typecheck` plus `npm test -- --runInBand`.

## Done criteria

- [ ] All `fetch` calls in `src/api.ts` use the timeout helper.
- [ ] JSON API requests time out after 15 seconds.
- [ ] redirect/HTML helper requests time out after 20 seconds.
- [ ] Timeout failures map to `proxy_unavailable` on web and `network` on native for API requests.
- [ ] Existing GET retry behavior still retries retryable timeout errors once.
- [ ] Focused timeout tests exist and pass without real network.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test -- --runInBand` exits 0.
- [ ] `plans/README.md` status row for plan 007 is updated to DONE.

## STOP conditions

Stop and report if:
- React Native's runtime or TypeScript environment lacks enough AbortController support and the fallback cannot be made reliable without a dependency.
- Implementing timeout support requires changing screen components or public type shapes.
- Fake timer tests are flaky or cannot be made deterministic without weakening the assertion.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Any future API-layer helper added to `src/api.ts` should use `fetchWithTimeout`. If a future endpoint legitimately needs a longer timeout, add an explicit constant and a test rather than bypassing the helper.
