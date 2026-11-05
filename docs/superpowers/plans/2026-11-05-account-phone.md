# Account phone and WhatsApp implementation plan

Goal: optional international phone at signup, editable from settings, shared only between active professional/student counterparts; community profiles remain unchanged.

Architecture: E.164 private contacts table, authenticated security-definer RPCs with active relationship checks, signup metadata capture trigger. Shared phone field uses libphonenumber-js and local country-flag-icons SVG assets. Region inferred from device locale, manually overrideable; Brazil fallback.

- [x] Verify current signup, settings and relationship schemas; create isolated feature branch.
- [x] Add failing normalization and real-migration database privacy tests.
- [x] Implement contacts migration and phone formatting helpers.
- [x] Connect signup metadata, settings editing, professional profile and active counterpart WhatsApp actions.
- [x] Verify desktop/mobile UI, signup/save/remove, country flags and access denial.
- [x] Run lint, typecheck, tests, build and independent code review.
- [x] Apply only new migration to existing Supabase project; verify schema and permissions.
- [ ] Commit, fast-forward main/master, push and verify existing Vercel production deployment.

Files: frontend/src/lib/phone.*, frontend/src/components/{PhoneField,AccountPhone}.jsx, phone-contact.css; AuthSheet/AuthProvider and account/relationship views; supabase/migrations/202611050002_account_phone_contacts.sql; scripts/test-account-phone.mjs; browser/UI regression tests.

Validation: lint/typecheck/build:vercel pass; 190 Vitest files / 1662 tests pass; 6 Playwright desktop/mobile cases pass; private contacts PGlite test passes; Supabase boundaries 40 pass / 3 existing skips. Independent review approved after focus/realtime revalidation fix. Production migration recorded on bgqavxoxwgheloeubbpf; RLS enabled; authenticated direct table read and anonymous RPC execution both denied.
