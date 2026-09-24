# Professional Client Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the professional and student training areas into practical client/program management workflows with secure Supabase boundaries, real program editing, explicit assignment, execution history, and organized next-workout views.

**Architecture:** Keep the existing React/PWA state model and Supabase tables, adding additive RPCs/projections for privacy-sensitive summaries. Treat published program versions as immutable; drafts are edited locally until publication, and assignments explicitly select a client and version. Split the existing monolithic views into focused subcomponents while preserving existing routes `/professional` and `/connect`.

**Tech Stack:** React 19, React Router, Zustand, Vitest/Happy DOM, Vite, Supabase PostgreSQL/RLS/RPCs, pgTAP migration tests.

**Spec:** `docs/superpowers/specs/2026-09-24-professional-client-management-design.md`

## Global Constraints

- Published or sent versions are immutable; edits create a new version.
- Professional reads are limited to active relationships and owned programs.
- Student reads are limited to their own active assignments and executions.
- No service-role key, private environment variable, or account snapshot of another user may reach the frontend.
- Existing local routines and workout history remain intact when a professional program becomes active.
- Database migrations are additive and must include pgTAP coverage and least-privilege grants.
- The exercise catalogue remains the single frontend source for exercise selection.
- Final verification must include `npm test`, `npm run build`, `npm --prefix frontend run check:i18n`, `npm run check:supabase`, `git diff --check`, hosted QA, and a clean `main` push.

## Review Focus

- A professional with multiple clients must never assign a program to the first client implicitly; test explicit selection and rejected foreign client IDs in Task 4.
- A student with multiple versions must activate only the newest explicitly assigned version and keep prior executions visible; test replacement/history behavior in Task 6.
- A malformed weekly payload must not publish empty exercise IDs, invalid days, or unsafe numeric values; test validation in Task 3.
- A revoked relationship must immediately stop professional detail reads and new assignments while preserving historical execution visibility; test RLS/RPC behavior in Task 2.
- A normal user and a professional-capable user must render different navigation without a capability flicker exposing protected actions; test loading/empty states in Task 5.

### Task 1: Establish domain contracts and pure program utilities

**Files:**
- Create: `frontend/src/lib/professional-program.js`
- Test: `frontend/src/lib/professional-program.test.js`
- Modify: `frontend/src/lib/assigned-program.js`
- Test: `frontend/src/lib/assigned-program.test.js`

**Interfaces:**
- Produces `DAYS`, `normalizeWeeklyPlan(plan)`, `validateWeeklyPlan(plan)`, `summarizeWeeklyPlan(plan)`, and `nextScheduledWorkouts(plan, fromDate, count)`.
- `normalizeWeeklyPlan` returns `{ [dayName]: ExerciseEntry[] }` with bounded numeric fields and no empty exercise IDs.
- `validateWeeklyPlan` returns `{ ok: true, value }` or `{ ok: false, error }` without throwing for user-editable input.
- `assignedPlanToState` consumes the normalized weekly plan and keeps personal routines/history unchanged.

- [ ] **Step 1: Write failing tests** for valid weekly plans, invalid days/IDs/numbers, summaries, next scheduled workouts, and assigned-plan replacement with preserved history.
- [ ] **Step 2: Run `npm --prefix frontend test -- src/lib/professional-program.test.js src/lib/assigned-program.test.js`; verify failures are caused by missing utilities or missing behavior.**
- [ ] **Step 3: Implement the utilities with explicit day and field bounds; update assigned-plan mapping to consume both array and normalized object forms.**
- [ ] **Step 4: Rerun the focused tests and then `npm --prefix frontend test -- src/lib/professional-program.test.js src/lib/assigned-program.test.js`; require all tests to pass.**
- [ ] **Step 5: Commit `feat: add professional program domain contracts`.**

### Task 2: Add secure Supabase projections and mutation RPCs

**Files:**
- Create: `supabase/migrations/202609240012_professional_management_rpc.sql`
- Create: `supabase/tests/202609240012_professional_management_rpc.sql`
- Create: `scripts/check-professional-management-migration.test.mjs`
- Modify: `scripts/check-supabase-boundaries.mjs`
- Modify: `scripts/check-supabase-boundaries.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `professional_client_summaries()`, `professional_client_detail(p_student_user_id uuid)`, `publish_program_version(p_program_id uuid, p_weekly_plan jsonb)`, `assign_program_version(p_program_id uuid, p_version_id uuid, p_student_user_id uuid)`, and `student_program_overview()` RPCs.
- Each RPC is `security definer`, sets `search_path = public, pg_temp`, revokes public/anon execution, grants only to `authenticated`, and derives authority from `auth.uid()`.
- `publish_program_version` validates ownership and normalized weekly payload, increments the program version atomically, and never updates an existing version.
- `assign_program_version` validates professional ownership, matching program/version, active relationship, and target student; it revokes prior active assignments for that student/professional/program before inserting the new active assignment.
- `student_program_overview` returns only the caller’s active assignment, version summary, and own executions.

- [ ] **Step 1: Write pgTAP tests** for function existence, grants, security definer/search path, owner scoping, malformed payload rejection, revoked-relationship rejection, mismatched program/version rejection, active-assignment replacement, and student-only visibility.
- [ ] **Step 2: Run the migration test and boundary checker; verify the new tests fail because the migration file/functions are absent.**
- [ ] **Step 3: Implement the migration with bounded JSON validation, transactional version numbering, ownership checks, participant checks, and minimum grants.**
- [ ] **Step 4: Run `npx supabase db push --dry-run --project-ref bgqavxoxwgheloeubbpf`; inspect that only the new additive migration would apply.**
- [ ] **Step 5: Apply the migration to the configured pre-production Supabase project only after the dry-run contains no destructive operation, then run `npx supabase migration list --project-ref bgqavxoxwgheloeubbpf`.**
- [ ] **Step 6: Run the pgTAP/static migration checks and commit `feat: add secure professional management RPCs`.**

### Task 3: Expand the frontend repository boundary

**Files:**
- Modify: `frontend/src/lib/professional-workflow.js`
- Test: `frontend/src/lib/professional-workflow.test.js`
- Modify: `frontend/src/lib/professional-profile.js` only if shared profile projection is required by the client summary.

**Interfaces:**
- Produces `clientSummaries()`, `clientDetail(studentUserId)`, `publishProgramVersion(programId, weeklyPlan)`, `assignProgramVersion({ programId, versionId, studentUserId })`, `studentOverview()`, and `execution(id)`.
- Repository methods return normalized view models and map known Supabase errors to stable local error codes.
- Existing `createInvite`, `previewInvite`, `acceptInvite`, `revokeRelationship`, `programs`, `versions`, and `executions` remain available until consumers migrate.

- [ ] **Step 1: Write failing repository tests** for RPC arguments, explicit student ID assignment, normalized client summaries/detail, and error mapping.
- [ ] **Step 2: Run the focused repository tests and verify failures identify missing methods/contracts.**
- [ ] **Step 3: Implement the methods using the existing client boundary; do not expose raw tokens or unrestricted table reads.**
- [ ] **Step 4: Run `npm --prefix frontend test -- src/lib/professional-workflow.test.js`; require green output.**
- [ ] **Step 5: Commit `feat: expose professional management repository contracts`.**

### Task 4: Build the professional program editor and explicit send flow

**Files:**
- Create: `frontend/src/components/ProfessionalProgramEditor.jsx`
- Create: `frontend/src/components/ProfessionalProgramEditor.test.jsx`
- Create: `frontend/src/components/ProfessionalClientDetail.jsx`
- Create: `frontend/src/components/ProfessionalClientDetail.test.jsx`
- Modify: `frontend/src/views/ProfessionalDashboard.jsx`
- Modify: `frontend/src/styles.css` or the repository’s existing stylesheet containing professional dashboard rules.

**Interfaces:**
- `ProfessionalProgramEditor({ program, initialPlan, exercises, onSaveDraft, onPublish, onCancel })` emits a validated weekly plan.
- `ProfessionalClientDetail({ client, detail, onAssign, onClose })` renders client summary, active program, recent executions, upcoming workouts, and explicit version/client selection.
- Dashboard state separates `clients`, `selectedClient`, `programs`, `drafts`, `activity`, `busy`, and `error`.

- [ ] **Step 1: Write failing component tests** for empty clients, client selection, editor day/exercise changes, validation errors, draft review, explicit send confirmation, and mobile-safe action layout.
- [ ] **Step 2: Run the focused component tests and confirm they fail because the components/dashboard flow is not present.**
- [ ] **Step 3: Implement the editor with catalogue search, day tabs, add/remove/reorder controls, bounded fields, draft state, weekly summary, and publish review.**
- [ ] **Step 4: Replace UUID-only dashboard cards with client cards and a detail panel; require selected client and selected version before assigning.**
- [ ] **Step 5: Add separate dashboard sections/tabs for overview, clients, programs, and invites/activity without removing existing invite actions.**
- [ ] **Step 6: Run component tests plus `npm --prefix frontend test -- src/views/ProfessionalDashboard.test.jsx`; require green output.**
- [ ] **Step 7: Commit `feat: add practical professional client and program management`.**

### Task 5: Reorganize the student received-training area

**Files:**
- Create: `frontend/src/components/StudentProgramOverview.jsx`
- Create: `frontend/src/components/StudentProgramOverview.test.jsx`
- Modify: `frontend/src/views/StudentConnections.jsx`
- Modify: `frontend/src/views/More.jsx` only if the menu label/description needs the new overview.
- Modify: `frontend/src/styles.css` or the existing student/professional styles.

**Interfaces:**
- `StudentProgramOverview({ overview, onStart, onSwitch, onRevoke })` renders current program, professional summary, upcoming workouts, version/status, execution history, and empty states.
- `StudentConnections` uses `repo.studentOverview()` and the existing invite/relationship methods; it no longer displays raw program/version UUIDs as primary labels.

- [ ] **Step 1: Write failing component tests** for no professional, pending invite, active program, upcoming day, execution history, revoked assignment, and multiple versions.
- [ ] **Step 2: Run the focused tests and confirm the new overview is absent or incomplete.**
- [ ] **Step 3: Implement the overview, preserving the current automatic `assignedPlanToState` activation and personal history.**
- [ ] **Step 4: Route start/complete actions through the assigned execution contract, using the correct scheduled day instead of hard-coded Monday.**
- [ ] **Step 5: Run student component/repository tests and commit `feat: organize received training for students`.**

### Task 6: Connect workout execution lifecycle and history views

**Files:**
- Create: `frontend/src/lib/professional-execution.js`
- Test: `frontend/src/lib/professional-execution.test.js`
- Modify: `frontend/src/views/Workout.jsx`
- Modify: `frontend/src/views/History.jsx` or `frontend/src/lib/history.js`, following the existing history boundary.
- Modify: `frontend/src/components/ProfessionalClientDetail.jsx`
- Modify: `supabase/migrations/202609240012_professional_management_rpc.sql` only if an execution update RPC is required by the tests.

**Interfaces:**
- Produces `startAssignedExecution({ assignmentId, versionId, studentUserId, dayKey })`, `completeAssignedExecution({ executionId, payload })`, and `groupExecutionsByDate(executions)`.
- Execution updates remain student-owned; professionals can read only participant executions and cannot alter them.
- Local workout completion remains the source for the user’s existing history, while the assigned execution row mirrors lifecycle status and payload metadata.

- [ ] **Step 1: Write failing tests** for start with the current day, completion, abandoned status, duplicate active execution prevention, grouping, and professional read-only visibility.
- [ ] **Step 2: Run focused tests and confirm the lifecycle methods are absent or incomplete.**
- [ ] **Step 3: Implement the lifecycle boundary and connect `Workout.jsx` only for assigned routines; leave personal workouts unchanged.**
- [ ] **Step 4: Add professional detail history grouping by student/program/date and student history grouping by version.**
- [ ] **Step 5: Run workout/history tests and commit `feat: track assigned workout execution lifecycle`.**

### Task 7: Full regression, hosted QA, and usability verification

**Files:**
- Modify only files needed to fix verified regressions found by the checks below.
- Add/update tests next to any fixed regression.

**Interfaces:**
- No new public interface; this task verifies the contracts produced by Tasks 1–6.

- [ ] **Step 1: Run `npm test`; record test files/tests passed and investigate every failure.**
- [ ] **Step 2: Run `npm run build`; confirm production bundle succeeds.**
- [ ] **Step 3: Run `npm --prefix frontend run check:i18n`; confirm all locale packs remain in sync.**
- [ ] **Step 4: Run `npm run check:supabase`; confirm required migration files and security checks pass.**
- [ ] **Step 5: Run `git diff --check`; inspect the complete diff against the pre-task `main` for scope, duplicated CSS/components, mobile layout, dark/light themes, safe areas, navigation overlap, and workout regressions.**
- [ ] **Step 6: Use existing QA accounts in the hosted pre-production project to exercise professional onboarding, invite, accept, client list/detail, draft, publish, explicit send, student activation, start, complete, history, revoke, and replacement flows. Do not expose credentials or delete QA accounts.**
- [ ] **Step 7: Verify production build/deployment status and run a final `git status --short --branch`, `git rev-parse HEAD`, and `git rev-parse origin/main`.**
- [ ] **Step 8: Commit any verified fixes individually, then create the final integration commit if needed and push `main`.**

## Spec coverage review

- Professional client management: Tasks 2–4.
- Program drafts, editing, publication, immutable versions: Tasks 1–4.
- Explicit assignment and secure ownership: Tasks 2–4.
- Student received-program layout and controls: Task 5.
- Execution lifecycle and histories: Task 6.
- RLS, RPC grants, malformed payloads, revoked relationships: Task 2.
- Regression, real hosted QA, responsive/theme/accessibility checks: Task 7.

## Execution order

Tasks must run in order because each later task consumes the contracts produced by the preceding task. Each task ends with a focused test cycle and a commit; Task 7 is the final verification and push gate.
