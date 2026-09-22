# FPP — Account, Auth and Sync Architecture

**Status:** approved architectural specification. This document defines a future
foundation only; it does not authorize implementation, a migration, a remote
Supabase change, a worktree, or resumption of Professional Profile work.

## 1. Context

Fit Pro Player currently has two distinct paths:

- anonymous training state in browser storage under `gym_state_v1` (with a
  Capacitor file mirror on mobile);
- a legacy WebAuthn account, represented by an FPP-signed cookie and backed by
  per-user JSON files exposed through `/api/data`.

Phase 1 added a separate Supabase identity foundation: `auth.users`,
`profiles`, `user_roles`, and `legacy_identity_links`. Those migrations are
already the correct foundation for a relational professional domain, but the
current online account flow is still centered on the FPP WebAuthn session.

The approved direction is simpler: a new online account authenticates directly
with Supabase Auth. The Supabase UUID is the canonical identity for the new
authenticated domain, and Supabase is the canonical remote backup for that
identity. Anonymous use remains fully supported.

## 2. Problem

The old architecture makes the legacy FPP server responsible for identity,
session issuance, remote state files, and a future bridge to Supabase. It
creates a parallel identity and makes ordinary user access depend on custom JWT
issuance and a signing-key lifecycle that Supabase Auth already solves.

It also has unsafe product semantics for the new model: the current
`clearLocalSession` path deletes `gym_state_v1` after logout. A logout must end
an authenticated session, not erase a person's training history or a device's
anonymous state.

## 3. Goals

- Keep the full application usable without an account and without a network.
- Make Supabase Auth the primary identity and session authority for new online
  accounts.
- Use email and password as the first sign-in method.
- Keep local state durable, account-scoped when authenticated, and never
  silently cross-contaminate two accounts on one device.
- Use a complete, versioned state snapshot as the first cloud-sync contract;
  do not prematurely split `gym_state_v1` into many relational tables.
- Detect concurrent writes and resolve them explicitly rather than applying
  silent last-write-wins.
- Preserve legacy WebAuthn users and their legacy backup as an explicit,
  provable migration path.
- Reuse the existing identity migrations and their RLS base without modifying
  historical migrations.
- Leave Professional Profile and professional relationships paused until the
  account and sync foundation is implemented and validated.

## 4. Non-goals

This specification does not implement or authorize:

- a Supabase migration, schema alteration, RLS change, remote configuration,
  signing-key operation, or data import;
- Professional Profile, professional invitation codes, professional/student
  relationships, workout programs, assignments, feedback, analytics, payments,
  chat, groups, Storage, or Realtime;
- Google, Apple, Facebook, magic-link, or OTP login;
- a CRDT, automatic semantic merge, or full relational decomposition of workout
  state;
- deletion of legacy server data or the Phase 1B branch.

## 5. Superseded architecture

The following is superseded for the normal new-account flow:

- FPP-issued ES256 Supabase JWTs;
- `POST /api/account/supabase-token`;
- the Phase 1B in-memory bearer-token broker;
- importing or activating an FPP-owned Supabase signing key for normal auth;
- WebAuthn as the primary account creation and login method for new users;
- `/api/data` and server JSON files as the future cloud-sync destination;
- logout that deletes local workout state.

The Git branch `codex/fpp-supabase-auth-bootstrap` remains preserved as history.
It must not be merged, deleted, pushed, or resumed merely because this document
exists. Its generic security lessons may be reused deliberately, but its bridge
architecture is not active.

## 6. Identity model

For every new authenticated account, the canonical sequence is:

```text
Supabase Auth account
  → auth.users.id (canonical UUID)
  → public.profiles
  → public.user_roles
  → account-scoped snapshots and later relational domain entities
```

No FPP-generated user identifier, custom JWT subject, or browser-provided ID is
a second authority for this account. `auth.users.id`, received from a validated
Supabase session and expressed in `auth.uid()` for database access, is the only
identity key for new authenticated data.

`legacy_identity_links` is not part of normal Supabase sign-in. It is a
one-to-one compatibility and migration bridge from a proven legacy FPP identity
to a Supabase UUID.

## 7. Anonymous mode

No login is required to use existing local training functionality. The current
anonymous state remains local and `gym_state_v1` remains the compatible
anonymous-state key until an implementation has a safe, tested migration.

Anonymous mode may create routines, history, settings, an active workout, and
offline changes exactly as it does today. It has no remote identity and must not
accidentally upload to another person's account. A future account creation or
login presents an explicit first-association decision; it never silently claims
the anonymous state.

## 8. Authenticated account model

An authenticated account has three deliberately separate concerns:

1. **Supabase Auth session:** establishes who the signed-in person is.
2. **Account-local cache:** an offline-capable cache namespaced by the canonical
   Supabase UUID.
3. **Supabase snapshot:** the canonical remote backup for that UUID.

The active training engine receives the appropriate local state for its context.
It does not infer account ownership from a display name, email, timestamp, or
the last user of the device.

## 9. Supabase Auth and email/password flows

The initial provider is email and password. Supabase Auth owns account creation,
password verification, email confirmation, session persistence, token refresh,
password recovery, and logout.

Required conceptual flows are:

```text
Sign up → account created → confirmation may be required → confirmed → usable session
Login → valid email/password → usable session
Forgot password → recovery email → approved redirect/recovery flow → new password
Logout → Supabase session ended → active account context cleared, local data retained
```

Whether sign-up immediately yields a usable session depends on the Supabase
project's email-confirmation setting. Implementation planning must inspect and
test the real configuration; it must not assume confirmation is disabled.

The frontend uses the official `supabase-js` Auth client with the public project
URL and publishable key. Passwords are supplied only to the Auth call and are
never written to application state, snapshots, logs, analytics, or custom API
payloads.

Future providers are compatible additions, not implied deliverables. They must
link to the same canonical Supabase user and must not introduce parallel FPP
identities.

## 10. Session model

### Web and PWA

The official browser client manages `persistSession`, session restoration, and
`autoRefreshToken`. The application listens to Auth state changes and derives
the active authenticated context only from the resulting Supabase user/session.
It does not manually copy an access token or refresh token into `gym_state_v1`,
its snapshots, custom localStorage keys, URLs, logs, or analytics.

### Capacitor

Capacitor must no longer force every launch into anonymous/offline mode once
account sync is introduced. A future implementation will validate an appropriate
Supabase storage adapter for the installed Capacitor platform, restore the Auth
session when present, maintain an account-local offline cache, and retain the
native file mirror for workout resilience.

Password reset and email confirmation use web/PWA redirect URLs directly. Native
Capacitor confirmation and recovery require a separately tested deep-link and
allowed-redirect configuration gate. That gate does not block this architecture,
but it blocks claiming those flows are production-ready in a native shell.

## 11. Local cache model and account switching

The future implementation must model at least these logical namespaces:

```text
anonymous state                     → existing compatible gym_state_v1 context
authenticated cache for UUID A      → account-scoped local cache A
authenticated cache for UUID B      → account-scoped local cache B
```

Exact storage-key strings and a storage-version prefix remain implementation
details, but the namespace must include the canonical Supabase UUID and a schema
version. A cache entry also records its owning UUID and snapshot version so a
corrupt, stale, or incorrectly addressed entry can be rejected rather than
loaded into another account.

Account switch safety is mandatory:

```text
login A → load only A cache / A remote snapshot
logout  → preserve A cache; remove active A context
login B → load only B cache / B remote snapshot
```

The active state pointer must change only after ownership checks pass. Neither
display name nor email may be used as a cache namespace. The anonymous cache is
also never destroyed just because an account was created or used on the device.

## 12. Remote snapshot model

The initial remote synchronization contract is one conceptual account-owned
snapshot entity, named here `account_training_snapshots` only as a design label.
The physical table name and SQL are intentionally deferred.

Each account has at most one current snapshot with:

| Property | Contract |
|---|---|
| `user_id` | canonical `auth.users.id`; immutable owner and primary identity |
| `version` | strictly increasing opaque concurrency authority, such as `bigint` |
| `payload` | validated versioned representation of the syncable training state |
| `payload_schema_version` | application payload format version, independent of row version |
| `created_at`, `updated_at` | server timestamps for audit/display, never the concurrency authority |
| optional idempotency record | supports safe retry of a known client operation without duplicate effects |

The current treatment of `active` workouts remains intentional: an in-progress
workout is device-local until an explicit, safe completion/sync rule exists.
That rule must preserve offline training and avoid accidentally overwriting an
active workout from another device.

RLS must permit only the authenticated owner to read and mutate their snapshot,
using `user_id = auth.uid()`. `anon` has no access. A client must not be able to
choose another `user_id`. Backend use is reserved for genuinely privileged or
legacy-migration operations, not as a mandatory proxy for ordinary owner-scoped
sync.

## 13. Versioning, optimistic concurrency, and idempotency

`version`, not a timestamp, is the concurrency authority. This avoids the known
failure mode where equal timestamps contain different content.

The write contract is conceptually:

```text
read snapshot version X
→ make a local durable change
→ attempt write with expected_version = X and an operation id
→ atomically create/update only if the current version is X
→ server increments to X + 1 and returns the canonical version
```

If the server is already at version `Y`, the write returns a conflict and does
not overwrite `Y`. Network retries use a client-generated opaque operation ID,
not a timestamp, so a completed-but-unacknowledged write can be recognized as
idempotent. Client-generated IDs already present in workout state remain useful
for offline creation and later reconciliation; timestamps are not operation
identities.

The initial implementation may use a narrowly scoped RPC or a carefully
constrained database operation to make compare-and-swap atomic. It must not rely
on a client-side read followed by an unconditional update.

## 14. Sync and conflict states

The user-visible state model is conceptual and must be represented separately
from the workout payload:

| State | Meaning |
|---|---|
| `LOCAL_ONLY` | no authenticated association or no accepted remote snapshot |
| `SYNCED` | local account cache matches the acknowledged remote version |
| `SYNCING` | a queued/active upload or download is in progress |
| `OFFLINE` | local use continues; a remote operation is deferred |
| `CONFLICT` | local and remote versions diverged and need an explicit choice |
| `ERROR` | recoverable sync failure, with confirmed local state retained |

State-changing workout actions persist locally first where appropriate. A network
failure, app backgrounding, or failed refresh must never destroy the last
confirmed local state. Reconnect, foreground, and explicit retry can resume a
safe pending sync.

There is no silent last-write-wins and no CRDT in this phase. A conflict presents
the actual alternatives, preserves both candidates until a choice succeeds, and
does not mark the operation complete merely because a local choice was made.

## 15. First association and data migration

The first successful Supabase session on a device is a data-association decision,
not an automatic import. The application evaluates account-scoped remote and
local candidates without crossing account namespaces.

| Situation | Required behavior |
|---|---|
| only relevant device data | offer an explicit import/backup to the new account |
| only remote account data | offer download into that account's cache |
| data on both sides | show explicit device/cloud/separate choices |
| neither side has data | create/use an empty account context without consuming anonymous state |

When both sides have relevant state, the choices are conceptually:

- use this device's data and upload it after preserving the remote candidate;
- use cloud data and create/update only that account's cache while retaining
  anonymous data;
- keep separate/cancel the association, allowing a valid account with an empty
  remote snapshot and leaving local anonymous data untouched.

There is no automatic merge. The copy and exact UI wording remain implementation
decisions, but the data guarantees do not.

### Device to cloud

Before replacing a meaningful remote candidate, implementation must create a
controlled remote backup/revision or otherwise retain a recoverable remote
candidate. It writes only after the chosen association is explicit. The original
local data remains until a successful acknowledgement is received. A failed
network request leaves the original local state usable and makes the association
retryable.

### Cloud to device

Downloading cloud data creates or updates only the cache namespaced to the
authenticated UUID. It never deletes `gym_state_v1` and never reads or rewrites
another account's cache.

## 16. Logout and deletion semantics

The future logout operation is intentionally non-destructive:

1. call Supabase Auth sign-out for the active session;
2. clear active authenticated context and in-memory sync work safely;
3. preserve account-local cache, anonymous state, workout history, and backup
   candidates;
4. return the application to the correct unauthenticated/anonymous experience.

It must not call `localStorage.clear()` or an equivalent broad deletion. It must
not reuse a destructive helper for logout, account deletion, local-cache removal,
or remote-data deletion. Those are separate explicit product operations with
their own confirmation, retention, and authorization rules.

## 17. Offline and multiple devices

Offline capability is a non-negotiable product property. An account holder must
be able to open cached workouts, execute a workout, record sets, and complete a
workout without a network. The local account cache and native mirror provide
that continuity; cloud sync is recoverable work, not a prerequisite for training.

The same account can later use a phone and PWA/web. Independent cached changes
are expected and become detectable through snapshot versions. The system makes
the conflict explicit rather than assuming a single device or silently choosing
the newest clock value.

## 18. Legacy WebAuthn and legacy server files

Existing FPP WebAuthn is a **legacy migration flow**, not a new primary Auth
provider. New users must not receive new FPP WebAuthn registration through the
future normal account UI.

The future legacy migration sequence is:

```text
legacy WebAuthn proof
→ temporary legacy FPP session
→ create or sign in to Supabase account
→ explicit user confirmation of both identities
→ protected legacy_identity_links association
→ authorized import of legacy backup into the new account
```

The migration backend derives the legacy identity only from a proven legacy
WebAuthn session; it must never accept a supplied legacy ID as authority. It
also verifies the Supabase session. A requester cannot link another person's
legacy record merely by guessing or submitting an identifier.

`legacy_identity_links` remains a one-to-one bridge used for this compatibility
work. It does not run on normal Supabase login and is not needed to restore a
normal Supabase session.

`/api/data` and its server JSON files become **legacy read/migration sources**.
No significant new cloud product work belongs on that storage. Legacy files are
not automatically deleted during account migration; import, retention, and
eventual removal require a separate approved lifecycle policy. Transitional
coexistence is read/import-oriented, not permanent dual-write:

```text
temporary legacy migration: legacy file → explicit import → Supabase snapshot
new authenticated account: account cache ↔ Supabase snapshot
```

## 19. Roles and professional registration boundary

Existing roles remain additive:

- every Supabase user receives `student` automatically;
- `professional` is an explicit capability in addition to `student`;
- `admin` is never client-assignable.

Future registration can offer the explicit choice “Sou aluno” or “Sou
profissional.” Selecting professional may result in a narrowly authorized,
idempotent server/database operation that grants only `professional` to the
current authenticated UUID. It must derive that UUID from the verified Supabase
session, validate an allowed request shape, and never accept an arbitrary target
user ID or role name from the client.

Self-selecting professional is not professional verification. It must never
grant `admin`, set `verification_status = verified`, or bypass any future
Professional Profile validation/moderation. `professional_profiles` remains a
separate paused domain; the prior Phase 2 specification may be revisited only
after this foundation is implemented and validated.

## 20. Future professional-to-student code

A professional code is a future relationship action, not an authentication
credential, password, backup code, or workout-sharing code:

```text
student enters a professional code
→ controlled lookup returns a minimal professional card
→ student confirms the intended professional
→ relationship is created
```

Creating that relationship must not retroactively grant access to gym history,
personal routines, `gym_state_v1`, old snapshots, or any other private account
data. Those permissions require explicit future product rules in Phase 3.

## 21. RLS and security boundaries

With direct Supabase Auth, `auth.uid()` is the authenticated account identity.
RLS remains the principal authority for direct owner-scoped data access. The
frontend may call Supabase directly when RLS permits it; a backend proxy is not
required merely because a user is authenticated.

The backend remains appropriate for privileged administration, controlled
legacy migration, and narrowly justified actions that cannot be expressed safely
through RLS. `SUPABASE_SECRET_KEY` remains backend-only. The Vite frontend may
receive only its public Supabase URL and publishable key; it never receives a
secret key, database password, signing private key, or access token copied by
application code.

Security review requirements for implementation include:

- RLS ownership and denial tests for every snapshot operation;
- server-validated account switching and UUID cache ownership;
- no token/password/cookie/payload logging;
- XSS-aware browser session handling and CSP validation;
- explicit proof of both sides for legacy linking;
- non-client-assignable admin role and non-verified professional enrollment;
- native storage and deep-link validation before claiming Capacitor support;
- distinct destructive operations for logout, cache deletion, and account/data
  deletion.

## 22. CSP, PWA, and Capacitor impact

The current Vercel CSP uses `connect-src 'self'`. Direct Supabase Auth and
snapshot access will therefore require a future CSP amendment for only the
specific Supabase project endpoint(s) actually used. `connect-src *` is
forbidden. The changed policy must be tested for Auth, database requests,
recovery redirects, PWA behavior, and existing same-origin assets.

The current Capacitor mode is intentionally local-only. Its future transition
must preserve native file durability and offline workouts while adding safe
session restoration and eventual sync. It must not infer that browser storage is
adequate secure storage for a native refresh token without validating the
available platform adapter and threat model.

## 23. Observability and failure handling

Permitted observability is minimized to event category, anonymous/correlated
operation identifier where necessary, outcome, latency, snapshot version, and
high-level state transition. Examples include sign-in state change, sync success,
recoverable sync failure, conflict detected, retry, and migration stage.

Observability must never include passwords, access tokens, refresh tokens,
cookies, complete `gym_state_v1` content, or training payloads that are not
strictly required for an approved diagnostic purpose.

Failures are recoverable by default:

- auth unavailable: keep local training usable and show the account operation
  failed;
- confirmation/recovery redirect unavailable on native: keep the account state
  explicit and route through the validated platform flow when available;
- sync network error: retain local state and retry safely later;
- conflict: retain both candidates and require an explicit choice;
- migration failure: retain legacy source and do not claim import completion.

## 24. Reused Supabase foundation

Migrations 001–003 are preserved and reused without editing their history:

- `profiles` provides account profile data;
- `user_roles` provides additive roles;
- `legacy_identity_links` provides a restricted legacy migration bridge;
- `handle_new_auth_user` creates base profile and `student` role;
- existing grants and RLS establish owner-scoped identity access.

Future migrations are chronological additions only. They will be required for
the snapshot entity, controlled concurrency contract, any approved professional
role enrollment boundary, and eventually professional-domain entities. This
specification intentionally contains no SQL and changes no remote database.

## 25. Migration strategy, rollout, and rollback

The transition is incremental:

1. ship direct Supabase Auth foundation without breaking anonymous mode;
2. introduce separated local account cache ownership;
3. add and validate the owner-scoped Supabase snapshot schema and RLS;
4. move normal authenticated sync to the snapshot contract;
5. add first-association and conflict UX;
6. add proven legacy WebAuthn-to-Supabase migration;
7. validate Capacitor auth/session/deep-link behavior;
8. retire normal `/api/data` writes after migration coverage and retention
   policy are approved;
9. only then resume Professional Profile.

There is no permanent dual-write. During rollout, a feature flag or equivalent
explicit version gate may keep the legacy path available to existing legacy
accounts while new Supabase accounts use the new model. A rollback disables the
new path for new writes and preserves local caches, remote snapshots, and legacy
files; it does not delete any of them. Rollback must not recreate destructive
logout behavior or reintroduce Phase 1B as normal authentication.

## 26. Testing strategy

Implementation must use TDD and cover, at minimum:

- Supabase email/password sign-up, login, confirmation-required, recovery,
  reset, restore, refresh, and logout state transitions;
- anonymous flow regression and no-login offline training;
- UUID-scoped cache A/B isolation, logout preservation, and account switching;
- no access token/refresh token in gym state, snapshots, URLs, logs, or custom
  persistence;
- snapshot owner RLS denial for anonymous and account B;
- atomic expected-version success, stale-version conflict, idempotent retry, and
  equal-timestamp/different-payload regression;
- device-only, cloud-only, both, and empty first-association cases;
- network interruption before acknowledgement, while offline, and during retry;
- phone-plus-PWA concurrent edits and explicit conflict handling;
- legacy proof requirement, one-to-one link conflict, migration import, and no
  normal-login dependency on `legacy_identity_links`;
- professional self-selection grants only professional, never admin or verified
  status;
- restricted CSP endpoints, PWA verification, and real-device Capacitor
  confirmation/recovery/session checks before release claims.

## 27. Future phase breakdown

This is a conceptual sequence, not an implementation plan:

| Phase | Scope |
|---|---|
| A | Supabase Auth foundation and email/password account UX |
| B | account-scoped local cache isolation and non-destructive logout |
| C | versioned Supabase snapshot schema, RLS, and concurrency contract |
| D | sync-engine transition, offline queue/retry, and conflict states |
| E | first-association and explicit device/cloud/separate UX |
| F | proven legacy WebAuthn migration and legacy file import |
| G | Capacitor session, secure adapter assessment, and deep-link validation |
| H | approved `/api/data` retirement and legacy retention lifecycle |
| I | resume Professional Profile, then relationship/code work in later phases |

## 28. Open questions and implementation gates

- What are the actual Supabase project settings for email confirmation, allowed
  redirect URLs, password policy, and recovery templates?
- Which Supabase session storage adapter and threat model are appropriate for
  the installed Capacitor targets?
- Should the first snapshot design retain bounded server-side revisions, and
  what retention/recovery UX is appropriate before a user replaces cloud data?
- What payload validation, size cap, compression policy, and schema migration
  format safely protect the snapshot endpoint?
- Which existing legacy accounts and file formats need migration support, and
  what explicit user notice/retention period applies to legacy files?
- What exact CSP origin(s) are needed for the chosen Supabase project and
  platform flow?
- Is professional self-selection unrestricted at signup, or will future product
  policy require an invite, terms acknowledgement, or another server-validated
  gate before adding that capability?

These questions must be answered during implementation planning and validation,
not by assumptions embedded in this specification.

## 29. Self-review

This specification was checked to ensure that it:

- treats the Phase 1B bridge as superseded rather than active;
- forbids destructive logout and broad storage clearing;
- separates anonymous state and UUID-scoped account caches;
- forbids silent overwrite and timestamp-only concurrency;
- prevents client-granted admin and distinguishes professional from verified;
- treats future professional relationships as non-retroactive and separate from
  workout sharing;
- makes WebAuthn legacy migration only, not new registration;
- avoids permanent dual-write and CSP wildcards;
- preserves offline workout execution and multi-device conflict detection;
- prohibits manual token persistence in `gym_state_v1` or snapshots; and
- keeps Professional Profile independent and paused.
