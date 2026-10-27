# Community Social Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing community feel like an accessible, responsive social space for training without expanding the current backend model.

**Architecture:** Keep `Community.jsx` as the data and mutation coordinator while adding small presentational regions to the existing route. Replace the full-card media gate with a media-area fallback and use the shared dialog-focus hook for all community sheets. Styling stays local to the community and consumes the global token system.

**Tech Stack:** React 19, React Router, Framer Motion, Supabase client, Vitest, Playwright, CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-10-26-community-social-foundation-design.md`

## Global Constraints

- Preserve the single-photo post, comments, likes, messages, notifications and existing database schema.
- Do not add follows, groups, saved posts, new content models or storage-policy changes.
- Use existing global color tokens: `--label`, `--label-2`, `--acc`, `--on-acc`, `--surface`, `--surface-2`.
- Preserve operation with light/dark themes and all existing accents.
- Preserve the global `prefers-reduced-motion` behavior and do not add decorative high-frequency motion.
- Validate at 320, 390, 768, 1024 and 1440 CSS pixels through tests and visual review where practical.

## Review Focus

- A failed image still exposes its author, caption, comments and retry action.
- Opening and closing each sheet traps and restores keyboard focus without breaking Escape.
- A profile that does not exist resolves to an unavailable state, not a permanent loading label.
- The composer remains usable with touch scrolling, keyboard focus and its existing crop flow.
- Post controls convey current like/menu state to assistive technologies without changing mutations.

---

### Task 1: Accessible community foundations

**Files:**
- Modify: `frontend/src/views/Community.jsx`
- Modify: `frontend/src/components/community/CommunityComments.jsx`
- Modify: `frontend/src/components/community/CommunityComposerMedia.jsx`
- Modify: `frontend/src/views/Community.test.jsx`
- Modify: `frontend/src/components/community/CommunityComments.test.jsx`

**Interfaces:**
- Consumes: `useDialogFocus(ref, options)` from `frontend/src/lib/dialog-focus.js`.
- Produces: modal sheets with focus containment and labelled controls; keyboard crop positioning controls.

- [ ] Add failing tests for semantic like/menu states, an unavailable viewed profile and dialog focus behavior.
- [ ] Run the targeted tests and observe the new assertions fail.
- [ ] Add dialog refs and `useDialogFocus` to composer, notifications and comments; use explicit close callbacks.
- [ ] Add labelled text areas/inputs, `aria-pressed` for likes, and `aria-expanded` for owned-content menus.
- [ ] Add directional crop controls that adjust the current crop position in bounded steps while retaining pointer drag.
- [ ] Run targeted Community and CommunityComments tests until green.
- [ ] Commit `fix: improve community accessibility states`.

### Task 2: Social feed composition and resilient media

**Files:**
- Modify: `frontend/src/views/Community.jsx`
- Modify: `frontend/src/components/community/CommunityPostMedia.jsx`
- Modify: `frontend/src/components/community/community-media.css`
- Modify: `frontend/src/views/community.css`
- Modify: `frontend/src/views/Community.test.jsx`
- Modify: `frontend/src/components/community/CommunityPostMedia.test.jsx`

**Interfaces:**
- Consumes: the current page snapshot and `ownIdentity` from `CommunitySession`.
- Produces: `CommunityPostMedia` whose children remain visible while the image area loads or fails.

- [ ] Add failing media/component tests for preserving post content after an image error and for the community page’s social landmarks.
- [ ] Run the focused tests and observe failures.
- [ ] Render the named page header, composer invitation, “Recentes” feed context, compact profile header and loaded-post-count summary without new queries.
- [ ] Refactor media fallback to replace only the image area and preserve post actions/content.
- [ ] Replace incompatible color variables and reorganize community CSS for coherent mobile-first layout, desktop side rail, 44px controls, stable sticky header and sheet touch scrolling.
- [ ] Run focused media/community tests until green.
- [ ] Commit `feat: redesign community social feed`.

### Task 3: Responsive regression coverage and verification

**Files:**
- Modify: `frontend/e2e/community.spec.js`
- Modify: `frontend/src/views/Community.test.jsx`

**Interfaces:**
- Consumes: final community landmarks, post actions, composer and media retry state.
- Produces: browser coverage for responsive social-feed behavior without a real Supabase account.

- [ ] Add E2E assertions for the page title, publish invitation and accessible interaction states across desktop and mobile Chromium.
- [ ] Run the new targeted E2E assertions and observe failures if not already covered.
- [ ] Implement only the adjustments needed to make the UI satisfy those assertions.
- [ ] Run targeted Vitest, community E2E and a production frontend build.
- [ ] Visually inspect desktop and mobile screenshots in light and dark modes when the test fixtures permit.
- [ ] Commit `test: cover community social foundation`.

## Self-review

- The three tasks cover all spec sections: social composition, media resilience, accessibility, responsive layout and validation.
- Interfaces retain existing data paths; no task requires a database migration.
- The review-focus cases each have an owning test task.
- Tasks share `Community.jsx` intentionally: accessibility changes establish the modal behavior before the composition task updates layout.
