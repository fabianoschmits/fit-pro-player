# FPP Motion & Feedback Implementation Plan

> **For agentic workers:** Use subagent-driven-development for independent migration groups, with shared interfaces and review before completion.

**Goal:** Standardize action feedback while preserving FPP appearance and local-first behavior.

**Architecture:** Existing Button delegates to a shared action button; async state is isolated in a hook. Shared feedback primitives and CSS use current tokens. Existing screens adopt onAction or controlled state without altering their business logic.

**Tech Stack:** React 19, existing CSS/Framer Motion, Vitest and Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-15-motion-feedback-design.md`

## Global constraints
Preserve dirty files and business/backend behavior. No new dependencies. No emojis or artificial action delays. Press 100 ms, transitions 180–220 ms, success check 360 ms. Busy visuals start after 160 ms only if still pending. Honor prefers-reduced-motion. Use current theme/accent tokens and i18n conventions.

## Review focus
- Duplicate click or Enter within one event turn must execute once.
- Fast completion and rejected requests must never leave loading or report false success.
- Local persistence failures must not be presented as successful cloud saves.
- Validation/cancel paths return false; no success feedback for no-op work.
- Navigation/unmount and changing action state must cancel feedback timers safely.

## Task 1: Shared foundation
Files: `components/useFppAction.js`, `FppPerformanceButton.jsx`, `FppFeedback.jsx`, existing `ui.jsx`, and focused tests.
Interface: preserve Button props; add onAction/state/intent/loadingLabel/successLabel/errorLabel/progress/onSuccess/onError as defined by spec.
- [x] Add failing behavior tests for lock, delay, resolution, rejection/retry, false result and controlled busy.
- [x] Implement shared action lifetime and accessible primitives; delegate Button, retain Check/Switch semantics.
- [x] Verify focused tests, review prop/markup compatibility.

## Task 2: Styles, showcase and browser validation
Files: `motion-feedback.css`, `views/MotionFeedback.jsx`, `App.jsx`, `e2e/motion-feedback.spec.js`.
- [x] Add functional browser checks for all states, themes/accents, width, reduced motion and duplicate clicks.
- [x] Style using FPP tokens; create deterministic state samples plus real promise-driven interactions without action delays in app flows.
- [x] Register lazy showcase route and structured route fallback, execute browser checks before broad migration.

## Task 3: Workout actions
Files: `sheets.jsx`, `views/Workout.jsx`, `views/RoutineEdit.jsx`, timer/overlay/share components if appropriate and tests.
- [x] Test local save feedback, confirmed deletion failure/retry and immediate set/finish behavior.
- [x] Apply shared primitives preserving sync local persistence, execution flow, timer deadlines and completion navigation.
- [x] Run existing workout/remove/manual-set/finish and related tests.

## Task 4: Professional actions
Files: invitation/profile/student views and ProfessionalProgramEditor, related tests.
- [x] Test pending, failure/retry, no false success and preserving publish drafts.
- [x] Migrate invites, copy/share, revoke, metadata saves and publication; use skeleton for structured list loading.
- [x] Run relevant professional tests.

## Task 5: Remaining established surfaces and final review
Files: auth/offline/sync/import/measurements components as applicable, locales, Toast/useUI, documentation.
- [x] Use controlled state for native forms; preserve validation, local-first semantics and existing statuses.
- [x] Consolidate Toast preserving its existing API; expose optional typed feedback.
- [x] Run localization, unit, production build and focused browser verification.
- [x] Independent review; fix findings, document coverage and remaining gradual rollout sites, update ledger.
