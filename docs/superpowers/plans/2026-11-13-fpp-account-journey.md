# FPP Account Journey Implementation Plan

> **For agentic workers:** Use subagent-driven-development with independent file ownership and a fresh final review. User authorized full execution.

**Goal:** Deliver the approved FPP-branded authentication and role-specific first-use flows.
**Architecture:** Shared visual journey shell and styles; AuthSheet owns access; new AccountOnboarding route composes training/professional setup. Existing repository and store persist data with account isolation.
**Tech Stack:** React 19, Vite, Zustand, Supabase, existing CSS and icons.
**Spec:** docs/superpowers/specs/2026-11-13-fpp-account-journey-design.md

## Global Constraints
- Preserve original workspace's modified index.css; all journey styles are in dedicated files.
- No new dependencies, passwords never persisted, no production mutations.
- Keep existing account guards, invitations, privacy routes, completed users and PlanWizard edit behavior.
- Portuguese copy uses existing localization boundaries; reduced motion, keyboard and mobile supported.

## Review Focus
- Reload mid-setup restores only current account draft.
- Email confirmation, resend failures and double submissions retain entered context.
- Professional setup never generates personal training routines or claims verification.
- Invite and public-document routes are reachable while setup is incomplete.
- Failed persistence cannot claim setup complete.

### Task 1: Authentication and visual shell
Files: AuthSheet.jsx/test, auth/AuthProvider.jsx/test, new components/JourneyLayout.jsx, new account-journey.css.
Produces: JourneyLayout({children, title, description, step?, total?, onBack?, aside?, variant?}); import CSS within layout. AuthProvider public user adds accountType. AuthSheet account-type selection remains available and signup supplies accountType; profile deferred to onboarding. resendConfirmation(email) provider method.
- [x] Add and run failing behavior tests for confirmation/resend and professional signup without pre-account professional form.
- [x] Implement shared FPP visual shell and restyled entry/login/signup/recovery/confirmation.
- [x] Run AuthSheet and AuthProvider tests and scoped lint.

### Task 2: Durable training onboarding
Files: new components/onboarding/TrainingOnboarding.jsx; new lib/onboarding.js/test; new components/onboarding/training-onboarding.css; tests.
Consumes: shared JourneyLayout.
Produces: TrainingOnboarding({onDone}); pure draft/completion helpers with account-scoped store persistence; follow-professional path navigates to /student/professionals/add.
- [x] Add/run failing tests covering resumption, unset personal data, self plan generation and coach path without generated plan.
- [x] Build short steps: start intent; goal/experience/weight+optional body; availability; review; completion.
- [x] Persist non-secret draft after advances, fail visibly if storage fails, clear only after successful completion.
- [x] Run new and existing PlanWizard tests.

### Task 3: Professional onboarding
Files: new components/onboarding/ProfessionalOnboarding.jsx; professional-onboarding.css; tests. Existing ProfessionalProfileForm may be extended with optional section filtering only if backwards compatible.
Consumes: JourneyLayout and existing professional repository. Produces ProfessionalOnboarding({onDone}).
- [x] Add/run failing tests for professional save failure, retry and successful setup without personal plan.
- [x] Build presentation, professional details, review and completed experience using current supported data.
- [x] Account-scoped non-secret draft save, provision/save repository handling, identity isolation.
- [x] Run professional profile/onboarding tests.

### Task 4: Route integration, entry and final QA
Files: App.jsx/auth test; new views/AccountOnboarding.jsx/test; views/Landing.jsx + landing.css targeted entry adjustments; store sync allowlist only if draft needs it.
- [x] Add/run failing route tests for professional destination and public document exceptions.
- [x] Integrate /onboarding gate and role chooser; retain invites; suppress navigation/profile chrome during first use.
- [x] Align public entry CTAs and copy with FPP journey.
- [x] Run lint/typecheck/i18n, focused tests, full relevant suite, production build.
- [x] Browser QA at desktop/mobile: login, signup choices, recovery, training steps, professional steps via isolated local test fixtures; no real signup.
- [x] Fresh final review; fix material findings and verify.
- [x] Transfer only task-owned changed files to original workspace; verify there and preserve original CSS.
