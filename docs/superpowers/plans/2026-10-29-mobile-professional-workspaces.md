# Mobile Professional Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the student “Meus profissionais” and professional workspace routes organized and usable on mobile without changing their behavior or destinations.

**Architecture:** Keep the existing `ManagementLayout` and shared stylesheet as the responsive foundation, with scoped page-level rules only where content differs. Keep navigation, forms, modal actions, and business logic intact; tune layout, safe areas, scroll regions, and touch targets.

**Tech Stack:** React, React Router, existing CSS stylesheets and app dialogs/sheets.

**Spec:** `docs/superpowers/specs/2026-10-29-mobile-professional-workspaces-design.md`

## Global Constraints

- Cover mobile widths 320, 360, 390, and 430 px.
- Preserve existing routes, labels, flows, and business behavior.
- Do not redesign desktop layouts or unrelated app areas.
- No new dependencies or test infrastructure.

## Review Focus

- Long translated or user-provided labels in headers, names, status chips, and actions wrap without clipping.
- Horizontal navigation keeps the current section visible and offers a clear cue when more items are off-screen.
- Long plans, forms, exercise pickers, and confirmations scroll to all controls while respecting mobile safe areas.
- Empty and populated lists preserve the same readable rhythm.
- Narrow viewport controls do not cause page-level horizontal overflow.

---

### Task 1: Shared workspace shell and navigation

**Files:**
- Modify: `frontend/src/management-workspace.css`
- Modify: `frontend/src/professional.css`
- Modify if required: `frontend/src/components/ManagementLayout.jsx`
- Modify if required: `frontend/src/components/ProfessionalWorkspaceNav.jsx`

**Interfaces:** Keep the existing `ManagementLayout` props and navigation destinations unchanged.

- [x] Inspect the cascade affecting `.management-topbar`, `.management-header`, `.management-nav`, `.management-main`, and mobile safe-area variables.
- [x] Adjust mobile header layout, horizontal gutters, vertical rhythm, and nav affordance for 320–430 px.
- [x] Ensure current nav destinations/sections stay visible when entering a route and remain reachable by touch scrolling.
- [x] Inspect the four target viewport widths for header/nav overlap and horizontal page overflow.

### Task 2: Student workspace pages

**Files:**
- Modify as needed: `frontend/src/views/StudentProfessionals.jsx`
- Modify as needed: `frontend/src/views/StudentProfessionalDetail.jsx`
- Modify as needed: `frontend/src/views/StudentProfessionalMaterials.jsx`
- Modify as needed: associated rules in `frontend/src/management-workspace.css`

**Interfaces:** Preserve the existing summary, training, history, and relationship sections and existing student routes.

- [x] Refine the overview, add-professional action, person/material rows, and empty states for narrow widths.
- [x] Refine the five-section detail navigation, long profile facts, and expanded training/history content.
- [x] Review add/connect/invite and material-detail flows reached from this area; make local layout changes only where needed.
- [x] Inspect populated, empty, and long-content states at all four target widths.

### Task 3: Professional overview, students, and student profile

**Files:**
- Modify as needed: `frontend/src/views/ProfessionalDashboard.jsx`
- Modify as needed: `frontend/src/views/ProfessionalStudents.jsx`
- Modify as needed: `frontend/src/components/ProfessionalStudentIdentity.jsx`
- Modify as needed: `frontend/src/views/ProfessionalStudentPage.jsx`
- Modify as needed: `frontend/src/management-workspace.css`

**Interfaces:** Preserve search/filter behavior, student routes, section query values, and existing plan/history/note actions.

- [x] Reflow dashboard quick actions and summary tiles so their labels remain legible on narrow phones.
- [x] Refine student search, filters, record cards, identity facts, and five-section detail navigation.
- [x] Refine history, notes, and relationship sections for long content and reachable actions.
- [x] Inspect dashboard/list/detail states at all four target widths.

### Task 4: Professional plans, templates, invites, and profile

**Files:**
- Modify as needed: `frontend/src/views/ProfessionalStudentPlan.jsx`
- Modify as needed: `frontend/src/views/ProfessionalPrograms.jsx`
- Modify as needed: `frontend/src/views/ProfessionalInvites.jsx`
- Modify as needed: `frontend/src/views/ProfessionalProfile.jsx`
- Modify as needed: `frontend/src/management-workspace.css`
- Modify as needed: `frontend/src/professional.css`

**Interfaces:** Preserve existing plan/template/invite/profile data and actions; keep existing exercise selection and prescription behavior.

- [x] Reflow plan week, routine cards, editors, and sticky actions for narrow widths without introducing page-level horizontal scrolling.
- [x] Reflow template fields, step labels, prescription rows, and action groups.
- [x] Reflow invite QR/code/share/revoke content and profile display/edit forms.
- [x] Inspect long forms and populated/empty states at all four target widths.

### Task 5: Dialogs and confirmation sheets in covered flows

**Files:**
- Modify as needed: `frontend/src/professional.css`
- Modify as needed: `frontend/src/components/Dialog.jsx`
- Modify as needed: `frontend/src/sheets.jsx`
- Modify as needed: `frontend/src/management-workspace.css`

**Interfaces:** Preserve dialog and sheet APIs, confirmation semantics, and keyboard/backdrop dismissal behavior.

- [x] Inventory dialogs, pickers, and confirm sheets reachable from the covered routes.
- [x] Tune mobile viewport sizing, safe-area padding, internal scrolling, and persistent/reachable actions for long content.
- [x] Check confirmation sheets, exercise picker, and other covered overlays at 320, 360, 390, and 430 px.

### Task 6: Whole-scope visual review and integration

**Files:** Review all files changed in Tasks 1–5.

- [x] Review every covered route/subroute and relevant overlay at 320, 360, 390, and 430 px using available visual inspection tooling.
- [x] Fix any clipped, overlapping, unreachable, or horizontally overflowing content found during review.
- [x] Run the repository's applicable non-test build/check command and record its result (`npm run build`: passed; sprite catalogue matches all 156 exercises).
- [x] Review the final diff and commit the implementation (`2265870`).
- [x] Push the completed commits to `master` and `main`; both remote refs resolve to `2265870`.
