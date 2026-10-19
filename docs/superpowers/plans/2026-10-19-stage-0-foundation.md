# Stage 0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the reviewed fixes, make localization checks pass, and leave the data-integrity design internally consistent before product features begin.

**Architecture:** Keep this stage bounded to existing flows. Static UI copy uses canonical English translation keys, existing regression fixes remain isolated, and the data specification distinguishes display preference from canonical storage so the later persistence stage has one unambiguous contract.

**Tech Stack:** React 19, Zustand, Vitest, Playwright, Vite, Node.js localization checks, Supabase boundary checks.

**Spec:** `docs/PLANO_EVOLUCAO_PRODUTO.md` and `docs/superpowers/specs/2026-10-19-data-integrity-and-localization-design.md`

## Global Constraints

- Preserve unrelated untracked project artifacts.
- Treat current data as test data; no legacy data migration is required in this stage.
- Do not implement the new persistence model or navigation in Stage 0.
- Keep all locale packs at exact key parity.
- Do not claim database validation for checks skipped because PostgreSQL tooling is absent.

## Review Focus

- Portuguese text passed directly to `t()` must not become an untranslated key in other languages.
- Parameterized exercise counts must keep the `{0}` placeholder in every language.
- Empty-history rendering must include the icon without throwing.
- A comma decimal height such as `1,76` must persist as `176` centimeters.
- The professional exercise picker must add the exercise before Escape can close the sheet.

---

### Task 1: Consolidate confirmed regression fixes

**Files:**
- Modify: `frontend/src/views/History.jsx`
- Create: `frontend/src/views/History.test.jsx`
- Modify: `frontend/src/views/PersonalData.jsx`
- Modify: `frontend/src/views/PersonalData.test.jsx`
- Modify: `frontend/src/components/ProfessionalExercisePicker.jsx`

**Interfaces:**
- Consumes: `heightCmFromText(value)` from `frontend/src/lib/profile.js` and immediate button activation from `FppPerformanceButton`.
- Produces: safe empty history, locale-aware height persistence, and synchronous exercise selection.

- [ ] Verify the focused tests fail against the original behavior or retain the existing RED evidence in the task ledger.
- [ ] Review the current diff for scope and correctness.
- [ ] Run `npm --prefix frontend test -- src/views/PersonalData.test.jsx src/views/History.test.jsx src/components/ProfessionalProgramEditor.test.jsx` and expect all tests to pass.
- [ ] Run the focused Playwright professional editor scenario and expect it to pass.
- [ ] Commit only the five regression files with message `fix: stabilize core editing flows`.

### Task 2: Complete localization coverage

**Files:**
- Modify: `frontend/src/views/RoutineEdit.jsx`
- Modify: `frontend/src/views/Workout.jsx`
- Modify: `frontend/src/components/BodyMap.jsx`
- Modify: `frontend/src/components/ErrorBoundary.jsx`
- Modify: `frontend/src/locales/*.js`
- Test: `frontend/scripts/check-locales.mjs`
- Test: `frontend/scripts/check-source-strings.mjs`

**Interfaces:**
- Consumes: `t(source, ...args)` with canonical source-language keys.
- Produces: exact locale-key parity and no source string missing from every locale.

- [ ] Preserve the current failing `check:i18n` output as RED evidence: fifteen source strings missing.
- [ ] Replace Portuguese-only lookup keys with concise canonical English keys in the four source components.
- [ ] Add those keys and accurate values to every locale, preserving `{0}` where present.
- [ ] Run `npm --prefix frontend run check:i18n` and expect all three localization checks to pass.
- [ ] Run the RoutineEdit, Workout, BodyMap, and ErrorBoundary component tests and expect them to pass.
- [ ] Commit source and locale files with message `fix: complete localized interface copy`.

### Task 3: Correct the canonical-unit specification

**Files:**
- Modify: `docs/superpowers/specs/2026-10-19-data-integrity-and-localization-design.md`
- Modify: `docs/PLANO_EVOLUCAO_PRODUTO.md`

**Interfaces:**
- Produces: the Stage 2 contract `massUnit: 'kg'`, `displayUnit: 'kg' | 'lb'`, and an explicit schema version for one-time normalization.

- [ ] Replace the ambiguous use of `S.unit` as both stored unit and display preference.
- [ ] Specify that canonical values are never converted because the display preference changes.
- [ ] Specify that test data may be reset instead of heuristically migrated.
- [ ] Run `rg -n "S\.unit.*intern|unit.*origem|reconvert|displayUnit|massUnit" docs/PLANO_EVOLUCAO_PRODUTO.md docs/superpowers/specs/2026-10-19-data-integrity-and-localization-design.md` and inspect all matches for consistency.
- [ ] Commit both documents with message `docs: clarify canonical unit contract`.

### Task 4: Verify and close Stage 0

**Files:**
- Modify: `docs/PLANO_EVOLUCAO_PRODUTO.md`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: recorded Stage 0 evidence and a clean starting point for the Stage 1 UX specification.

- [ ] Run `npm --prefix frontend test` and expect the complete Vitest suite to pass.
- [ ] Run `npm --prefix frontend run build` and expect a successful build; record non-fatal warnings.
- [ ] Run `npm run check:supabase` and record pass, fail, and skipped counts accurately.
- [ ] Run `git diff --check` and expect no whitespace errors.
- [ ] Update the roadmap Stage 0 section with commands, results, and remaining external validation.
- [ ] Commit the verification record with message `docs: record stage zero verification`.
