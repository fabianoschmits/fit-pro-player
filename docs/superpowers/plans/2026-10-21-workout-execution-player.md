# Workout Execution Player Implementation Plan

> **For agentic workers:** Use subagent-driven-development for the independent presentation/CSS/browser tasks; keep production session handlers in the existing owner.

**Goal:** Apply the approved reference to the real workout execution screen while retaining every existing workout function.

**Architecture:** Extract ExerciseBlock into a new WorkoutExercisePlayer component driven by real Zustand state and existing callbacks. Keep ActiveWorkout mutation, progression, superset, timer and recovery behavior. One selected exercise, with secondary information folded and a CSS-native player shell.

**Tech Stack:** Existing React, Zustand, CSS, shared Button/Check/NumberField/Media, Vitest/Playwright. No dependencies.

**Spec:** `docs/superpowers/specs/2026-10-21-workout-execution-player-design.md`

## Global constraints

- Use real /workout state, existing session identity and callbacks; no demo controller.
- Preserve Play/Stop/rest, timed elapsed recording and superset high-water behavior.
- Preserve all field modes, conversions, optional effort and secondary actions.
- Shared branded controls, real animations, 44px targets, 320px width, reduced motion and themes.

## Shared presentation interface

`WorkoutExercisePlayer` default export in `frontend/src/components/WorkoutExercisePlayer.jsx`. Props: `{entryIdx, compact, locked, onStartWorkout, onToggle, onField, onStartTimed, onPrevious, onNext, previousDisabled, nextDisabled}`. `onToggle(i)` and `onField(i,field,value)` operate only on that entry through parent closures; timed Start calls onStartTimed(i), timed completion calls useUI.finishWorkEarly. Navigation callbacks supplied by parent. Select current running set if any, else next pending. Parent remains owner of actual progression. Existing `Media` remains exercise demonstration/controls, expansion can use exerciseDetailSheet. Details collapse complete set table/notes/history/progression; do not hide execution hint.

Root `.active-workout.workout-player-page`; component `.wp-exercise-player`, `data-exidx`; `.wp-series-track` segments; `.wp-media-card` with `.wp-media`, `.wp-exercise-nav--previous/--next`, `.wp-exercise-title`, `.wp-exercise-target`; `.wp-current-controls` with `.wp-metric` and shared steppers; `.wp-main-action`; `.wp-series-details` and `.wp-exercise-details` native details. Keep useful legacy classes on complete table for existing behaviors. CSS owner must inspect actual markup and scope all overrides.

## Review focus

- Starting never logs; completing only affects the active set; timed completion logs elapsed.
- Rest and navigation never complete another set; supersets alternate before resting.
- All field modes and mass/effort bounds survive collapsed full table + large current controls.
- Missing/long names and 320px screens retain accessible animation/actions.
- Session sync/status, all edits and early finish remain reachable.

### Task 1: Exercise player presentation

Owner: presentation agent. Files: new component and focused component tests only.
- [ ] Read existing ExerciseBlock completely and test a failing real-store presentation/control behavior.
- [ ] Implement animation card, current-set controls and primary action with folded full table/context.
- [ ] Verify modes, locked/rest/running/completed states and shared controls.

### Task 2: Visual implementation

Owner: CSS agent. File: `frontend/src/workout-player.css` only.
- [ ] Implement reference geometry, scoped responsive surfaces and interactions based on real component markup.
- [ ] Style parent header, queue dots, folded info and timers without concealing functionality.
- [ ] Check 320/390px, themes, names, focus/reduced motion.

### Task 3: Integration

Owner: root. Files: `Workout.jsx`, existing Workout tests and other integration files only when required.
- [ ] Add failing regression tests for real player shell, navigation/progress and collapsed secondary sections.
- [ ] Replace ExerciseBlock rendering; preserve ActiveWorkout handlers; add navigation and one active superset member with group context.
- [ ] Keep recovery, queue/add, all adjustment groups and completion reachable.
- [ ] Update layout-specific test expectations while keeping behavioral assertions.

### Task 4: Browser verification/review/delivery

Owner: browser agent for `frontend/e2e/application.spec.js` and new `workout-execution-player.spec.js`; root for checks/review.
- [ ] Update old layout selectors to new visible controls and retain persistence/timer assertions.
- [ ] Exercise real bodyweight/loaded/lb/time/cardio/unilateral/superset flows at desktop and mobile, including loaded animation and screenshots.
- [ ] Run focused/full unit tests, relevant browser checks and production build.
- [ ] Independent review and resolve material findings.
- [ ] Integrate the verified change into the project and verify delivery.
