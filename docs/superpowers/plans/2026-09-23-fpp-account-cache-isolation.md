# FPP Account Cache Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate the anonymous `gym_state_v1` cache from per-Supabase-user local caches so anonymous state, account A, and account B can never be loaded into one another's active Zustand store.

**Architecture:** Add one local-state scope boundary that resolves either the existing anonymous namespace or a UUID-owned authenticated namespace. The Zustand store will switch scopes explicitly before hydration, persist only through the active scope, and reject stale asynchronous loads with a generation token. Supabase Auth remains the session authority; this phase does not associate anonymous data, sync remote snapshots, change Auth, or change the database.

**Tech Stack:** React 19, Zustand 5, Supabase Auth provider already present on the Phase A branch, browser `localStorage`, the existing Capacitor Filesystem mirror, Vitest with `happy-dom`, Vite, and the existing Node boundary checks.

**Spec:** `docs/superpowers/specs/2026-09-22-fpp-account-auth-sync-design.md`

## Global Constraints

- `auth.users.id` is the only canonical identity key for a new authenticated account.
- The anonymous state remains in the compatible `gym_state_v1` context and is never silently imported into an account cache.
- Account-local cache keys include the canonical Supabase UUID and a storage schema version; email, display name, username, and timestamps are not namespaces.
- A missing authenticated cache produces an empty account context and never falls back to `gym_state_v1`.
- Logout ends the Supabase session, clears the active authenticated context, preserves the account cache, and preserves anonymous state.
- The official Supabase browser client remains responsible for session persistence, token refresh, and callback handling.
- Passwords, access tokens, refresh tokens, sessions, cookies, service keys, and database credentials never enter application state or a local cache.
- Phase B is local cache isolation only: no remote snapshot, upload, download, RLS snapshot, sync queue, conflict resolution, first association, or Supabase migration.
- Existing Phase A Supabase Auth, PKCE, CSP, legacy WebAuthn, anonymous mode, and workout behavior remain intact.
- Do not introduce IndexedDB or a new dependency; retain the existing localStorage plus Capacitor Filesystem approach unless a test proves it cannot satisfy the namespace contract.
- Do not modify historical migrations, Supabase Auth settings, Vercel environment variables, deployment configuration, or remote data.
- Do not delete or rename `gym_state_v1`; current anonymous users must retain it byte-for-byte unless a normal anonymous write changes it.
- Every implementation task ends with its focused tests, relevant full checks, a reviewable commit, and no unrelated redesign.

## Review Focus

- Missing account cache must hydrate an empty account state rather than anonymous state; pin this in Task 2 with a new-account test.
- A delayed A hydration must not overwrite B after a rapid sign-out/sign-in; pin this in Task 3 with a generation-race test.
- Corrupt or incompatible account data must be rejected without destroying the anonymous cache; pin this in Task 1 and Task 4.
- The Capacitor mirror must use the same scope contract as browser storage instead of one shared file; pin this in Task 2 with isolated mirror-path tests.
- Auth/session material must remain outside every serialized cache and every persistence path; pin this in Task 5 and the boundary test.

Hosted Auth status for this plan: **DEFERRED**. The hosted email-dependent E2E is deferred because a reliable confirmation mailbox is not configured. Do not mark it PASS or FAIL during Phase B.

### Task 1: Define and test the local scope and cache contract

**Files:**
- Create: `frontend/src/lib/local-state-scope.js`
- Create: `frontend/src/lib/local-state-scope.test.js`
- Create: `frontend/src/lib/account-cache.js`
- Create: `frontend/src/lib/account-cache.test.js`
- Modify: `frontend/src/store/useStore.js:13-78` only to consume the contract after Task 1's API is approved

**Interfaces:**
- Consumes: a nullable Supabase user id and a storage adapter implementing `getItem(key)`, `setItem(key, value)`, and `removeItem(key)`.
- Produces: `ANONYMOUS_SCOPE`, `ACCOUNT_CACHE_SCHEMA_VERSION`, `resolveLocalScope(userId)`, `storageKeyForScope(scope)`, `nativePathForScope(scope)`, `readScopedState(scope, storage)`, `writeScopedState(scope, state, storage)`, and `emptyStateForScope(scope, defaultState)`.
- The scope shape is `{ kind: 'anonymous', userId: null }` or `{ kind: 'account', userId: canonicalUuid }`. `resolveLocalScope` must reject empty, non-string, and malformed UUID values rather than inventing an identity.
- `storageKeyForScope(ANONYMOUS_SCOPE)` returns exactly `gym_state_v1`. An account key must include only a technical UUID namespace and the schema version, for example `fpp_account_cache_v1:<uuid>`; finalize the exact constant in this task and reuse it everywhere.
- A serialized account entry contains `{ ownerId, schemaVersion, state }`. `readScopedState` accepts it only when `ownerId` equals the requested UUID and `schemaVersion` is supported. Anonymous storage keeps the existing raw state shape for compatibility.
- `readScopedState` returns a discriminated result such as `{ status: 'missing', state: emptyState }`, `{ status: 'valid', state }`, or `{ status: 'invalid', state: emptyState, reason }`; it never returns data from another scope.

- [ ] **Step 1: Write failing contract tests**

```js
it('keeps anonymous storage on the legacy key', () => {
  expect(storageKeyForScope(ANONYMOUS_SCOPE)).toBe('gym_state_v1')
})

it('namespaces accounts by canonical UUID and schema version', () => {
  const scope = resolveLocalScope('72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2')
  expect(scope.kind).toBe('account')
  expect(storageKeyForScope(scope)).toBe('fpp_account_cache_v1:72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2')
  expect(storageKeyForScope(scope)).not.toContain('@')
})

it('rejects email and display-name values as account identities', () => {
  expect(() => resolveLocalScope('ana@example.com')).toThrow()
  expect(() => resolveLocalScope('Ana')).toThrow()
})

it('rejects a cache owned by another UUID', () => {
  const storage = memoryStorage({
    'fpp_account_cache_v1:72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2': JSON.stringify({
      ownerId: '11111111-1111-4111-8111-111111111111', schemaVersion: 1, state: { workouts: [{ id: 'A' }] },
    }),
  })
  const result = readScopedState(resolveLocalScope('72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2'), storage)
  expect(result.status).toBe('invalid')
  expect(result.state.workouts).toEqual([])
})

it('never serializes session material', () => {
  const raw = writeScopedState(resolveLocalScope('72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2'), {
    ...DEF, access_token: 'forbidden', refresh_token: 'forbidden', session: { access_token: 'forbidden' },
  }, memoryStorage())
  expect(raw).not.toMatch(/access_token|refresh_token|session/i)
})
```

- [ ] **Step 2: Run the focused tests and verify they fail for the missing API**

Run: `npm --prefix frontend test -- src/lib/local-state-scope.test.js src/lib/account-cache.test.js`

Expected: FAIL because the new scope and cache modules do not exist yet.

- [ ] **Step 3: Implement the smallest pure contract**

Implement UUID validation, the fixed anonymous key, the versioned UUID account key, owner/schema validation, safe JSON parsing, and a state-only serializer. Do not import Supabase, read Auth session storage, or add fallback behavior. Keep storage injection explicit so all corruption and quota paths are testable without a browser.

- [ ] **Step 4: Run focused and boundary tests**

Run: `npm --prefix frontend test -- src/lib/local-state-scope.test.js src/lib/account-cache.test.js`

Expected: PASS, including invalid JSON, missing data, incompatible version, cross-owner data, and token-field exclusion cases.

- [ ] **Step 5: Commit the contract**

```bash
git add frontend/src/lib/local-state-scope.js frontend/src/lib/local-state-scope.test.js frontend/src/lib/account-cache.js frontend/src/lib/account-cache.test.js
git commit -m "feat: define isolated local account cache contract"
```

### Task 2: Add scope-aware browser and Capacitor storage adapters

**Files:**
- Modify: `frontend/src/lib/mobile.js`
- Create: `frontend/src/lib/mobile-cache.test.js`
- Modify: `frontend/src/lib/account-cache.js`
- Modify: `frontend/src/lib/account-cache.test.js`

**Interfaces:**
- Consumes: the scope contract from Task 1.
- Produces: `nativeLoad(scope)`, `nativeSave(scope, state)`, and `nativePathForScope(scope)`; browser persistence continues through the injected storage adapter from Task 1.
- Anonymous Capacitor data continues to use a stable anonymous-compatible file name. Account files include only the validated UUID and schema version, with no email or display name. A malformed scope must not reach Filesystem.
- The adapter must preserve the current best-effort semantics: an unreadable or unavailable mirror returns `null`, while localStorage remains the usable browser source of truth.

- [ ] **Step 1: Write failing adapter tests**

```js
it('maps anonymous and two account scopes to different private files', () => {
  const a = resolveLocalScope('72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2')
  const b = resolveLocalScope('11111111-1111-4111-8111-111111111111')
  expect(nativePathForScope(ANONYMOUS_SCOPE)).not.toBe(nativePathForScope(a))
  expect(nativePathForScope(a)).not.toBe(nativePathForScope(b))
  expect(nativePathForScope(a)).toMatch(/72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2/)
})

it('does not expose email or session values in a native path', () => {
  const path = nativePathForScope(resolveLocalScope('72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2'))
  expect(path).not.toMatch(/@|access|refresh|token|session/i)
})
```

- [ ] **Step 2: Run the focused adapter tests to verify the old single-file implementation fails**

Run: `npm --prefix frontend test -- src/lib/mobile-cache.test.js`

Expected: FAIL because `nativeLoad`/`nativeSave` currently use one global `fitproplayer-state.json` path.

- [ ] **Step 3: Implement scope-aware mirror paths without changing Capacitor permissions or dependencies**

Keep the existing dynamic plugin import and private `Directory.Data`. Route every mirror read/write through `nativePathForScope(scope)`. Do not use a global delete, enumerate account contents, or put serialized session data in the mirror.

- [ ] **Step 4: Run adapter and existing mobile-related tests**

Run: `npm --prefix frontend test -- src/lib/mobile-cache.test.js src/store/useStore.test.js src/store/useStore.sync.test.js`

Expected: PASS, with the existing anonymous behavior unchanged.

- [ ] **Step 5: Commit the adapter**

```bash
git add frontend/src/lib/mobile.js frontend/src/lib/mobile-cache.test.js frontend/src/lib/account-cache.js frontend/src/lib/account-cache.test.js
git commit -m "feat: namespace the native cache mirror"
```

### Task 3: Make the Zustand store resolve, hydrate, and persist one active scope

**Files:**
- Modify: `frontend/src/store/useStore.js:13-360`
- Modify: `frontend/src/store/useStore.test.js`
- Modify: `frontend/src/store/useStore.sync.test.js`
- Create: `frontend/src/store/useStore.cache-isolation.test.js`

**Interfaces:**
- Consumes: `resolveLocalScope`, `readScopedState`, `writeScopedState`, and scope-aware native adapters from Tasks 1–2.
- Produces: store actions `activateLocalScope(userId)`, `getActiveLocalScope()`, and `boot({ legacySessionEnabled, supabaseUserId })`. Existing workout mutations continue to call `update`/`replaceState`; those methods persist only through the active scope.
- `activateLocalScope` increments a private hydration generation, resolves the identity before reading state, synchronously clears the old in-memory state, and loads only the requested scope. A missing account cache returns normalized `DEF` with no anonymous data. It must not set `gym_guest` for an authenticated scope.
- `persist` captures the scope and generation used at the beginning of the write. A late async result may update the mirror only if both still match; otherwise it is discarded. Existing remote `/api/data` calls remain disabled for Supabase account state in this phase rather than being retargeted to the wrong identity.
- `clearLegacySessionContext` must stop being a cache-clearing primitive. Legacy identity cleanup may remain, but `gym_state_v1` and account cache entries are preserved. Any old `clearLocalSession` path used by legacy flows must be isolated from normal Supabase logout and covered by explicit tests.

- [ ] **Step 1: Write failing store isolation tests**

```js
it('anonymous boot reads gym_state_v1 and preserves its serialized value', async () => {
  const anonymous = stateWithWorkout('anonymous')
  localStorage.setItem('gym_state_v1', JSON.stringify(anonymous))
  await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: null })
  expect(useStore.getState().S.workouts[0].id).toBe('anonymous')
  expect(localStorage.getItem('gym_state_v1')).toBe(JSON.stringify(anonymous))
})

it('authenticated boot does not consume anonymous state when account cache is missing', async () => {
  localStorage.setItem('gym_state_v1', JSON.stringify(stateWithWorkout('anonymous')))
  await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: USER_A })
  expect(useStore.getState().S.workouts).toEqual([])
  expect(localStorage.getItem('gym_state_v1')).toContain('anonymous')
})

it('loads only account A and keeps account B empty', async () => {
  await writeAccountCache(USER_A, stateWithWorkout('A'))
  await writeAccountCache(USER_B, stateWithWorkout('B'))
  await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: USER_A })
  expect(useStore.getState().S.workouts[0].id).toBe('A')
  await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: USER_B })
  expect(useStore.getState().S.workouts[0].id).toBe('B')
})
```

- [ ] **Step 2: Run the isolation tests to expose the global-key behavior**

Run: `npm --prefix frontend test -- src/store/useStore.cache-isolation.test.js src/store/useStore.sync.test.js`

Expected: FAIL because the current store always loads and persists `gym_state_v1` and has no authenticated namespace.

- [ ] **Step 3: Implement one active-scope boundary in the store**

Replace direct `KEY` reads/writes with the Task 1 adapter. Initialize the store with the anonymous scope for backward compatibility, then make `boot` resolve the supplied UUID before hydrating. Keep `normalizeState`, starter-plan behavior, workout persistence, reminder scheduling, and the existing `gym_dirty`/conflict semantics otherwise unchanged. Do not pass a token or Supabase session into the store.

- [ ] **Step 4: Add the complete load-bearing matrix**

Cover anonymous preservation, A-only load, B-only load, A logout preservation, B logout preservation, A→B→A restoration, missing-cache no-fallback, corrupt-cache safe empty state, incompatible schema safe empty state, unchanged `gym_state_v1`, active-workout preservation, and JSON serialization/quota failure without destructive cleanup.

- [ ] **Step 5: Run focused plus existing store tests**

Run: `npm --prefix frontend test -- src/store/useStore.cache-isolation.test.js src/store/useStore.test.js src/store/useStore.sync.test.js`

Expected: PASS with no regression in legacy sync safety tests.

- [ ] **Step 6: Commit the store boundary**

```bash
git add frontend/src/store/useStore.js frontend/src/store/useStore.test.js frontend/src/store/useStore.sync.test.js frontend/src/store/useStore.cache-isolation.test.js
git commit -m "feat: isolate Zustand state by account scope"
```

### Task 4: Make Auth boot and logout transitions select the correct scope

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/App.auth.test.jsx`
- Modify: `frontend/src/auth/AuthProvider.jsx` only if the transition callback needs a stable event boundary; preserve its public user shape and PKCE behavior
- Modify: `frontend/src/views/Settings.jsx` only to remove any remaining normal Supabase path that invokes legacy state clearing
- Create: `frontend/src/auth/local-scope-transition.test.jsx`

**Interfaces:**
- Consumes: `auth.status`, `auth.user.id`, and `auth.suppressLegacyResume` from the existing `AuthProvider`, plus `useStore().boot`/`activateLocalScope` from Task 3.
- Produces: deterministic ordering `Auth initialization → identity known → local scope selection → store hydration → route render`. The `App` boot effect must pass `{ legacySessionEnabled: ..., supabaseUserId: auth.status === 'authenticated' ? auth.user.id : null }`.
- Anonymous→A must switch to A's empty/existing cache without copying `gym_state_v1`. A→anonymous must reload the anonymous namespace without deleting A. A→B must clear active A in memory before loading B and must never use A's state during the transition.
- Supabase `AuthProvider` remains responsible for `signOut`; the store must not receive access/refresh tokens. A successful logout must trigger the anonymous scope through the normal Auth state transition. A failed logout must leave the authenticated scope active and its cache intact.

- [ ] **Step 1: Update the boot coordination tests before implementation**

```js
it('passes the canonical Supabase UUID to local boot', async () => {
  mocks.auth = { status: 'authenticated', suppressLegacyResume: false, user: { id: USER_A } }
  await act(async () => root.render(<App />))
  expect(mocks.boot).toHaveBeenCalledWith({ legacySessionEnabled: false, supabaseUserId: USER_A })
})

it('selects anonymous scope after Auth returns to anonymous', async () => {
  mocks.auth = { status: 'anonymous', suppressLegacyResume: true, user: null }
  await act(async () => root.render(<App />))
  expect(mocks.boot).toHaveBeenCalledWith({ legacySessionEnabled: false, supabaseUserId: null })
})
```

- [ ] **Step 2: Run the focused App tests and verify the old call shape fails**

Run: `npm --prefix frontend test -- src/App.auth.test.jsx`

Expected: FAIL because the current `App` passes only `legacySessionEnabled`.

- [ ] **Step 3: Implement the transition boundary**

Pass only the canonical UUID to the store. Preserve the existing suppression of legacy resume after a successful Supabase logout. Do not change callback URL construction, PKCE exchange, recovery-sheet behavior, or Auth error mapping.

- [ ] **Step 4: Add transition tests for failed logout and rapid switching**

Test that failed `auth.signOut()` leaves the active scope unchanged, successful logout returns to anonymous state without deleting either cache, and rapid A→logout→B does not render or persist A after B becomes active.

- [ ] **Step 5: Run Auth, App, Settings, and store tests**

Run: `npm --prefix frontend test -- src/auth/AuthProvider.test.jsx src/App.auth.test.jsx src/auth/local-scope-transition.test.jsx src/views/Settings.auth.test.jsx src/store/useStore.cache-isolation.test.js src/store/useStore.sync.test.js`

Expected: PASS, including the existing PKCE and failed-logout regressions.

- [ ] **Step 6: Commit the Auth transition integration**

```bash
git add frontend/src/App.jsx frontend/src/App.auth.test.jsx frontend/src/auth/AuthProvider.jsx frontend/src/auth/local-scope-transition.test.jsx frontend/src/views/Settings.jsx
git commit -m "feat: coordinate auth transitions with local cache scope"
```

### Task 5: Add corruption, version, quota, and token-boundary hardening

**Files:**
- Modify: `frontend/src/lib/account-cache.js`
- Modify: `frontend/src/lib/account-cache.test.js`
- Modify: `frontend/src/store/useStore.cache-isolation.test.js`
- Modify: `scripts/check-supabase-boundaries.mjs` only if the existing rule cannot inspect the new cache serializer without false positives
- Modify: `scripts/check-supabase-boundaries.test.mjs` with a regression fixture for the final serializer shape

**Interfaces:**
- Consumes: the stable cache serialization API from Tasks 1–4.
- Produces: explicit safe behavior for invalid JSON, wrong owner, unsupported storage schema, missing required state shape, quota failure, and non-serializable values. The application keeps the in-memory state usable and leaves the last valid serialized cache untouched when a write fails.
- Account cache content is limited to normalized workout/application state plus `ownerId` and `schemaVersion`. It must not serialize the Supabase client, Auth provider value, password, access token, refresh token, cookie, or arbitrary operation metadata.

- [ ] **Step 1: Write failing safety tests**

```js
it('does not overwrite an existing valid cache when a write exceeds quota', () => {
  const storage = throwingStorage({ existing: validAccountEntry(USER_A) })
  expect(() => writeScopedState(accountScope(USER_A), stateWithWorkout('new'), storage)).not.toThrow()
  expect(storage.value).toBe(storage.existing)
})

it('treats a future schema version as an empty account cache', () => {
  const storage = memoryStorage({ [accountKey(USER_A)]: JSON.stringify({ ownerId: USER_A, schemaVersion: 99, state: stateWithWorkout('future') }) })
  expect(readScopedState(accountScope(USER_A), storage).status).toBe('invalid')
})

it('never flags ordinary application fields as Auth material', () => {
  const source = serializeStateOnly(stateWithWorkout('A'))
  expect(source).not.toMatch(/access_token|refresh_token|password|cookie/i)
})
```

- [ ] **Step 2: Run the safety tests to verify the edge cases are uncovered**

Run: `npm --prefix frontend test -- src/lib/account-cache.test.js src/store/useStore.cache-isolation.test.js`

Expected: FAIL for at least the quota-preservation and future-schema cases if the initial implementation does not yet expose these outcomes.

- [ ] **Step 3: Implement safe rejection and non-destructive writes**

Validate before replacing in-memory state, catch storage quota/serialization errors, and return a structured failure to the store. Keep the old entry intact on failed writes. Never log raw serialized cache values or exception payloads that may contain user data.

- [ ] **Step 4: Extend the static security boundary test**

Run the repository boundary checker against the new modules and add a fixture that rejects a serializer writing `access_token` to an account key or to `gym_state_v1`, while allowing the official SDK's own persistence configuration.

- [ ] **Step 5: Run focused safety and boundary checks**

Run: `npm --prefix frontend test -- src/lib/account-cache.test.js src/store/useStore.cache-isolation.test.js`

Run: `node --test scripts/check-supabase-boundaries.test.mjs`

Expected: PASS with no private frontend environment names, token sinks, or new remote objects.

- [ ] **Step 6: Commit the hardening**

```bash
git add frontend/src/lib/account-cache.js frontend/src/lib/account-cache.test.js frontend/src/store/useStore.cache-isolation.test.js scripts/check-supabase-boundaries.mjs scripts/check-supabase-boundaries.test.mjs
git commit -m "test: harden account cache rejection boundaries"
```

### Task 6: Verify anonymous compatibility, workout behavior, and offline persistence

**Files:**
- Modify: `frontend/src/store/useStore.cache-isolation.test.js`
- Modify: `frontend/src/lib/mobile-cache.test.js`
- Modify: `frontend/src/views/Workout.test.jsx` only for a regression fixture if the store transition surface requires it
- Modify: `frontend/src/views/Settings.auth.test.jsx` for non-destructive logout assertions
- Create: `frontend/src/lib/local-cache.integration.test.js`

**Interfaces:**
- Consumes: the final scope controller, store transition API, and mobile adapter from Tasks 1–5.
- Produces: a focused regression suite proving that current anonymous users keep their state and that a cached authenticated user remains usable when the network is unavailable.

- [ ] **Step 1: Write failing integration/regression tests**

```js
it('preserves an existing anonymous workout before and after an account session', async () => {
  const before = stateWithWorkout('anonymous')
  localStorage.setItem('gym_state_v1', JSON.stringify(before))
  await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: USER_A })
  await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: null })
  expect(useStore.getState().S.workouts[0].id).toBe('anonymous')
  expect(JSON.parse(localStorage.getItem('gym_state_v1')).workouts[0].id).toBe('anonymous')
})

it('keeps account A usable offline after it has been cached', async () => {
  await writeAccountCache(USER_A, stateWithWorkout('A'))
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
  await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: USER_A })
  expect(useStore.getState().S.workouts[0].id).toBe('A')
})
```

- [ ] **Step 2: Run the regression tests and identify any behavior changed by the boundary**

Run: `npm --prefix frontend test -- src/lib/local-cache.integration.test.js src/views/Workout.test.jsx src/views/Settings.auth.test.jsx`

Expected: Any failure must identify a real compatibility issue; do not weaken isolation to make a legacy test pass.

- [ ] **Step 3: Implement only the compatibility adjustments required by the tests**

Keep workout mutation and active-workout semantics unchanged. Ensure a scope switch replaces the in-memory state before routing can expose a page, and ensure a network failure does not trigger remote legacy sync for the local-only account cache.

- [ ] **Step 4: Run the full frontend test suite**

Run: `npm --prefix frontend test`

Expected: PASS with the complete existing suite plus the Phase B isolation tests.

- [ ] **Step 5: Commit compatibility coverage**

```bash
git add frontend/src/store/useStore.cache-isolation.test.js frontend/src/lib/mobile-cache.test.js frontend/src/lib/local-cache.integration.test.js frontend/src/views/Workout.test.jsx frontend/src/views/Settings.auth.test.jsx
git commit -m "test: verify anonymous and offline cache compatibility"
```

### Task 7: Whole-branch verification and Phase B handoff

**Files:**
- Modify: `docs/superpowers/plans/2026-09-23-fpp-account-cache-isolation.md` only to record verification results after implementation
- Do not modify: Supabase migrations, Auth settings, Vercel configuration, Phase A Auth code outside the approved transition integration, or any remote resource

**Interfaces:**
- Consumes: all completed local-cache tasks and the approved Phase A baseline `56ac7413046f018f683531706737404052027086`.
- Produces: evidence that the branch implements local isolation only and is ready for a fresh whole-branch review before any later sync phase.

- [ ] **Step 1: Run all required local checks**

Run:

```bash
npm test
npm run build
npm --prefix frontend run check:i18n
node --test scripts/check-supabase-boundaries.test.mjs
git diff --check
```

Expected: all commands exit successfully; no command performs a Supabase write.

- [ ] **Step 2: Inspect the complete diff against the Phase A base**

Run: `git diff 56ac7413046f018f683531706737404052027086...HEAD --stat` and `git diff 56ac7413046f018f683531706737404052027086...HEAD -- frontend/src/store frontend/src/lib frontend/src/auth frontend/src/App.jsx frontend/src/views/Settings.jsx scripts`

Review specifically for anonymous-state deletion, account A/B leakage, email-based keys, token/session serialization, remote-sync additions, legacy WebAuthn changes, mobile mirror collisions, boot races, and unrelated redesign.

- [ ] **Step 3: Verify the phase boundary and repository state**

Run: `git status --short --branch`, `git log --oneline --decorate -12`, and `git diff --name-only 56ac7413046f018f683531706737404052027086...HEAD -- supabase vercel.json api`

Expected: no Supabase migration or remote/Auth/Vercel change is part of Phase B; the worktree is clean after the final commit.

- [ ] **Step 4: Record the deferred hosted gates**

Record `HOSTED AUTH CORE E2E: DEFERRED` with reason `email confirmation mailbox unavailable`. Carry these gates to final project closure: hosted signup, confirmation email, real PKCE callback, hosted session restore/refresh, profile/student trigger, recovery email, `PASSWORD_RECOVERY`, password change, Vercel public env/CSP/headers, Capacitor Android/iOS session/deep links/secure storage/safe area/keyboard, physical WebAuthn, and Docker image build.

- [ ] **Step 5: Commit only the verification record if it changed**

```bash
git add docs/superpowers/plans/2026-09-23-fpp-account-cache-isolation.md
git commit -m "docs: record account cache isolation verification"
```

## Self-review checklist

- Anonymous state remains on `gym_state_v1`, is never copied to an account, and survives every account transition.
- Account A and B use UUID-owned, versioned namespaces and cannot read each other's entries.
- Missing, corrupt, future-version, quota-failed, or wrong-owner entries fail closed without deleting other scopes.
- Auth boot selects identity before hydration; generation checks prevent stale A work from overwriting B.
- Logout preserves both account and anonymous data and does not repurpose destructive legacy helpers.
- The Capacitor mirror follows the same scope contract and does not collapse all accounts into one file.
- No password, session, token, cookie, secret key, remote sync, migration, or first-association behavior is added.
- Existing Phase A PKCE, AuthProvider callback cleanup, legacy WebAuthn, workout flow, and CSP boundary remain covered.

Recommended execution method: `superpowers:executing-plans` in the existing Phase A worktree. The tasks are tightly coupled through one store boundary, require frequent contract checks, and the user explicitly requested that subagent limits be considered; native execution is the safer default unless a later review confirms cleanly separable task ownership.

## Execution record

- Base: `56ac7413046f018f683531706737404052027086`.
- Phase B implementation commits: `fa703cc`, `c8cee10`, `81f5a9e`, `af94c69`, `096ff05`, `4d45d43`, `710726c`.
- `npm test`: PASS — frontend 63 files/555 tests, API 31 tests, MCP 36 tests.
- `npm run build`: PASS.
- `npm --prefix frontend run check:i18n`: PASS.
- `npm run check:supabase`: PASS — 12 tests and boundary scan.
- `git diff --check`: PASS.
- Remote writes: `NONE`; migrations: `NONE`; hosted email E2E: `DEFERRED`.
- Capacitor account cache structure: implemented and unit-tested; physical Android/iOS validation: `DEFERRED`.
- Final review: self-review completed because no reviewer subagent tool was available in this runtime. The review found and fixed stale mobile boot continuation with RED→GREEN coverage before the final suite.
