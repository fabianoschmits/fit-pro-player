# Offline Account Lifecycle — Design Specification

## Goal

Make Fit Pro Player preserve offline training data when a visitor creates a Supabase account, keep the account snapshot synchronized across devices, and make “Restaurar tudo” delete the local data and the authenticated account safely.

## Decisions

- Anonymous data remains in the device-scoped anonymous cache until an authenticated account has been confirmed and the first remote snapshot upload succeeds.
- If the authenticated account has no local account data and no remote snapshot, anonymous data is automatically adopted by that account; no association dialog is shown.
- If account or remote data already exists, the existing non-destructive association/conflict flow remains in force.
- Remote-ahead snapshots replace local account state only when local sync metadata is clean; dirty local state still produces a conflict.
- Account deletion is an authenticated, server-side Supabase RPC. The browser never receives or uses `service_role`.
- Account deletion is atomic from the user’s perspective: when online and the RPC succeeds, the Auth user is deleted (with existing `on delete cascade` data), local account/anonymous cache is cleared, the session ends, and the user returns to the public Landing page.
- When offline or when remote deletion fails, local account data is not silently destroyed and the UI reports that deletion could not be completed.
- The main navigation is visible for both completed guest sessions and completed Supabase sessions; it remains hidden on the public Landing and during onboarding.

## Data and security contract

- The new `delete_my_account()` function is `security definer`, uses a fixed `search_path`, requires `auth.uid()`, deletes only `auth.users` for the caller, and is executable only by `authenticated`.
- Existing foreign keys cascade deletion of `profiles`, professional profile, roles/links, and account snapshot rows.
- Snapshot writes continue through `save_own_account_snapshot` CAS; client state serialization continues to exclude credential-like fields.

## Acceptance criteria

1. A guest can build a plan offline, create/confirm an account, and find the same plan under the account without choosing a merge option.
2. The anonymous cache is removed only after the account snapshot is confirmed `APPLIED`.
3. A second device/account scope can pull a clean newer snapshot automatically; dirty conflicts are not overwritten.
4. A signed-in user can delete the account only while online and after confirmation; success removes Auth and cascaded data and returns to Landing.
5. A guest can use the same control to clear local data without an Auth account.
6. Student and professional Auth flows continue to work, and the main navigation renders for authenticated users on mobile and desktop.
7. Existing frontend, Supabase boundary, i18n, build, and formatting checks remain green.
