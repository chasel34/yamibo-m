# Plan 010: Harden forum link parsing against malformed encoded paths

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`
> unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat afb1985..HEAD -- src/forumLinks.ts src/screens/Thread.tsx src/screens/Reader.tsx __tests__/forumLinks.test.ts plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/001-add-test-baseline.md`
- **Category**: bug
- **Planned at**: commit `afb1985`, 2026-06-28

## Why this matters

Forum post bodies are remote content, and users can tap links embedded by other users. `parseForumLink()` currently constructs a `URL` inside a `try`, but then decodes `url.pathname` outside that guard. A malformed percent-encoded path throws `URIError`, so tapping one bad link can break the thread or reader interaction instead of falling back to "cannot open this link".

## Current state

- `src/forumLinks.ts` parses Discuz thread, board, and profile URLs.
- `src/screens/Thread.tsx` calls `parseForumLink(href)` before its `Linking.openURL()` fallback.
- `src/screens/Reader.tsx` does the same inside the WebView message handler.

Current parser excerpt:

```ts
// src/forumLinks.ts:25-39
export function parseForumLink(href?: string | null): ForumLinkTarget | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, `${HOST}/`);
  } catch (e) {
    return null;
  }
  if (url.hostname !== 'bbs.yamibo.com') return null;

  const path = decodeURIComponent(url.pathname);
  const qs = url.searchParams;
  const mod = String(qs.get('mod') || '').toLowerCase();
  const pid = firstNumber(qs.get('pid'), pidFromHash(url.hash));
  const page = pageNumber(qs.get('page'));
```

Current callers:

```ts
// src/screens/Thread.tsx:361-380
const openLink = async (href: string) => {
  const target = parseForumLink(href);
  if (target?.kind === 'thread') {
    nav.push('thread', {
      thread: { tid: target.tid, title: '帖子' },
      targetPid: target.pid,
      targetPage: target.page,
    });
    return;
  }
  // ...
  try {
    await Linking.openURL(href);
```

```ts
// src/screens/Reader.tsx:374-385
} else if (msg.type === 'link') {
  const href = String(msg.href || '');
  if (!/^https?:\/\//i.test(href)) return;
  const target = parseForumLink(href);
  if (target?.kind === 'thread') {
    nav.push('thread', { tid: target.tid, targetPid: target.pid, targetPage: target.page });
  // ...
  } else {
    Linking.openURL(href).catch(() => nav.toast('无法打开这个链接'));
  }
}
```

Repo conventions to match:

- Keep URL boundary helpers in `src/forumLinks.ts`; screens should stay thin.
- Add deterministic unit tests under `__tests__/`, following the existing style in `__tests__/api.mappers.test.ts`.
- Do not make real network calls in tests.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Focused tests | `npm test -- --runInBand __tests__/forumLinks.test.ts` | forum link tests pass |
| Full tests | `npm test -- --runInBand` | all suites pass |

## Scope

**In scope**:

- `src/forumLinks.ts`
- `__tests__/forumLinks.test.ts` (create if absent)
- `plans/README.md` status row

**Out of scope**:

- Do not change `ThreadScreen` or `ReaderScreen` unless typecheck proves it is required.
- Do not change navigation param shapes in `src/types.ts`.
- Do not add new external URL handling behavior beyond preventing parser throws.
- Do not make `parseForumLink()` accept non-Discuz hosts.

## Git workflow

- Branch: `fix/harden-forum-link-parsing`
- Commit style: Conventional Commits, for example `fix: harden forum link parsing`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add regression coverage for malformed paths

Create `__tests__/forumLinks.test.ts`.

Cover at least:

- `parseForumLink('https://bbs.yamibo.com/%E0%A4%A')` returns `null` and does not throw.
- A normal query-style thread link still returns `{ kind: 'thread', tid, pid, page }`.
- A normal path-style board or profile link still parses as before.

Use direct unit tests; do not render screens.

**Verify**: `npm test -- --runInBand __tests__/forumLinks.test.ts` -> tests fail only because the malformed-path fix is not implemented yet.

### Step 2: Make pathname decoding safe inside the parser

In `src/forumLinks.ts`, keep the `URL` construction guard and add a tiny safe decode helper near the existing small helpers:

```ts
function safeDecodePath(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch (e) {
    return pathname;
  }
}
```

Then replace `const path = decodeURIComponent(url.pathname);` with:

```ts
const path = safeDecodePath(url.pathname);
```

This preserves existing matching for valid encoded paths while making malformed paths fall through to `return null` instead of throwing.

**Verify**: `npm test -- --runInBand __tests__/forumLinks.test.ts` -> all tests in the file pass.

### Step 3: Run full gates and update status

Run the full local gates. If they pass and only in-scope files changed, update plan 010 in `plans/README.md` from TODO to DONE.

**Verify**:

- `npm run typecheck` -> exit 0.
- `npm test -- --runInBand` -> all suites pass.
- `git status --short` -> only `src/forumLinks.ts`, `__tests__/forumLinks.test.ts`, and `plans/README.md` are modified.

## Test plan

- New file: `__tests__/forumLinks.test.ts`.
- Structural pattern: direct helper tests like `__tests__/api.mappers.test.ts`.
- Cases: malformed percent path, query-style thread link, path-style board/profile link, unrelated host returning `null`.

## Done criteria

- [ ] `parseForumLink()` no longer throws on malformed percent-encoded paths.
- [ ] Existing valid Discuz thread, board, and profile parsing still works.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test -- --runInBand` exits 0.
- [ ] `plans/README.md` status row for 010 is updated.

## STOP conditions

Stop and report back if:

- `src/forumLinks.ts` no longer contains a centralized `parseForumLink()` helper.
- Fixing the issue requires changing React Navigation route params or `RootStackParamList`.
- The new test can only be made to pass by catching exceptions in screen callers instead of hardening the parser.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Future Discuz URL formats should be added as parser unit tests first. Keep malformed-input behavior boring: unrecognized or malformed forum URLs should return `null` so callers can fall back to `Linking.openURL()` or a toast.
