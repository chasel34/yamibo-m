# Plan 002: Persist native session cookies consistently with the Discuz CookieJar contract

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report instead of improvising. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 59697b2..HEAD -- src/sessionCookies.ts src/api.ts docs/API.md package.json scripts`
> If any in-scope file changed since this plan was written, compare the excerpts below against the live code before proceeding. If they no longer match, stop and report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-add-test-baseline.md`
- **Category**: bug
- **Planned at**: commit `59697b2`, 2026-06-21

## Why this matters

The project documentation says native auth is CookieJar-based and that `sid` plus risk-control cookies may be required after first contact with the site. The current persistence layer stores only `cookiepre`, `auth`, and `saltkey`, then recreates those two cookies with a fresh 30-day expiry on every hydrate. That can make cold-start login restore less reliable and can drift from server-issued cookie lifetime.

## Current state

- `docs/API.md:53-60` says the app should use a persistent CookieJar and preserve `auth`, `saltkey`, `sid`, `acw_tc`, and `cdn_sec_tc` as needed.
- `src/sessionCookies.ts:8-13` stores only:

```ts
interface StoredDiscuzSession {
  cookiepre: string;
  auth: string;
  saltkey: string;
  savedAt: number;
}
```

- `src/sessionCookies.ts:50-78` writes only `${cookiepre}auth` and `${cookiepre}saltkey`.
- `src/sessionCookies.ts:103-120` hydrates stored sessions without checking `savedAt`.
- `src/api.ts:184-228` calls `hydrateSessionCookies()` before requests and `persistSessionCookies(json.Variables)` after JSON responses.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0 |
| Existing parser verifier | `npm run verify:richtext` | exit 0 |

## Scope

**In scope**:
- `src/sessionCookies.ts`
- `src/api.ts` only if needed to pass response/cookie metadata into the session layer
- `scripts/verify-session-cookies.mjs` or equivalent tests created by plan 001
- `docs/API.md` only for a small clarification if behavior intentionally differs

**Out of scope**:
- Do not change login UI.
- Do not implement multi-account switching.
- Do not store raw usernames/passwords.
- Do not change `tools/proxy.js`; web proxy cookie behavior is handled by plan 005.

## Git workflow

- Branch: `fix/native-session-cookies`
- Commit style: Conventional Commits, for example `fix: persist native session cookie jar`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add session tests before changing behavior

Using the baseline from plan 001, add tests for the session persistence helpers. If the production module is hard to import because of React Native dependencies, factor pure helpers inside `src/sessionCookies.ts` and export them through a narrow `__private` object.

Cover:
- valid stored sessions hydrate when not expired,
- malformed stored JSON is rejected,
- sessions older than the intended TTL are removed or ignored,
- additional cookies such as `${cookiepre}sid`, `acw_tc`, and `cdn_sec_tc` can be preserved without exposing secret values in test output.

**Verify**: `npm test` -> fails before the implementation change if the test expresses missing behavior, then passes after later steps.

### Step 2: Expand stored session shape

Replace the minimal stored shape with a versioned shape that can hold a list or map of cookies. Keep backwards compatibility with the existing `{ cookiepre, auth, saltkey, savedAt }` format by migrating it on read.

Target shape example:

```ts
interface StoredDiscuzSession {
  version: 2;
  cookiepre: string;
  cookies: Array<{ name: string; value: string; domain?: string; path?: string; expires?: string; secure?: boolean; httpOnly?: boolean }>;
  savedAt: number;
}
```

Keep `auth` and `saltkey` present in the cookie list. Preserve only cookies for `bbs.yamibo.com` or the Discuz cookie prefix plus known risk-control names. Do not persist unrelated cookies.

**Verify**: `npm run typecheck` -> exits 0.

### Step 3: Persist all relevant cookies available from login/API responses

If the native cookie manager can read cookies for `HOST` after a response, update `persistSessionCookies()` to capture the native CookieJar after successful logged-in responses. If that API is not available or unreliable, at minimum persist the response-derived `auth`/`saltkey` and keep the code structured so future `sid`/risk-control cookies can be added when observed.

Preserve the documented behavior: login remains HTTPS-only, no password storage, cookies go through `expo-secure-store`.

**Verify**: `npm run typecheck` -> exits 0.

### Step 4: Honor expiry and age on hydrate

During `hydrateStoredSession()`, reject stored sessions that are older than `COOKIE_TTL_MS` or whose persisted cookie expiry is in the past. Remove rejected sessions from SecureStore and AsyncStorage. Do not refresh cookie expiry merely by hydrating stale data.

**Verify**: `npm test` -> session tests pass.

### Step 5: Keep logout cleanup complete

Ensure `clearSessionCookies()` still removes SecureStore, legacy AsyncStorage, in-memory fingerprint, and native CookieManager data on both Android and iOS. Keep the existing Android `flush()` behavior.

**Verify**: `npm run typecheck && npm test` -> both exit 0.

## Test plan

Add tests for pure validation/migration/writing-shape helpers. Mocking `SecureStore` and `CookieManager` is optional; prefer pure helper coverage over brittle module mocking. If manual device validation is available, verify Android cold start after login still calls `checkAuth()` successfully, but do not make that a CI dependency.

## Done criteria

- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` exits 0.
- [ ] Existing legacy stored sessions migrate or remain readable.
- [ ] Stored sessions older than `COOKIE_TTL_MS` are ignored/removed.
- [ ] No secret cookie values are printed in logs, tests, or docs.
- [ ] `plans/README.md` status row for plan 002 is updated.

## STOP conditions

Stop and report if:
- The cookie manager library cannot read native cookies and preserving `sid`/risk-control cookies would require a new dependency.
- Expo SecureStore cannot store the expanded shape on target platforms.
- The fix would require changing login UX or storing credentials.

## Maintenance notes

Reviewers should scrutinize privacy and migration behavior. A committed session format change is long-lived; keep the versioned schema small and document any intentional limitation against `docs/API.md`.
