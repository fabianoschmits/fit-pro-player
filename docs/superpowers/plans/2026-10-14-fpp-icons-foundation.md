# FPP Icons Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first reviewable FPP Icons foundation with a repository inventory, three consistent workout SVGs, a React renderer, and a development gallery.

**Architecture:** Keep SVG files as the source of truth, describe them through a manifest, and render them through a small `FppIcon` component using Vite asset imports. Keep the gallery isolated from production navigation and reuse the existing design tokens and theme behavior.

**Tech Stack:** React 19, Vite, Vitest, SVG, existing CSS tokens, Node.js scripts.

**Spec:** `docs/superpowers/specs/2026-10-14-fpp-icons-foundation-design.md`

## Global Constraints

- All icon SVGs use `viewBox="0 0 24 24"`.
- SVGs use `currentColor`, `fill="none"`, rounded caps/joins, and no fixed brand colors.
- No external icon library, raster image, base64 data, text, gradient, or shadow.
- Only `workout-push`, `workout-pull`, and `workout-legs` are created in this phase.
- Existing Plan, BodyMap, workout, and production navigation behavior must remain unchanged.
- No new runtime dependency may be added.

## Review Focus

- SVGs must remain distinguishable at 20–24 px; add validation/gallery coverage in Task 2.
- Push and Pull must communicate different front/rear anatomy; add semantic fixture assertions and gallery review in Task 3.
- The component must not silently render a wrong icon for an unknown name; add a focused test in Task 4.
- Decorative and titled accessibility states must be correct; add component tests in Task 4.
- The development gallery must not become a production destination; add route/entry guard coverage in Task 5.

### Task 1: Repository audit and icon package foundation

**Files:**
- Create: `frontend/src/assets/icons/fpp/ICON-INVENTORY.md`
- Create: `frontend/src/assets/icons/fpp/README.md`
- Create: `frontend/src/assets/icons/fpp/manifest.json`
- Create: `frontend/src/assets/icons/fpp/index.js`
- Create: `frontend/src/assets/icons/fpp/muscles/.gitkeep`
- Create: `frontend/src/assets/icons/fpp/body/.gitkeep`
- Create: `frontend/src/assets/icons/fpp/workouts/.gitkeep`
- Create: `frontend/src/assets/icons/fpp/exercise/.gitkeep`
- Create: `frontend/src/assets/icons/fpp/equipment/.gitkeep`
- Create: `frontend/src/assets/icons/fpp/ui/.gitkeep`

**Interfaces:**
- Produces a manifest object/list that later tasks can extend with `{ id, file, name, namePtBr, category }` records.
- Produces inventory status values that distinguish existing assets, new assets, and deferred candidates.

- [ ] **Step 1: Complete the repository search**

  Search `frontend/src`, `frontend/public`, and relevant root scripts for SVGs, inline SVG, emoji/Unicode icon substitutes, BodyMap, Plan, workout categories, muscle slugs, and existing icon classes. Record concrete file paths and usage locations.

- [ ] **Step 2: Write `ICON-INVENTORY.md`**

  Add the requested table columns and include the three new workout icons plus all relevant existing/deferred icon candidates found by the audit.

- [ ] **Step 3: Create package metadata and documentation**

  Add the empty category directories, a three-entry manifest, and README conventions for adding future icons without duplicating the SVG source of truth.

- [ ] **Step 4: Verify the audit foundation**

  Run `git diff --check` and a small Node/Vitest check that parses `manifest.json` and confirms unique IDs/files.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/assets/icons/fpp
  git commit -m "feat: scaffold FPP icon library"
  ```

### Task 2: SVG validation and the three reference icons

**Files:**
- Create: `frontend/src/assets/icons/fpp/workouts/workout-push.svg`
- Create: `frontend/src/assets/icons/fpp/workouts/workout-pull.svg`
- Create: `frontend/src/assets/icons/fpp/workouts/workout-legs.svg`
- Create: `frontend/scripts/validate-fpp-icons.mjs`
- Modify: `frontend/package.json`
- Test: `frontend/scripts/validate-fpp-icons.test.mjs`

**Interfaces:**
- Produces three SVG assets listed by the manifest.
- Produces a validator runnable through `npm run icons:validate`, returning a non-zero exit code for invalid files.

- [ ] **Step 1: Write validator tests first**

  Cover valid SVGs and failures for wrong viewBox, `<text>`, raster/image references, base64, fixed color literals, incompatible width/height, duplicate manifest IDs, and unlisted SVG files.

- [ ] **Step 2: Run the validator tests to verify they fail**

  Run `npm test -- --run frontend/scripts/validate-fpp-icons.test.mjs` from the repository root or the project’s equivalent Vitest invocation. Expected: FAIL because the validator and SVGs do not exist yet.

- [ ] **Step 3: Implement the validator**

  Use Node filesystem and XML-safe string checks sufficient for this controlled SVG format. Validate every SVG under `frontend/src/assets/icons/fpp`, compare against the manifest, and report file-specific errors.

- [ ] **Step 4: Create the three SVGs**

  Draw original 24×24 line icons using the shared construction: push/front chest emphasis, pull/rear back emphasis, and legs/lower-body emphasis. Use the shared base/target classes where helpful, with no hard-coded color.

- [ ] **Step 5: Add and run the package script**

  Add `icons:validate` to `frontend/package.json`, then run `npm run icons:validate` and the validator tests. Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/assets/icons/fpp/workouts frontend/scripts frontend/package.json
  git commit -m "feat: add initial FPP workout icons"
  ```

### Task 3: FppIcon component

**Files:**
- Create: `frontend/src/components/FppIcon.jsx`
- Create: `frontend/src/components/FppIcon.test.jsx`
- Modify: `frontend/src/assets/icons/fpp/index.js`

**Interfaces:**
- `FppIcon({ name, size = '1em', className, title, aria-hidden, ...rest })` renders the named SVG with `viewBox="0 0 24 24"`, width/height from `size`, and forwarded class/style attributes.
- Unknown names throw an explicit error containing the requested name.

- [ ] **Step 1: Write component tests first**

  Assert rendering for each initial name, width/height from numeric and CSS sizes, class merging, title behavior, default decorative `aria-hidden`, explicit `aria-hidden`, and unknown-name failure.

- [ ] **Step 2: Run the focused tests to verify they fail**

  Run `npm test -- --run src/components/FppIcon.test.jsx` from `frontend`. Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement manifest resolution and rendering**

  Import the three SVG assets in `index.js`, expose a lookup map, and render a native `<svg>` through the imported asset’s URL or the project’s established SVG-loading approach. Preserve accessibility attributes and avoid duplicating icon path data in JSX.

- [ ] **Step 4: Run focused tests**

  Run `npm test -- --run src/components/FppIcon.test.jsx`. Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/components/FppIcon.jsx frontend/src/components/FppIcon.test.jsx frontend/src/assets/icons/fpp/index.js
  git commit -m "feat: add FppIcon renderer"
  ```

### Task 4: Development gallery

**Files:**
- Create: `frontend/src/views/FppIconGallery.jsx`
- Create: `frontend/src/views/FppIconGallery.test.jsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- The gallery renders the three manifest icons in sizes `16`, `20`, `24`, `32`, and `48` px, with normal and accent color states on light and dark surfaces.
- The gallery route/entry is development-only and does not alter normal production navigation.

- [ ] **Step 1: Write gallery tests first**

  Assert all three names appear, all five size labels/variants are present, and the gallery is not registered in production mode.

- [ ] **Step 2: Run focused tests to verify they fail**

  Run `npm test -- --run src/views/FppIconGallery.test.jsx`. Expected: FAIL because the view and route do not exist.

- [ ] **Step 3: Implement the gallery**

  Build a compact review surface using existing tokens, with explicit light/dark preview cards and accent swatches. Keep styling local to clearly named FPP gallery classes and do not change Plan or BodyMap styles.

- [ ] **Step 4: Add guarded local access**

  Add the smallest consistent development-only route or entry mechanism around the existing `HashRouter`. Ensure production builds do not expose a normal navigation link to the gallery.

- [ ] **Step 5: Run focused tests and build**

  Run the gallery test and `npm run build` from `frontend`. Expected: PASS and a successful Vite production build.

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/views/FppIconGallery.jsx frontend/src/views/FppIconGallery.test.jsx frontend/src/index.css frontend/src/App.jsx
  git commit -m "feat: add FPP icon gallery"
  ```

### Task 5: Final verification and review handoff

**Files:**
- Modify only files required by verification fixes.

- [ ] **Step 1: Run icon validation**

  Run `npm run icons:validate` from `frontend`. Expected: all three SVGs pass and manifest coverage is complete.

- [ ] **Step 2: Run focused tests**

  Run `npm test -- --run src/components/FppIcon.test.jsx src/views/FppIconGallery.test.jsx frontend/scripts/validate-fpp-icons.test.mjs` using the repository’s supported Vitest invocation. Expected: PASS.

- [ ] **Step 3: Run the full frontend test suite**

  Run `npm test` from `frontend`. Expected: PASS with no regressions.

- [ ] **Step 4: Run the production build**

  Run `npm run build` from `frontend`. Expected: PASS.

- [ ] **Step 5: Inspect the gallery at all required sizes**

  Start the dev server, open the gallery, and visually compare Push/Pull/Legs at 20, 24, and 32 px on both theme surfaces. Correct only inconsistencies found in this first family.

- [ ] **Step 6: Commit verification fixes and report the review gate**

  Commit any final corrections with `git commit -m "fix: polish FPP icon foundation"`, then present the gallery and stop for visual approval before creating additional icons.
