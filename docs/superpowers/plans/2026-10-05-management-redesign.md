# Management Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign professional and student management into coherent responsive workspaces with focused, addressable subpages.

**Architecture:** Introduce a management-only layout and component vocabulary; preserve the main application shell and domain repositories. Extend the workflow repository with authenticated student-scoped professional read RPCs, then build focused professional and student destinations around the existing mutation contracts. Complete tasks sequentially with independent review gates to avoid shared routing/style conflicts.

**Tech Stack:** React 19, React Router 7 HashRouter, existing CSS tokens, Vitest/happy-dom, Supabase PostgreSQL/RLS/RPCs and Playwright.

**Spec:** `docs/superpowers/specs/2026-10-05-management-redesign-design.md`

## Global Constraints

- Scope only profile, professional dashboard, students/detail, invitations, programs/versions, student professionals/details/materials and corresponding More entry links.
- Leave Home, Plan, Workout, Stats, BodyProgress, personal History, Library, general Settings and Landing design unchanged.
- Preserve existing light/dark tokens, user accents, `--on-acc`, system type family and minimum 44 px interaction targets. Scope new CSS to management.
- Preserve existing route aliases, `onboarding=1`, invitation code context and `program`/`version` handoff.
- Materials mean existing assigned programs, prescriptions, versions and exercise instructions; no attachment/upload subsystem.
- Do not weaken RLS, expose other students, or move domain queries into components.
- Preserve the single active assignment rule, assignedPlanToState/clearAssignedProgramFromState synchronization and startFlow; inactive material never starts/replaces the active plan.
- Use the existing translation flow; coordinate additions to translations in Task 5, and report all new copy in task reports.
- Do not add product dependencies, modify user-owned `docs/reports/`, publish, push or apply a remote migration without established environment access.

## Review Focus

- Reload/direct links to creation, editor, profile edit and person sections resolve to the same visible content: Tasks 1/3/4 route tests.
- Changing account or person while a request is pending never renders stale data: Tasks 1/2/3/4 owner guards and focused tests.
- Two linked professionals return independent identity/material sets; unrelated and anonymous callers cannot read them: Task 2 database tests and Task 4 selection tests.
- Empty lists, long names and failed requests leave a usable action/navigation path on 360 px: Task 5 browser QA.
- Inspecting historical material never replaces or starts the active program: Task 4 interaction tests.

## Files and boundaries

Task 1 owns `components/ManagementLayout.jsx`, `components/ManagementUI.jsx`, `components/ProfessionalWorkspaceNav.jsx`, `views/ProfessionalProfile.jsx`, profile/form components and related tests, and the initial management CSS. Task 2 owns workflow repository extensions, its tests and the new migration/check/database tests. Task 3 owns professional dashboard/student/invite/program views and their tests. Task 4 owns student professional views/components and their tests. Task 5 owns final routing integration in App, More entry links, translation coverage, visual fixtures and any integration adjustments through a reviewed fix dispatch. Sequential tasks may extend App/CSS after the prior task commits.

### Task 1: Management layout and professional profile

**Files:**
- Create `frontend/src/components/ManagementLayout.jsx`, `ManagementUI.jsx`, `ManagementLayout.test.jsx`.
- Modify `frontend/src/components/ProfessionalWorkspaceNav.jsx` and its test.
- Modify `frontend/src/views/ProfessionalProfile.jsx`; extract `frontend/src/components/ProfessionalProfileForm.jsx` if needed.
- Modify `frontend/src/views/ProfessionalProfile.onboarding.test.jsx`; add `ProfessionalProfile.test.jsx`.
- Modify `frontend/src/professional.css` and profile/edit routes in `frontend/src/App.jsx`.

**Interfaces:**
- `ManagementLayout({ title, subtitle, backTo, action, audience = 'professional', children, className })` produces a `.management-layout` root and `.management-content` content column; accepts optional management nav. `audience='student'` supplies student workspace destinations. Preserve AppHeader usage internally.
- `ManagementPanel({ title, description, action, children, className })`, `ManagementEmpty({ icon, title, description, action })`, `ManagementStatus({ children, tone })`, `ManagementAvatar({ name })` exports from ManagementUI; all class names prefixed `management-`.
- Profile edit determined by `/professional/profile/edit`; aliases/onboarding continue to work. Repository methods `role/own/save/provision` remain unchanged.

- [ ] Add tests for professional/student destinations and active link; profile editing loads saved values, cancel preserves saved data, save validates name, successful provisioning uses existing method, and late account response is ignored.
- [ ] Run `npm --prefix frontend test -- src/components/ManagementLayout.test.jsx src/components/ProfessionalWorkspaceNav.test.jsx src/views/ProfessionalProfile.onboarding.test.jsx src/views/ProfessionalProfile.test.jsx`; observe meaningful failures before implementing.
- [ ] Build layout/components/profile with distinct read/edit views and grouped presentation, specialties/location, registration fields. Prefer focused content and genuine identity initials; no decorative fake metrics. CSS desktop grid uses 208 px local nav plus minmax content; collapse at 900 px; expose tokens only inside `.management-layout`.
- [ ] Re-run the task tests and `npm --prefix frontend run build`, self-review and commit only task files. Write report including exact commands/results and new translation strings.

### Task 2: Authorized student professional summaries and detail

**Files:**
- Modify `frontend/src/lib/professional-workflow.js` and `professional-workflow.test.js`.
- Create `supabase/migrations/202610050015_student_professional_management.sql`.
- Create `supabase/tests/202610050015_student_professional_management.sql`.
- Create `scripts/check-student-professional-management-migration.test.mjs`; include in root `check:supabase` script.

**Interfaces:**
- Repository `studentProfessionals()` invokes `student_professional_summaries` with no student id and returns normalized objects: `{ professionalId, relationshipId, professionalName, bio, specialties, cityRegion, registrationType, registrationNumber, verificationStatus, linkedAt, activeProgramTitle }`.
- Repository `studentProfessionalDetail(professionalId)` invokes `student_professional_detail({ p_professional_user_id: professionalId })` and normalizes `{ professional, relationship, materials, executions }`; professional uses summary shape; relationship has `id/status/linkedAt`; materials `{ assignmentId, programId, versionId, title, description, status, versionNumber, publishedAt, assignedAt, weeklyPlan }`; executions use existing execution shape.
- Both RPCs require auth.uid and an active relationship to caller. Detail never accepts an arbitrary student id. Materials/executions are limited to selected professional and caller; only published assigned versions. Do not widen profile select policies.

- [ ] Add repository tests asserting RPC arguments and normalization, empty summaries and denied detail behavior. Add migration checks for auth scoping, active linkage, fixed search_path and authenticated-only grants.
- [ ] Run `npm --prefix frontend test -- src/lib/professional-workflow.test.js` and `node --test scripts/check-student-professional-management-migration.test.mjs`; verify new cases fail before implementation.
- [ ] Implement RPCs and repository normalization using existing SQL table contracts. Add SQL fixtures/assertions for anonymous rejection, two linked professionals, unrelated student, unlinked/revoked professional, own profile fields, assignment status and execution isolation.
- [ ] Run unit/migration checks and `npm run check:supabase`; inspect database-test availability. Report clearly whether SQL assertions actually ran; do not claim a remote migration applied without evidence. Self-review and commit only task files.

### Task 3: Professional management subpages

**Files:**
- Modify `frontend/src/views/ProfessionalDashboard.jsx`, `ProfessionalStudents.jsx`, `ProfessionalStudentPage.jsx`, `ProfessionalInvites.jsx`, `ProfessionalPrograms.jsx` and their tests.
- Extract focused program view/editor wrappers into `frontend/src/components/` only when useful.
- Modify professional routes in `frontend/src/App.jsx` and extend scoped `professional.css`.

**Interfaces:**
- Consume ManagementLayout/UI from Task 1; preserve existing workflow RPC mutation signatures.
- `/professional/programs`, `/new`, `/:programId`, `/:programId/edit` select library, creation, detail and editor respectively; route source of truth from useParams/useLocation.
- Student detail `section` query accepts summary/training/history/relationship; preserve program/version parameters, default training on version handoff, fallback summary for invalid section.
- Invitation creation can use `?section=create`; list/create and generated result must be focused and recoverable by URL.

- [ ] Adapt/add tests for library-first creation link, detail/editor direct links, preserved version handoff, cancel/back navigation, archive confirmation, history section query, student search/filter and dashboard attention semantics.
- [ ] Run `npm --prefix frontend test -- src/views/ProfessionalDashboard.test.jsx src/views/ProfessionalStudents.test.jsx src/views/ProfessionalStudentPage.test.jsx src/views/ProfessionalInvites.test.jsx src/views/ProfessionalPrograms.test.jsx`; observe intended failures.
- [ ] Implement shared layout across all professional management pages, person list/ficha hierarchy, focused forms and useful empty/error states. Preserve program editor, prescription comparison, sharing and confirm-before-destructive actions. Guard pending role/load/mutations against context changes.
- [ ] Run task tests/build, self-review, commit task files, report exact test evidence and new copy.

### Task 4: Student professionals, details, materials and invitation flow

**Files:**
- Modify `frontend/src/views/StudentProfessionals.jsx` and `StudentProfessionals.test.jsx`.
- Create `frontend/src/views/StudentProfessionalDetail.jsx` and its test; `StudentProfessionalMaterials.jsx` and its test.
- Extract `frontend/src/components/StudentProfessionalInvite.jsx` and its test if needed.
- Reuse `StudentProgramOverview`, `ProfessionalPrescription` and `ProfessionalSessionDetail`.
- Modify student routes in `frontend/src/App.jsx` and extend scoped CSS.

**Interfaces:**
- Consume `studentProfessionals()` and `studentProfessionalDetail(professionalId)` from Task 2 and ManagementLayout/UI from Task 1.
- `/student/professionals` overview; `/add` add/preview/accept; `/materials` assigned prescriptions for currently linked professionals; `/:professionalId` detail with section query for training/history/relationship.
- Preserve invitation `code` parameter and `/connect`/`/invite/:code` behavior; redirect code-bearing entry to add view while keeping code.
- Preserve active plan synchronization from existing refresh; only active/current assignment can invoke startFlow. Viewing detail/material never calls replaceState for that material.

- [ ] Add interaction tests for named linked cards, empty/loading/error, preview before accept, explicit unlink confirmation, professional selection isolation, direct-link section, inactive material cannot start/replace plan, and stalled/anonymous auth guard.
- [ ] Run `npm --prefix frontend test -- src/views/StudentProfessionals.test.jsx src/views/StudentProfessionalDetail.test.jsx src/views/StudentProfessionalMaterials.test.jsx`; observe meaningful failures.
- [ ] Implement student overview/detail/materials/add screens with consistent navigation and real data. Give selected-person errors a return path; aggregate only summaries of active relationships. Avoid rendering one professional's plan under another profile.
- [ ] Run task tests and `npm --prefix frontend run build`; self-review and commit task files. Report new copy and migration dependency.

### Task 5: Integration, translations and responsive verification

**Files:**
- Review `frontend/src/App.jsx`, `frontend/src/views/More.jsx`, `frontend/src/professional.css` and new management files.
- Update `frontend/src/locales/` or existing professional English mapping according to established translation contracts.
- Add management routing/flow tests and local browser fixtures under `frontend/` only as needed; do not expose fixtures in production routes.

- [ ] Verify route ordering reserves `/add`, `/materials`, `/new` and `/edit` before person/program IDs. All legacy aliases and code/version query contexts resolve.
- [ ] Complete translation coverage for all new strings; run `npm --prefix frontend run check:i18n`.
- [ ] Run full frontend suite, `npm --prefix frontend run build`, `npm run check:supabase`, new migration checks and `git diff --check`. Resolve failures attributable to changes with focused regression coverage; report any baseline limitations.
- [ ] Use a local browser with synthetic fixtures if live authenticated accounts are unavailable to inspect overview/profile/form/aluno/program/student detail/materials at 360/390 and 1280/1440 px, light and dark. Validate focus, overflow, long names, empty/error and return paths. Never claim live data/security validation from fixtures.
- [ ] Obtain independent whole-change code review. Fix Important/Critical findings in one dispatch with regression tests and scoped re-review. Keep all work in current checkout as authorized; do not push/publish. Record local migration/application limitations in final delivery.
