# Fit Pro Player Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Fit Pro Player frontend into a coherent mobile-first workout app while preserving all existing data, navigation contracts, and behavior.

**Architecture:** Extend the existing React/Vite/Zustand/React Router shell with a small set of semantic UI primitives and a clearer primary navigation model. Refactor screen composition around task priority, keeping domain logic in existing views/helpers and shared presentation in `components/ui.jsx`, `TabBar`, and new focused shell components only when behavior is genuinely shared.

**Tech Stack:** React 19, Vite, React Router 7, Zustand 5, Framer Motion 12, Vitest 4, existing CSS token system, Capacitor/PWA integrations.

**Spec:** `docs/superpowers/specs/2026-09-21-fit-pro-player-frontend-redesign-design.md`

## Global Constraints

- Preserve API contracts, persisted state shape, synchronization semantics, authentication, Capacitor integrations, workout domain behavior, themes, and languages.
- Keep the existing React/Vite/React Router/Zustand/Framer Motion stack.
- Do not add a large component library.
- Use `#0F8B8D` as the semantic default accent without painting the entire interface.
- Validate widths 320, 360, 375, 390, 414, and 430px, plus tablet and desktop, in both themes.
- Keep touch targets at least 44px where practical and respect `prefers-reduced-motion`.
- New user-facing strings must use the locale system and pass the existing i18n checks.

## Review Focus

- A user with an active workout must never lose access to the current exercise, set progress, completion action, timer, or wake-lock behavior when the shell/navigation changes; pin this in `Workout.test.jsx` and `Workout.remove.test.jsx`.
- A first-run or incomplete-profile user must still be routed into the existing onboarding/plan flow rather than seeing an empty dashboard; pin this in a shell/onboarding regression test.
- A narrow viewport with the software keyboard visible must not hide the workout primary action or create horizontal overflow; pin the workout layout contract with DOM assertions and verify in the visual pass.
- Light and dark themes must retain readable semantic contrast and the selected accent after navigation/remount; pin token/theme assertions in a shell test.
- Offline/sync-conflict state must continue to persist locally and expose existing feedback after UI refactors; preserve and rerun the relevant store tests.

---

### Task 1: Baseline and shared shell inventory

**Files:**
- Create: `docs/superpowers/plans/2026-09-21-fit-pro-player-frontend-redesign-ledger.md`
- Test: existing frontend suite and repository suite
- Inspect: `frontend/src/App.jsx`, `frontend/src/components/TabBar.jsx`, `frontend/src/components/ui.jsx`, `frontend/src/store/useUI.js`, `frontend/src/index.css`

**Interfaces:**
- Consumes: current route table, existing UI primitives, `useStore`, `useUI`, and current test scripts.
- Produces: a recorded baseline and an implementation ledger for task results and rulings.

- [ ] **Step 1: Run the current frontend and repository baselines**

  Run `npm --prefix frontend test` and `npm test`. Record pass/fail counts and any pre-existing failures in the ledger before code changes.

- [ ] **Step 2: Inspect shared shell contracts**

  Map every `TabBar`, `Button`, `Row`, sheet, toast, and route consumer with `rg`; record the exact existing props and route assumptions in the ledger. Do not change code in this step.

- [ ] **Step 3: Commit the baseline ledger**

  Run `git diff --check`, then commit `docs/superpowers/plans/2026-09-21-fit-pro-player-frontend-redesign-ledger.md` with `docs: record frontend redesign baseline`.

### Task 2: Semantic design tokens and shared mobile primitives

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/ui.jsx`
- Modify: `frontend/src/components/TabBar.jsx`
- Create: `frontend/src/components/AppHeader.jsx`
- Test: `frontend/src/components/ui.test.jsx` (create if no equivalent exists)

**Interfaces:**
- Consumes: current CSS classes and primitive props used by all views.
- Produces: `AppHeader({ title, backTo, action, subtitle })`, semantic button/list/section styles, and a `TabBar` that exposes the same navigation callbacks while supporting the four primary destinations plus contextual workout emphasis.

- [ ] **Step 1: Add failing primitive and navigation contract tests**

  Test that `AppHeader` renders a labeled back action when `backTo` is supplied, shared `Button` variants retain their accessible names, and `TabBar` renders Home, Plan, Progress, and More destinations without removing the workout action when `onStart` is supplied.

- [ ] **Step 2: Run the focused tests and verify failure**

  Run `npm --prefix frontend test -- src/components/ui.test.jsx`; expect failures for the new component/contracts.

- [ ] **Step 3: Consolidate tokens and implement primitives**

  Add semantic spacing, surface, control-height, content-width, and safe-area tokens to `index.css`; replace conflicting repeated values only where the shared primitives consume them. Implement `AppHeader` using existing `Icon` and `useNavigate`, preserve current `TabBar` route behavior, and keep all existing prop names used by callers.

- [ ] **Step 4: Run focused and existing component tests**

  Run `npm --prefix frontend test -- src/components/ui.test.jsx src/components/ExerciseGuideAnimation.test.js src/components/BodyMap.shape.test.jsx`; expect PASS.

- [ ] **Step 5: Commit shared shell primitives**

  Run `git diff --check`; commit with `feat: establish mobile app shell primitives`.

### Task 3: Authenticated shell and primary navigation

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/store/useUI.js`
- Test: `frontend/src/App.test.jsx` (create)
- Test: existing route/navigation tests

**Interfaces:**
- Consumes: Task 2 `AppHeader`/`TabBar`, current `HashRouter`, `useStore`, lazy route loaders, and onboarding redirect.
- Produces: a stable authenticated shell with primary nav semantics, contextual headers for secondary routes, unchanged lazy loading, and unchanged onboarding/auth route guards.

- [ ] **Step 1: Write failing shell regression tests**

  Cover: unauthenticated landing, authenticated incomplete profile redirect to `/plan`, active workout route availability, direct `/history` and `/body-progress` access, light/dark preference application, and admin guard behavior.

- [ ] **Step 2: Run focused shell tests and verify failure**

  Run `npm --prefix frontend test -- src/App.test.jsx`; expect failures for the new shell assertions.

- [ ] **Step 3: Refactor the shell without changing route contracts**

  Keep the current route paths, lazy imports, service-worker boot, wake lock, modals, toast, rest timer, back handling, and onboarding redirect. Add route-aware shell metadata for primary/secondary pages, render `AppHeader` only where a contextual header is needed, and remove duplicate global navigation cues rather than removing access to a feature.

- [ ] **Step 4: Run shell and store regression tests**

  Run `npm --prefix frontend test -- src/App.test.jsx src/store/useStore.test.js src/store/useStore.sync.test.js`; expect PASS.

- [ ] **Step 5: Commit shell navigation**

  Commit with `feat: simplify authenticated app navigation`.

### Task 4: Home, Plan, and More task-oriented composition

**Files:**
- Modify: `frontend/src/views/Home.jsx`
- Modify: `frontend/src/views/Plan.jsx`
- Modify: `frontend/src/views/More.jsx`
- Modify: related sections in `frontend/src/index.css`
- Test: `frontend/src/views/Home.test.jsx` (create)
- Test: existing `Landing.test.jsx` and route-related tests

**Interfaces:**
- Consumes: Task 2 primitives and Task 3 shell; existing `useStore`, sheets, and route helpers.
- Produces: Home as a start/resume decision surface; Plan as routine ownership; More as grouped utilities without duplicated destination rows.

- [ ] **Step 1: Write failing behavior tests**

  Cover Home start/resume routing, starter-plan and onboarding empty states, Plan routine-edit navigation, and More links to Library, Settings, History, Body Progress, and admin when authorized.

- [ ] **Step 2: Run focused tests and verify failure**

  Run `npm --prefix frontend test -- src/views/Home.test.jsx`; expect failures for the new role/order assertions.

- [ ] **Step 3: Recompose Home**

  Keep all existing actions and data calculations, but order the DOM around the day's workout and one dominant action. Move secondary calendar/weigh-in/history controls into labeled compact sections; use the shared list/button primitives and remove redundant nested card wrappers.

- [ ] **Step 4: Recompose Plan and More**

  Preserve routine editing, sharing, profile editing, settings, library, history, body progress, and admin routes. Use semantic grouped lists, concise headers, and one visual treatment for secondary destinations.

- [ ] **Step 5: Run focused screen tests**

  Run `npm --prefix frontend test -- src/views/Home.test.jsx src/views/Landing.test.jsx src/views/BodyProgress.test.jsx`; expect PASS.

- [ ] **Step 6: Commit primary screens**

  Commit with `feat: refocus home plan and utility navigation`.

### Task 5: Progress journey and secondary screen consistency

**Files:**
- Modify: `frontend/src/views/Stats.jsx`
- Modify: `frontend/src/views/History.jsx`
- Modify: `frontend/src/views/BodyProgress.jsx`
- Modify: `frontend/src/views/Library.jsx`
- Modify: `frontend/src/views/Settings.jsx`
- Modify: `frontend/src/views/Admin.jsx`
- Test: existing `Stats.recovery.test.jsx`, `BodyProgress.test.jsx`, `Settings.push.test.jsx`

**Interfaces:**
- Consumes: Task 2 `AppHeader` and semantic sections; existing domain calculations, navigation, and sheets.
- Produces: consistent contextual headers, grouped sections, empty/loading/error feedback, and direct progress cross-links without changing domain behavior.

- [ ] **Step 1: Add regression assertions for direct routes and controls**

  Extend existing tests to assert Stats opens Body Progress, History remains reachable, Settings push behavior and sign-out remain intact, and Body Progress measurement actions retain labels and navigation.

- [ ] **Step 2: Run the existing focused tests before edits**

  Run `npm --prefix frontend test -- src/views/Stats.recovery.test.jsx src/views/BodyProgress.test.jsx src/views/Settings.push.test.jsx`; record the baseline.

- [ ] **Step 3: Apply consistent secondary-screen composition**

  Replace bespoke back/header markup with `AppHeader` where contracts match, normalize section spacing and empty states, and keep specialized charts/maps/tables intact. Do not rewrite calculations or measurement persistence.

- [ ] **Step 4: Run focused tests and commit**

  Run the same focused command and commit with `feat: unify progress and secondary screens`.

### Task 6: Workout-first interaction refactor

**Files:**
- Modify: `frontend/src/views/Workout.jsx`
- Modify: `frontend/src/components/ExerciseGuideAnimation.jsx`
- Modify: `frontend/src/components/RestTimer.jsx`
- Modify: relevant workout styles in `frontend/src/index.css`
- Test: `frontend/src/views/Workout.test.jsx`
- Test: `frontend/src/views/Workout.remove.test.jsx`
- Test: `frontend/src/lib/workout-session.test.js`

**Interfaces:**
- Consumes: current workout session/model helpers, sheets, timer, wakelock, sound, superset flow, and store mutations.
- Produces: a single clear current-exercise/set flow with a safe-area-aware primary action and unchanged session persistence.

- [ ] **Step 1: Write/extend failing workout interaction tests**

  Assert the current exercise, set index/total, weight and reps controls, complete-set action, next-step context, remove behavior, repeat behavior, and result transition remain available and call the existing session/store actions.

- [ ] **Step 2: Run workout tests to establish the failure or coverage gap**

  Run `npm --prefix frontend test -- src/views/Workout.test.jsx src/views/Workout.remove.test.jsx src/lib/workout-session.test.js`; record which new assertions fail or expose missing coverage.

- [ ] **Step 3: Recompose the workout view around one primary action**

  Keep the existing event handlers and state transitions. Reorder the JSX into current exercise, guide, current set, inputs, completion action, and compact progress/next context. Use one primary control group, move nonessential details to the existing sheet/modals, and ensure sticky positioning accounts for `--sab` and focus/keyboard scrolling.

- [ ] **Step 4: Verify workout persistence and accessibility**

  Run the focused workout command, inspect accessible names and keyboard focus in the rendered DOM, then run `npm --prefix frontend test -- src/views/Workout.test.jsx src/views/Workout.remove.test.jsx src/lib/workout-session.test.js src/lib/supersetFlow.test.js`; expect PASS.

- [ ] **Step 5: Commit the workout refactor**

  Commit with `feat: streamline active workout flow`.

### Task 7: Responsive, theme, accessibility, and i18n hardening

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/landing.css`
- Modify: affected view/component styles discovered during visual pass
- Modify: locale files only for genuinely new strings
- Test: existing i18n scripts and relevant component tests

**Interfaces:**
- Consumes: all redesigned screens and shared tokens from Tasks 2–6.
- Produces: no-overflow responsive layout, consistent light/dark contrast, focus/reduced-motion behavior, and complete translated strings.

- [ ] **Step 1: Run i18n and static checks before visual changes**

  Run `npm --prefix frontend run check:i18n` and the frontend suite; record any baseline result.

- [ ] **Step 2: Add failing assertions for high-risk responsive/accessibility contracts**

  Add tests for `aria-label`/role presence on the primary workout action, disabled states, keyboard-triggerable custom controls, and no duplicated navigation labels in the shell.

- [ ] **Step 3: Consolidate responsive styles**

  Replace conflicting media-query rules used by touched screens with semantic tokens and mobile-first layout rules. Verify 320/360/375/390/414/430px, tablet, and desktop; keep desktop max-widths and native safe areas.

- [ ] **Step 4: Harden theme and motion**

  Check both themes for readable primary/secondary text, selected controls, error/success feedback, focus rings, and disabled controls. Ensure new transitions use opacity/transform and are disabled by the existing reduced-motion rule.

- [ ] **Step 5: Run i18n and focused accessibility tests**

  Run `npm --prefix frontend run check:i18n` and `npm --prefix frontend test`; expect PASS.

- [ ] **Step 6: Commit hardening changes**

  Commit with `fix: harden responsive accessibility and theme states`.

### Task 8: Full verification and visual review

**Files:**
- Modify: only files required by verified findings from visual/code review
- Inspect: all changed files, browser console, git diff

**Interfaces:**
- Consumes: completed Tasks 1–7 and the spec's verification criteria.
- Produces: evidence-backed final branch with no known critical/important regressions.

- [ ] **Step 1: Run the complete verification matrix**

  Run `npm test`, `npm run build`, `npm --prefix frontend run check:i18n`, and `git diff --check`; read and record every result.

- [ ] **Step 2: Perform visual browser review**

  Start the frontend dev server, inspect Home, Plan, Workout, Stats, History, Body Progress, More, Settings, and Landing at 320/360/390/430px and desktop, in light and dark themes. Check overflow, clipped text, keyboard/focus, sheets, bottom navigation, safe areas, and console errors.

- [ ] **Step 3: Run a separate code review pass**

  Review the branch against the spec and Review Focus. Classify findings by user impact; fix Critical/Important findings with a regression test first, and record deferred Minor findings in the ledger.

- [ ] **Step 4: Re-run the complete verification matrix**

  Repeat `npm test`, `npm run build`, `npm --prefix frontend run check:i18n`, and `git diff --check` after all review fixes.

- [ ] **Step 5: Record final evidence**

  Append final test/build results, visual limitations requiring a real device, `git status --short --branch`, `git diff --stat`, and the complete commit list to the ledger. Do not claim completion without these outputs.
