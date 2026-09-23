# FPP Account Cloud Fast Track — Operational Checklist

Base: `7f74547b07ca15ccc4c49e6828e34ebc4b9f33ee`
Branch: `codex/fpp-account-cloud-fast-track`

## Scope

Execute Phases C–I continuously in this worktree. Preserve Phase A/B behavior,
keep anonymous state local, keep legacy WebAuthn and `/api/data` only where
needed for legacy migration, and never expose secrets to the frontend.

## Sequence

- [x] C — Add additive account snapshot schema, owner-only RLS, CAS RPC, and database tests.
- [x] D — Add authenticated account sync service with explicit result states, offline safety, conflict handling, and generation guards.
- [x] E — Add first-association and conflict decisions without silent overwrite.
- [x] F — Add explicit legacy WebAuthn-to-Supabase bridge without changing normal Supabase login.
- [x] G — Complete structural Capacitor session/deep-link/account integration without manual token storage.
- [x] H — Remove `/api/data` from normal Supabase account flows while retaining required legacy consumers.
- [x] I — Add owner-only, professional-role-gated Professional Profile migration, API/service boundary, and mobile-first view/edit/preview UI.

## Verification

Run focused RED→GREEN tests for each block, then `npm test`, `npm run build`,
`npm --prefix frontend run check:i18n`, `npm run check:supabase`, migration
static/security checks, database tests when available, and `git diff --check`.

## Safety

No production deploy, no merge, no deletion of prior branches, no Auth email
configuration changes, and no destructive hosted migration. Hosted migrations
may be applied only after SQL review confirms they are additive and safe for the
pre-production project. Email E2E, physical Android/iOS, physical WebAuthn,
Docker, Vercel production, and final domain validation remain DEFERRED.

## Execution notes

- Record architectural rulings and deferred gates here as work proceeds.
- Do not create separate Phase C–I branches or approval gates.
