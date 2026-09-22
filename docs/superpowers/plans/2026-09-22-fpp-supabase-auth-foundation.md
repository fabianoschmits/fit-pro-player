# FPP Supabase Auth Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add direct Supabase email/password authentication for web/PWA without making login mandatory, synchronizing training data, or changing the paused Professional domain.

**Architecture:** The browser gets one SDK-owned Supabase client and one React Auth context. The context handles initial session, Auth events, and PKCE callbacks. Zustand retains only legacy-WebAuthn session state and local training state. The application waits for Auth initialization before choosing whether legacy boot is allowed, preventing accidental /api/data pull or write.

**Tech Stack:** React 19, React Context, Zustand 5, Vite 8, Vitest 4 with happy-dom, @supabase/supabase-js 2.116.0, Node test runner, Vercel static headers, existing i18n locale packs.

**Spec:** docs/superpowers/specs/2026-09-22-fpp-account-auth-sync-design.md

## Global Constraints

- Implement only Phase A: Supabase Auth foundation for web/PWA.
- Use direct Supabase Auth with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. Never expose a secret, database password, signing key, or service-role key in frontend code.
- Use email and password only. Do not add providers, Professional Profile, enrollment, snapshots, sync, account cache, conflicts, first association, or /api/data import.
- Anonymous local training remains fully usable. No route may require a Supabase session to open or train locally.
- Session persistence and refresh are SDK-owned. FPP code must not copy access/refresh tokens into gym_state_v1, training storage, URLs, logs, analytics, or an ad-hoc storage adapter.
- Use PKCE for web/PWA confirmation and recovery. The callback is the root URL without a hash route because the app uses HashRouter.
- Capacitor Auth, secure native storage, and native deep links are out of scope. Preserve its current local behavior and label it pending validation.
- Migrations 001–003 are immutable. Create no migration and make no hosted Supabase change.
- Phase 1B is superseded for normal auth: do not integrate its JWT signer, broker, /api/account/supabase-token, imported signing key, or private-key variables.
- legacy_identity_links, FPP WebAuthn cookie, and /api/data are legacy-only. Normal Supabase login does not invoke them.
- Logout ends only the relevant session/context. It preserves gym_state_v1, active workout data, and history; it never calls localStorage.clear().
- All new copy uses t(), all locale packs get matching keys, and forms must use labels, autocomplete, submit state, error announcement, focus, and mobile-friendly input semantics.
- Unit tests mock the Supabase boundary. Hosted validation is a later authorization gate.

## Review Focus

- A restored Supabase session must beat stale legacy gym_user without /api/me, /api/data, or training-payload modification. Task 3 owns this.
- A failed or expired PKCE recovery callback must show a recoverable translated error and never leave the app initializing. Tasks 2 and 6 own this.
- Supabase and legacy logout must preserve gym_state_v1, history, and active workout byte-for-byte. Task 4 owns this.
- Missing/invalid public config must leave a usable anonymous app with unavailable account actions and no partial SDK construction. Tasks 1 and 5 own this.
- CSP must admit only the current project origin; no wildcard, wildcard subdomain, WebSocket, or unrelated origin. Task 1 owns this.

---

## File map and dependency order

| Area | Files | Responsibility |
|---|---|---|
| Public client | frontend/src/lib/supabase-config.js, frontend/src/lib/supabase-client.js | Validate public config and create the SDK client. |
| Auth state | frontend/src/auth/AuthProvider.jsx, frontend/src/auth/auth-errors.js | One session, operation, callback, and error authority. |
| App coordination | frontend/src/main.jsx, frontend/src/App.jsx, frontend/src/store/useStore.js | Gate legacy boot and preserve local state. |
| Account UI | frontend/src/components/AuthSheet.jsx, Landing.jsx, Settings.jsx, More.jsx | Non-blocking account entry and legacy presentation. |
| Security | vercel.json, scripts/check-supabase-boundaries.mjs | Exact CSP and no FPP-managed token persistence. |
| Legacy server | api/server.js | Retire only new WebAuthn registration; retain existing passkey login. |

Tasks 2–6 consume Task 1. Task 3 lands before account UI so a Supabase session cannot race legacy boot. Task 4 lands before the Supabase sign-out action is exposed.

### Task 1: Add public browser Supabase client and CSP/security boundary

**Files:**
- Modify: frontend/package.json
- Modify: frontend/package-lock.json
- Modify: frontend/src/lib/supabase-config.js
- Modify: frontend/src/lib/supabase-config.test.js
- Create: frontend/src/lib/supabase-client.js
- Create: frontend/src/lib/supabase-client.test.js
- Modify: vercel.json
- Modify: scripts/check-supabase-boundaries.mjs
- Modify: scripts/check-supabase-boundaries.test.mjs
- Modify: .env.example

**Interfaces:**
- Consumes: getPublicSupabaseConfig(env), VITE_SUPABASE_URL, and VITE_SUPABASE_PUBLISHABLE_KEY.
- Produces: createBrowserSupabaseClient(config, createClientImpl), getBrowserSupabaseClient(env), and resetBrowserSupabaseClientForTest().
- Produces: checkVercelCsp({ text, requiredSupabaseOrigin }) returning descriptive violations for the existing npm run check:supabase command.

- [ ] **Step 1: Write failing client/config and CSP tests**

Add Vitest tests that a complete config creates one client with the exact options below; missing or malformed config returns null and never calls the injected SDK constructor.

~~~js
expect(createClient).toHaveBeenCalledWith('https://bgqavxoxwgheloeubbpf.supabase.co', 'publishable-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
})
expect(createBrowserSupabaseClient({ enabled: false }, createClient)).toBeNull()
expect(createClient).not.toHaveBeenCalled()
~~~

Add Node fixtures for checkVercelCsp requiring connect-src 'self' plus https://bgqavxoxwgheloeubbpf.supabase.co. Reject *, *.supabase.co, wss:, and an unrelated origin. Add a frontend-source fixture that writes access_token or refresh_token to gym_state_v1 and assert the boundary check fails. A normal SDK client with no custom storage adapter must pass.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

~~~bash
npm --prefix frontend test -- src/lib/supabase-config.test.js src/lib/supabase-client.test.js
node --test scripts/check-supabase-boundaries.test.mjs
~~~

Expected: FAIL because supabase-client.js, checkVercelCsp, and the manual-token persistence rule do not exist.

- [ ] **Step 3: Implement the narrow browser boundary**

Run:

~~~bash
npm install --prefix frontend @supabase/supabase-js@2.116.0
~~~

Create a module singleton. It asks getPublicSupabaseConfig(env) for a complete pair and returns null otherwise. It sets only the Auth options tested above; it does not set global headers, custom storage, or token getters.

Extend public config with origin only when enabled:

~~~js
return {
  enabled,
  url: enabled ? url : null,
  origin: enabled ? new URL(url).origin : null,
  publishableKey: enabled ? publishableKey : null,
}
~~~

In vercel.json extend only connect-src with https://bgqavxoxwgheloeubbpf.supabase.co. Do not add wildcard, wildcard subdomain, wss:, unsafe-eval, or another changed CSP directive. Extend the current Node boundary script to parse CSP and scan non-test frontend code for direct token writes to gym_state_v1, custom cache, sessionStorage, IndexedDB, console, or URL mutation.

Update .env.example comments only: identify the two Vite values as public browser Auth config and SUPABASE_SECRET_KEY as server-only. Do not add values or touch ignored .env.local.

- [ ] **Step 4: Run GREEN verification**

Run:

~~~bash
npm --prefix frontend test -- src/lib/supabase-config.test.js src/lib/supabase-client.test.js
node --test scripts/check-supabase-boundaries.test.mjs
npm run check:supabase
npm --prefix frontend run check:i18n
~~~

Expected: all pass; the boundary check reports no CSP, secret, or manual-token-persistence violation.

- [ ] **Step 5: Commit the boundary**

~~~bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/supabase-config.js frontend/src/lib/supabase-config.test.js frontend/src/lib/supabase-client.js frontend/src/lib/supabase-client.test.js vercel.json scripts/check-supabase-boundaries.mjs scripts/check-supabase-boundaries.test.mjs .env.example
git commit -m "feat: add browser Supabase auth client boundary"
~~~

### Task 2: Build Auth provider, PKCE callback handling, and error contract

**Files:**
- Create: frontend/src/auth/auth-errors.js
- Create: frontend/src/auth/auth-errors.test.js
- Create: frontend/src/auth/AuthProvider.jsx
- Create: frontend/src/auth/AuthProvider.test.jsx
- Modify: frontend/src/main.jsx

**Interfaces:**
- Consumes: getBrowserSupabaseClient() from Task 1; it may be null.
- Produces: AuthProvider, useAuth, and buildAuthRedirectUrl(locationLike, flow).
- Produces context { status, user, operation, recovery, error, configured, suppressLegacyResume, signUp, signIn, sendPasswordRecovery, updatePassword, signOut }.
- Produces: toAuthError(error, operation) with only these UI domain codes: invalid_credentials, email_already_registered, email_confirmation_required, password_too_weak, network_unavailable, auth_unavailable, recovery_link_invalid, recovery_link_expired, session_expired.

- [ ] **Step 1: Write failing provider and mapper tests**

Use an injected fake client with auth.getSession, onAuthStateChange, exchangeCodeForSession, signUp, signInWithPassword, resetPasswordForEmail, updateUser, and signOut. Assert initial state, restored user UUID, all event types INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY, and operation cleanup.

~~~jsx
expect(result.current.status).toBe('initializing')
await waitFor(() => expect(result.current.status).toBe('authenticated'))
expect(result.current.user.id).toBe('72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2')
expect(result.current.user).not.toHaveProperty('access_token')
~~~

Drive delayed getSession after SIGNED_IN and prove stale getSession cannot overwrite the newer event. Fire duplicate events and assert one state transition. Verify a HashRouter source such as https://app.example/#/settings creates https://app.example/?auth_flow=confirm or recovery, with no hash and no token.

Test ?auth_flow=recovery&code=abc calls exchangeCodeForSession('abc'), removes code and auth_flow using history.replaceState, and sets recovery: 'required'. Rejected exchange maps to recovery_link_invalid or recovery_link_expired and reaches a recoverable anonymous/error state. Missing configuration yields anonymous/configured:false without invoking a client method.

- [ ] **Step 2: Run the provider tests and verify RED**

Run:

~~~bash
npm --prefix frontend test -- src/auth/auth-errors.test.js src/auth/AuthProvider.test.jsx
~~~

Expected: FAIL because neither Auth module nor injected test seam exists.

- [ ] **Step 3: Implement provider without token plumbing**

Create a pure error mapper; it checks documented Supabase error code/status before a safe generic fallback and never returns a backend message or stack. AuthProvider stores only session-derived user metadata { id, email, emailConfirmedAt }, never raw access/refresh tokens.

Subscribe to onAuthStateChange before initial bootstrap. Use a monotonic event revision so later events beat an earlier getSession promise. With Task 1 detectSessionInUrl:false, parse only window.location.search and exchange PKCE code explicitly. Remove code and auth_flow through history.replaceState after success or failure.

Use these exact SDK calls:

~~~js
client.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: buildAuthRedirectUrl(location, 'confirm') } })
client.auth.signInWithPassword({ email, password })
client.auth.resetPasswordForEmail(email, { redirectTo: buildAuthRedirectUrl(location, 'recovery') })
client.auth.updateUser({ password })
client.auth.signOut()
~~~

signUp returns { kind: 'authenticated' } only with a session; otherwise it returns { kind: 'confirmation_required' }. Each operation clears signing_up, signing_in, sending_recovery, resetting_password, or signing_out in finally. Wrap App with AuthProvider in main.jsx. Do not create a Capacitor adapter.

- [ ] **Step 4: Run GREEN verification**

Run:

~~~bash
npm --prefix frontend test -- src/auth/auth-errors.test.js src/auth/AuthProvider.test.jsx
npm run check:supabase
~~~

Expected: races, duplicate events, callback exchange, missing config, and error mapping pass.

- [ ] **Step 5: Commit Auth state**

~~~bash
git add frontend/src/auth/auth-errors.js frontend/src/auth/auth-errors.test.js frontend/src/auth/AuthProvider.jsx frontend/src/auth/AuthProvider.test.jsx frontend/src/main.jsx
git commit -m "feat: add Supabase auth session provider"
~~~

### Task 3: Coordinate Supabase state with app boot and legacy context

**Files:**
- Modify: frontend/src/App.jsx
- Create: frontend/src/App.auth.test.jsx
- Modify: frontend/src/store/useStore.js
- Modify: frontend/src/store/useStore.sync.test.js

**Interfaces:**
- Consumes: useAuth() and useStore().boot().
- Produces: useStore().boot({ legacySessionEnabled }), defaulting to true for existing callers.
- Produces: useStore().clearLegacySessionContext(), clearing only gym_user, legacy dirty/conflict flags, and in-memory legacy user.
- Produces precedence: Supabase authenticated > legacy WebAuthn user > guest > Landing.

- [ ] **Step 1: Write failing boot coordination tests**

Render App with a fake provider and mocked store. Assert:

~~~jsx
expect(boot).toHaveBeenCalledWith({ legacySessionEnabled: false })
expect(boot).not.toHaveBeenCalled() // while Auth is initializing
expect(boot).toHaveBeenCalledWith({ legacySessionEnabled: true }) // no Supabase session
~~~

In useStore.sync.test.js seed gym_user, gym_state_v1, active workout, and dirty flag. Call boot({ legacySessionEnabled: false }); assert no /api/me, /api/data, pushState, or pullState; gym_user/context clears; serialized gym_state_v1 is unchanged. Retain a regression proving plain boot() performs existing legacy bootstrap.

- [ ] **Step 2: Run RED**

Run:

~~~bash
npm --prefix frontend test -- src/App.auth.test.jsx src/store/useStore.sync.test.js
~~~

Expected: FAIL because boot has no option and App boots legacy before Auth initialization.

- [ ] **Step 3: Implement deterministic boot coordination**

Change the signature to:

~~~js
async boot({ legacySessionEnabled = true } = {})
~~~

After existing demo/standalone/mobile guards, boot with false calls clearLegacySessionContext(), sets ready:true, and returns before loadConfig, /api/me, /api/data, or legacy sync scheduling. It never removes gym_state_v1, replaces S, or persists defaults.

In App Shell, wait until auth.status is not initializing. Pass legacySessionEnabled only when auth is anonymous and suppressLegacyResume is false. Set suppressLegacyResume after an explicit Supabase signOut in the current page lifetime so it does not immediately revive an existing FPP cookie. A full reload with no Supabase session retains the legacy path.

~~~js
const authenticated = auth.status === 'authenticated'
const authed = authenticated || !!user || isGuest
const onlineIdentity = authenticated ? auth.user : user
~~~

Use onlineIdentity only for display/route decisions. Keep user?.admin legacy-only. Do not call setUser, pushState, pullState, /api/data, or legacy_identity_links from Supabase events.

- [ ] **Step 4: Run GREEN**

Run:

~~~bash
npm --prefix frontend test -- src/App.auth.test.jsx src/store/useStore.sync.test.js src/views/Landing.test.jsx
~~~

Expected: restored Supabase state suppresses legacy server boot; no new Auth event associates or syncs training data.

- [ ] **Step 5: Commit boot coordination**

~~~bash
git add frontend/src/App.jsx frontend/src/App.auth.test.jsx frontend/src/store/useStore.js frontend/src/store/useStore.sync.test.js
git commit -m "feat: coordinate Supabase auth with legacy app boot"
~~~

### Task 4: Make every logout non-destructive

**Files:**
- Modify: frontend/src/store/useStore.js
- Modify: frontend/src/store/useStore.sync.test.js
- Modify: frontend/src/views/Settings.jsx
- Create: frontend/src/views/Settings.auth.test.jsx

**Interfaces:**
- Consumes: legacy useStore().signOut()/signOutAll() and useAuth().signOut().
- Produces: legacy sign-out methods clearing only legacy session context after successful legacy server logout.
- Produces: Settings dispatching Supabase logout to useAuth only and legacy logout to Zustand only.

- [ ] **Step 1: Write RED data-preservation tests**

Replace the existing expectation that successful logout leaves workouts empty:

~~~js
const before = JSON.stringify({ ...personalState(), active: { id: 'active', entries: [] } })
localStorage.setItem('gym_state_v1', before)
await expect(useStore.getState().signOut()).resolves.toBeUndefined()
expect(useStore.getState().user).toBeNull()
expect(JSON.stringify(useStore.getState().S)).toBe(before)
expect(localStorage.getItem('gym_state_v1')).toBe(before)
~~~

Repeat for signOutAll(). In Settings.auth.test.jsx, a Supabase account clicking Sign out calls auth.signOut once, never store.signOut, and makes no /api/data request. A legacy account calls store.signOut but sees non-destructive confirmation copy.

- [ ] **Step 2: Run RED**

Run:

~~~bash
npm --prefix frontend test -- src/store/useStore.sync.test.js src/views/Settings.auth.test.jsx
~~~

Expected: FAIL because clearLocalSession removes gym_state_v1 and resets S.

- [ ] **Step 3: Implement narrow logout semantics**

Rename clearLocalSession to clearLegacySessionContext. Remove localStorage.removeItem(KEY) and persist(normalizeState(DEF), false). Retain successful legacy server logout but clear only legacy identity/sync metadata. Do not alter workout data, export/import, native mirror, or account deletion.

Settings branches on auth.status === 'authenticated' before legacy user. Supabase sign-out says “Signed out. Your workouts stay on this device.” Legacy sign-out uses the same guarantee. Do not add account deletion, cache deletion, or sync.

- [ ] **Step 4: Run GREEN**

Run:

~~~bash
npm --prefix frontend test -- src/store/useStore.sync.test.js src/views/Settings.auth.test.jsx
npm --prefix frontend run check:i18n
~~~

Expected: both logout paths preserve local state; Supabase action cannot invoke legacy sync.

- [ ] **Step 5: Commit logout safety**

~~~bash
git add frontend/src/store/useStore.js frontend/src/store/useStore.sync.test.js frontend/src/views/Settings.jsx frontend/src/views/Settings.auth.test.jsx
git commit -m "fix: preserve local workouts on logout"
~~~

### Task 5: Add accessible email/password entry, confirmation, and recovery UI

**Files:**
- Create: frontend/src/components/AuthSheet.jsx
- Create: frontend/src/components/AuthSheet.test.jsx
- Modify: frontend/src/views/Landing.jsx
- Modify: frontend/src/views/Landing.test.jsx
- Modify: frontend/src/views/Settings.jsx
- Modify: frontend/src/views/More.jsx
- Modify: frontend/src/locales/pt.js
- Modify: frontend/src/locales/de.js
- Modify: frontend/src/locales/es.js
- Modify: frontend/src/locales/fr.js
- Modify: frontend/src/locales/it.js
- Modify: frontend/src/locales/pl.js
- Modify: frontend/src/locales/tr.js
- Modify: frontend/src/locales/ru.js
- Modify: frontend/src/locales/zh.js
- Modify: frontend/src/locales/ko.js
- Modify: frontend/src/locales/hi.js

**Interfaces:**
- Consumes: useAuth operations/state and useUI.getState().openSheet.
- Produces: AuthSheet({ close, initialMode }) for entry, sign_in, sign_up, forgot_password, and reset_password.
- Produces: openAuthSheet(initialMode), shared by Landing, Settings, and recovery event handling.

- [ ] **Step 1: Write failing normal-flow UI tests**

Render AuthSheet with a fake provider. Assert:

~~~jsx
expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password')
expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
~~~

Cover sign-up displayName/email/new-password, disabled submit during signing_up, confirmation_required outcome, invalid credentials, duplicate email, weak password, offline, generic unavailable, forgot-password, and reset-password with matching confirmation. Error uses role=alert and receives focus after failure.

Extend Landing tests: local Start now remains visible and works; configured web also exposes non-blocking Protect your training. Extend Settings/More tests: auth.user.email displays as account identity without admin status or /api/data access.

- [ ] **Step 2: Run RED**

Run:

~~~bash
npm --prefix frontend test -- src/components/AuthSheet.test.jsx src/views/Landing.test.jsx src/views/Settings.auth.test.jsx
~~~

Expected: FAIL because the shared sheet and new account UI do not exist.

- [ ] **Step 3: Implement smallest mobile-first UI**

Use one sheet rather than duplicate Landing/Settings forms:

~~~jsx
<input type="email" inputMode="email" autoComplete="email" required aria-describedby="auth-error" />
<input type="password" autoComplete="current-password" required minLength={8} />
<p id="auth-error" role="alert" tabIndex="-1">{translatedError}</p>
~~~

Use name/new-password/confirmation fields for sign-up. Generic recovery success never confirms account existence. Reset remains open until updatePassword succeeds. All new labels, help, success, and error strings go through t() and have matching keys in all eleven locale packs.

Remove Settings SupabaseAccountSheet, manual access-token input, and linkSupabaseIdentity import/UI. Keep backend legacy link support untouched for Phase F. More displays a Supabase account as an account, not “Signed in with passkey.”

- [ ] **Step 4: Run GREEN**

Run:

~~~bash
npm --prefix frontend test -- src/components/AuthSheet.test.jsx src/views/Landing.test.jsx src/views/Settings.auth.test.jsx
npm --prefix frontend run check:i18n
npm run check:supabase
~~~

Expected: anonymous entry, accessible Auth states, translated copy, and no manual bearer UI all pass.

- [ ] **Step 5: Commit account UI**

~~~bash
git add frontend/src/components/AuthSheet.jsx frontend/src/components/AuthSheet.test.jsx frontend/src/views/Landing.jsx frontend/src/views/Landing.test.jsx frontend/src/views/Settings.jsx frontend/src/views/Settings.auth.test.jsx frontend/src/views/More.jsx frontend/src/locales
git commit -m "feat: add email password account flows"
~~~

### Task 6: Wire recovery presentation and retire new WebAuthn registration

**Files:**
- Modify: frontend/src/App.jsx
- Modify: frontend/src/App.auth.test.jsx
- Modify: frontend/src/components/AuthSheet.jsx
- Modify: frontend/src/components/AuthSheet.test.jsx
- Modify: frontend/src/lib/api.js
- Delete: frontend/src/lib/api.account.test.js
- Modify: api/server.js
- Modify: api/server.integration.test.js
- Modify: frontend/src/views/Landing.jsx
- Modify: frontend/src/views/Settings.jsx

**Interfaces:**
- Consumes: Task 2 recovery state and Task 5 openAuthSheet('reset_password').
- Produces: a one-shot recovery sheet per recovery event.
- Produces: passkeyLogin remains exported; passkeyRegister is unreachable from normal UI and POST /api/register/options returns stable 410.

- [ ] **Step 1: Write failing recovery and retirement tests**

Fire PASSWORD_RECOVERY twice and expect one reset sheet, one focus target, and no navigation loop. Test invalid/expired callback remains reachable from anonymous landing after reload.

In api/server.integration.test.js, move malformed body coverage to a supported route and add:

~~~js
const retired = await request('/api/register/options', JSON.stringify({ name: 'Ana' }))
assert.equal(retired.status, 410)
assert.deepEqual(await retired.json(), { error: 'passkey registration retired' })
~~~

Landing and Settings tests must show legacy Sign in with passkey but not Create passkey profile / Create new profile. Neither action runs automatically for a Supabase session.

- [ ] **Step 2: Run RED**

Run:

~~~bash
npm --prefix frontend test -- src/App.auth.test.jsx src/components/AuthSheet.test.jsx src/views/Landing.test.jsx src/views/Settings.auth.test.jsx
npm --prefix api test -- --test-name-pattern "passkey registration retired"
~~~

Expected: FAIL because recovery lacks a guard and server registration still creates challenges.

- [ ] **Step 3: Implement deterministic recovery and retirement**

In App, open reset sheet once per recovery revision. Do not put recovery state back into URL. Dismissal does not duplicate alerts; failed reset keeps the sheet with mapped error.

Remove RegisterSheet/RegisterInline from normal UI. Remove unused passkeyRegister, linkSupabaseIdentity, and requestSupabaseProfessionalRole frontend exports and delete api.account.test.js. Retain passkeyLogin. In api/server.js, return the exact 410 response from POST /api/register/options before challenge creation. Keep /api/login/options, /api/login/verify, credentials, cookies, and legacy files unchanged.

- [ ] **Step 4: Run GREEN**

Run:

~~~bash
npm --prefix frontend test -- src/App.auth.test.jsx src/components/AuthSheet.test.jsx src/views/Landing.test.jsx src/views/Settings.auth.test.jsx
npm --prefix api test
npm run check:supabase
~~~

Expected: one recovery UX, legacy login regression coverage, retired registration, and no 1B/manual-bearer production path.

- [ ] **Step 5: Commit recovery and retirement**

~~~bash
git add frontend/src/App.jsx frontend/src/App.auth.test.jsx frontend/src/components/AuthSheet.jsx frontend/src/components/AuthSheet.test.jsx frontend/src/lib/api.js frontend/src/views/Landing.jsx frontend/src/views/Landing.test.jsx frontend/src/views/Settings.jsx frontend/src/views/Settings.auth.test.jsx api/server.js api/server.integration.test.js
git rm frontend/src/lib/api.account.test.js
git commit -m "feat: retire new passkey registration"
~~~

### Task 7: Run full local regression and honor the hosted stop gate

**Files:**
- Modify only when verification identifies a real Phase A defect in a file owned by Tasks 1–6.
- Do not create migrations, modify supabase/, modify frontend/capacitor.config.json, or change hosted Supabase/Vercel configuration.

**Interfaces:**
- Consumes: all local Phase A commits.
- Produces: a fresh local verification record and hosted stop-gate report, with no remote mutation.

- [ ] **Step 1: Run complete local verification**

Run:

~~~bash
npm test
npm run build
npm --prefix frontend run check:i18n
npm run check:supabase
git diff --check
git status --short --branch
~~~

Expected: all tests pass without hosted network dependency; build, i18n, and boundary checks pass; diff check is empty.

- [ ] **Step 2: Perform final scope review**

Inspect git diff origin/main...HEAD --name-only. Reject any migration, snapshot/sync table, per-user cache, /api/data write from Supabase Auth, Professional Profile, Capacitor adapter/deep link, token broker/JWT signer, private env variable, or CSP wildcard. Confirm migrations 001–003 are unchanged.

- [ ] **Step 3: Stop before hosted Auth changes**

Report LOCAL AUTH IMPLEMENTATION COMPLETE and stop for authorization before changing Site URL, redirect allowlist, email confirmation, providers, SMTP/templates, Vercel env variables, or any hosted Auth configuration.

The later separately authorized read-only inspection verifies development, pre-production, and production callback URLs against buildAuthRedirectUrl. Only later disposable-account E2E can validate sign-up, confirmation, login, reload restore, refresh, logout, recovery, profiles trigger, and student role. Capacitor Auth validation remains pending.

- [ ] **Step 4: Commit only a real verification fix**

If Step 1 or Step 2 finds a Phase A defect, commit the minimal correction with a precise fix: message. Otherwise create no empty verification commit.

## Explicitly deferred phases

| Phase | Deferred work |
|---|---|
| B | local cache isolation by supabase_user_id |
| C | Supabase snapshot schema, RLS, versioning, and idempotency |
| D | sync transition, retry queue, and conflicts |
| E | first local/cloud association UX |
| F | WebAuthn/data-file proof, link, import, and retention |
| G | Capacitor storage adapter, session restore, and deep links |
| H | retirement of normal /api/data writes |
| I | resume Professional Profile and later relationship/code work |

## Plan self-review

### Spec coverage

- Email/password sign-up/login, SDK persistence/refresh, session restore, confirmation, recovery, and logout: Tasks 1, 2, 5, and 6.
- Anonymous local use and absence of association/sync: Tasks 3–5 prohibit Supabase Auth calls to store sync.
- Non-destructive logout: Task 4 has a RED serialized gym_state_v1 regression.
- CSP, public-only env, and no manual token storage: Task 1 plus Task 7 scope review.
- Legacy WebAuthn compatibility and registration retirement: Task 6; linking/import remains Phase F.
- Profiles/student trigger: no migration; Task 7 makes it a later hosted validation gate.
- Capacitor and Professional Profile: excluded globally and in the deferred table.

### Placeholder scan

No placeholder markers, generic “add tests,” or relative task instructions are present. Every behavioral task names files, interfaces, RED command, GREEN command, and commit scope.

### Interface consistency

Task 2 keeps Supabase identity in useAuth while Task 3 keeps legacy identity in useStore().user. Task 4 never routes Supabase sign-out through legacy sync. Tasks 5 and 6 share AuthSheet and do not reintroduce manual bearer input.

### Review Focus coverage

Reload/dual-auth is Task 3; expired callback is Tasks 2 and 6; data preservation is Task 4; missing config is Tasks 1 and 5; exact CSP is Task 1.

## Recommended execution method

Use **subagent-driven development**. The tasks have clear interfaces but separate high-risk concerns—SDK session lifecycle, data-loss prevention, PKCE recovery, CSP/security scanning, and legacy WebAuthn regression—where an independent implementation/review cycle per task is safer than one long shared pass.
