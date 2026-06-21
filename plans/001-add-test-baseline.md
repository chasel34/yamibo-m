# Plan 001: Install a full Jest-based test framework for API, reader, and React Native behavior

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report instead of improvising. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 59697b2..HEAD -- package.json package-lock.json scripts src __tests__ jest.config.* .github/workflows/typecheck.yml`
> If any in-scope file changed since this plan was written, compare the excerpts below against the live code before proceeding. If they no longer match, stop and report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `59697b2`, 2026-06-21

## Why this matters

This repo currently has a working TypeScript gate and one custom rich-text verifier, but no complete test framework. The next plans need confidence around runtime behavior: Discuz API mapping, native session persistence, pagination state, proxy URL validation, and reader indexing. A real test framework should support pure TypeScript unit tests, mocked API/session tests, and React Native component tests, not just one-off Node verifier scripts.

This plan intentionally introduces the Expo-supported Jest stack: `jest`, `jest-expo`, `@types/jest`, and `@testing-library/react-native`. Expo’s current testing docs recommend installing those packages with `npx expo install ... --dev` and configuring Jest with the `jest-expo` preset.

## Current state

- `package.json` defines `typecheck` and `verify:richtext`, but no `test` script:

```json
// package.json:25
"scripts": {
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web",
  "proxy": "node tools/proxy.js",
  "typecheck": "tsc --noEmit",
  "verify:richtext": "node scripts/verify-richtext.mjs"
}
```

- `.github/workflows/typecheck.yml` runs `npm ci` and `npm run typecheck`, but does not run runtime or component tests.
- `scripts/verify-richtext.mjs` contains valuable parser fixtures. Keep those cases, but migrate them into Jest tests so future tests use one runner.
- `CLAUDE.md` says `request()` returning `any` in `src/api.ts` is intentional; do not turn this into a TypeScript strictness refactor.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install current dependencies | `npm ci` | exit 0 |
| Add test framework | `npx expo install jest-expo jest @types/jest @testing-library/react-native -- --dev` | exit 0 and updates `package.json` / `package-lock.json` |
| Typecheck | `npm run typecheck` | exit 0, no TypeScript errors |
| Existing rich text verifier before migration | `npm run verify:richtext` | exit 0, prints 7 passing cases |
| New test gate | `npm test -- --runInBand` | exit 0 |

## Scope

**In scope**:
- `package.json`
- `package-lock.json`
- New Jest config, preferably `jest.config.js`, or `package.json` `jest` field if that stays clearer
- New tests under `__tests__/` or colocated `*.test.ts` / `*.test.tsx` files; choose one convention and document it in this plan’s implementation notes
- `scripts/verify-richtext.mjs`, either kept as a legacy script or superseded by Jest tests
- `.github/workflows/typecheck.yml`
- Tiny, narrow `__private` test exports from modules when pure helpers are otherwise impossible to reach

**Out of scope**:
- Do not refactor app behavior beyond tiny testability seams.
- Do not add Detox/Appium/E2E in this plan.
- Do not snapshot large UI trees.
- Do not call the live forum API in tests.
- Do not change Metro/Babel runtime behavior unless `jest-expo` requires a Jest-only transform setting.

## Git workflow

- Branch: `test/jest-baseline`
- Commit style: Conventional Commits, for example `test: add jest testing baseline`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Install the Expo-supported Jest stack

Run:

```bash
npx expo install jest-expo jest @types/jest @testing-library/react-native -- --dev
```

This should update `package.json` and `package-lock.json`. Do not hand-edit dependency versions first; let Expo choose compatible versions for the installed SDK.

**Verify**: `npm run typecheck` -> exits 0 after install.

### Step 2: Configure Jest for Expo and TypeScript

Add a Jest config. Preferred `jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js)', '**/?(*.)+(test|spec).(ts|tsx|js)'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
};
```

Create `test/setup.ts` for shared mocks only if needed. Keep it minimal. Add `"test": "jest"` to `package.json`. Optionally add `"test:watch": "jest --watchAll"` for local use.

**Verify**: `npm test -- --runInBand` -> exits 0 or reports “No tests found” only before Step 3. By the end of this plan it must run real tests.

### Step 3: Migrate rich-text verifier cases into Jest

Create a Jest test file such as `__tests__/util.parseMessage.test.ts`. Port all 7 cases from `scripts/verify-richtext.mjs`:

- image attachments are not downgraded to files,
- image attachments missing from `imagelist` are preserved,
- numeric entities decode high Unicode code points,
- linked images render as images,
- tables keep rows and cells,
- quotes keep attribution and source href,
- rich inline styles and links survive.

After migration, either keep `scripts/verify-richtext.mjs` for manual compatibility or change `verify:richtext` to run the targeted Jest test. Do not leave two diverging sources of truth.

**Verify**: `npm test -- --runInBand __tests__/util.parseMessage.test.ts` -> all 7 cases pass.

### Step 4: Add API mapper unit tests without network

Create tests for mapper behavior in `src/api.ts`. If current mapping is buried inside networked functions, extract narrow pure mappers or expose them via a small `__private` object. Keep production exports stable.

Cover at least:
- board mapper: missing arrays become empty lists, numeric strings parse correctly, pinned threads are excluded from normal list;
- collection mapper: `count`, `perpage`, and total-page metadata can be derived from fake `myfavthread` payloads;
- reminder/PM mapper: list items and pagination metadata can be derived from fake payloads.

Do not mock `fetch` for these tests unless absolutely necessary; prefer pure functions fed with fake Discuz `Variables` objects.

**Verify**: `npm test -- --runInBand` -> all tests pass.

### Step 5: Add reader-index unit tests

Create tests for `src/reading.ts` covering:

- linked table-of-contents posts becoming `toc-ready` indexes,
- complete scan indexes preserving every non-empty OP post,
- `stripLeadingChapterTitle` removing only the title prefix and keeping body text on the same line.

Use small inline fake `ReadingStreamPage` payloads. Do not fetch network data or touch `AsyncStorage` in these tests.

**Verify**: `npm test -- --runInBand` -> all tests pass.

### Step 6: Add one React Native component smoke test

Use `@testing-library/react-native` for one small component that is easy to render with minimal providers, for example an empty/loading state component or a pure UI component. The goal is to prove component testing works, not to exhaustively test screens.

If theme/navigation providers make even small components hard to render, add a tiny test utility wrapper in `test/render.tsx`. Keep provider mocks explicit and local.

**Verify**: `npm test -- --runInBand` -> component smoke test passes.

### Step 7: Wire tests into CI

Update `.github/workflows/typecheck.yml` to run `npm test -- --runInBand` after `npm run typecheck`. Keep `npm run typecheck` as a separate step so type errors are easy to read.

**Verify**: `npm run typecheck && npm test -- --runInBand` -> both exit 0.

## Test plan

The new framework itself is the deliverable. Required tests:

- parser tests migrated from the existing 7 rich-text fixtures,
- API mapper unit tests for board, collections, reminders, and PMs,
- reader-index unit tests,
- one React Native component smoke test using Testing Library.

All tests must be deterministic, local, and network-free.

## Done criteria

- [ ] `jest`, `jest-expo`, `@types/jest`, and `@testing-library/react-native` are installed as dev dependencies.
- [ ] Jest uses the `jest-expo` preset.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test -- --runInBand` exits 0 and runs real tests.
- [ ] The 7 existing rich-text verifier cases are represented in Jest.
- [ ] API mapper and reader-index tests exist.
- [ ] At least one React Native component test exists.
- [ ] CI runs both typecheck and Jest tests.
- [ ] No test calls the live forum API.
- [ ] `plans/README.md` status row for plan 001 is updated.

## STOP conditions

Stop and report if:

- `npx expo install` selects versions incompatible with the current Expo SDK or React 19 stack.
- Jest cannot import React Native modules without broad Babel/Metro changes.
- Tests require live network access to pass.
- Private mapper functions cannot be tested without broad production API changes.
- The fix appears to require changing app runtime behavior rather than adding testability seams.

## Maintenance notes

Future plans should add Jest coverage before changing session cookies, pagination, proxy behavior, or reader indexing. Keep tests small and focused. Prefer explicit fake Discuz payloads over snapshots or live API calls.
