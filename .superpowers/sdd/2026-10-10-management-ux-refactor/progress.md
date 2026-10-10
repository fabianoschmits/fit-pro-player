# SDD ledger — plan: docs/superpowers/plans/2026-10-10-management-ux-refactor.md
Task 1: Ruling: a full application-level TabBar is reused for professional routes while the existing contextual nav remains desktop-only — this satisfies the single-bottom-navigation constraint without rewriting the shell; cost if wrong: professional desktop/mobile navigation may need a follow-up styling adjustment.
Task 1: complete (commits fa1a7a6..WORKTREE, tests: TabBar + ProfessionalLayout 22/22; isolated native persistence reproduction 1/1; full suite showed one pre-existing flaky timeout and was not considered a task regression)
Task 5: complete (current commit, tests: TabBar + ProfessionalLayout + WorkoutDraftEditor 26/26; i18n 1018/1018)
