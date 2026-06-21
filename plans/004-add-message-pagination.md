# Plan 004: Add pagination to reminders and private messages

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report instead of improvising. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 59697b2..HEAD -- src/api.ts src/screens/Messages.tsx src/components/ui.tsx src/types.ts scripts`
> If any in-scope file changed since this plan was written, compare the excerpts below against the live code before proceeding. If they no longer match, stop and report.

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: `plans/001-add-test-baseline.md`
- **Category**: bug
- **Planned at**: commit `59697b2`, 2026-06-21

## Why this matters

The messages tab has two independent lists: reminders and private messages. Both API functions accept `page`, but the screen only fetches page 1. This means older reminders and older DM conversations become inaccessible even when the API reports a larger total count.

## Current state

- `src/api.ts:618-629` maps reminders and returns `{ list, count }`.
- `src/api.ts:633-642` maps private messages and returns `{ list, count }`.
- `src/screens/Messages.tsx:27-38` fetches `SEGS[which].fetch(1)` for every load.
- `src/screens/Messages.tsx:20-23` stores only arrays, not page metadata:

```ts
const [lists, setLists] = React.useState<{ remind: any[] | null; dm: any[] | null }>({ remind: null, dm: null });
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0 |

## Scope

**In scope**:
- `src/api.ts`
- `src/screens/Messages.tsx`
- `src/types.ts` only if `ListResult` needs optional pagination fields
- Test/verifier scripts from plan 001

**Out of scope**:
- Do not implement mark-as-read.
- Do not implement private-message conversation detail.
- Do not add push notifications.
- Do not change bottom tab unread count behavior.

## Git workflow

- Branch: `fix/message-pagination`
- Commit style: Conventional Commits, for example `fix: paginate message lists`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add mapper tests for reminder and PM metadata

Extend the API mapper tests from plan 001 so fake `mynotelist` and `mypm` payloads expose count and per-page metadata. Use the same fallback convention as collections: if `perpage` is missing, derive from list length or 20.

**Verify**: `npm test` -> the new tests fail before mapper changes, then pass after Step 2.

### Step 2: Return pagination metadata from `getReminders` and `getPMs`

Update both functions to include `page`, `perpage`, and `totalPages` in their returned `ListResult`, or whatever shape plan 003 introduced. Keep list item shapes unchanged.

Use defensive parsing:

```ts
const perpage = asPositiveInt(v.perpage, list.length || 20);
const count = asInt(v.count, list.length);
const totalPages = count > 0 ? Math.max(1, Math.ceil(count / perpage)) : 1;
```

**Verify**: `npm run typecheck` -> exits 0.

### Step 3: Store per-segment pagination state

Change `MessagesScreen` state from bare arrays to per-segment result objects. For example:

```ts
type MessageListState = {
  remind: ListResult<Reminder> | null;
  dm: ListResult<PMItem> | null;
};
```

Keep separate page state per segment so switching from reminders to DMs preserves the current page already loaded.

**Verify**: `npm run typecheck` -> exits 0.

### Step 4: Add `Pager` per active segment

Add a `Pager` below the rendered active list when `totalPages > 1`. It should call `load(seg, targetPage)` and disable pointer events while paging. Pull-to-refresh should reload page 1 for the active segment and reset that segment’s page to 1.

Keep the existing segmented UI and empty states.

**Verify**: `npm test` -> exits 0.

## Test plan

Add mapper tests for:
- reminders with `count > perpage`,
- private messages with `count > perpage`,
- missing `perpage`,
- empty lists.

Manual check: with an account that has multiple pages of reminders or PMs, switch segments and confirm each segment keeps its own pagination state.

## Done criteria

- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` exits 0.
- [ ] Reminder list can navigate beyond page 1.
- [ ] PM list can navigate beyond page 1.
- [ ] Segment switching does not lose the already loaded page for the other segment.
- [ ] Mark-as-read and conversation detail remain untouched.
- [ ] `plans/README.md` status row for plan 004 is updated.

## STOP conditions

Stop and report if:
- The Discuz reminder or PM payload does not expose any count/per-page signal.
- The change requires implementing message detail or mark-as-read.
- Shared `Pager` cannot be reused without a broader component redesign.

## Maintenance notes

This plan should use the same `ListResult` pagination shape as plan 003. If plan 003 has not landed, coordinate the shared type first instead of creating a second incompatible shape.
