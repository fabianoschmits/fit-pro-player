# Pending plan synchronization — 2026-11-02

The reported screenshot shows the confirmation dialog open and blocked by pending plan synchronization before apply_library_plan is invoked. A read-only inspection of the affected account found professional version 1 still selected at revision 24, with version 2 available and three personal routines preserved. No account data was changed during diagnosis. The device cache itself was not inspected; the regression scenarios reproduce the supported failure paths rather than asserting which cached payload was on that phone.

## Fix

Confirmed application previously updated the visible store without advancing the live synchronization merge base. A later revision merge could therefore report a false schedule conflict. Confirmed responses now update the controller revision, live base, durable base and store together. Delayed older reads cannot roll the base backwards.

An old professional cache can also be rejected because its selection or protected prescription differs from the server. Synchronization now recovers these specific conflicts using the server execution plan and a three-way merge of current personal routines when a trusted base exists. Without a base, recovery requires identical personal routines. Unsent personal calendar changes, conflicting personal edits and uncertain reads remain pending with durable evidence. Personal routine ordering is retained. Other permission errors remain blocked.

The final confirmation remains the only application trigger. Account scope, revision, duplicate submission and result validation protections remain enforced. The dialog closes only after the confirmed response has been accepted by the synchronization controller and store. Refresh failures after confirmed success do not turn success into failure.

## Validation

- Full Vitest: 186 files, 1,639 tests passed.
- ESLint, TypeScript and production build passed.
- Added regression coverage for live/durable merge bases, old responses, safe cache recovery, permission classification, personal calendar conflicts, routine ordering and controller-integrated modal completion.
- Browser cases cover both legacy selection mismatch and protected-prescription mismatch: no application during synchronization; one final apply RPC; next revision; updated store/base; closed dialog; seven professional calendar days; preserved personal routines.
- Supabase remote dry-run: up to date, zero pending migrations. No new migration or SQL changes.

Full browser and hosted Quality results are recorded in the delivery message after the commit is published.

Local plan-switching E2E: 33 passed across desktop Chromium, mobile Chromium and mobile WebKit (4.2 minutes). Final read-only review found no critical or important remaining issue.
