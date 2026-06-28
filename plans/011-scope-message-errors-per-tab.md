# Plan 011: Scope message loading errors to the active tab

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`
> unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat afb1985..HEAD -- src/screens/Messages.tsx __tests__/messages.test.tsx plans/README.md`
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

The messages screen has two independent data surfaces: reminders and private messages. Today they share one `error` state, so an error from one tab can replace the already-loaded content of the other tab. This is a user-visible state bug and a small source of future confusion when deeper message features are added.

## Current state

- API contract: reminders and private messages are separate paginated modules.

```md
// docs/API.md:255-279
## 4. 消息与提醒接口（只读）
GET ?version=4&module=mynotelist[&page=1]
...
GET ?version=4&module=mypm[&page=1]      // 会话列表
GET ?version=4&module=pmlist&touid=<对方uid>   // 某会话内消息(发送在v2)
```

- `MessagesScreen` stores separate lists but a single shared error:

```tsx
// src/screens/Messages.tsx:22-41
const [seg, setSeg] = React.useState<Seg>('remind');
const [lists, setLists] = React.useState<ListsState>({ remind: null, dm: null });
const [error, setError] = React.useState<string | null>(null);
const [refreshing, setRefreshing] = React.useState(false);
const [paging, setPaging] = React.useState<Seg | null>(null);

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

- Render also reads that one shared error before checking the active list:

```tsx
// src/screens/Messages.tsx:52-58 and 77-79
const active = lists[seg];
const refresh = () => load(seg, 1, true);
const loadingThis = lists[seg] === null;

{error ? <ErrorView message={error} onRetry={refresh} />
  : loadingThis ? <Loader label="加载…" />
  : (
```

Repo conventions to match:

- Keep simple screen state local to the screen; `BoardScreen` is the current exemplar for local request state.
- User-facing fallback text is Chinese and concise.
- Use Jest/React Native Testing Library for component regressions; see `__tests__/ui.smoke.test.tsx` for provider setup style.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Focused tests | `npm test -- --runInBand __tests__/messages.test.tsx` | message screen tests pass |
| Full tests | `npm test -- --runInBand` | all suites pass |

## Scope

**In scope**:

- `src/screens/Messages.tsx`
- `__tests__/messages.test.tsx` (create if absent)
- `plans/README.md` status row

**Out of scope**:

- Do not add message detail, mark-read, or send-message behavior.
- Do not change `getReminders()`, `getPMs()`, `ListResult`, `Reminder`, or `PMItem` API shapes.
- Do not restyle the messages UI.
- Do not address stale response ordering here; that is plan 012.

## Git workflow

- Branch: `fix/scope-message-tab-errors`
- Commit style: Conventional Commits, for example `fix: scope message errors per tab`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add a regression test for cross-tab errors

Create `__tests__/messages.test.tsx`.

Test the current bug:

1. Mock `getReminders()` to resolve one reminder item.
2. Mock `getPMs()` to reject with a visible error message.
3. Render `MessagesScreen` with the minimal providers needed by `useNav()` and `useTheme()`; model the provider style after `__tests__/ui.smoke.test.tsx`.
4. Wait for the reminder text.
5. Press the `私信` tab and wait for the private-message error.
6. Press the `提醒` tab and assert the reminder text is visible and the private-message error is not visible.

Do not use real network.

**Verify**: `npm test -- --runInBand __tests__/messages.test.tsx` -> the new test should fail before the implementation because the shared error hides reminders.

### Step 2: Replace the shared error with per-tab errors

In `src/screens/Messages.tsx`, replace:

```ts
const [error, setError] = React.useState<string | null>(null);
```

with a keyed shape, for example:

```ts
type ErrorsState = Record<Seg, string | null>;
const [errors, setErrors] = React.useState<ErrorsState>({ remind: null, dm: null });
```

Inside `load(which, ...)`:

- Clear only the target tab's error before fetching:
  `setErrors((prev) => ({ ...prev, [which]: null }));`
- On initial-load failure for that tab, set only `errors[which]`.
- If that tab already had data, keep the existing toast behavior and leave rendered content intact.

Then derive:

```ts
const activeError = errors[seg];
```

and render `activeError` instead of the old shared `error`.

**Verify**: `npm run typecheck` -> exit 0.

### Step 3: Keep retry behavior tab-local

Make sure `refresh` still calls `load(seg, 1, true)` and `ErrorView onRetry` retries only the active tab. Do not clear the other tab's error when retrying this one; switching tabs should show each tab's own current state.

**Verify**: `npm test -- --runInBand __tests__/messages.test.tsx` -> focused tests pass.

### Step 4: Run full gates and update status

Run all gates. If they pass and only in-scope files changed, update plan 011 in `plans/README.md` from TODO to DONE.

**Verify**:

- `npm run typecheck` -> exit 0.
- `npm test -- --runInBand` -> all suites pass.
- `git status --short` -> only `src/screens/Messages.tsx`, `__tests__/messages.test.tsx`, and `plans/README.md` are modified.

## Test plan

- New focused component test in `__tests__/messages.test.tsx`.
- Cases: reminders can render after the private-message tab fails; retry uses the active tab; existing loaded tab errors still toast rather than replacing content.
- Existing full suite must still pass.

## Done criteria

- [ ] Error state is keyed per message segment.
- [ ] A private-message initial-load error no longer hides already-loaded reminders after switching back.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test -- --runInBand` exits 0.
- [ ] `plans/README.md` status row for 011 is updated.

## STOP conditions

Stop and report back if:

- `MessagesScreen` has already been refactored to a different state model and the excerpts no longer match.
- The test requires adding production-only test hooks or changing user-visible labels.
- Fixing this appears to require changing API functions or global navigation behavior.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Plan 012 builds on this by adding stale-response guards to `MessagesScreen`. Reviewers should keep these concerns separate: this plan scopes which tab owns an error; plan 012 decides which network response is still current.
