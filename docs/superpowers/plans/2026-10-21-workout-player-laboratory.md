# Workout Player Laboratory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Add ten distinct interactive workout players to the existing administrator laboratory.

**Architecture:** A local reducer and hook own a demonstration workout independently of production stores. Ten presentational renderers consume the same model/actions and shared accessible controls. One admin page selects designs and scenarios; the existing access gate and ConsoleShell wrap it.

**Tech Stack:** React 19, existing CSS/SVG, Vitest, Playwright; no dependencies.

**Spec:** `docs/superpowers/specs/2026-10-21-workout-player-laboratory-design.md`

## Global Constraints

- Use `/console/laboratory/players` and the existing administrator access gate.
- No production workout storage, backend writes, dependencies or raster UI.
- Ten distinct layouts, all driven by the same complete demo flow.
- Portuguese copy, 44 px touch controls, mobile 360 px, reduced motion.

## Review Focus

- Repeated completion cannot create duplicate results.
- Rest expires once and respects skip/reset/unmount.
- Exercise switching cannot accidentally register a set.
- All concepts expose usable controls at mobile widths.
- Unauthenticated and non-admin visitors cannot see the experiment.

### Task 1: Local workout flow and shared controls

Files: `frontend/src/experiments/workout-players/session.js`, `session.test.js`, `usePlayerDemo.js`, `PlayerParts.jsx`, `player-parts.css`.

- [x] Write failing tests for ready→active→rest→ready, last set→exerciseDone→next, final summary, invalid repeated completion, numeric bounds, reset and scenario jumps.
- [x] Run the test and confirm missing behavior.
- [x] Implement immutable session reducer, selectors and timed rest hook; shared SVG art, metric controls, phase readout, primary action, set markers and navigation.
- [x] Run focused tests.

### Task 2: Designs Órbita, Console, Cartaz, Percurso, Deck

Files: `DesignsA.jsx`, `designs-a.css` in the same directory. Consume the shared interface below; own only these files. Deliver five visibly different renderers and metadata in `PLAYER_DESIGNS_A`.

- [x] Build five responsive compositions with shared functional parts.
- [x] Check all phases and inspect mobile sizing.

### Task 3: Designs Haltere, Sprint, Foco, Cabine, Placar

Files: `DesignsB.jsx`, `designs-b.css`. Same contract and constraints; export `PLAYER_DESIGNS_B`.

- [x] Build five responsive compositions with shared functional parts.
- [x] Check all phases and inspect mobile sizing.

### Shared renderer contract

Each renderer receives `{ model, actions }`. Metadata: `{ id, title, subtitle, idea, accent, background, component }`. CSS must be prefixed `wpl-`; every renderer root has `wpl-design` plus its own class, and `data-phase={model.phase}`.

Model: `phase` is `ready|countdown|active|rest|exerciseDone|complete`; `exercise` has `id,name,muscle,sets,reps,load,rest,unit,mode`; `exerciseIndex,exerciseCount,setIndex,totalSets,completedSets,reps,load,rir,remaining,restDuration,progress,completedTotal,total,results,phaseLabel,actionLabel,actionIcon,phaseTitle,phaseHint,displayValue,displayUnit,elapsedLabel,setElapsedLabel`.

Actions: `primary()`, `adjust(field,delta)`, `chooseExercise(index)`, `reset()`, `setPhase(phase)`.

Shared exports from `./PlayerParts.jsx`: `ExerciseDemo`, `SetMarkers`, `MetricControls`, `MainAction`, `PhaseReadout`, `ExerciseNav`, `SessionClock`. Each accepts `{model,actions,className}`; className is optional. `ExerciseDemo` and `SessionClock` can accept model only. Renderers must include SessionClock. Renderers may add decorative HTML/SVG but must use these shared components for functional controls. No imports from stores, network or auth.

### Task 4: Admin integration, browser tests and review

Files: `WorkoutPlayers.jsx`, `workout-players.css`, `WorkoutPlayers.test.jsx`, `frontend/src/features/console/ConsoleLaboratory.jsx`, `frontend/src/App.jsx`, existing ConsoleWorkspace test, `frontend/e2e/workout-players.spec.js`.

- [x] Add failing access/entry and complete-flow UI tests.
- [x] Add selection gallery, selected full-size player, stage shortcuts, reset and local result history.
- [x] Register lazy admin route and catalogue entry.
- [x] Run focused tests, full suite and build.
- [x] Exercise ten designs with Playwright at desktop/mobile; inspect screenshots and fix issues.
- [x] Obtain independent code review and resolve material issues.


## Verification completed

- Vitest: 152 files, 1293 tests passed.
- Playwright: 28 desktop/mobile Chromium tests passed, including actual exercise frame progression and independent pause/resume.
- Vite production build passed; pre-existing sheets dynamic import warning remains.
- Independent review: no remaining material findings after timer corrections.
- Available locally at http://127.0.0.1:8080/#/console/laboratory/players. No production deployment performed.
