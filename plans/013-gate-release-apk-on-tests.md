# Plan 013: Gate Android release builds on the Jest suite

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`
> unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat afb1985..HEAD -- .github/workflows/release-android.yml .github/workflows/typecheck.yml package.json eas.json plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `plans/001-add-test-baseline.md`
- **Category**: tests
- **Planned at**: commit `afb1985`, 2026-06-28

## Why this matters

Pull requests and pushes to `main` run both typecheck and Jest, but the tag-triggered Android APK release workflow runs only typecheck before spending an EAS build. That allows a tested regression to be caught in PR CI but missed during a direct tag release. The workflow also invokes `npx eas-cli@latest`, which makes release behavior depend on whatever version is current at execution time.

## Current state

- PR/main CI runs tests:

```yaml
# .github/workflows/typecheck.yml:32-36
- name: Typecheck
  run: npm run typecheck

- name: Test
  run: npm test -- --runInBand
```

- Android release CI does not:

```yaml
# .github/workflows/release-android.yml:35-47
- name: Typecheck
  run: npm run typecheck

- name: Check Expo token
  run: |
    if [ -z "$EXPO_TOKEN" ]; then
      echo "Missing EXPO_TOKEN repository secret."
      exit 1
    fi

- name: Build Android APK with EAS
  run: |
    npx eas-cli@latest build \
```

- The repo already has a Jest script:

```json
// package.json:33-36
"typecheck": "tsc --noEmit",
"test": "jest",
"test:watch": "jest --watchAll",
"verify:richtext": "jest --runInBand __tests__/util.parseMessage.test.ts"
```

- EAS version floor is documented in `eas.json`:

```json
// eas.json:2-5
"cli": {
  "version": ">= 16.0.1",
  "appVersionSource": "local"
}
```

Repo conventions to match:

- CI uses npm, not pnpm or yarn.
- Release is tag-triggered only; `CLAUDE.md` says `main` merges do not automatically build APKs.
- Keep workflow changes minimal.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Tests | `npm test -- --runInBand` | all suites pass |
| Workflow syntax sanity | `git diff --check -- .github/workflows/release-android.yml` | no whitespace errors |

## Scope

**In scope**:

- `.github/workflows/release-android.yml`
- `plans/README.md` status row

**Optional in scope only if you choose to pin EAS through npm dependencies**:

- `package.json`
- `package-lock.json`

**Out of scope**:

- Do not change EAS build profiles in `eas.json`.
- Do not trigger or watch a real EAS build.
- Do not change release notes body content.
- Do not require secrets for local verification.

## Git workflow

- Branch: `ci/gate-release-on-tests`
- Commit style: Conventional Commits, for example `ci: gate android release on tests`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add Jest before token check and EAS build

In `.github/workflows/release-android.yml`, add a test step immediately after typecheck:

```yaml
- name: Test
  run: npm test -- --runInBand
```

This should happen before `Check Expo token` so missing tests fail before checking release credentials, and before the paid/remote EAS build starts.

**Verify**:

- `git diff --check -- .github/workflows/release-android.yml` -> no whitespace errors.
- `npm test -- --runInBand` -> all suites pass locally.

### Step 2: Pin the EAS CLI invocation

Replace `npx eas-cli@latest build \` with a deterministic version. Prefer the smallest change:

```yaml
npx eas-cli@16.0.1 build \
```

Rationale: `eas.json` already says the CLI must be `>= 16.0.1`, and the workflow currently downloads via `npx` anyway. This avoids editing `package-lock.json`.

If `16.0.1` is known not to work in the executor environment, STOP and report with the observed error. Do not substitute a random newer version without maintainer approval.

**Verify**: `git diff --check -- .github/workflows/release-android.yml` -> no whitespace errors.

### Step 3: Run full local gates and update status

Run local gates. If they pass and only in-scope files changed, update plan 013 in `plans/README.md` from TODO to DONE.

**Verify**:

- `npm run typecheck` -> exit 0.
- `npm test -- --runInBand` -> all suites pass.
- `git status --short` -> only `.github/workflows/release-android.yml` and `plans/README.md` are modified, unless you intentionally chose the optional npm dependency route.

## Test plan

- No new Jest test is needed; this plan wires the existing suite into release CI.
- Local validation is workflow diff sanity plus the exact commands the workflow will run before EAS.

## Done criteria

- [ ] Release workflow runs `npm test -- --runInBand` after typecheck and before EAS build.
- [ ] Release workflow no longer uses `eas-cli@latest`.
- [ ] `npm run typecheck` exits 0.
- [ ] `npm test -- --runInBand` exits 0.
- [ ] `plans/README.md` status row for 013 is updated.

## STOP conditions

Stop and report back if:

- The release workflow has already been restructured and the excerpts no longer match.
- Pinning `eas-cli@16.0.1` is known to break this Expo SDK/release profile.
- A real EAS build would be required to verify the change.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

If the team later upgrades Expo/EAS and needs a newer CLI, update the pinned CLI and `eas.json` together in one PR. Keep release CI at least as strict as PR CI for checks that do not require secrets.
