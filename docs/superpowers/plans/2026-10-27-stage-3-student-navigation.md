# Stage 3 Student Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first student-experience slice: canonical navigation, an action-led Home, and coherent Progress and Account entry points.

**Architecture:** Keep current views and the Stage 2 store/repository contracts. `App.jsx` owns canonical routes and compatibility redirects; `navigation-contexts.js` resolves active navigation state for canonical and legacy paths; existing Home, Stats and More views are relabeled and linked through their new destinations rather than duplicated.

**Tech Stack:** React 19, React Router, Zustand, Vitest, existing FPP UI components, CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-10-27-stage-3-student-navigation-design.md`

## Global Constraints

- Keep the five primary destinations: Início, Plano, Treinar, Evolução and Conta.
- Preserve Stage 2 session recovery, canonical kg data, themes, reduced motion and existing data contracts.
- Keep old routes available through canonical redirects; preserve search, hash and navigation state.
- Reuse existing Home, Plan, Workout, Stats and More data paths; no new migration, table, RPC or duplicated state.
- Keep professional, console, community and support routes outside this delivery.

## Review Focus

- A bookmarked legacy route must reach the canonical screen while retaining a query string and hash.
- A session in progress must still be reachable in one tap from every primary navigation context.
- A person without a routine must receive one useful next action rather than an empty Home.
- The currently selected navigation item must remain correct for `/progress`, `/progress/history`, `/progress/body`, `/account` and legacy aliases.
- Existing paths into settings, personal data, support, library and professional workflows must remain reachable after Account/Progress reorganization.

---

### Task 1: Canonical route aliases and route-level regression coverage

**Files:**
- Modify: `frontend/src/App.jsx:44-553`
- Create: `frontend/src/App.student-navigation.test.jsx`

**Interfaces:**
- Consumes: lazy view loaders and React Router `Navigate`.
- Produces: canonical `/progress`, `/progress/history`, `/progress/body` and `/account` routes; legacy aliases redirect with the original `search` and `hash`.

- [ ] **Step 1: Write failing route tests**

Render the application route shell with lightweight lazy-view mocks. Assert `/stats?range=30#volume` redirects to `/progress?range=30#volume`, `/history?from=home` to `/progress/history?from=home`, `/body-progress` to `/progress/body`, and `/more` to `/account`.

- [ ] **Step 2: Run the new route test to verify it fails**

Run: `npm test -- src/App.student-navigation.test.jsx`

Expected: FAIL because the canonical aliases do not exist and `/more` currently points to `/home`.

- [ ] **Step 3: Add canonical routes and a reusable compatibility redirect in `App.jsx`**

Create a small route component using `useLocation()` that receives `to` and calls `<Navigate replace>` with `pathname`, the current `search`, `hash`, and `state`. Mount existing `Stats`, `History`, `BodyProgress` and `More` views at the canonical paths. Route legacy paths through that component.

- [ ] **Step 4: Run the route test to verify it passes**

Run: `npm test -- src/App.student-navigation.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/App.student-navigation.test.jsx
git commit -m "feat: add canonical student routes"
```

### Task 2: Resolve primary navigation for canonical and compatibility paths

**Files:**
- Modify: `frontend/src/lib/navigation-contexts.js:1-300`
- Modify: `frontend/src/lib/navigation-contexts.test.js`
- Modify: `frontend/src/components/TabBar.test.jsx`

**Interfaces:**
- Consumes: `resolveNavigationContext({ pathname, search, navigationState, workoutState, hasActiveWorkout })`.
- Produces: `contextId: 'progress' | 'account'` and primary items keyed `home`, `plan`, `start`, `progress`, `account`; detail routes retain their parent active key.

- [ ] **Step 1: Write failing resolver and tab-bar tests**

Assert `/progress`, `/progress/history`, `/progress/body`, legacy `/stats`, legacy `/history`, `/account`, and legacy `/more` resolve to the expected context, active key and item labels. Assert an active workout still renders `Retomar` and navigates to `/workout` from `/progress` and `/account`.

- [ ] **Step 2: Run focused navigation tests to verify they fail**

Run: `npm test -- src/lib/navigation-contexts.test.js src/components/TabBar.test.jsx`

Expected: FAIL because contexts still expose `stats`, use `/stats`, and have no `/account` primary entry.

- [ ] **Step 3: Update `resolveNavigationContext` without changing the tab bar's interaction model**

Treat canonical and legacy Progress routes as one `progress` context and canonical/legacy account routes as one `account` context. Use exactly five primary item definitions for the student contexts: Home (`/home`), Plan (`/plan`), Start/Resume (`/workout`), Progress (`/progress`) and Account (`/account`). Preserve contextual subnavigation for professional/support routes and retain `withResumeAction` behavior.

- [ ] **Step 4: Run focused navigation tests to verify they pass**

Run: `npm test -- src/lib/navigation-contexts.test.js src/components/TabBar.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/navigation-contexts.js frontend/src/lib/navigation-contexts.test.js frontend/src/components/TabBar.test.jsx
git commit -m "feat: organize student primary navigation"
```

### Task 3: Make Home lead with the next workout decision

**Files:**
- Modify: `frontend/src/views/Home.jsx:1-240`
- Modify: `frontend/src/views/Home.test.jsx`
- Modify: `frontend/src/App.jsx:275-282` only if the Home route scenery predicate needs canonical child-route adjustment.

**Interfaces:**
- Consumes: current `S.active`, routines, week/day plan, workouts and existing sheet actions.
- Produces: Home landmarks `home-next-action`, `home-week-progress`, `home-secondary-progress`; a primary button that resumes, starts planned work, or guides an unplanned person to create/load a plan.

- [ ] **Step 1: Write failing Home tests for all three next-action states**

Assert a session in `S.active` renders the resume action; a scheduled routine without an active session renders its routine name and starts `/workout`; no routines renders `Criar treino para hoje` and `Carregar plano inicial`, without presenting a misleading generic start action.

- [ ] **Step 2: Run the Home test to verify it fails**

Run: `npm test -- src/views/Home.test.jsx`

Expected: FAIL because the current card does not expose stable stage landmarks or the specified empty-plan action copy.

- [ ] **Step 3: Refactor only the Home decision card**

Keep `nextPlannedWorkout()` and existing actions. Give the current action card `data-home-section="next-action"`; make its heading/copy distinguish resume, planned workout and no-plan states; route the no-plan primary action through the existing today-plan creation flow and keep `loadStarterPlan()` as the secondary option. Do not alter session persistence or routine mutation semantics.

- [ ] **Step 4: Add landmarks to existing weekly and lower-progress regions**

Mark the existing weekly block as `data-home-section="week-progress"` and the body-weight/recent-workout region as `data-home-section="secondary-progress"`, preserving their interaction and responsive styling.

- [ ] **Step 5: Run Home tests to verify they pass**

Run: `npm test -- src/views/Home.test.jsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/Home.jsx frontend/src/views/Home.test.jsx frontend/src/App.jsx
git commit -m "feat: prioritize the next workout on home"
```

### Task 4: Reframe existing pages as Evolução and Conta

**Files:**
- Modify: `frontend/src/views/Stats.jsx:301-470`
- Modify: `frontend/src/views/History.jsx:1-25`
- Modify: `frontend/src/views/More.jsx:1-120`
- Modify: `frontend/src/views/History.test.jsx`
- Modify: `frontend/src/views/More.management.test.jsx`
- Create: `frontend/src/views/Stats.student-navigation.test.jsx`

**Interfaces:**
- Consumes: existing store data, `useNavigate`, `AppHeader` and `MenuRow` behavior.
- Produces: an Evolução heading and links to `/progress/history` and `/progress/body`; an Account heading whose grouped links retain existing destinations.

- [ ] **Step 1: Write failing view tests**

Assert Evolution's header is `Evolução`, its history control navigates to `/progress/history`, and its body card navigates to `/progress/body`. Assert Account's header is `Conta` and its groups include profile/preferences, professional follow-up and help/privacy links with their current destinations.

- [ ] **Step 2: Run view tests to verify they fail**

Run: `npm test -- src/views/Stats.student-navigation.test.jsx src/views/History.test.jsx src/views/More.management.test.jsx`

Expected: FAIL because titles and paths use Stats/More and legacy destinations.

- [ ] **Step 3: Update labels and internal navigation without duplicating pages**

In `Stats.jsx`, use Evolução title/subtitle and canonical history/body destinations. In `History.jsx`, use `/progress` as its back destination. In `More.jsx`, rename the page to Conta, use profile/preference/professional/help-privacy section labels, and retain every existing link/action and its authorization condition.

- [ ] **Step 4: Run the focused view tests to verify they pass**

Run: `npm test -- src/views/Stats.student-navigation.test.jsx src/views/History.test.jsx src/views/More.management.test.jsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/Stats.jsx frontend/src/views/Stats.student-navigation.test.jsx frontend/src/views/History.jsx frontend/src/views/History.test.jsx frontend/src/views/More.jsx frontend/src/views/More.management.test.jsx
git commit -m "feat: organize progress and account destinations"
```

### Task 5: Verify the student navigation vertical flow

**Files:**
- Modify: `frontend/e2e/` add a focused navigation scenario only if the existing router fixture can authenticate an app shell without production services.
- Modify: `docs/PLANO_EVOLUCAO_PRODUTO.md`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: automated proof that canonical navigation works on mobile and desktop, plus a Stage 3A verification entry.

- [ ] **Step 1: Inspect current E2E fixtures and write a focused failing scenario when supported**

Cover mobile and desktop navigation from Home to Plan, Workout, Progress and Account, plus an active-session resume route. If authentication/service constraints prevent a deterministic app-shell scenario, record the exact constraint and retain Vitest coverage instead of adding a flaky test.

- [ ] **Step 2: Run the focused browser scenario or document the fixture limitation**

Run: `$env:FPP_E2E_PORT='8097'; npm run test:e2e -- <student-navigation-spec>`

Expected: PASS, or a documented reproducible fixture limitation.

- [ ] **Step 3: Run final verification**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 4: Record the results and commit**

Add the exact verification result and any E2E limitation to the Stage 3 record in `docs/PLANO_EVOLUCAO_PRODUTO.md`.

```bash
git add frontend/e2e docs/PLANO_EVOLUCAO_PRODUTO.md
git commit -m "docs: verify stage three student navigation"
```

## Self-review

- Canonical routes, redirect preservation, navigation contexts, Home decision states and Account/Evolução labels are each owned by one task.
- No task introduces persistence changes, so the Stage 2 security and recovery contracts remain untouched.
- The five review-focus risks each have tests in Tasks 1–4; the final task verifies the vertical flow and records browser limitations rather than masking them.
- Session detail, exercise detail and final workout summary are deliberately absent and remain later Stage 3 slices.
