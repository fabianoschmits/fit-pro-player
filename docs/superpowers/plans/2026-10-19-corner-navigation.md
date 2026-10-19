# Corner Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the More page with the accessible, responsive Fit Pro Player corner navigation while preserving every existing destination and training action.

**Architecture:** Evolve `TabBar` into the fixed corner menu and move its secondary route metadata into a small reusable module. The menu owns display-only permission checks and delegates navigation, training start, sign-out confirmation, icons, and activation behavior to the existing application services.

**Tech Stack:** React, React Router, Zustand, Framer Motion, Vitest, existing CSS custom properties and local SVG icons.

**Spec:** `docs/superpowers/specs/2026-10-19-corner-navigation-design.md`

## Global Constraints

- Preserve existing routes, the current training start/resume flow, and the local `Icon` system; do not add dependencies.
- Render the corner navigation only where the current tab bar renders it.
- Keep professional and administrative destinations conditional on their existing real account permissions.
- `/more` must redirect to `/home`; no duplicate More page remains.
- Keep all controls keyboard accessible, localizable, and compliant with `prefers-reduced-motion`.
- Do not modify authentication, authorization, account data, or professional/console layouts.

## Review Focus

- A direct visit to `/more` reaches `/home` without a blank page; pin this in Task 4.
- A user who begins a drag on a tab does not activate a second route from the follow-up click; pin this in Task 2.
- A short viewport scrolls only the vertical menu content while the corner controls remain usable; pin this in Task 3.
- When permissions fail to load, privileged destinations remain hidden; pin this in Task 2.
- Escape and outside interaction close only the vertical menu and return focus to its trigger; pin this in Task 3.

---

## File Structure

- `frontend/src/lib/corner-navigation.js`: declarative primary/secondary menu metadata and route-to-active-item helpers.
- `frontend/src/lib/corner-navigation.test.js`: unit tests for active-route and permission-aware item selection.
- `frontend/src/components/TabBar.jsx`: corner menu interaction, current tab behavior, role lookup, focus handling, and navigation callbacks.
- `frontend/src/components/TabBar.test.jsx`: DOM-level navigation, menu, permission, keyboard, and training-flow tests.
- `frontend/src/index.css`: isolated corner-menu layout, responsive vertical overflow, focus, and reduced-motion styles.
- `frontend/src/App.jsx`: replace `/more` screen route with a redirect.
- `frontend/src/views/More.jsx`: remove after the route is replaced and all its navigation definitions have moved.

### Task 1: Navigation metadata

**Files:**
- Create: `frontend/src/lib/corner-navigation.js`
- Create: `frontend/src/lib/corner-navigation.test.js`

**Interfaces:**
- Produces: `PRIMARY_NAV_ITEMS`, `secondaryNavigation({ account, professional, consoleAccess })`, and `activeNavigationKey(pathname)`.
- Consumes: no UI component; exports plain data containing route, icon, title key, subtitle key, group, and visibility condition.

- [ ] **Step 1: Write failing metadata tests**

Test that `/body-progress` resolves to the Evolution primary area; `/history` resolves to a secondary training item; a guest excludes account-only actions; an authenticated non-professional gets “Become professional”; and a professional administrator gets the applicable professional and console destinations.

- [ ] **Step 2: Run the metadata tests to verify they fail**

Run: `npm --prefix frontend test -- src/lib/corner-navigation.test.js`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement navigation metadata in `frontend/src/lib/corner-navigation.js`**

Define the four horizontal items in the exact order Home, Plan, Start, Stats. Define secondary grouped items from the existing `More.jsx` labels, routes, icons, and role conditions. `activeNavigationKey(pathname)` must classify descendants as the same areas currently classified by `TabBar.isActive`.

- [ ] **Step 4: Run the metadata tests to verify they pass**

Run: `npm --prefix frontend test -- src/lib/corner-navigation.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit the metadata task**

```bash
git add frontend/src/lib/corner-navigation.js frontend/src/lib/corner-navigation.test.js
git commit -m "feat: define corner navigation items"
```

### Task 2: Corner menu behavior

**Files:**
- Modify: `frontend/src/components/TabBar.jsx`
- Modify: `frontend/src/components/TabBar.test.jsx`

**Interfaces:**
- Consumes: `PRIMARY_NAV_ITEMS`, `secondaryNavigation`, and `activeNavigationKey` from `corner-navigation.js`.
- Produces: `TabBar({ onStart })` with the existing public component interface and a corner-menu DOM structure.

- [ ] **Step 1: Write failing component tests**

Cover primary navigation, the unchanged start/resume behavior, menu opening and closing after secondary navigation, conditional role items, hidden privileged items after a role lookup error, and prevention of a duplicate activation after a drag selection.

- [ ] **Step 2: Run the focused TabBar tests to verify they fail**

Run: `npm --prefix frontend test -- src/components/TabBar.test.jsx`  
Expected: FAIL because the corner controls and menu destinations are absent.

- [ ] **Step 3: Implement the corner menu in `frontend/src/components/TabBar.jsx`**

Keep `onStart`, `useFppActivation`, training state selection, and pointer-based nearest-tab selection. Add open-state controls for the horizontal assembly and vertical menu; resolve professional/admin access with the same repositories currently used by `More`; render local `Icon` values and grouped secondary buttons; preserve confirmation before sign-out.

- [ ] **Step 4: Run focused component tests to verify they pass**

Run: `npm --prefix frontend test -- src/components/TabBar.test.jsx`  
Expected: PASS.

- [ ] **Step 5: Commit the component task**

```bash
git add frontend/src/components/TabBar.jsx frontend/src/components/TabBar.test.jsx
git commit -m "feat: replace tab bar with corner menu"
```

### Task 3: Responsive, accessible presentation

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/components/TabBar.jsx`
- Modify: `frontend/src/components/TabBar.test.jsx`

**Interfaces:**
- Consumes: Task 2 corner-menu element class names and controls.
- Produces: focus-safe responsive presentation with no impact on professional, console, invitation, or connection layouts.

- [ ] **Step 1: Write failing accessibility interaction tests**

Test `aria-expanded`, focus entering the first vertical item, Escape closing the menu and restoring trigger focus, and outside click closing the vertical menu. Include a test asserting the vertical container has the class used for constrained-height scrolling.

- [ ] **Step 2: Run the focused accessibility tests to verify they fail**

Run: `npm --prefix frontend test -- src/components/TabBar.test.jsx`  
Expected: FAIL because focus and expanded-state behavior are not yet implemented.

- [ ] **Step 3: Implement CSS and interaction behavior**

Replace the bottom-bar-only rules with namespaced corner-menu rules. Anchor against safe-area insets, cap and scroll the vertical arm, retain touch targets on narrow displays, add visible focus styles, and remove menu transition timing under reduced motion. Implement document-level outside interaction and Escape cleanup in the component.

- [ ] **Step 4: Run the focused accessibility tests to verify they pass**

Run: `npm --prefix frontend test -- src/components/TabBar.test.jsx`  
Expected: PASS.

- [ ] **Step 5: Commit the presentation task**

```bash
git add frontend/src/index.css frontend/src/components/TabBar.jsx frontend/src/components/TabBar.test.jsx
git commit -m "feat: make corner menu responsive and accessible"
```

### Task 4: Retire More page and verify integration

**Files:**
- Modify: `frontend/src/App.jsx`
- Delete: `frontend/src/views/More.jsx`
- Modify: `frontend/src/App.test.jsx` or the route test that owns application routing

**Interfaces:**
- Consumes: completed corner navigation from Tasks 1–3.
- Produces: `/more` redirect compatibility with no More page component.

- [ ] **Step 1: Write the failing route test**

Render the authenticated app at `/more` and assert that it lands on Home without rendering the former More heading or page content.

- [ ] **Step 2: Run the route test to verify it fails**

Run: `npm --prefix frontend test -- src/App.test.jsx`  
Expected: FAIL because `/more` still renders `More`.

- [ ] **Step 3: Replace the More route with a redirect and remove its view**

Use the existing React Router `Navigate` import. Keep unrelated direct routes unchanged and delete `More.jsx` only after its role and menu definitions are represented in Tasks 1–2.

- [ ] **Step 4: Run routing and full frontend verification**

Run: `npm --prefix frontend test -- src/App.test.jsx src/components/TabBar.test.jsx src/lib/corner-navigation.test.js && npm --prefix frontend run build`  
Expected: all selected tests pass and the production build completes.

- [ ] **Step 5: Commit the integration task**

```bash
git add frontend/src/App.jsx frontend/src/App.test.jsx frontend/src/views/More.jsx
git commit -m "refactor: replace more page with corner navigation"
```

### Task 5: Final review and delivery

**Files:**
- Modify: `docs/superpowers/plans/2026-10-19-corner-navigation.md` only to mark completed tasks if this repository uses tracked plan progress.

**Interfaces:**
- Consumes: complete implementation and test results.
- Produces: reviewed, buildable branch ready for commit/push.

- [ ] **Step 1: Inspect the complete diff for route regressions, privilege leaks, and unused More imports**

Run: `git diff --check HEAD~4..HEAD && rg -n "from './views/More|from '../views/More|<More" frontend/src`

- [ ] **Step 2: Run the full frontend test suite and production build**

Run: `npm --prefix frontend test && npm --prefix frontend run build`  
Expected: test suite and build both pass.

- [ ] **Step 3: Perform a browser smoke test at mobile and desktop widths**

Open `/home`, `/plan`, `/stats`, a role-eligible secondary item, and `/more`. Confirm the corner menu opens, navigates, closes correctly, and `/more` redirects.

- [ ] **Step 4: Commit any review corrections**

```bash
git add frontend/src/App.jsx frontend/src/components/TabBar.jsx frontend/src/components/TabBar.test.jsx frontend/src/index.css frontend/src/lib/corner-navigation.js frontend/src/lib/corner-navigation.test.js frontend/src/views/More.jsx
git commit -m "fix: finalize corner navigation"
```
