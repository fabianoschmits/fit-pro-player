# FPP Supabase Account Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Vercel-hosted Fit Pro Player create and operate normal and immediately usable unverified professional Supabase accounts without depending on the legacy Node API.

**Architecture:** Supabase Auth owns identity and session. PostgreSQL trigger-created profiles/student roles and a narrow authenticated RPC provision professional capability/profile atomically. The React app uses the existing Supabase client, AuthProvider, account cache, snapshot/CAS sync, and professional profile repository; legacy WebAuthn/API paths remain only where a consumer audit proves they are still required.

**Tech Stack:** Supabase SQL migrations and pgTAP-style SQL tests, React 19, Vite, Vitest, `@supabase/supabase-js`, existing account cache/snapshot services.

**Spec:** `docs/superpowers/specs/2026-09-23-fpp-supabase-account-onboarding-design.md`

## Global Constraints

- Do not expose `SUPABASE_SECRET_KEY`, service-role credentials, database passwords, JWT private keys, access tokens, or refresh tokens to Vite, the bundle, local training state, logs, or Git.
- Keep RLS authoritative; the client never inserts or updates `user_roles` directly.
- Preserve migrations 001–005; add only additive migration(s).
- Professional accounts are immediately usable but start with `verification_status = 'unverified'`.
- No admin capability can be granted from signup input.
- Hosted email, recovery mailbox, physical passkeys, Android, and iOS remain manual follow-ups.

## Review Focus

- Professional signup cannot self-grant `admin`; test RPC role allowlist and RLS denial.
- Repeated professional provisioning is idempotent; test duplicate calls.
- Confirmation-required signup does not claim authenticated state; test AuthProvider/AuthSheet contract.
- A Supabase account never calls legacy `/api/data`; test boot/sync request boundaries.
- Reload restores the account scope and professional capability without cross-user cache reuse.

### Task 1: Secure professional onboarding RPC

**Files:**
- Create: `supabase/migrations/202609230006_professional_onboarding.sql`
- Create: `supabase/tests/202609230006_professional_onboarding.sql`
- Create: `scripts/check-professional-onboarding-migration.test.mjs`

**Interfaces:**
- Produces `public.provision_professional_profile(text, text, text[], text, text, text)` returning `public.professional_profiles`.
- RPC uses `auth.uid()`, inserts `professional` only, creates/updates one owner-scoped `professional_profiles` row with `unverified`, and is executable by `authenticated` only.

- [ ] Write SQL regression tests for authenticated ownership, idempotency, unverified status, and admin escalation rejection.
- [ ] Run the SQL/static migration checks and observe RED before the migration exists.
- [ ] Implement the additive SECURITY DEFINER RPC with bounded inputs and `search_path = public, pg_temp`.
- [ ] Run migration structure tests and the available local Supabase checks until GREEN.
- [ ] Apply the migration to the linked Supabase project only after local/static checks pass.
- [ ] Confirm remote migration history and RPC existence without printing credentials.
- [ ] Commit `feat: add secure professional onboarding rpc`.

### Task 2: Signup intent and provisioning client

**Files:**
- Modify: `frontend/src/auth/AuthProvider.jsx`
- Modify: `frontend/src/components/AuthSheet.jsx`
- Modify: `frontend/src/lib/professional-profile.js`
- Test: `frontend/src/auth/AuthProvider.test.jsx`
- Test: `frontend/src/components/AuthSheet.test.jsx`
- Test: `frontend/src/lib/professional-profile.test.js`

**Interfaces:**
- `AuthProvider.signUp({ email, password, displayName, accountType })` accepts `student | professional`.
- `createProfessionalProfileRepository({ client }).provision(userId, profile)` calls the authenticated `provision_professional_profile` RPC and returns the normalized profile.

- [ ] Add tests proving professional signup sends only bounded public metadata and confirmation-required signup remains unauthenticated.
- [ ] Run focused tests and observe RED for the new `accountType`/provisioning contract.
- [ ] Implement the smallest AuthProvider/AuthSheet changes, including an explicit student/professional choice and safe error mapping.
- [ ] Add the RPC repository method; never expose verification status as client authority.
- [ ] Run focused tests GREEN.
- [ ] Commit `feat: support student and professional Supabase signup`.

### Task 3: Account bootstrap and professional UI integration

**Files:**
- Modify: `frontend/src/components/AuthSheet.jsx`
- Modify: `frontend/src/views/More.jsx`
- Modify: `frontend/src/views/ProfessionalProfile.jsx`
- Modify: `frontend/src/store/useStore.js`
- Test: `frontend/src/views/More.auth.test.jsx`
- Test: `frontend/src/views/ProfessionalProfile.auth.test.jsx`
- Test: `frontend/src/store/useStore.cache-isolation.test.js`

**Interfaces:**
- Authenticated Supabase boot reads the account snapshot and professional capability from Supabase-scoped services.
- Professional navigation appears only for the returned `professional` role; profile save remains owner-scoped.

- [ ] Add tests for immediate professional navigation, student isolation, reload scope, and no legacy `/api/data` request.
- [ ] Run focused tests and observe RED.
- [ ] Implement bootstrap/provisioning refresh and UI gating without changing training-state schema.
- [ ] Run focused tests GREEN and then the complete frontend suite.
- [ ] Commit `feat: connect professional onboarding to account bootstrap`.

### Task 4: Legacy usage audit and safe cleanup

**Files:**
- Modify only files proven unused by the consumer audit.
- Test: add regression checks beside each removed boundary.
- Docs: update `README.md` and deployment documentation only where behavior changed.

- [ ] Produce a consumer map for WebAuthn, `/api/*`, identity-link, local legacy session, and professional routes.
- [ ] Add RED checks for each boundary selected for removal.
- [ ] Remove only unreachable legacy consumers; preserve migration/admin paths that still have a supported use.
- [ ] Run GREEN focused tests and full suite.
- [ ] Commit `refactor: remove retired legacy account consumers` only if the audit proves the removal safe.

### Task 5: Full verification and production readiness

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `npm --prefix frontend run check:i18n`.
- [ ] Run `npm run check:supabase`.
- [ ] Run `npm audit --audit-level=high`.
- [ ] Run `git diff --check` and a secret scan.
- [ ] Verify local signup contracts with Supabase credentials from the environment without printing values.
- [ ] Verify Vercel public environment names and bundle absence of private variables.
- [ ] Verify production root, anonymous boot, signup UI, session reload, student/professional role behavior, snapshot/CAS, and professional profile.
- [ ] Record email/passkey/mobile manual follow-ups.
