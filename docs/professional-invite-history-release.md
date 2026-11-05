# Professional invite history — release notes

## Behavior
- Available generated invitations display Ativo; revoked invitations display Revogado.
- Direct acceptance or an approved link request displays Utilizado with a green check.
- Expanded used invitations show the accepting user's public display name and date. Missing/deleted profile names use an explicit unavailable label.
- Only unused revoked invitations can be deleted, after confirmation. Requests and relationships are retained; the existing FK clears only the invitation reference.
- Personal reusable invitations retain their existing controls and are excluded from the generated-history RPC.

## Database rollout before frontend release
Apply `supabase/migrations/202611050001_professional_invite_history.sql` to the existing Fit Pro Player project `bgqavxoxwgheloeubbpf` before updating main/master. This adds an accepted-source index and two owner-scoped RPCs; it does not rewrite invitation statuses or relationships. The new frontend requires the history RPC.

The CLI account available during implementation did not list this project. Production migration and frontend release remain pending correct project access. Do not use one of the unrelated projects listed by that account.

## Validation
- Lint, typecheck and build:vercel passed.
- 189 unit test files / 1,658 tests passed.
- Ten invite-history/revocation browser tests plus two existing management regressions passed (desktop/mobile).
- Supabase boundary checks passed (40 tests passed, three existing skips).
- `node --test scripts/test-professional-invite-history.mjs` passed against PostgreSQL/WASM with all repository migrations. Covers direct/request acceptance, actual names, caller isolation, blocked deletion of available/used/foreign invitations, missing rows and preservation of student relationships/profiles.
- The reviewed deletion race was corrected by locking the owner invitation, locking referencing requests, then rechecking eligibility in a separate statement. This environment has only the single-session WASM database available; a true two-session concurrency run has not been performed.
