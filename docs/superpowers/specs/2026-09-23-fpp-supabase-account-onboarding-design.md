# FPP Supabase Account Onboarding Design

## Goal

Make the production web application on Vercel support immediate Supabase account creation for normal users and physical-education professionals, without depending on the legacy Node API.

## Approved architecture

```text
https://www.fitpp.com.br
        |
        v
Vercel — React / PWA
        |
        v
Supabase
  Auth
  PostgreSQL
  RLS
  RPCs
  Edge Functions only when a server-side boundary is required
```

The legacy Node API remains available for self-hosted/WebAuthn compatibility, but new Supabase accounts do not use it for identity, profiles, roles, snapshots, or normal synchronization.

## Product behavior

- Every account is created through Supabase Auth using the existing email/password and PKCE flow.
- A normal user is provisioned with a `profiles` row and the `student` role.
- A professional may select professional onboarding during signup and can use the product immediately.
- Professional onboarding creates a `professional_profiles` row with `verification_status = 'unverified'` and grants only the approved `professional` capability.
- Formal verification, credentials, moderation, and approval workflows are explicitly deferred.
- No client-controlled input can create or grant `admin`.

## Data and authorization

- `profiles` remains owned by `auth.users.id`.
- `user_roles` remains the source of capability truth.
- `professional_profiles` remains owner-scoped and capability-gated.
- The client must not insert `user_roles` directly.
- A narrow `SECURITY DEFINER` RPC or Supabase Edge Function will validate the authenticated caller, create the professional profile, and grant only `professional` idempotently.
- The database remains authoritative; UI checks are not authorization.
- Existing migrations 001–005 are preserved. A new additive migration is required for the onboarding operation and its tests.

## Authentication flow

1. The browser loads the publishable Supabase configuration from `frontend/.env.local` in development and Vercel public environment variables in production.
2. The existing `AuthProvider` performs session bootstrap, PKCE callback exchange, refresh, logout, and recovery handling.
3. `AuthSheet` collects name, email, password, and onboarding intent.
4. `signUp` sends only public profile metadata and the selected onboarding intent; it never sends secrets or service credentials.
5. After a confirmed or immediately-returned session, the client invokes the narrow onboarding operation with the current Supabase session.
6. The client refreshes the account snapshot and routes the user according to the returned roles/profile.
7. Reload restores the Supabase session and the same account scope without legacy `/api/data` access.

## Failure handling

- If email confirmation is enabled, signup reports confirmation required and does not claim authenticated access.
- If professional provisioning fails, the account remains a valid student account and the UI reports a retryable onboarding error; no partial client-side role state is trusted.
- Duplicate professional provisioning is idempotent.
- Admin escalation, another user's profile, and cross-owner professional profile access are rejected by database authorization.
- Missing or malformed public configuration fails closed without exposing private environment names or values.

## Security boundaries

- `SUPABASE_SECRET_KEY`, service-role credentials, database passwords, JWT private keys, access tokens, and refresh tokens never enter Vite source, the frontend bundle, local training state, or logs.
- RLS remains enabled for all account-domain tables.
- The browser uses the publishable key and the Supabase SDK session handling only.
- No global CORS or Vercel `/api/*` rewrite is part of this design.

## Verification criteria

- Signup creates a normal student account with profile and student role.
- Signup creates a professional account with profile, professional profile, student role, and professional role, all owner-scoped.
- No signup path grants admin.
- Confirmation-required signup, login, logout, recovery, reload, and PKCE callback remain functional.
- Professional UI is visible only for the authenticated professional capability.
- RLS and RPC tests cover ownership, idempotency, role escalation, and unauthorized reads/writes.
- Frontend tests cover both signup intents and provisioning failures.
- Full test suite, build, i18n, Supabase boundary checks, audit, and diff checks pass.
- Hosted email confirmation, recovery mailbox, physical passkeys, Android, and iOS remain explicit manual follow-ups.

## Out of scope

- Professional verification or credential approval.
- Invitations, students, programs, assignments, billing, documents, Storage, Realtime, or analytics.
- Production deployment changes before the implementation passes local and Supabase validation.

## Follow-up cleanup after readiness

After the Supabase account architecture is implemented and the complete validation checklist is green, perform a separate usage audit before removing legacy pieces. The cleanup must identify real consumers first and remove only code that is no longer reachable:

- legacy WebAuthn registration/login and signed-cookie session paths;
- legacy `/api/me`, `/api/data`, logout, push, and administrative routes;
- legacy local account/session state and compatibility branches;
- identity-link bridges that no longer have a supported migration consumer;
- unused frontend auth labels, screens, imports, tests, environment variables, and deployment documentation.

The cleanup is not part of this onboarding implementation. It requires its own RED tests for absence/non-use, a production usage check, a rollback-safe commit, and explicit confirmation that no existing user data or supported migration path still depends on the removed code.
