# Plan 006: Close the dev proxy main forwarding allowlist gap

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report instead of improvising. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 03b455a..HEAD -- tools/proxy.js __tests__/proxy.rules.test.js plans/README.md`
> If any in-scope file changed since this plan was written, compare the excerpts below against the live code before proceeding. If they no longer match, stop and report.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/005-constrain-dev-proxy.md`
- **Category**: security
- **Planned at**: commit `03b455a`, 2026-06-27

## Why this matters

`tools/proxy.js` is explicitly a dev-only CORS and cookie proxy for Expo web verification. Plan 005 already constrained the `__image` and `__resolve` helpers, but the normal API forwarding path still resolves `req.url` directly against `TARGET` and then forwards it. In Node, protocol-relative URLs such as `//example.com/path` resolve to an external origin; because the proxy attaches its in-memory cookie jar after target construction, this path should be closed before more web-only helper behavior grows around it.

## Current state

- `tools/proxy.js` defines an allowlist helper that only accepts `TARGET`:

```js
// tools/proxy.js:48-60
function parseHttpUrl(input) {
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch (e) {
    return null;
  }
}

function isAllowedProxyUrl(input) {
  const url = typeof input === 'string' ? parseHttpUrl(input) : input;
  return !!url && ALLOWED_PROXY_ORIGINS.has(url.origin);
}
```

- The helper paths use that allowlist:

```js
// tools/proxy.js:147-163
if (req.url.startsWith('/__image?')) {
  const imageUrl = new URL(req.url, 'http://localhost').searchParams.get('url');
  if (!imageUrl || !isAllowedProxyUrl(imageUrl)) {
    writeInvalidUrl(res, 'invalid image URL');
    return;
  }
  pipeImage(imageUrl, res);
  return;
}

if (req.url.startsWith('/__resolve?')) {
  const input = new URL(req.url, 'http://localhost').searchParams.get('url');
  if (!input || !isAllowedProxyUrl(input)) {
    writeInvalidUrl(res, 'invalid URL');
    return;
  }
  resolveUrl(input, res);
  return;
}
```

- The normal API forwarding path does not use the allowlist:

```js
// tools/proxy.js:167-184
const target = new URL(req.url, TARGET);
const chunks = [];
req.on('data', (c) => chunks.push(c));
req.on('end', () => {
  const body = Buffer.concat(chunks);
  const headers = {
    'User-Agent': UA,
    'Accept': 'application/json',
    'Accept-Encoding': 'identity',
    'Referer': TARGET + '/',
    'Origin': TARGET,
  };
  if (jar.size) headers['Cookie'] = cookieHeader();
  if (req.method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Content-Length'] = Buffer.byteLength(body);
  }
  const preq = https.request(target, { method: req.method, headers }, (pres) => {
```

- Existing tests cover helper allowlisting but not the main forwarding target:

```js
// __tests__/proxy.rules.test.js:3-20
describe('dev proxy URL rules', () => {
  test('allows forum URLs', () => {
    expect(isAllowedProxyUrl('https://bbs.yamibo.com/api/mobile/index.php')).toBe(true);
  });
  // ...
});
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Syntax | `node -c tools/proxy.js` | exit 0 |
| Focused tests | `npm test -- --runInBand __tests__/proxy.rules.test.js` | proxy tests pass |
| Typecheck | `npm run typecheck` | exit 0 |
| Full tests | `npm test -- --runInBand` | all suites pass |

## Scope

**In scope**:
- `tools/proxy.js`
- `__tests__/proxy.rules.test.js`
- `plans/README.md` status row

**Out of scope**:
- Do not change native API behavior.
- Do not broaden allowed proxy origins beyond `https://bbs.yamibo.com`.
- Do not add network-dependent tests.
- Do not rework CORS, `__image`, or `__resolve` except as needed to share a pure URL helper.

## Git workflow

- Branch: `fix/dev-proxy-main-allowlist`
- Commit style: Conventional Commits, for example `fix: close dev proxy forwarding allowlist gap`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add a pure main-target resolver

In `tools/proxy.js`, add a small pure helper near `parseHttpUrl` / `isAllowedProxyUrl`, for example `resolveAllowedProxyTarget(reqUrl)`.

Required behavior:
- Accept normal relative API paths such as `/api/mobile/index.php?version=4&module=forumindex`.
- Resolve them against `TARGET`.
- Return `null` for malformed URLs, non-HTTP(S) schemes, protocol-relative external URLs such as `//example.com/path`, and absolute external URLs such as `https://example.com/path`.
- Return a `URL` object only when `isAllowedProxyUrl(url)` is true.

Export the helper from `module.exports` so tests can call it. Importing `tools/proxy.js` must still not start the server; preserve the existing `if (require.main === module)` guard.

**Verify**: `node -c tools/proxy.js` -> exits 0.

### Step 2: Use the resolver in the normal forwarding path

Replace `const target = new URL(req.url, TARGET);` with the new helper. If the helper returns `null`, call `writeInvalidUrl(res, 'URL is not allowed')` and return before reading request body chunks or constructing upstream headers.

Keep current behavior for valid relative forum API requests, including POST body forwarding and cookie jar behavior.

**Verify**: `node -c tools/proxy.js` -> exits 0.

### Step 3: Add pure tests for the main forwarding target

Extend `__tests__/proxy.rules.test.js` to import the new helper.

Add tests for:
- `/api/mobile/index.php?version=4&module=forumindex` resolves to origin `https://bbs.yamibo.com`.
- `//example.com/api/mobile/index.php` is rejected.
- `https://example.com/api/mobile/index.php` is rejected.
- `javascript:alert(1)` or another non-HTTP(S) scheme is rejected.

Keep the existing helper tests unchanged.

**Verify**: `npm test -- --runInBand __tests__/proxy.rules.test.js` -> all proxy rule tests pass.

### Step 4: Run repo gates and update status

Run the repository gates. If both pass and only in-scope files changed, update plan 006 in `plans/README.md` from TODO to DONE.

**Verify**:
- `npm run typecheck` -> exit 0.
- `npm test -- --runInBand` -> all suites pass.
- `git status --short` -> only `tools/proxy.js`, `__tests__/proxy.rules.test.js`, and `plans/README.md` are modified.

## Test plan

- Add focused pure unit tests in `__tests__/proxy.rules.test.js`.
- Do not start a real proxy server in Jest.
- Do not call the public internet.
- Run `node -c tools/proxy.js`, focused proxy tests, full Jest, and typecheck.

## Done criteria

- [ ] Normal relative API proxy URLs still resolve to `https://bbs.yamibo.com`.
- [ ] Protocol-relative and absolute external main proxy URLs are rejected before upstream request construction.
- [ ] Existing `__image` and `__resolve` allowlist behavior remains covered.
- [ ] `node -c tools/proxy.js` exits 0.
- [ ] `npm test -- --runInBand __tests__/proxy.rules.test.js` passes.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test -- --runInBand` exits 0.
- [ ] `plans/README.md` status row for plan 006 is updated to DONE.

## STOP conditions

Stop and report if:
- The normal web app sends absolute or protocol-relative same-origin URLs that the helper would reject.
- Closing the target resolver requires changing `src/api.ts` or the documented `npm run proxy` + `npm run web` workflow.
- The allowlist helper behavior has drifted from the excerpts above.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Future proxy helpers should pass through the same explicit target allowlist. If the project later needs a second legitimate forum asset host, add it to `ALLOWED_PROXY_ORIGINS` with a comment and tests instead of special-casing a call site.
