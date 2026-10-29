# Professional Profile, Invites, and Model Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Each task is independently verifiable and ends with a commit.

**Goal:** Repair professional-profile saves, add a reusable editable name-based invite code beside existing individual invites, and safely delete unused professional models.

**Architecture:** Use narrowly scoped authenticated RPCs for profile persistence and destructive model deletion. Extend `professional_invites` with a per-professional personal-code marker so existing unique-code storage remains globally authoritative; preserve individual invite lifecycle and add a reusable acceptance branch. Derive an automatic code until the professional customizes it, then keep the chosen code stable.

**Tech Stack:** React, Vitest, Playwright, Supabase Postgres migrations/RPCs, disposable PGlite integration harness.

**Spec:** `docs/superpowers/specs/2026-10-29-professional-profile-invites-and-model-deletion-design.md`

## Global Constraints

- `professional_profiles` is private to its owner; verification status, user identity, and timestamps remain server-managed.
- Invite code uniqueness remains global through `professional_invites.code`; personal invites are reusable, individual generated invites remain single-use and revocable while pending.
- Invite codes are the normalized first and last professional-name tokens concatenated without spaces; automatic collisions receive suffixes starting at `2`.
- Hard deletion is owner-only and allowed only when database references permit it; referenced models and their history remain intact and may be archived.
- RPCs use `SECURITY DEFINER` with a fixed `search_path`, authenticate `auth.uid()`, and validate role/ownership on the server.

## Review Focus

- Profile save must not change a pending/verified registration status or expose another user's row; test authenticated owner, missing role, missing profile, and immutable server fields.
- Profile-name edits must keep derived codes synchronized but preserve manually customized codes; test both branches.
- Automatic code allocation must avoid existing personal and generated codes; manual conflicts must return a stable code-taken error.
- Accepting a personal code repeatedly must create/restore separate student relationships without consuming the code; generated codes must still become active after first acceptance.
- A model with any referencing assignment, execution, or history must survive a delete attempt; test error mapping and archive fallback.

---

### Task 1: Save professional profiles through a protected RPC

**Files:**
- Modify: `frontend/src/lib/professional-profile.js`
- Modify: `frontend/src/lib/professional-profile.test.js`
- Modify: `supabase/migrations/202610290003_professional_profile_invites_and_model_delete.sql`
- Create: `scripts/check-professional-profile-invites-model-delete-migration.test.mjs`
- Create: `supabase/tests/202610290003_professional_profile_invites_and_model_delete.sql`
- Modify: `scripts/test-plan-library-database.mjs`
- Modify: `package.json`

**Interfaces:**
- Add RPC `save_professional_profile(p_user_id uuid, p_professional_name text, p_bio text, p_specialties text[], p_city_region text, p_registration_type text, p_registration_number text) returns public.professional_profiles`.
- Repository `save(userId, profile)` passes `p_user_id` only so the RPC can assert that the authenticated caller matches; the update targets `auth.uid()` and never selects another profile.

- [x] **Step 1: Add failing repository and SQL contract tests**
  - Assert the repository calls `save_professional_profile` with normalized fields and maps its returned row.
  - Assert table writes are not used for editing.
  - SQL test: authenticated owner can update editable profile fields; verification status, user ID, and creation time remain unchanged; missing role, other owner, missing profile, invalid name, and invalid specialties are rejected.
- [x] **Step 2: Run the tests and verify the expected failures**
  - Run: `cd frontend; npx vitest run src/lib/professional-profile.test.js`
  - Run: `node --test scripts/check-professional-profile-invites-model-delete-migration.test.mjs`
  - Expected: repository still calls table `upsert` and migration/RPC contract is absent.
- [x] **Step 3: Implement the protected update contract**
  - Implement the RPC with fixed `search_path`, authenticated role check, input validation, owner-only update, and stable SQLSTATE/messages.
  - Revoke direct `INSERT` and `UPDATE` table grants from `authenticated`, retaining owner `SELECT`; keep provisioning and privileged admin writes on their protected server paths.
  - Switch repository editing to RPC and retain `42501`/validation/not-found distinctions for UI mapping.
- [x] **Step 4: Run repository and database integration checks**
  - Add migration and SQL test to the existing PGlite harness and `check:supabase` script.
  - Run focused Vitest, `npm run test:plan-library:database`, and `npm run check:supabase`.
- [ ] **Step 5: Commit**

### Task 2: Add reusable personal invite code and preserve generated invite behavior

**Files:**
- Modify: `supabase/migrations/202610290003_professional_profile_invites_and_model_delete.sql`
- Modify: `supabase/tests/202610290003_professional_profile_invites_and_model_delete.sql`
- Modify: `scripts/check-professional-profile-invites-model-delete-migration.test.mjs`
- Modify: `scripts/test-plan-library-database.mjs`
- Modify: `frontend/src/lib/professional-workflow.js`
- Modify: `frontend/src/lib/professional-workflow.test.js`
- Modify: `frontend/src/lib/professional-profile.js`

**Interfaces:**
- Extend `professional_invites` with `is_personal boolean not null default false` and `is_custom boolean not null default false`; enforce at most one `is_personal` row per professional.
- Add RPC `save_professional_personal_invite(p_code text)` returning the updated invite row.
- Add an internal code-normalization/allocation helper used by the profile save/provisioning and personal-code edit RPCs.
- Add repository method `savePersonalInviteCode(code)` and include `is_personal`/`is_custom` in `invites()` DTO rows.

- [ ] **Step 1: Add failing tests for generation, edits, acceptance, and compatibility**
  - SQL tests for backfilling existing professionals, new provisioning, first+last normalization, numeric collision suffix, custom edit, taken-code rejection, and code stability after profile rename.
  - SQL tests for repeat acceptance of a personal code by separate students; generated code remains one-use and revocation rejects personal rows.
  - Repository tests for the code-edit RPC arguments and personal DTO flags.
- [ ] **Step 2: Run new tests and verify expected failures**
  - Run: `node --test scripts/check-professional-profile-invites-model-delete-migration.test.mjs`
  - Run focused database harness.
  - Expected: missing personal-code marker, allocation and acceptance behavior.
- [ ] **Step 3: Implement migration and repository contracts**
  - Add personal markers/index, normalized name-based allocation and backfill, and transactional profile-name synchronization until `is_custom` is true.
  - Update provisioning, profile-save, and generated-invite creation paths to share collision-safe global allocation; retry random generated codes on unique conflicts.
  - Update preview/accept RPCs so personal invite status is never consumed; exclude personal rows from revoke RPC.
  - Map stable `code_taken` error and preserve personal custom code after profile name edits.
- [ ] **Step 4: Run focused checks**
  - Run repository/profile Vitest, static migration tests, `npm run test:plan-library:database`, and `npm run check:supabase`.
- [ ] **Step 5: Commit**

### Task 3: Show personal and generated codes on the invitations page

**Files:**
- Modify: `frontend/src/views/ProfessionalInvites.jsx`
- Modify: `frontend/src/views/ProfessionalInvites.test.jsx`
- Modify: `frontend/e2e/management.spec.js`
- Modify: `frontend/src/professional.css`

**Interfaces:**
- Consume `repo.invites()` rows tagged `is_personal` and `is_custom`; persist personal-code edits through `repo.savePersonalInviteCode(code)`.

- [ ] **Step 1: Add failing UI tests**
  - Show the personal code in its own panel with edit/save/cancel and conflict/error states.
  - Show all generated invites, including accepted and revoked, while allowing revoke only for pending generated rows.
  - Verify personal code is never presented as pending/accepted/revocable and generated invite creation remains available.
- [ ] **Step 2: Run tests and verify expected failures**
  - Run: `cd frontend; npx vitest run src/views/ProfessionalInvites.test.jsx`
- [ ] **Step 3: Implement sections and responsive layout**
  - Separate persistent personal code from individual generated-invite history; use existing QR/copy/link controls and preserve current generated flow.
- [ ] **Step 4: Verify unit and browser flows**
  - Run focused Vitest and targeted Playwright management tests for edit, conflict, copy/share, generated history, and revoke.
- [ ] **Step 5: Commit**

### Task 4: Safely delete unreferenced professional models

**Files:**
- Modify: `supabase/migrations/202610290003_professional_profile_invites_and_model_delete.sql`
- Modify: `supabase/tests/202610290003_professional_profile_invites_model_delete.sql`
- Modify: `scripts/check-professional-profile-invites-model-delete-migration.test.mjs`
- Modify: `frontend/src/lib/professional-workflow.js`
- Modify: `frontend/src/lib/professional-workflow.test.js`
- Modify: `frontend/src/views/ProfessionalPrograms.jsx`
- Modify: `frontend/src/views/ProfessionalPrograms.test.jsx`
- Modify: `frontend/e2e/management.spec.js`

**Interfaces:**
- Add RPC `delete_professional_program(p_program_id uuid) returns void`; repository exposes `deleteProgram(programId)`.
- Map referenced-program conflicts to stable `program_in_use` for the UI.

- [ ] **Step 1: Add failing repository, SQL, and UI tests**
  - Owner can delete a model with no dependent assignments/history; non-owner and missing model are rejected.
  - A model referenced by an assignment or historical row remains intact, and the RPC returns a stable conflict.
  - Model detail exposes a confirmed delete action; `program_in_use` explains the restriction and offers archive.
- [ ] **Step 2: Run tests and verify expected failures**
  - Run focused workflow/program Vitest, migration static test, and DB harness.
- [ ] **Step 3: Implement guarded delete RPC and interface**
  - Lock and verify the owned model; delete in one transaction; map restrictive foreign-key dependencies to `program_in_use` without removing history.
  - Add a danger confirmation and handle the stable conflict with an archive path.
- [ ] **Step 4: Verify UI and database behavior**
  - Run focused Vitest, SQL/PGlite integration, and targeted Playwright deletion cases.
- [ ] **Step 5: Commit**

### Task 5: Final review and verification

**Files:**
- Review all files changed in Tasks 1–4.

- [ ] Check every spec criterion, migration grants/search paths, generated-invite regressions, invite acceptance, and retained model history.
- [ ] Run focused Vitest, `npm run check:supabase`, `npm run test:plan-library:database`, targeted/full management E2E, and `npm run build`.
- [ ] Record unavailable checks and unrelated baseline failures accurately.
- [ ] Request a fresh-context code review and fix any important findings; commit any review fixes.
