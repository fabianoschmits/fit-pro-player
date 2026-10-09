# Professional management native verification

The professional workspace now uses compact, mobile-first routes for the management home, students, student follow-up, programs, immutable versions, assignment, invitations, profile, exercise catalog and received training. Dynamic first loads use accessible skeleton geometry; retained data remains visible during refresh.

## Route and evidence map

- `/professional`: aggregated server counts, today's workouts, recent activity and shortcuts; dashboard unit coverage.
- `/professional/students` and `/:studentId/{training,assign,history,history/:executionId,progress}`: paged students, private notes, program management, prescribed-versus-performed history and shared-execution progress; focused student suites.
- `/professional/programs`, `/new`, `/:id`, `/workouts/:day`, `/edit/:day`, `/versions`, `/versions/compare`, `/assign`: compact library, persistent weekly draft, exact immutable versions and explicit assignment review; editor/library unit and Chromium viewport flows.
- `/professional/invites`, `/profile`, `/profile/edit`, `/exercises`: invitation status/expiry, profile provisioning and contextual real exercise catalog; invite/profile/workflow suites.
- `/student/professionals` and professional detail/training/history/relationship routes: exact received material, active assignment execution and unlink guards; received-training suites.

## Verification

- Frontend: 119 files, 988 tests passed.
- Supabase static boundary: 30 passed, 3 optional checks skipped by the harness.
- Disposable local PostgreSQL: migrations/tests through `202610090017_professional_workspace_reads.sql` passed.
- i18n: 11 locale packs aligned; 988 source strings covered; pt-BR complete.
- Production/Vercel build passed.
- Chromium App flows: 375px and 1280px editor/library scenarios, 5 passed; 5 duplicate mobile-project executions intentionally skipped by the focused specs.

No lint or TypeScript verification is claimed because the repository provides neither script/configuration. Native Safari software-keyboard behavior was not executed; Chromium mobile-width behavior, focus return, Back/Escape, dark/light screenshots and horizontal overflow were exercised by the focused flows.
