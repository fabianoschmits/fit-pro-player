# FPP Professional — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Supabase-backed identity foundation for FPP Professional—profiles, multi-role accounts, and a secure legacy-WebAuthn identity link—without changing anonymous use or migrating `gym_state_v1`.

**Architecture:** Keep the current Node API, signed WebAuthn cookie, JSON user database, local-first Zustand state, and per-user legacy state files intact. Add a separately bounded Supabase adapter and versioned PostgreSQL schema for `profiles`, `user_roles`, and `legacy_identity_links`; use Supabase Auth user IDs as relational ownership roots, keep RLS authoritative, and route the legacy-to-Supabase bridge through the existing backend. Supabase configuration is optional during rollout, so a missing configuration leaves anonymous and legacy-only flows operational.

**Tech Stack:** Node 22 ESM API, React/Vite/Zustand frontend, Supabase Auth, Supabase PostgreSQL, Supabase CLI migrations, PostgreSQL RLS, Node built-in test runner, Vitest, existing WebAuthn implementation.

**Spec:** `docs/superpowers/specs/2026-09-21-fpp-professional-phase-0-design.md`

## Global Constraints

- Do not migrate `gym_state_v1`, existing routines, existing history, or `S.active`.
- Preserve anonymous mode, Capacitor local storage, PWA behavior, current WebAuthn login, logout, and legacy sync.
- Use `auth.users.id`/Supabase UUIDs as relational identity; never use email, name, or username as ownership keys.
- Keep `student`, `professional`, and `admin` as independent roles; a user may hold multiple roles.
- Every sensitive table must have explicit RLS decisions for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
- The client may receive only public Supabase configuration; `service_role` is backend-only and must never enter Vite, React, Capacitor, localStorage, logs, or Git.
- Do not implement `professional_profiles`, invitations, professional-student relationships, programs, templates, assignments, professional workouts, executions, feedback, notifications, analytics, or the professional panel.
- Do not require Supabase configuration for anonymous use or for the existing legacy WebAuthn flow.
- Migrations, policies, functions, constraints, and indexes must be reproducible from version-controlled files.
- Use TDD for each behavior: write a failing test, run it, implement the smallest change, rerun focused tests, then run regression tests and commit.
- Do not request or commit real Supabase credentials.

## Review Focus

1. A legacy user must link to exactly one Supabase identity without receiving a duplicate account or losing local data; pin this in the identity-link tests.
2. A client must not self-assign `admin` or `professional`; pin role insert/update policies and backend role tests.
3. Missing Supabase configuration must not block anonymous boot, guest persistence, or the legacy WebAuthn API; pin config fallback tests and existing store/API suites.
4. No service-role credential may be exposed through frontend source, Vite env exposure, Capacitor build input, or response payloads; pin config tests and a repository secret scan.
5. A profile or identity link must not be readable across users; pin RLS tests for same-user and cross-user sessions.
6. Existing logout, logout-all, state upload, state conflict handling, and local state clearing must remain unchanged; pin API/store regression tests.
7. Development, preview, and production migrations must be reproducible without manual dashboard edits; pin migration structure and local reset verification.

## Scope and identity decisions

The implementation will use a temporary hybrid identity model. Existing WebAuthn accounts remain valid and continue to receive the current signed `gymsid` cookie. Supabase Auth becomes the identity root for new relational features. A link operation is allowed only when the request has both a valid legacy session and a verified Supabase access token; the backend writes one `legacy_identity_links` row in a transaction. No match is ever made by name or email.

Every Supabase account receives the `student` role at profile creation because the existing FPP product is a student-facing training app. `professional` is an explicit capability that can be requested through a backend operation in this phase, but it does not imply verification or create a professional profile. `admin` is never client-assignable. During transition, an existing legacy admin is eligible for the Supabase `admin` role only through an explicit, auditable backend link path that checks the server-side legacy `isAdmin(user)` result; ordinary users cannot trigger that grant.

The first implementation will not replace WebAuthn, decide a final Supabase login provider, or require a Supabase session for ordinary FPP use. The Supabase client, when introduced, will be used only for public Auth flows and will send an access token to the backend for server verification. The service role is reserved for server-side provisioning, role grants, and identity-link transactions that cannot safely be performed with the public client.

## File map

Files to create:

- `supabase/config.toml` — local Supabase CLI project configuration with no credentials.
- `supabase/migrations/202609210001_identity_profiles_roles_links.sql` — reproducible schema, enums, constraints, trigger functions, indexes, and RLS for Phase 1.
- `supabase/tests/202609210001_identity_profiles_roles_links.sql` — database authorization tests for own/cross-user profiles, role escalation, and identity links.
- `api/supabase/config.js` — optional server configuration parser and fail-closed feature flags.
- `api/supabase/config.test.js` — pure configuration tests for enabled/disabled and secret boundaries.
- `api/supabase/client.js` — lazy Supabase server client factory; refuses to construct privileged access without explicit server-only configuration.
- `api/supabase/contracts.js` — normalization and validation for `AuthenticatedUser`, `Profile`, `UserRole`, and `LegacyIdentityLink` response shapes.
- `api/supabase/identity.js` — backend operations for token verification, profile/role reads, and atomic legacy identity linking.
- `api/supabase/identity.test.js` — unit tests for optional configuration, token/link boundaries, duplicate prevention, and response minimization.
- `api/supabase/routes.js` — route handlers for additive account identity endpoints, separated from the existing route table logic.
- `frontend/src/lib/supabase-config.js` — public-only client configuration detector; no service-role name or value is exposed.
- `frontend/src/lib/supabase-config.test.js` — tests for configured/unconfigured public client behavior and secret rejection.
- `frontend/src/lib/api.account.test.js` — tests for account-link request headers, response normalization, and stable unavailable errors.

Files to modify:

- `.env.example` — document public `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` and backend-only variables without values.
- `.gitignore` — explicitly ignore local Supabase secrets and generated local state while preserving migration files.
- `api/package.json` and `api/package-lock.json` — add the pinned Supabase server dependency only when Task 3 is implemented.
- `api/server.js` — mount additive account routes and preserve all existing auth/data/admin routes unchanged.
- `api/server.integration.test.js` — add legacy-session compatibility and disabled-Supabase behavior checks.
- `frontend/src/lib/api.js` — add narrowly scoped authenticated-account request helpers; do not rewrite passkey helpers.
- `frontend/src/views/Settings.jsx` — add the minimal account-link entry point while preserving existing passkey and anonymous rows.
- `frontend/src/lib/onboarding-locales.js` — add only the new account-link/status strings required by Settings.

Files explicitly not modified in Phase 1: workout views, plan/routine views, history helpers, exercise catalog, Capacitor native code, service worker, locales except for strictly necessary account copy, and all professional domain UI.

## Interfaces between tasks

The following names and shapes are fixed for the plan:

```js
// api/supabase/config.js
readSupabaseConfig(env) -> {
  enabled: boolean,
  url: string | null,
  publishableKey: string | null,
  secretKey: string | null,
  hasServerCredentials: boolean
}

// api/supabase/contracts.js
normalizeAuthenticatedUser(input) -> { id: string, email?: string | null }
normalizeProfile(input) -> { id: string, displayName: string, avatarRef: string | null, createdAt: string, updatedAt: string }
normalizeRole(input) -> { userId: string, role: 'student'|'professional'|'admin', createdAt: string }
normalizeLegacyIdentityLink(input) -> { legacyUserId: string, supabaseUserId: string, linkedAt: string }

// api/supabase/identity.js
verifyAccessToken(accessToken) -> Promise<AuthenticatedUser>
getAccountSnapshot({ accessToken, legacyUser }) -> Promise<{ profile, roles, legacyLink }>
linkLegacyIdentity({ accessToken, legacyUser }) -> Promise<{ profile, roles, legacyLink }>
requestProfessionalRole({ accessToken }) -> Promise<UserRole>

// frontend/src/lib/supabase-config.js
getPublicSupabaseConfig(env) -> { enabled: boolean, url: string | null, publishableKey: string | null }
```

Any implementation may split internals further, but later tasks must consume these boundaries rather than importing Supabase clients throughout the application.

## Implementation tasks

### Task 1: Establish the optional Supabase configuration boundary

**Files:**
- Create: `api/supabase/config.js`
- Create: `api/supabase/config.test.js`
- Create: `frontend/src/lib/supabase-config.js`
- Create: `frontend/src/lib/supabase-config.test.js`
- Modify: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces `readSupabaseConfig(env)` for the backend and `getPublicSupabaseConfig(env)` for Vite.
- Backend accepts `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and optional `SUPABASE_SECRET_KEY`.
- Frontend accepts only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; it never reads or forwards a secret variable.

- [ ] **Step 1: Write failing configuration tests.** Cover empty env (`enabled: false`), complete public env, complete server env, malformed URL, public key without URL, and a client env object containing `SUPABASE_SECRET_KEY` that must be ignored and rejected by the test helper.
- [ ] **Step 2: Run focused tests.** Run `npm --prefix api test -- --test-name-pattern "Supabase configuration"` and `npm --prefix frontend test -- src/lib/supabase-config.test.js`. Expected: new tests fail because the modules do not exist.
- [ ] **Step 3: Implement the minimal pure parsers.** Trim values, validate `http(s)` URL syntax, return nulls instead of throwing for absent optional configuration, and keep service-role detection server-only.
- [ ] **Step 4: Rerun focused tests.** Expected: all configuration tests pass; no browser boot code is changed yet.
- [ ] **Step 5: Update environment documentation and ignore rules.** Document placeholders only, preserve current WebAuthn variables, and ignore `.env`, `.env.*.local`, `.supabase/`, and local Supabase secrets without ignoring `supabase/config.toml` or migrations.
- [ ] **Step 6: Commit.** `git add api/supabase/config.js api/supabase/config.test.js frontend/src/lib/supabase-config.js frontend/src/lib/supabase-config.test.js .env.example .gitignore && git commit -m "chore: prepare optional Supabase configuration"`

### Task 2: Add reproducible local Supabase project metadata

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/seed.sql`
- Test: `supabase/config.toml` and `supabase/seed.sql` through the CLI reset command

**Interfaces:**
- Produces a credential-free local project definition and an empty deterministic seed.
- Consumes only the configuration boundary from Task 1; it must not require a remote project.

- [ ] **Step 1: Define the local project settings.** Pin PostgreSQL/Auth service configuration appropriate for local development, leave external project IDs and secrets unset, and keep the file compatible with the repository's Node 22 workflow.
- [ ] **Step 2: Add an empty deterministic seed.** The seed must not create fake users, profiles, roles, or credentials that could be mistaken for production data.
- [ ] **Step 3: Verify the CLI configuration without a remote login.** Run `npx supabase start` only when Docker and the Supabase CLI are available; otherwise run `npx supabase config validate` or the repository's supported equivalent and record the exact unavailable prerequisite rather than inventing credentials. Expected: configuration parses, with no remote mutation.
- [ ] **Step 4: Commit.** `git add supabase/config.toml supabase/seed.sql && git commit -m "chore: add local Supabase project configuration"`

### Task 3: Add the Phase 1 PostgreSQL schema and bootstrap functions

**Files:**
- Create: `supabase/migrations/202609210001_identity_profiles_roles_links.sql`
- Create: `supabase/tests/202609210001_identity_profiles_roles_links.sql`

**Interfaces:**
- Produces tables `profiles`, `user_roles`, and `legacy_identity_links`.
- Produces enum/check constraints for `user_role` (`student`, `professional`, `admin`) and link status.
- Produces unique constraints on `profiles.id`, `(user_roles.user_id, user_roles.role)`, `legacy_identity_links.legacy_user_id`, and `legacy_identity_links.supabase_user_id`.
- Produces a controlled `auth.users` trigger that creates a profile and `student` role without copying arbitrary untrusted metadata beyond a bounded display name.

- [ ] **Step 1: Write database tests for schema invariants.** Assert table existence, primary/foreign keys, role uniqueness, one-to-one identity links, timestamp defaults, display-name length constraints, and that a new auth user receives exactly one profile and `student` role.
- [ ] **Step 2: Run the database tests before the migration exists.** Run `npx supabase db reset` followed by `npx supabase test db` when local services are available. Expected: tests fail because the schema is absent.
- [ ] **Step 3: Write the migration.** Create only Phase 1 tables and indexes. Use `auth.users.id` as the root key, `timestamptz` defaults, explicit update timestamps, and no columns for professional profiles, invites, programs, assignments, or executions.
- [ ] **Step 4: Add safe bootstrap logic.** Create the profile/`student` trigger with a `SECURITY DEFINER` function whose `search_path` is fixed; do not create a client-callable role-grant function for `admin`.
- [ ] **Step 5: Run database tests after the migration.** Expected: schema and bootstrap tests pass on a clean local database.
- [ ] **Step 6: Commit.** `git add supabase/migrations/202609210001_identity_profiles_roles_links.sql supabase/tests/202609210001_identity_profiles_roles_links.sql && git commit -m "feat: add Supabase identity profile and role schema"`

### Task 4: Encode RLS for profile, role, and identity-link boundaries

**Files:**
- Modify: `supabase/migrations/202609210001_identity_profiles_roles_links.sql`
- Modify: `supabase/tests/202609210001_identity_profiles_roles_links.sql`

**Interfaces:**
- Produces RLS policies for all three Phase 1 tables.
- A user can read/update only their own permitted profile fields.
- A user can read their own roles but cannot insert, delete, or elevate roles directly.
- A user can read only their own identity link and cannot create or rewrite one directly.
- Backend service operations use explicit server-side functions or service-role calls after authorization; RLS is not disabled globally.

- [ ] **Step 1: Add failing cross-user policy tests.** Run as two authenticated test users and a service role. Cover own profile select/update, other profile denial, forbidden `id` change, own role select, direct role insert/update/delete denial, own link select, other link denial, and direct link insert/update/delete denial.
- [ ] **Step 2: Run tests to confirm the policies fail.** Expected: unauthorized operations currently succeed or policies are absent.
- [ ] **Step 3: Add explicit RLS enablement and policies.** Use `auth.uid()` checks. Profile updates must not allow changing `id`, `created_at`, or server-managed fields. Role and link writes are restricted to controlled backend/service operations; no policy grants admin or professional from client input.
- [ ] **Step 4: Add policy regression tests.** Include a test that a user with `professional` still cannot read another user's profile or link, and that `admin` is not inferred from a client-supplied claim.
- [ ] **Step 5: Run the clean database authorization suite.** Expected: all own-user operations pass, all cross-user and escalation attempts fail, and service-side setup remains possible only through the intended path.
- [ ] **Step 6: Commit.** `git add supabase/migrations/202609210001_identity_profiles_roles_links.sql supabase/tests/202609210001_identity_profiles_roles_links.sql && git commit -m "feat: enforce Phase 1 Supabase RLS policies"`

### Task 5: Create the server-only Supabase client boundary

**Files:**
- Create: `api/supabase/client.js`
- Create: `api/supabase/client.test.js`
- Modify: `api/package.json`
- Modify: `api/package-lock.json`

**Interfaces:**
- Produces `createSupabasePublicClient()` for server-side Auth verification that does not carry service privileges and `createSupabaseAdminClient()` for narrowly scoped operations.
- Both factories return `null` when the required optional configuration is absent.
- The admin factory refuses to run in a browser-like environment and never exports the service key in errors or serialized objects.

- [ ] **Step 1: Write failing factory tests.** Cover absent config, public-only config, complete server config, malformed config, and assertions that returned client wrappers do not expose raw service keys in their public shape.
- [ ] **Step 2: Run focused API tests.** Expected: fail because the boundary and dependency do not exist.
- [ ] **Step 3: Add the pinned Supabase server dependency.** Use the repository's lockfile workflow and record the exact package version in `api/package.json`; do not add a frontend dependency yet.
- [ ] **Step 4: Implement lazy factories.** Construct clients only when a route needs them, keep service-role creation in one file, disable implicit persistence of auth sessions on the server, and return a controlled `supabase-unavailable` result when configuration is absent.
- [ ] **Step 5: Run focused tests and a repository secret scan.** Expected: factories pass and no source file contains a real credential or service key literal.
- [ ] **Step 6: Commit.** `git add api/supabase/client.js api/supabase/client.test.js api/package.json api/package-lock.json && git commit -m "feat: add server-only Supabase client boundary"`

### Task 6: Define runtime contracts and identity repository operations

**Files:**
- Create: `api/supabase/contracts.js`
- Create: `api/supabase/identity.js`
- Create: `api/supabase/identity.test.js`

**Interfaces:**
- Implements the signatures in the Interfaces section above.
- `verifyAccessToken` returns only a validated Supabase user identity.
- `getAccountSnapshot` returns normalized profile, roles, and optional link without raw auth metadata or credentials.
- `linkLegacyIdentity` requires a valid current legacy user and a verified Supabase user, rejects conflicting existing links, and performs an idempotent same-pair retry.
- `requestProfessionalRole` inserts only `professional`; it never inserts `admin` and never creates `professional_profiles`.

- [ ] **Step 1: Write failing repository tests with dependency injection.** Cover token verification failure, absent Supabase, malformed legacy ID, first link, same-pair retry, legacy ID linked to a different Supabase user, Supabase user linked to a different legacy ID, display-name preservation, automatic student role, professional-role request, and admin escalation rejection.
- [ ] **Step 2: Run focused tests to confirm the boundary is absent.** Expected: failure at module import or unimplemented operation.
- [ ] **Step 3: Implement pure contract normalizers.** Enforce bounded strings, UUID shape where applicable, known role values, and omission of unknown/private fields.
- [ ] **Step 4: Implement repository calls through injected public/admin clients.** Verify the bearer token with Supabase Auth, resolve the current legacy user only from the server session, use a transaction/RPC or equivalent atomic operation for the identity link, and map unique-constraint conflicts to stable errors.
- [ ] **Step 5: Run focused tests and API tests.** Expected: all identity cases pass without requiring a real Supabase project by using deterministic client fakes.
- [ ] **Step 6: Commit.** `git add api/supabase/contracts.js api/supabase/identity.js api/supabase/identity.test.js && git commit -m "feat: add Supabase identity and account contracts"`

### Task 7: Mount additive account endpoints without changing legacy auth

**Files:**
- Create: `api/supabase/routes.js`
- Modify: `api/server.js`
- Modify: `api/server.integration.test.js`

**Interfaces:**
- Adds `GET /api/account` for an authenticated Supabase/linked account snapshot when configured.
- Adds `POST /api/account/identity-link` for a valid legacy session plus verified Supabase bearer token.
- Adds `POST /api/account/roles/professional` for a verified Supabase identity; the endpoint is capability-only and does not create a professional profile.
- Existing `/api/me`, `/api/login/*`, `/api/register/*`, `/api/logout*`, `/api/data`, `/api/admin/*`, and `/api/activity` contracts remain unchanged.

- [ ] **Step 1: Add integration tests first.** Cover anonymous requests returning the established unauthenticated result, missing Supabase configuration returning a stable unavailable response without blocking `/api/config` or `/api/me`, legacy WebAuthn session preservation, bearer-token requirement, same-pair idempotency, conflicting link rejection, and refusal to grant admin from request JSON.
- [ ] **Step 2: Run the API integration suite.** Expected: new endpoint tests fail while existing four API tests continue to pass.
- [ ] **Step 3: Implement route mounting.** Keep the existing monolithic route table behavior intact; dispatch only the new `/api/account` paths to the Supabase route module after existing request-body/session helpers are available.
- [ ] **Step 4: Implement request authentication rules.** Require the existing signed legacy cookie for linking, require a bearer token for Supabase identity, never trust a client-supplied user ID/role, and return generic errors that do not enumerate identities.
- [ ] **Step 5: Run focused and full API tests.** Expected: new boundaries pass and all existing auth/data/admin/sync tests remain green.
- [ ] **Step 6: Commit.** `git add api/supabase/routes.js api/server.js api/server.integration.test.js && git commit -m "feat: expose additive account identity endpoints"`

### Task 8: Add the minimal account bridge while preserving anonymous and legacy UX

**Files:**
- Modify: `frontend/src/lib/api.js`
- Modify: `frontend/src/views/Settings.jsx`
- Modify: `frontend/src/lib/onboarding-locales.js`
- Test: `frontend/src/lib/api.account.test.js`, `frontend/src/views/Landing.test.jsx`, and `frontend/src/store/useStore.sync.test.js`

**Interfaces:**
- Adds `linkSupabaseIdentity(accessToken)` and `requestSupabaseProfessionalRole(accessToken)` helpers that send a Supabase access token only to the backend; they do not replace `passkeyLogin`, `passkeyRegister`, `signOut`, or `signOutAll`.
- Anonymous boot remains independent of Supabase configuration.
- Settings keeps account-link status in component state; it does not add Supabase identity data to `useStore` or `gym_state_v1`. Existing `gym_user`, `gym_state_v1`, `gym_dirty`, `gym_sync_conflict`, and `S.active` semantics remain unchanged.

- [ ] **Step 1: Add failing frontend tests.** Cover `linkSupabaseIdentity` sending only a bearer access token, guest boot with no Supabase variables, existing passkey login, local state remaining after opening account/link UI, logout clearing only the current legacy session as before, and no service-role string in the built-facing frontend module.
- [ ] **Step 2: Run focused frontend tests.** Expected: new account assertions fail; existing 489-test baseline remains the comparison point.
- [ ] **Step 3: Implement the smallest account bridge.** Keep anonymous entry and all current routes intact. Add the explicit Settings action for linking an already authenticated Supabase account to the current legacy session, keep the access token in component memory only, and do not add professional screens or require account creation at startup.
- [ ] **Step 4: Add only required locale entries.** Run the existing i18n checks and avoid changing unrelated translations.
- [ ] **Step 5: Run focused frontend tests plus existing auth/store/workout tests.** Expected: account bridge passes and no workout/sync behavior changes.
- [ ] **Step 6: Commit.** `git add frontend/src/lib/api.js frontend/src/store/useStore.js frontend/src/views/Settings.jsx frontend/src/lib frontend/src/locales && git commit -m "feat: preserve anonymous and legacy account flows"`

### Task 9: Verify migration reproducibility, security boundaries, and full regression

**Files:**
- Modify: `supabase/tests/202609210001_identity_profiles_roles_links.sql`
- Create: `scripts/check-supabase-boundaries.mjs`
- Create: `scripts/check-supabase-boundaries.test.mjs`
- Modify: `package.json` only to add a deterministic `check:supabase` script
- Test: complete repository suites and build artifacts

**Interfaces:**
- `npm run check:supabase` fails if service-role names or private Supabase env exposure appear under `frontend/`, if migrations are absent from the expected path, or if the Phase 1 migration contains forbidden future-domain tables.
- The final verification does not require a remote Supabase project.

- [ ] **Step 1: Write failing static-boundary tests.** Detect private Supabase secret names under frontend source/build inputs, missing migration/config files, and accidental Phase 2+ table names in the Phase 1 migration.
- [ ] **Step 2: Run the checks and confirm failures before the checker exists.** Expected: command unavailable or tests fail.
- [ ] **Step 3: Implement the repository checker with explicit allowlists.** Scan tracked source/config files only, ignore `node_modules`, allow backend env parsing, and report file/line for violations.
- [ ] **Step 4: Run local migration reset/tests.** When local Docker/CLI is available, run `npx supabase db reset` and `npx supabase test db`; otherwise record the environment limitation and still run SQL structure/static checks.
- [ ] **Step 5: Run all required verification.** Run `npm test`, `npm run build`, `npm --prefix frontend run check:i18n`, `npm run check:supabase`, and `git diff --check`. Expected: all pass, with existing baseline tests preserved plus new Phase 1 coverage.
- [ ] **Step 6: Review the complete diff against `main`.** Confirm no workout, plan, history, PWA, Capacitor, anonymous, or legacy sync changes slipped into scope. If the review exposes a concrete Phase 1 policy or migration defect, add the corresponding regression test and fix, then rerun affected tests.
- [ ] **Step 7: Commit final verification tooling.** `git add scripts/check-supabase-boundaries.mjs scripts/check-supabase-boundaries.test.mjs package.json supabase && git commit -m "test: verify Supabase Phase 1 boundaries"`

## Expected future environment commands

No command in the plan contacts a remote project or requires credentials. Once credentials are intentionally supplied during implementation, use separate environment files/secrets for each environment:

```text
# Frontend public build inputs
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=

# Backend-only
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Expected local verification commands after implementation:

```powershell
npx supabase start
npx supabase db reset
npx supabase test db
npm test
npm run build
npm --prefix frontend run check:i18n
npm run check:supabase
git diff --check
```

Remote deployment will be a later, explicitly authorized operation using the linked Supabase project and its migration workflow. It is not part of the planning turn or of any implementation step that lacks credentials.

## Planned commit sequence

1. `chore: prepare optional Supabase configuration`
2. `chore: add local Supabase project configuration`
3. `feat: add Supabase identity profile and role schema`
4. `feat: enforce Phase 1 Supabase RLS policies`
5. `feat: add server-only Supabase client boundary`
6. `feat: add Supabase identity and account contracts`
7. `feat: expose additive account identity endpoints`
8. `feat: preserve anonymous and legacy account flows`
9. `test: verify Supabase Phase 1 boundaries`

The implementation should stop after this phase's verification. No Phase 2 work may be included in these commits.
