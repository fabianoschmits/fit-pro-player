# Community Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe, structured reports for community posts, comments, and replies through the existing support and operations-console systems.

**Architecture:** A database migration creates a private report-context record associated one-to-one with the existing support ticket and exposes one validating `community_report_content` RPC. A small community reporting component gathers a reason and optional explanation, while existing post/comment menus invoke it. The support repository maps the context into existing admin ticket views so the console can open the reported post through its canonical deep link.

**Tech Stack:** React, React Router, Vitest, Playwright, Supabase PostgreSQL/RPC/RLS, existing support center and operations console.

**Spec:** `docs/superpowers/specs/2026-10-26-community-reporting-design.md`

## Global Constraints

- Reuse support tickets and the operations console; do not create a parallel moderation product.
- Reports cover only community posts, comments, and replies in this delivery.
- Use `/community?post=<postId>` as the persisted verification link for every target.
- Do not reveal the reporter to the reported person or emit a report notification to them.
- Do not add automated removal, suspension, blocking, mute, report counts, or reporting for DMs, profiles, avatars, or workouts.
- Preserve existing theme tokens, touch target sizing, dialog-focus behavior, and drafts on a recoverable send failure.

## Review Focus

- A stale, deleted, or mismatched comment ID must be rejected by the RPC instead of attaching a report to an unrelated post; Task 1 SQL tests this.
- A person must not create multiple open reports for the same target or report their own content; Task 1 SQL tests this.
- The reporter must regain focus and retain their reason/description after a network error; Task 3 React tests this.
- The reports action must never appear in the three-dot menu of the reporter’s own post, comment, or reply; Task 3 React tests this.
- An administrator must see the canonical post link and immutable report context even if the live target is later unavailable; Tasks 1 and 2 test this.

---

### Task 1: Persist validated community report context

**Files:**
- Create: `supabase/migrations/20261026120000_community_reports.sql`
- Create: `supabase/tests/20261026120000_community_reports.sql`

**Interfaces:**
- Consumes: `support_tickets`, `support_messages`, `support_categories`, `community_posts`, `community_comments`, `profiles`, and `ops_require_admin()`.
- Produces: `public.community_report_content(p_target_kind text, p_post_id uuid, p_comment_id uuid, p_reason text, p_description text default null) returns uuid`; private report context included by `ops_support_ticket_detail(uuid)`.

- [ ] **Step 1: Write failing SQL tests for a valid post report and its canonical verification context**

Assert `community_report_content('post', post_id, null, 'spam', null)` creates one `community_report` support ticket, a linked context row, and `/community?post=<post_id>`.

- [ ] **Step 2: Run the migration test to verify it fails**

Run: `supabase test db --file supabase/tests/20261026120000_community_reports.sql`

Expected: FAIL because the report RPC and context table do not exist.

- [ ] **Step 3: Add the category, private context table, indexes, RLS, and `community_report_content` RPC**

The RPC validates the authenticated reporter, target kind, reason (`spam`, `harassment`, `inappropriate`, `misinformation`, `other`), `other` description, target ownership, comment/post relationship, and uses an advisory lock or unique active-target strategy to return an existing non-archived report for the same reporter and target.

- [ ] **Step 4: Extend the SQL tests for comment/reply ownership, self-report refusal, invalid target pairing, reason validation, duplicate reports, and admin-only context**

Use separate users and a reply with the parent post ID to prove comments and replies use their parent post’s link.

- [ ] **Step 5: Run the migration test to verify it passes**

Run: `supabase test db --file supabase/tests/20261026120000_community_reports.sql`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261026120000_community_reports.sql supabase/tests/20261026120000_community_reports.sql
git commit -m "feat: persist community reports"
```

### Task 2: Expose report context through the support repository and console

**Files:**
- Modify: `frontend/src/lib/support.js:1-24`
- Modify: `frontend/src/lib/support.test.js`
- Modify: `frontend/src/features/console/ConsoleConversation.jsx:1-220`
- Modify: `frontend/src/views/ConsoleWorkspace.test.jsx`

**Interfaces:**
- Consumes: `community_report_content(...)` from Task 1 and `ops_support_ticket_detail()` JSON containing `report_context`.
- Produces: `createSupportRepository().reportCommunityContent({ targetKind, postId, commentId, reason, description })` and `ticket.reportContext` with `targetKind`, `postId`, `commentId`, `reportedUserId`, `reason`, `description`, `contentExcerpt`, and `verificationLink`.

- [ ] **Step 1: Write failing repository tests for `reportCommunityContent` and report-context mapping**

Assert the repository calls `community_report_content` with `p_target_kind`, `p_post_id`, `p_comment_id`, `p_reason`, and `p_description`; assert `adminTicketDetail()` maps the nested context into camelCase.

- [ ] **Step 2: Run the repository test to verify it fails**

Run: `npm test -- src/lib/support.test.js`

Expected: FAIL because the method and mapped `reportContext` are absent.

- [ ] **Step 3: Implement repository RPC call and report-context mapping**

Keep the generic `createTicket` API unchanged. Only `reportCommunityContent` calls the report-specific RPC.

- [ ] **Step 4: Write a failing console test for the reported-content card**

Use a report ticket fixture and assert the reason, excerpt, target type, and an external link to the canonical `/community?post=...` target appear.

- [ ] **Step 5: Implement the console context card**

Render it only when `ticket.reportContext` exists. Open `verificationLink` in a new tab with safe link attributes; retain existing reply, assignment, priority, and status controls.

- [ ] **Step 6: Run focused tests to verify they pass**

Run: `npm test -- src/lib/support.test.js src/views/ConsoleWorkspace.test.jsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/support.js frontend/src/lib/support.test.js frontend/src/features/console/ConsoleConversation.jsx frontend/src/views/ConsoleWorkspace.test.jsx
git commit -m "feat: show community reports in support console"
```

### Task 3: Add the community reporting dialog and menu actions

**Files:**
- Create: `frontend/src/components/community/CommunityReportDialog.jsx`
- Create: `frontend/src/components/community/CommunityReportDialog.test.jsx`
- Modify: `frontend/src/views/Community.jsx:1-285`
- Modify: `frontend/src/views/Community.test.jsx`
- Modify: `frontend/src/components/community/CommunityComments.jsx:1-160`
- Modify: `frontend/src/components/community/CommunityComments.test.jsx`
- Modify: `frontend/src/views/community.css`

**Interfaces:**
- Consumes: `createSupportRepository().reportCommunityContent()` from Task 2 and `useDialogFocus`.
- Produces: `<CommunityReportDialog target={{ targetKind, postId, commentId, authorId, authorName }} onClose={() => void} />`; post and comment menus pass only other users’ content to this dialog.

- [ ] **Step 1: Write failing dialog tests for reason validation, retry-safe draft preservation, focus restoration, and successful close**

Assert `other` requires a description, a rejected RPC leaves chosen reason and description intact with an alert, Escape returns focus to the menu trigger, and success closes the dialog.

- [ ] **Step 2: Run the dialog test to verify it fails**

Run: `npm test -- src/components/community/CommunityReportDialog.test.jsx`

Expected: FAIL because the dialog does not exist.

- [ ] **Step 3: Implement `CommunityReportDialog`**

Use radio controls for the five fixed reasons, show the description field only for `other`, use `useFppAction` for single-submit/retry behavior, and use `useDialogFocus` with a dialog ref. Compose confirmation copy without exposing reporter identity.

- [ ] **Step 4: Write failing Community and CommunityComments tests for menu visibility and target payloads**

Assert post, comment, and reply menus for another author offer `Denunciar`; owned items do not; clicking opens the dialog with the correct post/comment IDs and author. Include one comment/reply test that confirms the parent post ID is preserved.

- [ ] **Step 5: Wire menu actions and report state through Community and CommunityComments**

Keep existing owner edit/delete menus intact. Add `onReport` from Community to CommunityComments and render one report dialog at the Community level so post/comment actions share focus, error, and submission behavior.

- [ ] **Step 6: Add focused CSS for the reason list, description field, confirmation, and dialog error state**

Use community theme tokens and 44 px targets; do not alter unrelated feed or sheet layout.

- [ ] **Step 7: Run focused tests to verify they pass**

Run: `npm test -- src/components/community/CommunityReportDialog.test.jsx src/views/Community.test.jsx src/components/community/CommunityComments.test.jsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/community/CommunityReportDialog.jsx frontend/src/components/community/CommunityReportDialog.test.jsx frontend/src/views/Community.jsx frontend/src/views/Community.test.jsx frontend/src/components/community/CommunityComments.jsx frontend/src/components/community/CommunityComments.test.jsx frontend/src/views/community.css
git commit -m "feat: report community content from menus"
```

### Task 4: Verify report workflows in the browser and full application

**Files:**
- Modify: `frontend/e2e/community.spec.js`

**Interfaces:**
- Consumes: the UI and repository contracts from Tasks 2 and 3.
- Produces: desktop and mobile browser coverage for post/comment reports and their canonical payload.

- [ ] **Step 1: Add a failing browser scenario for reporting a post**

Mock `community_report_content`, open another person’s post menu, choose `spam`, submit, and assert payload fields and the success state. Assert the owned post menu does not expose `Denunciar`.

- [ ] **Step 2: Add a failing browser scenario for reporting a comment**

Open comments, report another person’s reply, choose `other`, provide a description, and assert the payload includes the parent post ID and reply ID.

- [ ] **Step 3: Run the browser scenarios to verify they fail**

Run: `$env:FPP_E2E_PORT='8097'; npm run test:e2e -- e2e/community.spec.js`

Expected: FAIL because report controls and RPC stubs are absent.

- [ ] **Step 4: Complete fixture RPC handling and browser assertions, then run the browser suite**

Run: `$env:FPP_E2E_PORT='8097'; npm run test:e2e -- e2e/community.spec.js`

Expected: PASS on configured desktop and mobile Chromium projects.

- [ ] **Step 5: Run the complete application suite and production build**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/e2e/community.spec.js
git commit -m "test: cover community reporting workflow"
```
