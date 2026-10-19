# Stage 2 Data and Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace account-wide snapshot editing with canonical domain records, server-owned workout sessions, and a local recovery draft limited to the active session.

**Architecture:** Supabase remains the authorization and persistence boundary. New domain RPCs use row ownership, expected revisions, immutable prescription snapshots, and idempotent operation IDs; the React client accesses them through focused repositories. Zustand keeps UI/session state while confirmed domain data comes from the server. The full offline plan/download path is removed only after session recovery is verified.

**Tech Stack:** PostgreSQL/Supabase migrations and RLS, Supabase JS, React 19, Zustand, Vitest, Node SQL boundary tests, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-navigation-and-product-contracts-design.md`, `docs/superpowers/specs/2026-10-19-data-integrity-and-localization-design.md`

## Global Constraints

- Test data may be reset; no heuristic migration of legacy lb values.
- Persist all mass/load values in kg with `massUnit: 'kg'`; `displayUnit` affects input and presentation only.
- Real usage requires an authenticated account; demo data remains isolated.
- A local recovery draft may contain only the active account/session identity, writer token, revision, frozen prescription, and unconfirmed operations.
- Mutations require ownership checks, expected revisions, and idempotent operation IDs.
- One active session and one active program per student; multiple professional relationships are allowed.
- Do not apply migrations to a remote Supabase project from this plan.

## Review Focus

- A stale writer token must never overwrite a session taken over on another device.
- Replaying the same operation ID must return the existing result without duplicating a set or workout.
- Switching display unit repeatedly must not alter canonical kg values or their precision.
- Signing into another account must not display or resend the previous account's recovery draft.
- Completing while the network response is lost must recover as the same completed session after retry.

---

### Task 1: Define the domain schema and security boundaries

**Files:**
- Create: `supabase/migrations/202610190001_domain_training_state.sql`
- Create: `scripts/check-domain-training-state-migration.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: tables/RPCs for preferences, routines, plans, body records, workout sessions, set operations, and active-program selection.
- Produces: `start_workout_session`, `append_workout_operation`, `take_over_workout_session`, `complete_workout_session`, and read RPC contracts.

- [x] Write static migration tests for RLS enablement, revoked default grants, fixed `search_path`, ownership checks, expected revision, writer token, and operation ID uniqueness.
- [x] Run the new Node test and verify RED because the migration is absent.
- [x] Add the schema and RPC migration with all quantities documented in kg.
- [x] Run static checks and disposable PostgreSQL tests; record any environment skips. Static checks passed; three database-backed checks remain skipped because `PG_BIN` is unavailable.
- [ ] Commit migration and checks with message `feat: add server-owned training domain`.

### Task 2: Add client repositories and DTO validation

**Files:**
- Create: `frontend/src/lib/training-repository.js`
- Create: `frontend/src/lib/training-repository.test.js`
- Create: `frontend/src/lib/training-dto.js`
- Create: `frontend/src/lib/training-dto.test.js`

**Interfaces:**
- Consumes: Task 1 RPCs.
- Produces: validated `startSession`, `appendOperation`, `takeOverSession`, `completeSession`, `loadPlan`, `loadHistory`, and `savePreferences` methods.

- [ ] Write failing tests for malformed responses, RPC argument names, conflict mapping, stale token, idempotent replay, and account-scope mismatch.
- [ ] Implement DTO parsing without passing raw database rows into views.
- [ ] Implement the repository with injected client and authenticated account ID.
- [ ] Run repository tests and the full frontend suite.
- [ ] Commit with message `feat: add training domain repository`.

### Task 3: Establish canonical kg and display conversion

**Files:**
- Create: `frontend/src/lib/mass.js`
- Create: `frontend/src/lib/mass.test.js`
- Modify: `frontend/src/store/useStore.js`
- Modify: all consumers located by `rg -n "S\.unit|\.unit.*kg|unit=\{S\.unit" frontend/src`.
- Modify: `frontend/src/lib/import-csv.js`
- Modify: `frontend/src/views/Settings.jsx`

**Interfaces:**
- Produces: `toDisplayMass(kg, displayUnit)`, `fromDisplayMass(value, displayUnit)`, `formatDisplayMass(kg, displayUnit)`, `displayUnit`, `massUnit: 'kg'`, and current `stateSchemaVersion`.

- [ ] Write failing conversion, round-trip, invalid input, import, and repeated-unit-switch tests.
- [ ] Implement pure conversion functions and reset legacy states without current schema markers.
- [ ] Replace reads/writes at profile, routine, workout, history, progress, professional prescription, import, export, charts, and sharing boundaries.
- [ ] Update settings copy and add a test proving the persisted kg value is unchanged after display switches.
- [ ] Run focused tests, `check:i18n`, and the full suite.
- [ ] Commit with message `feat: store training mass canonically in kilograms`.

### Task 4: Implement active-session recovery

**Files:**
- Create: `frontend/src/lib/session-recovery.js`
- Create: `frontend/src/lib/session-recovery.test.js`
- Modify: `frontend/src/views/Workout.jsx`
- Modify: `frontend/src/sheets.jsx`
- Modify: `frontend/src/store/useStore.js`
- Modify: `frontend/src/components/AppStatus.jsx`

**Interfaces:**
- Consumes: Task 2 repository and Task 3 canonical mass helpers.
- Produces: account-scoped recovery draft, queued operation state, takeover flow, and saving status.

- [ ] Write failing tests for account isolation, replay, lost completion response, expired authentication, stale writer token, and corrupt drafts.
- [ ] Persist the minimal draft before dispatching each operation and remove confirmed operations only after the RPC response.
- [ ] Add recovery/takeover UI and inline `Saving`, `Saved`, `Waiting to send`, and failure states.
- [ ] Prevent a completed-but-pending session from being started again.
- [ ] Run focused component/repository tests and full suite.
- [ ] Commit with message `feat: recover interrupted workout sessions`.

### Task 5: Switch account data reads to domain records

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/store/useStore.js`
- Modify: athlete views and sheets that currently mutate snapshot-owned state.
- Create: focused integration tests beside each changed view.

**Interfaces:**
- Consumes: Task 2 repository.
- Produces: authenticated boot/refresh and mutation invalidation by domain.

- [ ] Write failing integration tests for boot, refresh on focus, stale response rejection, error-with-old-data, and account change.
- [ ] Load preferences, plan, history, and body data independently.
- [ ] Route mutations through domain methods and refresh only affected queries.
- [ ] Keep demo state isolated from authenticated repositories.
- [ ] Run full unit and targeted E2E flows.
- [ ] Commit with message `feat: use domain persistence for athlete data`.

### Task 6: Remove broad offline and snapshot UI

**Files:**
- Delete after reference scan: `frontend/src/components/OfflineControls.jsx` and its tests if no remaining consumer exists.
- Modify: `frontend/src/views/Settings.jsx`
- Modify: `frontend/src/lib/account-sync.js` and tests, or delete after all consumers are removed.
- Modify: `frontend/public/sw.js`
- Modify: `frontend/src/App.jsx`
- Modify: `docs/PROFESSIONAL_READINESS.md`

**Interfaces:**
- Consumes: Tasks 4–5.
- Produces: online product with static-asset/PWA notification worker and active-session recovery only.

- [ ] Add failing tests proving no plan-download control, no account snapshot upload, and notification/update worker behavior remains.
- [ ] Remove offline preparation, guest persistence for real flows, account-wide conflict UI, and unused snapshot code.
- [ ] Retain only cache/update/push behavior still required by the PWA and document its exact purpose.
- [ ] Run PWA, notification, settings, and account tests.
- [ ] Commit with message `refactor: retire full offline account mode`.

### Task 7: Verify the Stage 2 vertical flow

**Files:**
- Create or modify: `frontend/e2e/session-recovery.spec.js`
- Modify: `docs/PLANO_EVOLUCAO_PRODUTO.md`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: Stage 2 verification record and a stable persistence base for the navigation build.

- [ ] Exercise start → record → disconnect → complete pending → reconnect → single server completion.
- [ ] Exercise two-device takeover and confirm the old writer is rejected.
- [ ] Exercise account switch and confirm drafts/data do not cross accounts.
- [ ] Run frontend suite, build, i18n, Supabase boundary/SQL checks, E2E, and `git diff --check`.
- [ ] Record exact pass/fail/skip counts and remaining device/homologation checks.
- [ ] Commit with message `docs: record stage two verification`.
