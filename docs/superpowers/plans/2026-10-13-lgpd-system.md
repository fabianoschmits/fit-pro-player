# LGPD System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement public privacy transparency and authenticated LGPD rights management for Fit Pro Player.

**Architecture:** Keep privacy copy/configuration in a small frontend module, expose public routes and authenticated Settings controls, and enforce all titular operations through Supabase RPCs/RLS bound to `auth.uid()`. Reuse the existing account export/deletion primitives and add versioned records rather than duplicating account state.

**Tech Stack:** React, React Router, Zustand, Supabase/Postgres/RLS, Vitest, existing i18n.

**Spec:** `docs/superpowers/specs/2026-10-13-lgpd-compliance-design.md`

## Global Constraints

- Never invent controller, DPO, operator, retention, or transfer details; use explicit configuration placeholders.
- Treat health/training/measurements as potentially sensitive data and minimize professional projections.
- Every authenticated data operation must derive the subject from `auth.uid()`.
- Preserve demo/local mode and existing account deletion/export behavior.
- Use test-first changes and keep all copy in the existing translation system.

## Review Focus

- Missing legal configuration must be visible but must not break local/demo mode (config and route tests).
- A user must not access another user's rights request or export (RLS tests).
- Revoking optional consent must not silently delete account data (store/RPC tests).
- Failed deletion/export must preserve the local copy and show an actionable error (auth/settings tests).
- Professional access must remain relationship-scoped and must not expose private measurements (projection/RLS tests).

### Task 1: Privacy configuration and public documents

**Files:** Create `frontend/src/lib/privacy-config.js`, public privacy/terms/rights views and tests; modify routes, landing/footer links and translations.

- [ ] Write tests for configured/unconfigured rendering and public route navigation.
- [ ] Run focused tests and observe the missing module/route failure.
- [ ] Implement configuration, document metadata, pages, links and placeholder warning.
- [ ] Run focused tests and build.
- [ ] Commit `feat: add public privacy documents`.

### Task 2: Versioned consent capture

**Files:** Modify signup/auth UI and auth tests; create Supabase migration and SQL tests for document versions/consent records/RLS.

- [ ] Write failing tests for mandatory acceptance, optional separation, version capture and revocation.
- [ ] Run frontend and SQL/static checks to verify failure.
- [ ] Add migration, caller-only RPCs, RLS and signup/settings UI.
- [ ] Run focused frontend/database checks.
- [ ] Commit `feat: record versioned privacy consents`.

### Task 3: Rights requests, export and correction

**Files:** Create migration/RPCs, rights-request library and Settings components/tests; reuse account serialization/export boundaries.

- [ ] Write failing tests for own-user access, request protocol/status, structured export and correction validation.
- [ ] Verify red tests.
- [ ] Implement RPCs, RLS, UI, status/error handling and translations.
- [ ] Run tests, audit SQL and build.
- [ ] Commit `feat: add authenticated lgpd rights center`.

### Task 4: Deletion, retention and security audit

**Files:** Modify Settings/AuthProvider/server migrations/docs; create retention/audit tests and an LGPD operational checklist.

- [ ] Write failing tests for deletion confirmation, failure preservation, retention metadata and audit minimization.
- [ ] Verify red tests.
- [ ] Complete deletion UI/copy, retention jobs/metadata, incident/contact documentation and professional data-boundary checks.
- [ ] Run full frontend tests, SQL tests, i18n check, build, audit and manual route checklist.
- [ ] Commit `feat: complete lgpd lifecycle controls`.

### Task 5: Release readiness

- [ ] Fill and validate controller/DPO/operator/retention configuration; fail release checks when required values are placeholders.
- [ ] Run full verification and inspect every public/authenticated route.
- [ ] Document unresolved legal/business inputs explicitly.
- [ ] Commit release documentation only after controller review.
