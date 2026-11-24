# FPP Training Comparison Implementation Plan

> **For agentic workers:** Use subagent-driven-development for independent engine, persistence and UI work; root owns lifecycle integration and verification. Execution is already explicitly authorized by the user.

**Goal:** Deliver immutable original/adjusted session metadata and the official BodyMap comparison integrated with existing history.
**Architecture:** Optional `comparison.version=1` rides existing active/workout/journal JSON. Actual work derives from completed non-warm-up rows. UI consumes the pure engine and the existing BodyMap.
**Tech Stack:** Existing React/Zustand/Supabase/Vitest/Playwright; Node 22.17.0, Supabase CLI 2.122.0; no dependencies.
**Spec:** `docs/superpowers/specs/2026-11-23-fpp-training-comparison-design.md` plus the user's complete specification in this conversation.

## Global constraints

Preserve preexisting index.css edit and output artifacts; no production deployment/SQL, no main merge, no forced push. Preserve SVG/sprites, themes/i18n, professional contracts and idempotency. Do not implement excluded future features.

## Review focus

- Original captured before Flex and adjusted captured exactly once, including restored preparation.
- Local whitelist, operation JSON and DTO cannot lose optional comparison or custom metadata.
- Current catalogue/routine edits cannot rewrite historical muscles or original counts.
- Foreign/invalid query ID cannot silently display another session; account switch cannot retain old selection.
- Invalid/empty metadata and zero denominators cannot fabricate percentages or break BodyMap.

## Tasks

- [x] 1. Pure engine and 20 required edge classes: `training-comparison.js` and tests. APIs `createTrainingComparison(entries,origin,resolver)`, `confirmTrainingComparison(active,resolver)`, `normalizeTrainingComparison(value)`, `compareTraining(workout)`; RED then GREEN.
- [x] 2. Optional persistence: finish boundary, local projection, DTO, repository and existing recovery journal. Test JSON roundtrip, independent account history read, offline retry and RLS with disposable database. No migration unless existing JSON rejects contract.
- [x] 3. Lifecycle: sheets preparation and repeat; freeze entry metadata; confirm via `startSessionExecution`; include start metadata in store; preserve dynamic additions/substitutions. Unit integration tests RED/GREEN.
- [x] 4. Lazy view, shared-scale maps, progressive selector, safe unavailable/legacy/freestyle/empty states, i18n, navigation and lightweight preview. UI tests and browser fixtures.
- [x] 5. Four entry points, responsive themes and automated browser evidence. Verify snapshot persistence through actual Flex and finish/reload flows.
- [x] 6. Full checks, independent branch review, fix regressions, verification document, logical commits and push feature branch only.

Each owner records the executed tests and failures before fixes. Root reconciles shared APIs, reviews all changes and records final evidence. This compact plan follows the execution order already prescribed by the user; it introduces no design approval gate.

Verification completed on 2026-11-24. Global gates contain documented preexisting failures and timeouts; see the verification report and E2E annex. Feature-only branch publication is the final authorized delivery step.
