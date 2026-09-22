# FPP Professional — Fase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Implement the owner-only Professional Profile foundation, including migration 004, RLS-protected CRUD, derived completeness states, mobile-first management UI, preview, validation, avatar/profile integration, and regression coverage without starting Phase 3.

**Architecture:** Add public.professional_profiles as an ownership-rooted Supabase table. Browser requests use a request-scoped Supabase public client authenticated with the user bearer token, so normal profile reads and writes are enforced by RLS and never use SUPABASE_SECRET_KEY; the Node admin client remains available only for existing account operations and future privileged workflows. Add a focused frontend route under the existing More area, reusing profiles.display_name, profiles.avatar_ref, AvatarImage, existing UI primitives, the current i18n loader, and the existing mobile shell.

**Tech Stack:** Node 22 ESM API, React 19/Vite, Zustand, React Router 7, existing UI primitives and CSS tokens, Supabase PostgreSQL/RLS, Supabase CLI migrations, pgTAP, Node built-in test runner, Vitest.

**Spec:** docs/superpowers/specs/2026-09-21-fpp-professional-phase-2-design.md

## Global Constraints

- Create only professional_profiles and its enum, constraints, indexes, grants, RLS policies, protected-field trigger, and updated_at trigger in migration 004.
- Do not modify migrations 001, 002, or 003.
- Owner-only direct SELECT is the only Phase 2 profile read; another authenticated user and anon must receive no rows.
- INSERT and UPDATE require auth.uid() = user_id and the professional role; the client cannot select or change privileged verification states.
- verification_status starts as unverified; no verification workflow, pending workflow, or rejected workflow is implemented.
- Protect user_id, created_at, verification_status, and updated_at in the database; use clock_timestamp() for server-controlled update advancement.
- Losing the professional role retains the row and does not trigger deletion; subsequent professional writes are denied.
- Do not add display_name or avatar_ref to professional_profiles; use profiles.display_name and canonical persisted profiles.avatar_ref.
- Keep avatarId as the existing frontend asset-mapping vocabulary only; do not add Storage or a second avatar system.
- Do not add invitations, relationships, students, programs, templates, assignments, executions, feedback, dashboard, analytics, notifications, Realtime, offline sync, or Phase 3 access.
- Preserve guest mode, WebAuthn, gym_state_v1, workout flow, history, PWA, Capacitor, logout, and existing state sync.
- Save requires connectivity; do not add a queue, background retry, relational cache, or sync engine for professional profiles.
- All new UI copy uses the existing t() system and all locale key sets remain synchronized.
- No secret, database password, access token, or secret key may enter frontend source, localStorage, the Vite bundle, tests as a real value, logs, or Git.
- Follow RED → GREEN → REFACTOR for each behavior, run the focused test before implementation, and commit only coherent passing work.

## Pre-implementation authentication bootstrap gate

The current Phase 1 implementation has a real boundary gap that must be resolved before Task 4 or any Professional Profile UI is implemented. The existing frontend can receive a Supabase bearer only while the Settings account-link sheet is open; it does not persist that bearer, does not own a Supabase Auth session, and does not currently bootstrap a new Supabase bearer after a browser reload. The existing WebAuthn cookie keeps the legacy FPP session valid, but it cannot by itself authenticate a Supabase public client or satisfy Supabase RLS for normal profile edits.

Therefore the mandatory reload test is:

1. authenticated FPP/WebAuthn session links to the Supabase identity and receives a bearer;
2. the bearer is used only in memory for the profile request;
3. the browser reload loses the in-memory bearer while the WebAuthn cookie remains valid;
4. an approved Phase 2 bootstrap mechanism must obtain a fresh user-scoped Supabase context;
5. ProfessionalProfile loads and edits through the public client with RLS still active.

The current codebase does not yet provide step 4. Do not solve it by persisting a bearer/refresh token, by using localStorage/sessionStorage/IndexedDB/gym_state_v1, by exposing SUPABASE_SECRET_KEY, or by turning the backend admin client into the normal profile-edit path. Do not create the worktree or begin Task 1 until the user authorizes a concrete bootstrap design that reuses the Phase 1 identity boundary without bypassing RLS. This is a stop condition, not permission to invent a second authentication system.

## Review Focus

1. A non-professional cannot create a profile, and a user who loses the role cannot update it; pin both policy paths in pgTAP.
2. A professional cannot enumerate another professional’s profile, and anon cannot read any row; pin owner, cross-user, ordinary-authenticated, and anonymous sessions in pgTAP and route tests.
3. A client cannot self-verify or rewrite user_id, created_at, or updated_at; pin trigger errors and a strictly advanced clock_timestamp() value in pgTAP.
4. A profile with only professional name and usable general identity is COMPLETE; optional bio, city, specialties, and registration fields must not incorrectly block completion.
5. The UI must not imply that declared registration data is verified, must preserve profiles.avatar_ref, and must show a reconnect/offline state without persisting bearer tokens.
6. Existing routes, workouts, state sync, anonymous mode, logout, PWA, Capacitor, i18n, and dark/light theme behavior must remain regression-covered.

## Repository Map

### Create

- supabase/migrations/202609210004_professional_profiles.sql — Phase 2 enum, table, constraints, indexes, grants, RLS, policies, and protected-field/timestamp trigger.
- supabase/tests/202609210004_professional_profiles.sql — concrete pgTAP schema, authorization, trigger, validation, grant, and derived-state assertions.
- api/supabase/professional-profile.js — request-scoped repository and normalized profile contract.
- api/supabase/professional-profile.test.js — repository and payload-boundary tests with injected public clients.
- frontend/src/lib/supabase-session.js — ephemeral bearer-token bridge with subscribe/set/clear operations.
- frontend/src/lib/supabase-session.test.js — token-memory and clearing tests.
- frontend/src/lib/professional-profile.js — frontend normalization, validation, payload shaping, and NO_PROFILE/INCOMPLETE/COMPLETE derivation.
- frontend/src/lib/professional-profile.test.js — pure domain tests.
- frontend/src/views/ProfessionalProfile.jsx — professional profile entry, form, preview, loading, error, offline, capability-absent, and success states.
- frontend/src/views/ProfessionalProfile.test.jsx — route-level UI and accessibility behavior.

### Modify

- api/supabase/client.js and api/supabase/client.test.js — add a request-scoped public client option that sends the bearer token through Supabase client headers without exposing the secret key.
- api/supabase/contracts.js — add normalized professional profile and role/profile error contracts if the existing contract module remains the repository boundary.
- api/supabase/routes.js — add authenticated GET /api/professional-profile, POST /api/professional-profile, and PATCH /api/professional-profile; do not add DELETE.
- api/server.js — pass the request-scoped public client factory into the route dispatcher without changing legacy routes.
- api/server.integration.test.js — cover bearer authentication, capability errors, create/read/update behavior, forbidden DELETE, and non-leakage.
- frontend/src/lib/api.js — add profile request helpers that accept only the ephemeral public access token.
- frontend/src/views/Settings.jsx — set the ephemeral token after successful existing account linking and clear it on sign-out paths; do not persist it.
- frontend/src/App.jsx — lazy-load/preload and register the new route.
- frontend/src/views/More.jsx — add the existing-shell entry for My professional profile without a new bottom navigation.
- frontend/src/index.css — add focused responsive styles using existing tokens, safe-area spacing, bottom-navigation clearance, dark/light variables, and reduced-motion-compatible states.
- frontend/src/locales/{de,es,fr,hi,it,ko,pl,pt,ru,tr,zh}.js — add the exact new translation keys used by the profile UI.
- frontend/src/lib/api.account.test.js — test profile request headers and payload boundary.
- Existing UI, store, workout, and i18n tests are extended only where a regression assertion belongs; no unrelated refactor is planned.

### Test and verification targets

- supabase/tests/202609210004_professional_profiles.sql
- api/supabase/professional-profile.test.js
- api/server.integration.test.js
- frontend/src/lib/professional-profile.test.js
- frontend/src/lib/supabase-session.test.js
- frontend/src/views/ProfessionalProfile.test.jsx
- frontend/src/lib/api.account.test.js
- Existing frontend/src/components/TabBar.test.jsx, frontend/src/views/Workout.test.jsx, frontend/src/store/useStore.sync.test.js, and frontend/src/App.profile-header.test.jsx where the route or shell regression is relevant.

## Implementation Tasks

### Task 1: Add the Phase 2 schema and executable pgTAP authorization contract

**Files:**

- Create: supabase/migrations/202609210004_professional_profiles.sql
- Create: supabase/tests/202609210004_professional_profiles.sql
- Read-only reference: supabase/migrations/202609210001_identity_profiles_roles_links.sql
- Read-only reference: supabase/migrations/202609210003_fix_identity_updated_at.sql

**Interfaces:**

- Produces enum public.professional_verification_status with unverified, pending, verified, and rejected.
- Produces table public.professional_profiles with exactly user_id, professional_name, bio, specialties, city_region, registration_type, registration_number, verification_status, created_at, and updated_at.
- Produces owner-only SELECT, role-gated INSERT/UPDATE, no client DELETE, and no contextual Phase 3 access.
- Produces database-enforced limits for professional name, bio, specialties, city/region, registration type, and registration number.

- [ ] Step 1: Write the failing pgTAP assertions. Start the test with a plan count matching every assertion. Include has_table, col_is_pk, fk_ok, has_type, has_rls, and has_trigger checks. Create two auth users through the existing Phase 1 bootstrap, grant professional only to user A, and run service-role setup. Assert:
  - A inserts its own row with omitted verification_status and receives unverified.
  - A cannot insert user B’s row.
  - B, with only student, cannot insert its own row.
  - A selects its own row.
  - A sees zero rows for B; B sees zero rows for A; an ordinary authenticated user cannot enumerate; anon sees zero rows.
  - A updates allowed fields and cannot update B.
  - A cannot change user_id, created_at, verification_status, or updated_at.
  - updated_at is strictly greater than a timestamp captured before an allowed update.
  - A cannot delete its row; the row remains when the professional role is absent.
  - professional_name rejects blank/whitespace and length 121.
  - bio rejects length 2,001; city 121; registration type 41; registration number 81.
  - specialties rejects more than 8 items, an item over 40 characters, non-normalized values under the chosen contract, and duplicates after normalization.
  - authenticated has SELECT/INSERT/UPDATE but no DELETE; anon has no table grant.
  - NO_PROFILE, INCOMPLETE, and COMPLETE are queryable facts, not a persisted is_complete column.

- [ ] Step 2: Run npx supabase db reset and npx supabase test db only if the local CLI/Docker process is available. Expected before the migration: the new test cannot find professional_profiles. Do not link, push, or contact the remote project.

- [ ] Step 3: Write the migration. Create only the new enum and table. Use user_id uuid primary key references auth.users(id) on delete restrict, bounded text columns, text[] specialties, verification_status default unverified, and server timestamp defaults. Add checks for trimmed non-empty professional_name, scalar lengths, maximum eight specialties, lowercase trimmed specialty values, and duplicates after normalization. Add only ownership/capability indexes needed by the policy and owner lookup; do not add a public-directory index.

- [ ] Step 4: Add grants and RLS. Revoke table privileges from public, anon, and authenticated before granting SELECT, INSERT, UPDATE to authenticated. Enable RLS and create policies:
  - SELECT using user_id = auth.uid().
  - INSERT with user_id = auth.uid(), verification_status = unverified, and an exists query for the caller’s professional row in user_roles.
  - UPDATE using and with check clauses requiring ownership and the professional role.
  - No client DELETE grant or policy that permits deletion.
  Do not create a policy exposing another user’s row.

- [ ] Step 5: Add the protected-field trigger. Fix search_path. On insert, set created_at and updated_at from the server and enforce unverified for an authenticated caller. On update, always reject user_id or created_at changes; reject verification_status changes when auth.uid() is non-null; overwrite updated_at with clock_timestamp(). This leaves room for a future privileged workflow without implementing one now.

- [ ] Step 6: Run the database tests after the migration. Expected: every assertion passes on a clean local database. If Docker is unavailable, record the exact limitation and do not substitute a remote mutation.

- [ ] Step 7: Run git diff --check and commit:
  feat: add professional profile schema and RLS

### Task 2: Add the API contract, normalization, and request-scoped public Supabase client

**Files:**

- Create: api/supabase/professional-profile.js
- Create: api/supabase/professional-profile.test.js
- Modify: api/supabase/client.js
- Modify: api/supabase/client.test.js
- Modify api/supabase/contracts.js only if normalized contract exports belong there.

**Interfaces:**

- Produces normalizeProfessionalProfile(row, profileRow) returning userId, professionalName, bio, specialties, cityRegion, registrationType, registrationNumber, verificationStatus, createdAt, updatedAt, displayName, avatarRef, and state.
- Produces normalizeProfessionalProfileInput(input) returning only professionalName, bio, specialties, cityRegion, registrationType, and registrationNumber.
- Produces createSupabasePublicClient(env, { accessToken }); the token is used only in an in-memory request-scoped client header and is never returned by toJSON().
- Produces getProfessionalProfile(), createProfessionalProfile(input), and updateProfessionalProfile(input).

- [ ] Step 1: Write failing Node tests. Inject fake clients and assert camelCase normalization, profiles.display_name and profiles.avatar_ref integration, protected request-field stripping, trimmed/limited specialties, missing profile as NO_PROFILE, no admin-client use for normal operations, and no token serialization.

- [ ] Step 2: Run npm --prefix api test -- --test-name-pattern "professional profile|request-scoped". Expected: the module exports and request-scoped option are absent.

- [ ] Step 3: Extend createSafeClient without changing its default behavior. When accessToken is supplied, create the Supabase client with global.headers.Authorization = Bearer token. Keep persistSession false, autoRefreshToken false, and detectSessionInUrl false. Keep createSupabaseAdminClient server-only.

- [ ] Step 4: Implement normalization using the exact spec limits: professional name 120, bio 2,000, each specialty 40 with maximum 8, city/region 120, registration type 40, registration number 80. Normalize scalars with trim-to-null, specialties with trim/lowercase, reject duplicates, and never accept system-controlled fields.

- [ ] Step 5: Implement repository calls using only the request-scoped public client. Read the own professional_profiles and profiles rows; create with only editable fields and authenticated ownership; update only editable fields. Map errors to profile-not-found, professional-role-required, profile-conflict, profile-validation-failed, and profile-unavailable without echoing payloads or credentials.

- [ ] Step 6: Run focused tests. Expected: normalizers, input stripping, token isolation, and fake-client repository behavior pass.

- [ ] Step 7: Run git diff --check and commit:
  feat: add professional profile API contract

### Task 3: Mount owner-only professional profile endpoints

**Files:**

- Modify: api/supabase/routes.js
- Modify: api/server.js
- Modify: api/server.integration.test.js

**Interfaces:**

- Adds GET /api/professional-profile returning { professionalProfile } for the bearer owner.
- Adds POST /api/professional-profile accepting only the six editable fields and returning the normalized profile.
- Adds PATCH /api/professional-profile accepting only the six editable fields and returning the normalized profile.
- No DELETE route exists; a DELETE request receives the existing generic not-found/method response.
- No endpoint accepts user_id, verification_status, created_at, updated_at, or another user ID.

- [ ] Step 1: Write failing integration tests for missing bearer 401, token-only request-scoped client, NO_PROFILE, protected-field stripping, PATCH allowed fields, capability/RLS errors, absent DELETE, and responses without tokens, keys, passwords, or raw Supabase payloads.

- [ ] Step 2: Run the focused API integration tests. Expected: handlers are absent and tests fail.

- [ ] Step 3: Reuse bearerToken, require a non-empty token, parse JSON with readBody, pass only normalized input to the repository, and never trust request user IDs or role claims. Keep all existing legacy routes unchanged.

- [ ] Step 4: Map unavailable configuration to the existing unavailable response, invalid token to 401, missing professional capability to 403, validation to 422, duplicate profile to 409, and unexpected failures to the existing generic 500. Do not reveal whether another user’s profile exists.

- [ ] Step 5: Run npm --prefix api test. Expected: profile route tests and existing account, WebAuthn, data, logout, admin, and push tests pass.

- [ ] Step 6: Commit:
  feat: expose owner-only professional profile routes

### Task 4: Add the ephemeral frontend Supabase session bridge and API helpers

**Files:**

- Create: frontend/src/lib/supabase-session.js
- Create: frontend/src/lib/supabase-session.test.js
- Modify: frontend/src/lib/api.js
- Modify: frontend/src/lib/api.account.test.js
- Modify: frontend/src/views/Settings.jsx

**Interfaces:**

- Produces getSupabaseAccessToken(), setSupabaseAccessToken(token), clearSupabaseAccessToken(), and subscribeSupabaseSession(listener).
- Produces getProfessionalProfile(accessToken), createProfessionalProfile(accessToken, input), and updateProfessionalProfile(accessToken, input).
- Stores the token only in module memory; it does not use localStorage, Zustand gym_state_v1, cookies, URL parameters, or logs.
- Requires an approved reload/bootstrap mechanism before it can claim that ProfessionalProfile remains available after browser reload; the current Phase 1 bridge is insufficient by itself.

- [ ] Step 0: Resolve the authentication bootstrap gate before writing implementation code. Add a failing integration test that starts with a valid FPP/WebAuthn session, loses the in-memory bearer, bootstraps a fresh user-scoped Supabase context without persisted credentials or SUPABASE_SECRET_KEY, and reaches ProfessionalProfile. If the existing Phase 1 boundary cannot provide this behavior without a materially new authentication decision, stop and request that decision; do not implement the remaining tasks.

- [ ] Step 1: Write failing frontend tests for trimmed-token subscription, clearing, no serialization, bearer headers, POST/PATCH JSON bodies, and absence of protected fields in client payloads.

- [ ] Step 2: Run npm --prefix frontend test -- src/lib/supabase-session.test.js src/lib/api.account.test.js. Expected: the module and profile helpers do not exist.

- [ ] Step 3: Implement the memory-only bridge. On successful existing account linking, call setSupabaseAccessToken(accessToken) before closing the sheet. Clear it on existing sign-out and sign-out-everywhere success paths.

- [ ] Step 4: Implement profile helpers with GET for reads and POST/PATCH for writes. Require a non-empty token and pass it only in Authorization. Do not add a frontend secret, admin client, or service-role variable.

- [ ] Step 5: Run focused tests and npm run check:supabase. Expected: helpers pass and the frontend boundary scan finds no private Supabase reference.

- [ ] Step 6: Commit:
  feat: add ephemeral professional profile session bridge

### Task 5: Add shared Professional Profile domain logic and derived states

**Files:**

- Create: frontend/src/lib/professional-profile.js
- Create: frontend/src/lib/professional-profile.test.js

**Interfaces:**

- Produces PROFESSIONAL_SPECIALTIES with the approved initial slugs.
- Produces PROFILE_STATES = { NO_PROFILE, INCOMPLETE, COMPLETE }.
- Produces normalizeProfessionalProfile(value), validateProfessionalProfileDraft(draft), toProfessionalProfilePayload(draft), and deriveProfessionalProfileState(profile).
- Draft shape is professionalName, bio, specialties, cityRegion, registrationType, and registrationNumber.

- [ ] Step 1: Write failing pure tests for null → NO_PROFILE, valid professional name plus usable displayName → COMPLETE with optional fields empty, blank identity → INCOMPLETE, stable form normalization, specialty limits/normalization/duplicates, scalar limits, editable-only payload, exclusion of verification/timestamps/user/avatar fields, and declared registration remaining separate from verification status.

- [ ] Step 2: Run npm --prefix frontend test -- src/lib/professional-profile.test.js. Expected: exports are absent.

- [ ] Step 3: Implement the pure module. Keep completeness derived and side-effect free. Use profiles.display_name for general identity and profiles.avatar_ref mapped through the existing avatarId/asset resolver. Do not write is_complete.

- [ ] Step 4: Run focused tests. Expected: all domain tests pass.

- [ ] Step 5: Commit:
  feat: define professional profile domain states

### Task 6: Build the mobile-first Professional Profile screen and route

**Files:**

- Create: frontend/src/views/ProfessionalProfile.jsx
- Create: frontend/src/views/ProfessionalProfile.test.jsx
- Modify: frontend/src/App.jsx
- Modify: frontend/src/views/More.jsx
- Modify: frontend/src/index.css

**Interfaces:**

- Adds route /professional-profile.
- Consumes the session bridge, profile API helpers, domain normalizers, useStore general profile identity, AvatarImage, AppHeader, Section, Row, TextField, TextArea, and Button.
- Produces accessible capability-absent, disconnected/reconnect, loading, NO_PROFILE, INCOMPLETE, COMPLETE, editing, preview, saving, success, validation-error, server-error, and offline states.
- Renders no third-party profile listing or contextual viewing.

- [ ] Step 1: Write failing component tests for the More entry, no-token reconnect state, 403 capability state, NO_PROFILE create state, INCOMPLETE completion state, COMPLETE edit/preview state, exactly six editable fields, avatar reuse without upload, local-only preview, declared-registration copy, offline save preservation, success/error alerts, labels, error associations, keyboard specialty controls, and visible focus.

- [ ] Step 2: Run npm --prefix frontend test -- src/views/ProfessionalProfile.test.jsx. Expected: route, view, and entry are absent.

- [ ] Step 3: Lazy-load and register the route in App.jsx, include it in preloadCoreRoutes, and add one More row. Do not change TabBar or add a professional-only bottom-nav item.

- [ ] Step 4: Subscribe to the ephemeral token bridge, load only with a token, show reconnect after reload without a token, map capability denial to a non-enumerating message, and keep guest mode outside the feature.

- [ ] Step 5: Implement local React draft state. Create sends six editable fields; edit sends PATCH. Status and timestamps are read-only. On success normalize and derive state; on offline/error preserve the mounted draft and never write it to gym_state_v1.

- [ ] Step 6: Implement preview with professional name, general display name, reused avatar, bio, specialties, city, declared registration, and unverified status. State that the preview does not make the profile visible to other users in Phase 2.

- [ ] Step 7: Add focused CSS using existing tokens, responsive single-column layout, bottom-navigation safe-area clearance, dark/light variables, focus states, and reduced-motion compatibility. Do not add a dense dashboard or second card system.

- [ ] Step 8: Run focused component tests and npm --prefix frontend run build. Expected: profile states pass and the build succeeds.

- [ ] Step 9: Commit:
  feat: add mobile professional profile management

### Task 7: Add i18n, accessibility, and avatar/profile regression coverage

**Files:**

- Modify: frontend/src/locales/de.js, es.js, fr.js, hi.js, it.js, ko.js, pl.js, pt.js, ru.js, tr.js, zh.js.
- Modify: frontend/src/App.profile-header.test.jsx and frontend/src/components/TabBar.test.jsx.
- Modify frontend/src/store/useStore.sync.test.js only if the token/session change touches sign-out behavior.

**Interfaces:**

- Provides identical keys in every locale pack for the new profile UI.
- Keeps the general identity/avatar contract unchanged.
- Keeps bottom navigation, header profile rendering, local state sync, and sign-out behavior unchanged.

- [ ] Step 1: Add regression assertions for existing profile-header avatarId rendering, existing local avatar asset resolution, existing TabBar item count/paths, and ephemeral-token clearing without changing gym_state_v1 semantics.

- [ ] Step 2: Run focused regressions and expect only the new session integration assertions to fail before copy/session wiring is complete.

- [ ] Step 3: Add the same keys to every locale for: Professional area; My professional profile; Configure your professional profile; Complete your professional profile; Professional profile complete; Create profile; Edit profile; Preview; Professional name; Bio; Specialties; City or region; Registration type; Registration number; Declared registration; Not verified; This preview is not visible to other users yet.; Reconnect your Supabase account to manage this profile.; A professional role is required to create or edit this profile.; A connection is required to save.; Profile saved; Could not load your professional profile; Could not save your professional profile; Choose up to 8 specialties; Remove {0}; Add {0}; No professional profile yet; and each scalar-limit/duplicate-specialty validation message.

- [ ] Step 4: Run npm --prefix frontend run check:i18n. Expected: locale key sets and strict source-string checks pass.

- [ ] Step 5: Run focused profile, avatar, TabBar, store-sync, and header tests. Expected: existing navigation, avatar, local-first state, and sign-out behavior remain green.

- [ ] Step 6: Commit:
  test: cover professional profile UX boundaries

### Task 8: Verify repository, migration, security, and full regression

**Files:**

- No new production files.
- Read-only review against main and all files changed by Tasks 1–7.

**Interfaces:**

- The completed Phase 2 branch exposes only owner profile operations and no Phase 3 access path.
- Verification commands produce evidence without Docker dependency for non-database suites.
- Remote application remains a separate explicitly authorized action after implementation and review.

- [ ] Step 1: Run focused checks:
  ~~~text
  git diff --check
  npm --prefix api test
  npm --prefix frontend test -- src/lib/supabase-session.test.js src/lib/professional-profile.test.js src/views/ProfessionalProfile.test.jsx
  npm --prefix frontend run check:i18n
  npm run check:supabase
  ~~~
  Expected: no secret-boundary violation, no missing locale key, and all focused tests pass.

- [ ] Step 2: Run complete local verification:
  ~~~text
  npm test
  npm run build
  npm --prefix frontend run check:i18n
  npm run check:supabase
  git diff --check
  ~~~
  Expected: frontend, API, MCP, build, i18n, Supabase boundary, and whitespace checks pass.

- [ ] Step 3: If the established local Supabase process is available, run npx supabase db reset, npx supabase test db, and npx supabase db lint. If Docker is unavailable, record the exact limitation and keep the migration un-applied remotely.

- [ ] Step 4: Review the complete diff against main. Check owner-only SELECT, no enumeration, anon denial, role-gated writes, protected fields, clock_timestamp(), no DELETE, no hard delete, no secret leakage, no duplicate avatar system, derived completeness, declared-vs-verified copy, offline preservation, safe-area/bottom-nav overlap, dark/light themes, accessibility, and unchanged workout/legacy flows.

- [ ] Step 5: After implementation review and only with credentials intentionally available, run npx supabase db push --dry-run. Classify CREATE TABLE, CREATE FUNCTION, CREATE INDEX, ALTER, ENABLE RLS, CREATE POLICY, GRANT, REVOKE, DROP, TRUNCATE, and DELETE. Any destructive or unexpected operation blocks application. Do not apply the migration in this task.

- [ ] Step 6: If a real defect is found, add its failing regression test, fix the smallest scope, rerun affected checks, and commit a focused fix. If no defect is found, do not create a no-op verification commit.

## Planned Commit Sequence

1. feat: add professional profile schema and RLS
2. feat: add professional profile API contract
3. feat: expose owner-only professional profile routes
4. feat: add ephemeral professional profile session bridge
5. feat: define professional profile domain states
6. feat: add mobile professional profile management
7. test: cover professional profile UX boundaries
8. A final focused fix only if verification finds a real defect.

Implementation stops after local verification and the authorized dry-run. Applying the migration remotely, creating Phase 3 access, opening a pull request, or merging remains outside this plan unless separately authorized.
