# FPP Supabase signing-key runbook

## Status and stop gate

This is a local operational checklist, not authorization to change a hosted
Supabase project. Generation, import, activation, rotation, Auth settings,
RLS, migrations, and data changes require a separate approved change. Stop
before activation or rotation until that approval exists.

## Prepare the signing material

1. Use the organization's approved secure environment to generate an EC P-256
   signing key compatible with ES256. Prefer a non-exportable key store when
   available.
2. Store the non-public signing material only in the approved secret manager
   with least-privilege access, audit logging, backup, and a documented
   recovery owner. Do not place it in source control, examples, application
   logs, issue trackers, or client configuration.
3. Record the assigned key identifier in the approved secret manager alongside
   the server-only configuration names `FPP_SUPABASE_JWT_PRIVATE_KEY` and
   `FPP_SUPABASE_JWT_KEY_ID`. Keep `FPP_SUPABASE_BOOTSTRAP_ORIGINS` as an
   explicit server-side allowlist; do not use wildcards.

## Future authorized hosted validation

1. Import the signing material as a standby key only. Do not make it active
   and do not retire an existing key during this step.
2. Confirm the hosted JWKS advertises the intended key identifier and ES256
   algorithm. Confirm the server configuration uses the same identifier and
   that generated JWT headers select ES256 with that identifier.
3. With approved test identities and a controlled environment, verify the Data
   API accepts the short-lived FPP identity context and RLS permits A's own
   record while denying A access to B's record. Also verify expiry, an
   incorrect identifier, and an incorrect algorithm fail closed.
4. Validate each configured web origin and each real Capacitor origin without
   a wildcard. Keep unvalidated native origins disabled.

## Activation, rotation, and rollback

Only after the validation evidence and a new explicit approval may an operator
activate the standby key or rotate an active key. If validation fails, leave
the standby key inactive and restore the previously approved hosted signing
configuration through the change-control process. Preserve audit evidence in
the approved operations system and do not alter identity or application data
as part of rollback.
