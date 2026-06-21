# Plan 005: Constrain the dev proxy URL helpers

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report instead of improvising. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 59697b2..HEAD -- tools/proxy.js src/api.ts src/util.ts package.json scripts README.md CLAUDE.md`
> If any in-scope file changed since this plan was written, compare the excerpts below against the live code before proceeding. If they no longer match, stop and report.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/001-add-test-baseline.md`
- **Category**: security
- **Planned at**: commit `59697b2`, 2026-06-21

## Why this matters

`tools/proxy.js` is a dev-only CORS and cookie proxy for Expo web verification. It currently sets `Access-Control-Allow-Origin: *` and exposes `__image` / `__resolve` helpers that fetch any `http(s)` URL. If a developer has the proxy running, a browser page can potentially use localhost as an open fetcher. The proxy only needs to support the forum host and forum assets, so it should reject unrelated origins.

## Current state

- `CLAUDE.md:11-16` says web verification uses `npm run proxy` on port 8089 because browsers cannot call the forum API directly.
- `tools/proxy.js:19` sets `TARGET = 'https://bbs.yamibo.com'`.
- `tools/proxy.js:97-100` sends wildcard CORS:

```js
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

- `tools/proxy.js:105-123` accepts arbitrary `http(s)` URLs for `__image` and `__resolve`.
- `src/api.ts:1-3` says native talks directly to the forum; only web uses the local proxy.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test` | exit 0 |
| Proxy smoke | `npm run proxy` | starts and logs forwarding target |

## Scope

**In scope**:
- `tools/proxy.js`
- New proxy verifier script under `scripts/`, for example `scripts/verify-proxy-rules.mjs`
- `package.json` if adding a verifier script to `npm test`
- README/CLAUDE docs only for a short note if behavior changes for developers

**Out of scope**:
- Do not replace the proxy with a backend.
- Do not change native API requests.
- Do not remove image proxying for legitimate forum images.
- Do not add authentication to the dev proxy unless host restrictions are insufficient.

## Git workflow

- Branch: `fix/dev-proxy-url-allowlist`
- Commit style: Conventional Commits, for example `fix: constrain dev proxy URL helpers`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Extract URL allowlist helpers

In `tools/proxy.js`, add small helper functions near `TARGET`:

```js
function isAllowedProxyUrl(input) {
  const url = new URL(input);
  return url.origin === TARGET;
}
```

If legitimate image URLs can come from known Discuz CDN/static domains, encode that as a small explicit allowlist and document why each host is allowed. Do not allow arbitrary private-network or public origins.

**Verify**: `node -c tools/proxy.js` -> exits 0.

### Step 2: Apply allowlist to `__image` and `__resolve`

After parsing the `url` query parameter, reject disallowed origins with HTTP 400. Keep existing behavior for valid `bbs.yamibo.com` URLs. Ensure invalid URL parsing does not crash the process.

**Verify**: `node -c tools/proxy.js` -> exits 0.

### Step 3: Consider CORS origin narrowing

Replace wildcard CORS with a development allowlist if it does not break Expo web. A safe middle ground:
- allow missing `Origin` headers,
- allow `http://localhost:8085`, `http://127.0.0.1:8085`, and the Expo web port actually used by `npm run web`,
- reject or omit CORS for other origins.

If Expo web uses a variable port in this repo, keep wildcard CORS but add strict URL allowlisting from Steps 1-2. Do not break the documented `npm run proxy` + `npm run web` flow.

**Verify**: Start proxy and web manually if available; otherwise document why CORS narrowing was skipped.

### Step 4: Add proxy rule tests

Create `scripts/verify-proxy-rules.mjs` or extend an existing verifier. Prefer exporting pure helpers from `tools/proxy.js` only when `require.main !== module` is handled so importing the file does not start the server.

Test:
- `https://bbs.yamibo.com/...` is allowed,
- unrelated public hosts are rejected,
- loopback/private-network URLs are rejected,
- malformed URLs are rejected without throwing uncaught errors.

Wire this verifier into `npm test`.

**Verify**: `npm test` -> exits 0.

## Test plan

Automated tests should cover the pure allowlist helpers. Manual smoke:

1. Start `npm run proxy`.
2. Request a valid forum API URL through the app or curl.
3. Request `/__image?url=https%3A%2F%2Fexample.com%2Fimage.png` and confirm HTTP 400.
4. Request `/__resolve?url=https%3A%2F%2Fexample.com%2F` and confirm HTTP 400.

## Done criteria

- [ ] `npm run typecheck` exits 0.
- [ ] `npm test` exits 0 and includes proxy rule coverage.
- [ ] `node -c tools/proxy.js` exits 0.
- [ ] `__image` rejects non-allowlisted origins.
- [ ] `__resolve` rejects non-allowlisted origins.
- [ ] Documented web verification flow still works.
- [ ] `plans/README.md` status row for plan 005 is updated.

## STOP conditions

Stop and report if:
- Legitimate forum images are served from many unpredictable third-party hosts.
- Expo web cannot function unless wildcard CORS remains enabled and URL allowlisting cannot be added.
- Testing proxy helpers requires starting network listeners in CI.

## Maintenance notes

Keep the proxy explicitly dev-only. If future features need third-party image proxying, add hosts intentionally with comments and tests; do not return to arbitrary URL forwarding.
