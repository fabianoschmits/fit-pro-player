# Offline Account Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adopt offline data into a newly created Supabase account, synchronize account snapshots continuously, delete accounts safely from Settings, and show navigation for authenticated users.

**Architecture:** Keep anonymous and account caches isolated. Add a caller-only Supabase deletion RPC; never expose service credentials. Reuse the existing CAS snapshot and association modules, adding automatic adoption only for the unambiguous anonymous-only case and remote pull only for clean local state.

**Tech Stack:** React, Zustand, Supabase Auth/PostgreSQL, Vite, Vitest, SQL migration tests.

**Spec:** `docs/superpowers/specs/2026-09-23-offline-account-lifecycle-design.md`

## Global Constraints

- Anonymous data is cleared only after a confirmed first account snapshot upload.
- Existing account/cloud conflicts remain non-destructive and user-selectable.
- Browser code must never use `service_role` or private Supabase variables.
- Account deletion must require authenticated server-side authorization and online connectivity.
- No design or workout-domain changes outside this lifecycle are allowed.

## Review Focus

- Offline anonymous data plus brand-new account adopts exactly once and does not duplicate or lose the device copy before upload confirmation.
- Existing account/cloud data still uses the conflict flow and is never silently overwritten.
- Remote-ahead clean snapshots restore locally; dirty local snapshots remain protected.
- Authenticated navigation appears after onboarding while public Landing and onboarding stay menu-free.
- Account deletion failure/offline state preserves recoverable data and does not claim success.

---

### Task 1: Add the server-side account deletion contract

**Files:**
- Create: `supabase/migrations/202609240007_account_lifecycle.sql`
- Create: `supabase/tests/202609240007_account_lifecycle.sql`
- Create: `scripts/check-account-lifecycle-migration.test.mjs`

**Interfaces:**
- Produces `public.delete_my_account()` returning `void` for `authenticated` callers.

- [ ] Write migration assertions first for fixed search path, `auth.uid()`, delete of only the caller, and authenticated-only execute grant.
- [ ] Run the focused migration test and confirm it fails because the migration is absent.
- [ ] Add the SQL function with `security definer`, `set search_path = public, auth, pg_temp`, null caller rejection, and `delete from auth.users where id = auth.uid()`.
- [ ] Revoke public/anon execute and grant execute only to authenticated.
- [ ] Add pgTAP checks for function existence, security definer, search path, authenticated execute, anonymous denial, and cascaded ownership constraints.
- [ ] Run focused checks and commit `feat: add self-service account deletion contract`.

### Task 2: Make authentication expose safe account deletion

**Files:**
- Modify: `frontend/src/auth/AuthProvider.jsx`
- Test: `frontend/src/auth/AuthProvider.test.jsx`
- Modify: `frontend/src/auth/auth-errors.js`
- Modify: `frontend/src/locales/pt.js` and synchronized locale packs as required by i18n checks.

**Interfaces:**
- Adds `auth.deleteAccount()` returning `{ kind: 'success' }` or the existing mapped error result.

- [ ] Add a failing provider test for RPC success followed by local sign-out, RPC failure preserving the authenticated state, and offline rejection.
- [ ] Implement `deleteAccount` through `client.rpc('delete_my_account')`, then `client.auth.signOut({ scope: 'local' })`, and update provider state only after the RPC succeeds.
- [ ] Add an explicit mapped error for offline/account deletion failure and localized user-facing copy.
- [ ] Run AuthProvider tests and then the complete frontend test suite.
- [ ] Commit `feat: expose authenticated account deletion`.

### Task 3: Adopt anonymous cache automatically and synchronize clean remote state

**Files:**
- Modify: `frontend/src/store/useStore.js`
- Modify: `frontend/src/lib/account-association.js`
- Modify: `frontend/src/App.jsx`
- Test: `frontend/src/lib/account-association.test.js`
- Test: `frontend/src/lib/account-sync.test.js`
- Test: `frontend/src/store/useStore.cache-isolation.test.js`
- Test: `frontend/src/App.auth.test.jsx`

**Interfaces:**
- Adds a store operation to clear only the anonymous cache after successful adoption.
- Keeps `createAccountSyncService` CAS behavior and applies `REMOTE_AHEAD` snapshots only for clean local metadata.

- [ ] Add failing tests for anonymous-only automatic adoption eligibility, preservation before upload success, anonymous cache clearing after success, and remote-ahead classification.
- [ ] Add the minimal anonymous cache clearing operation using normalized `DEF`, without touching the active account scope.
- [ ] In the authenticated association effect, automatically apply `USE_DEVICE` only for anonymous-only + empty account + absent remote; upload with expected revision `0`; clear anonymous cache only on `IN_SYNC`.
- [ ] On `REMOTE_AHEAD` with clean metadata, replace account state with the validated remote payload and persist the remote revision; keep dirty local state in conflict handling.
- [ ] Add guarded in-flight association handling so Auth/session rerenders cannot duplicate adoption uploads.
- [ ] Update app navigation guards to preserve the approved Landing/onboarding behavior while allowing account sync after authentication.
- [ ] Run focused association/sync/store/App tests, then the full frontend suite.
- [ ] Commit `feat: adopt offline data into authenticated accounts`.

### Task 4: Wire Settings reset to local reset or full account deletion

**Files:**
- Modify: `frontend/src/views/Settings.jsx`
- Test: `frontend/src/views/Settings.auth.test.jsx`
- Modify: `frontend/src/components/TabBar.jsx`
- Test: `frontend/src/components/TabBar.test.jsx`

**Interfaces:**
- Guest reset clears device data and returns to Landing.
- Authenticated reset calls `auth.deleteAccount()` first; on success clears local caches and returns to Landing; on failure retains data and reports the error.

- [ ] Add failing tests for authenticated reset success/failure, guest reset, and TabBar rendering for authenticated completed accounts.
- [ ] Implement account-aware Settings reset with confirmation, online-safe deletion result handling, local cache cleanup, session reset, and Landing navigation.
- [ ] Change TabBar visibility guard from guest-only to authenticated-or-guest while retaining the onboarding guard.
- [ ] Run Settings and TabBar tests.
- [ ] Commit `feat: complete account reset and authenticated navigation`.

### Task 5: Full verification, migration dry run, and production publication

**Files:**
- Modify: `scripts/check-supabase-boundaries.test.mjs` and `scripts/check-supabase-boundaries.mjs` only if the new migration needs required-file coverage.

- [ ] Run `npm test` and confirm zero failures.
- [ ] Run `npm run build` and confirm exit code 0.
- [ ] Run `npm --prefix frontend run check:i18n` and confirm all locale packs are synchronized.
- [ ] Run `npm run check:supabase` and `git diff --check`.
- [ ] Review the complete diff against `origin/main` for scope, deletion safety, mobile/desktop navigation, dark/light themes, and offline behavior.
- [ ] Link the Supabase project and run only the approved migration dry-run before applying; inspect the exact SQL operations.
- [ ] Apply the migration only if the dry-run contains the intended lifecycle function and no unexpected destructive operation.
- [ ] Run hosted smoke tests for account creation, offline adoption, authenticated navigation, sync, and account deletion using disposable QA accounts.
- [ ] Commit any verified fixes, push `main`, wait for Vercel `READY`, and verify `www.fitpp.com.br`.
