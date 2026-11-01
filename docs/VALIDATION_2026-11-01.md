# Validação de correções — 2026-11-01

Node 22.17.0; Supabase CLI 2.122.0. Branch canônica: `main`. Nenhuma migration foi aplicada em banco remoto.

## Alterações principais

- Suspensão: guard reutilizável server-side, RPCs autenticadas, RLS restritiva e triggers de mutação; administrador e service-role preservados.
- Comunidade: bloqueio próprio, RLS, RPCs, bloqueio simétrico de mensagens/interações e ações na interface; histórico mantido.
- Sincronização: merge de três estados por campo/ID, conflitos incompatíveis preservados, limite de retries e avisos de revisão entre abas.
- Persistência: migrations locais v1 → v2 (versões reais existentes), whitelist estrutural compartilhada com recuperação e cache nativo, limpeza na troca de conta/logout.
- PWA: caches separados, limites/LRU, tratamento de quota, catálogo para pruning, fallback offline e identidade do shell derivada do manifesto.
- CI: traduções completas, testes SQL históricos separados, ESLint/checkJs, Node/Supabase fixos, main e instalação dos navegadores Chromium/WebKit exigidos pela matriz E2E.

## Migrations novas

- `supabase/migrations/202611010001_account_activity_guard.sql`
- `supabase/migrations/202611010002_community_user_blocks.sql`
- `supabase/migrations/202611010003_final_schema_regressions.sql`

## Testes históricos

`202610280002`, `003`, `004` e `007` foram movidos para `supabase/tests/historical/`, mantendo a validação da migration que originalmente implementava aplicação automática. Eles não rodam contra o schema final. O runner histórico também usa a fixture original de `202610280001` e verifica o backfill de notas no checkpoint correto. Os testes atuais confirmam aplicação exclusivamente após escolha explícita do aluno. Fixtures antigas de catálogo, privilégios, notificações e disponibilidade de múltiplos planos foram alinhadas ao schema final; a aplicação não foi alterada para restaurar aplicação automática.

## Dependências

`npm audit --json` foi executado na raiz e no frontend, antes/depois das atualizações compatíveis; lockfiles atualizados. Não foi usado `audit fix --force`.

- Raiz: 0 vulnerabilidades.
- Produção frontend (`--omit=dev`): 0 vulnerabilidades.
- Desenvolvimento: 18 (2 baixas, 16 moderadas), incluindo cadeias transitivas listadas abaixo. O npm propõe downgrades incompatíveis (Capacitor CLI 4, ESLint 4, plugins antigos e Workbox 7.3 fora da faixa atual); não foram forçados.

- `@capacitor/cli`: moderate; direta de desenvolvimento; via rimraf.
- `@eslint-community/eslint-utils`: moderate; transitiva de desenvolvimento; via eslint.
- `@eslint/config-array`: moderate; transitiva de desenvolvimento; via minimatch.
- `@eslint/eslintrc`: moderate; transitiva de desenvolvimento; via minimatch.
- `@rollup/plugin-node-resolve`: low; transitiva de desenvolvimento; via deepmerge.
- `@trickfilm400/rollup-plugin-off-main-thread`: moderate; transitiva de desenvolvimento; via ejs.
- `deepmerge`: low; transitiva de desenvolvimento; via deepmerge.
- `ejs`: moderate; transitiva de desenvolvimento; via jake.
- `eslint`: moderate; direta de desenvolvimento; via @eslint-community/eslint-utils, @eslint/config-array, @eslint/eslintrc, minimatch.
- `eslint-plugin-import`: moderate; direta de desenvolvimento; via minimatch.
- `eslint-plugin-promise`: moderate; direta de desenvolvimento; via @eslint-community/eslint-utils, eslint.
- `eslint-plugin-react`: moderate; direta de desenvolvimento; via minimatch.
- `filelist`: moderate; transitiva de desenvolvimento; via minimatch.
- `glob`: moderate; transitiva de desenvolvimento; via glob, minimatch.
- `jake`: moderate; transitiva de desenvolvimento; via filelist.
- `minimatch`: moderate; transitiva de desenvolvimento; via minimatch.
- `rimraf`: moderate; transitiva de desenvolvimento; via glob.
- `workbox-build`: moderate; direta de desenvolvimento; via @rollup/plugin-node-resolve, @trickfilm400/rollup-plugin-off-main-thread, glob.

## Limitação de ambiente

Docker não está instalado. `npx supabase db reset` falhou com `LocalDbRunningError: failed to inspect service`. Em substituição local parcial, `PG_BIN` apontou para PostgreSQL 17 completo com pgTAP: um cluster novo recebeu todas as migrations em ordem e todos os testes SQL atuais. Os testes de concorrência também usam PostgreSQL real descartável. Auth/Storage/PostgREST do stack Docker e o GitHub Actions remoto continuam sem validação neste ambiente.

## Comandos e resultados

| Comando | Resultado |
|---|---|
| `npm ci` | Passou; auditoria da raiz sem vulnerabilidades |
| `npm ci --prefix frontend` | Passou; 18 avisos de desenvolvimento documentados abaixo |
| `npm run lint` | Passou, sem erros/warnings de lint |
| `npm run typecheck` | Passou, checkJs em todo o código de produção JS/JSX |
| `npm test` | 180 arquivos, 1.507 testes passaram |
| `npm run check:i18n` | 11 idiomas × 1.554 chaves; 865 textos de código; 1.324 exercícios pt-BR completos |
| `npm run test:notifications` | 42 testes passaram |
| `PG_BIN=... READINESS_REQUIRE_DB=1 NOTIFICATIONS_REQUIRE_DB=1 STUDENT_MANAGEMENT_REQUIRE_DB=1 npm run check:supabase` | 42 testes passaram, zero skips; boundaries passaram |
| `node --test scripts/database-test-tap.test.mjs` | 3 testes passaram |
| `npm run check:database:clean` com `PG_BIN` | Todas as migrations aplicadas em cluster limpo; todos os testes SQL atuais passaram |
| `npm run test:plan-library:database` | Todos os checkpoints históricos e a regra final de confirmação passaram |
| `npm --prefix frontend run test:fatigue-probe` | 108.000 + 14.076 comparações passaram |
| `npm run build` | Passou; SW injetado, 138 entradas, aproximadamente 46,98 MB |
| `npm run build:vercel` | Passou; SW injetado |
| `npm run build:mobile:web` | Passou |
| `npm run test:e2e` / CLI Playwright equivalente | 315 cenários: 293 passaram após correções e repetição dos 9 casos afetados; 22 skips intencionais da matriz |
| `npm run test:e2e:pwa` | 7 cenários passaram, incluindo instalação de código SW com nova versão de cache, limpeza e recarga offline |
| `npm audit --json` | Raiz: 0; frontend: 18 de desenvolvimento; produção: 0 |
| `npm run audit` | Sem vulnerabilidades altas/críticas; avisos baixos/moderados permanecem |
| `npx supabase db reset` | Impedido pela ausência de Docker; alternativa PostgreSQL limpa validada |
| `git diff --check` | Passou |

Os builds ainda emitem avisos de empacotamento sobre imports estáticos/dinâmicos já coexistentes. Eles não impedem build e não foram alvo de refatoração. Os testes usam contas/serviços simulados para frontend e PostgreSQL local real para SQL; integrações remotas e dispositivos físicos não foram exercitados.

## Testes adicionados e adaptados

- SQL: suspensão com token ainda válido, chamada direta de RPC, RLS, escrita normal, administrador e service-role; bloqueio, desbloqueio, DM nas duas direções, auto-bloqueio, duplicidade e histórico preservado.
- Sincronização: dois dispositivos, alterações independentes, campo incompatível, exclusão/reordenação/inserção por ID, segunda falha de CAS, limite de retries, reconexão e avisos entre abas. Conflitos incompatíveis ficam persistidos e não geram novas chamadas em alterações não relacionadas ou após reload; retry explícito pode resolvê-los.
- Persistência: versões reais v1/v2 e estado sem marcador, estado incompleto/corrompido/futuro, recuperação offline, kg/lb, treino em andamento, cache nativo, quota, descrições personalizadas, progressão, volume e operações pendentes sem credenciais.
- PWA: cache limitado, quota, exclusão de API autenticada, manutenção de sprites e atualização real com remoção de caches/frames obsoletos.
- Comunidade: ações de bloquear/desbloquear, erros de servidor, auto-bloqueio oculto e lista própria carregada sob demanda.
- E2E legados adaptados ao contrato atual: confirmação do plano, templates paginados, finalização com nota opcional, rotas canônicas, comentário com textarea e navegação com estado salvo/modo explícito de movimentação. Asserções visuais usam as dimensões atuais e distinguem carrosséis internos de overflow da página, preservando o contrato atual. A mensagem do console recebeu uma correção pontual de quebra de linha no mobile, para manter o texto legível sem overflow.
- A migration de regressões também corrige o FK de exclusão de conta, restaura a rota de notificações de treino e padroniza a ordem dos locks entre envio/revogação de vínculo, comprovada pelo teste de concorrência PostgreSQL.

## Arquivos alterados

- `.github/workflows/test.yml`
- `.gitignore`
- `.nvmrc`
- `README.md`
- `docs/PLANO_EVOLUCAO_PRODUTO.md`
- `docs/VALIDATION_2026-11-01.md`
- `frontend/e2e/application.spec.js`
- `frontend/e2e/community.spec.js`
- `frontend/e2e/console.spec.js`
- `frontend/e2e/corner-navigation.spec.js`
- `frontend/e2e/fixtures.test.js`
- `frontend/e2e/management.spec.js`
- `frontend/e2e/modal-dismissal.spec.js`
- `frontend/e2e/page-transitions.spec.js`
- `frontend/e2e/plan-library.spec.js`
- `frontend/e2e/pwa-viewport.spec.js`
- `frontend/e2e/pwa.spec.js`
- `frontend/e2e/workout-execution-player.spec.js`
- `frontend/e2e/workout-silent-autosave.spec.js`
- `frontend/eslint.config.js`
- `frontend/jsconfig.json`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/playwright.config.js`
- `frontend/public/sw.js`
- `frontend/scripts/generate-pt-exercise-names.mjs`
- `frontend/scripts/inject-sw-manifest.mjs`
- `frontend/src/App.auth.test.jsx`
- `frontend/src/App.jsx`
- `frontend/src/App.management-sync.test.jsx`
- `frontend/src/App.student-navigation.test.jsx`
- `frontend/src/auth/AuthProvider.jsx`
- `frontend/src/auth/AuthProvider.test.jsx`
- `frontend/src/browser-types.d.ts`
- `frontend/src/components/AccountAssociationSheet.test.jsx`
- `frontend/src/components/AppHeader.jsx`
- `frontend/src/components/AppStatus.test.jsx`
- `frontend/src/components/AuthSheet.jsx`
- `frontend/src/components/AuthSheet.test.jsx`
- `frontend/src/components/AvatarImage.jsx`
- `frontend/src/components/AvatarPicker.jsx`
- `frontend/src/components/BodyMap.jsx`
- `frontend/src/components/BodyMap.shape.test.jsx`
- `frontend/src/components/DateWheelPicker.jsx`
- `frontend/src/components/Dialog.jsx`
- `frontend/src/components/ErrorBoundary.test.jsx`
- `frontend/src/components/FppFeedback.jsx`
- `frontend/src/components/FppFeedback.test.jsx`
- `frontend/src/components/FppPerformanceButton.jsx`
- `frontend/src/components/Heatmap.jsx`
- `frontend/src/components/Icon.jsx`
- `frontend/src/components/InviteQrCode.jsx`
- `frontend/src/components/LineChart.jsx`
- `frontend/src/components/ManagementAvatar.test.jsx`
- `frontend/src/components/ManagementLayout.jsx`
- `frontend/src/components/ManagementLayout.test.jsx`
- `frontend/src/components/ManagementLink.jsx`
- `frontend/src/components/ManagementUI.jsx`
- `frontend/src/components/MeasurementBodyMap.dom.test.jsx`
- `frontend/src/components/MeasurementBodyMap.jsx`
- `frontend/src/components/Media.jsx`
- `frontend/src/components/MetricInfoButton.jsx`
- `frontend/src/components/Modals.jsx`
- `frontend/src/components/NavigationIcon.jsx`
- `frontend/src/components/NotificationSettings.test.jsx`
- `frontend/src/components/PageTransition.jsx`
- `frontend/src/components/PageTransition.test.jsx`
- `frontend/src/components/PlanWizard.jsx`
- `frontend/src/components/PlanWizard.name.test.jsx`
- `frontend/src/components/PrivacyConsentModal.jsx`
- `frontend/src/components/PrivacyConsentModal.test.jsx`
- `frontend/src/components/PrivacyControls.test.jsx`
- `frontend/src/components/ProfessionalExercisePicker.jsx`
- `frontend/src/components/ProfessionalPrescription.jsx`
- `frontend/src/components/ProfessionalProfileForm.jsx`
- `frontend/src/components/ProfessionalProgramEditor.jsx`
- `frontend/src/components/ProfessionalProgramEditor.test.jsx`
- `frontend/src/components/ProfessionalWorkspaceNav.test.jsx`
- `frontend/src/components/RestTimer.jsx`
- `frontend/src/components/RoutineMuscleThumb.jsx`
- `frontend/src/components/StudentProfessionalInvite.jsx`
- `frontend/src/components/StudentProfessionalInvite.test.jsx`
- `frontend/src/components/StudentProgramOverview.jsx`
- `frontend/src/components/StudentProgramOverview.test.jsx`
- `frontend/src/components/TabBar.jsx`
- `frontend/src/components/TipOnce.jsx`
- `frontend/src/components/WorkoutExercisePlayer.jsx`
- `frontend/src/components/WorkoutMuscleThumb.test.jsx`
- `frontend/src/components/WorkoutShareLayouts.jsx`
- `frontend/src/components/WorkoutShareModal.jsx`
- `frontend/src/components/accessibility.test.jsx`
- `frontend/src/components/community/CommunityComments.jsx`
- `frontend/src/components/community/CommunityComments.test.jsx`
- `frontend/src/components/community/CommunityPostMedia.jsx`
- `frontend/src/components/community/CommunityReportDialog.jsx`
- `frontend/src/components/community/CommunityReportDialog.test.jsx`
- `frontend/src/components/community/MessageButton.jsx`
- `frontend/src/components/community/UserBlockActions.jsx`
- `frontend/src/components/community/UserBlockActions.test.jsx`
- `frontend/src/components/fpp-action-timing.js`
- `frontend/src/components/icon-morph-registry.jsx`
- `frontend/src/components/icon-morph-registry.test.jsx`
- `frontend/src/components/training/ExerciseCard.jsx`
- `frontend/src/components/training/PlanLibrary.jsx`
- `frontend/src/components/training/TrainingPlanPreview.jsx`
- `frontend/src/components/training/TrainingPlanWorkspace.jsx`
- `frontend/src/components/ui-types.d.ts`
- `frontend/src/components/ui.jsx`
- `frontend/src/components/ui.test.jsx`
- `frontend/src/components/useFppAction.js`
- `frontend/src/components/useManagementNavVisibility.test.jsx`
- `frontend/src/components/useStudentManagementRequest.js`
- `frontend/src/components/useStudentManagementRequest.test.jsx`
- `frontend/src/experiments/alternative-menus/AlternativeMenus.jsx`
- `frontend/src/experiments/workout-players/DesignsB.jsx`
- `frontend/src/experiments/workout-players/PlayerParts.jsx`
- `frontend/src/experiments/workout-players/WorkoutPlayers.test.jsx`
- `frontend/src/features/console/ConsoleAccess.jsx`
- `frontend/src/features/console/ConsoleAccountActions.test.jsx`
- `frontend/src/features/console/ConsoleLayout.jsx`
- `frontend/src/features/console/ConsoleNotifications.jsx`
- `frontend/src/features/console/ConsoleNotifications.test.jsx`
- `frontend/src/features/console/ConsoleOverview.jsx`
- `frontend/src/features/console/ConsoleProfessionals.jsx`
- `frontend/src/features/console/ConsoleSystem.jsx`
- `frontend/src/features/console/ConsoleUI.jsx`
- `frontend/src/features/console/ConsoleUserPage.jsx`
- `frontend/src/features/console/ConsoleUsers.jsx`
- `frontend/src/features/console/console.css`
- `frontend/src/features/console/notifications.js`
- `frontend/src/features/professional/hooks/useProfessionalLists.js`
- `frontend/src/features/professional/hooks/workspaceReads.test.jsx`
- `frontend/src/lib/account-association.js`
- `frontend/src/lib/account-cache.js`
- `frontend/src/lib/account-cache.test.js`
- `frontend/src/lib/account-domain-sync.js`
- `frontend/src/lib/account-domain-sync.test.js`
- `frontend/src/lib/assigned-program.js`
- `frontend/src/lib/backup-state.js`
- `frontend/src/lib/body-shape.js`
- `frontend/src/lib/community-identity.js`
- `frontend/src/lib/console.js`
- `frontend/src/lib/demoSeed.js`
- `frontend/src/lib/diagnostics.js`
- `frontend/src/lib/dialog-focus.js`
- `frontend/src/lib/direct-messages.js`
- `frontend/src/lib/direct-messages.test.js`
- `frontend/src/lib/domain-refresh.js`
- `frontend/src/lib/domain-sync-state.js`
- `frontend/src/lib/exercise-preloader.js`
- `frontend/src/lib/finish-workout.js`
- `frontend/src/lib/foreground-notification-scheduler.js`
- `frontend/src/lib/format.js`
- `frontend/src/lib/history.js`
- `frontend/src/lib/history.test.js`
- `frontend/src/lib/i18n.js`
- `frontend/src/lib/import-csv.js`
- `frontend/src/lib/local-state-migrations.js`
- `frontend/src/lib/local-state-migrations.test.js`
- `frontend/src/lib/local-state-scope.js`
- `frontend/src/lib/mobile-cache.test.js`
- `frontend/src/lib/mobile.js`
- `frontend/src/lib/native-push.js`
- `frontend/src/lib/nav.js`
- `frontend/src/lib/navigation-contexts.js`
- `frontend/src/lib/navigation-contexts.test.js`
- `frontend/src/lib/notification-client.js`
- `frontend/src/lib/notification-preferences.js`
- `frontend/src/lib/notification-preferences.test.js`
- `frontend/src/lib/persisted-state.js`
- `frontend/src/lib/plan-share.js`
- `frontend/src/lib/privacy-config.js`
- `frontend/src/lib/professional-english.js`
- `frontend/src/lib/professional-events.js`
- `frontend/src/lib/professional-execution.js`
- `frontend/src/lib/professional-profile.js`
- `frontend/src/lib/professional-ux.js`
- `frontend/src/lib/professional-workflow.js`
- `frontend/src/lib/pwa-install.js`
- `frontend/src/lib/recovery-view.test.js`
- `frontend/src/lib/recovery.js`
- `frontend/src/lib/service-worker.test.js`
- `frontend/src/lib/session-recovery.js`
- `frontend/src/lib/starter.js`
- `frontend/src/lib/support.js`
- `frontend/src/lib/sync-state.js`
- `frontend/src/lib/tab-sync.js`
- `frontend/src/lib/tab-sync.test.js`
- `frontend/src/lib/three-way-merge.js`
- `frontend/src/lib/three-way-merge.test.js`
- `frontend/src/lib/training-repository.js`
- `frontend/src/lib/ux.js`
- `frontend/src/lib/workout-share.js`
- `frontend/src/locales/de.js`
- `frontend/src/locales/es.js`
- `frontend/src/locales/fr.js`
- `frontend/src/locales/hi.js`
- `frontend/src/locales/it.js`
- `frontend/src/locales/ko.js`
- `frontend/src/locales/pl.js`
- `frontend/src/locales/pt.js`
- `frontend/src/locales/ru.js`
- `frontend/src/locales/tr.js`
- `frontend/src/locales/zh.js`
- `frontend/src/main.jsx`
- `frontend/src/sheets.jsx`
- `frontend/src/store/useStore.js`
- `frontend/src/store/useStore.test.js`
- `frontend/src/views/BodyProgress.jsx`
- `frontend/src/views/Community.jsx`
- `frontend/src/views/Community.test.jsx`
- `frontend/src/views/CommunityMessages.jsx`
- `frontend/src/views/CommunityMessages.test.jsx`
- `frontend/src/views/ConsoleWorkspace.test.jsx`
- `frontend/src/views/History.test.jsx`
- `frontend/src/views/Home.jsx`
- `frontend/src/views/InviteLanding.test.jsx`
- `frontend/src/views/Landing.jsx`
- `frontend/src/views/More.jsx`
- `frontend/src/views/More.management.test.jsx`
- `frontend/src/views/MotionFeedback.jsx`
- `frontend/src/views/PersonalData.jsx`
- `frontend/src/views/PersonalData.test.jsx`
- `frontend/src/views/Plan.jsx`
- `frontend/src/views/PrivacyPages.jsx`
- `frontend/src/views/PrivacyPages.test.jsx`
- `frontend/src/views/ProfessionalDashboard.test.jsx`
- `frontend/src/views/ProfessionalInvites.jsx`
- `frontend/src/views/ProfessionalInvites.test.jsx`
- `frontend/src/views/ProfessionalProfile.onboarding.test.jsx`
- `frontend/src/views/ProfessionalProfile.test.jsx`
- `frontend/src/views/ProfessionalPrograms.jsx`
- `frontend/src/views/ProfessionalPrograms.test.jsx`
- `frontend/src/views/ProfessionalStudentPage.test.jsx`
- `frontend/src/views/ProfessionalStudentPlan.jsx`
- `frontend/src/views/ProfessionalStudents.jsx`
- `frontend/src/views/ProfessionalStudents.test.jsx`
- `frontend/src/views/RoutineEdit.jsx`
- `frontend/src/views/Settings.auth.test.jsx`
- `frontend/src/views/Settings.jsx`
- `frontend/src/views/Stats.jsx`
- `frontend/src/views/Stats.recovery.test.jsx`
- `frontend/src/views/StudentProfessionalDetail.jsx`
- `frontend/src/views/StudentProfessionalDetail.test.jsx`
- `frontend/src/views/StudentProfessionalMaterials.test.jsx`
- `frontend/src/views/StudentProfessionals.jsx`
- `frontend/src/views/StudentProfessionals.test.jsx`
- `frontend/src/views/Support.jsx`
- `frontend/src/views/SupportComposer.test.jsx`
- `frontend/src/views/SupportTicket.feedback.test.jsx`
- `frontend/src/views/SupportTicket.jsx`
- `frontend/src/views/Workout.jsx`
- `frontend/src/views/Workout.remove.test.jsx`
- `frontend/vite.config.js`
- `package-lock.json`
- `package.json`
- `scripts/check-notification-migration.test.mjs`
- `scripts/check-professional-readiness-migration.test.mjs`
- `scripts/check-student-professional-management-migration.test.mjs`
- `scripts/local-database-bootstrap.sql`
- `scripts/run-clean-database-tests.mjs`
- `scripts/test-plan-library-database.mjs`
- `supabase/migrations/202611010001_account_activity_guard.sql`
- `supabase/migrations/202611010002_community_user_blocks.sql`
- `supabase/migrations/202611010003_final_schema_regressions.sql`
- `supabase/tests/202609210001_identity_profiles_roles_links.sql`
- `supabase/tests/202609210004_account_snapshots.sql`
- `supabase/tests/202609210005_professional_profiles.sql`
- `supabase/tests/202610020014_professional_readiness.sql`
- `supabase/tests/202610040015_notifications.sql`
- `supabase/tests/202610090016_professional_program_metadata.sql`
- `supabase/tests/202610090017_professional_workspace_reads.sql`
- `supabase/tests/202610150024_ops_notification_center.sql`
- `supabase/tests/202610150025_ops_notification_routing.sql`
- `supabase/tests/20261026120000_community_reports.sql`
- `supabase/tests/202610280001_library_updates.sql`
- `supabase/tests/202610280002_professional_plan_auto_updates.sql`
- `supabase/tests/202610280003_professional_plan_day_views.sql`
- `supabase/tests/202610280004_carry_seen_professional_plan_days.sql`
- `supabase/tests/202610280007_professional_plan_day_pending_bases.sql`
- `supabase/tests/202610290001_exercise_sprite_requirement.sql`
- `supabase/tests/202610290002_professional_workspace_history_notes.sql`
- `supabase/tests/202610290003_professional_profile_invites_model_delete.sql`
- `supabase/tests/202611010001_account_activity_guard.sql`
- `supabase/tests/202611010002_community_user_blocks.sql`
- `supabase/tests/historical/202610280001_library_updates.sql`
- `supabase/tests/historical/202610280002_professional_plan_auto_updates.sql`
- `supabase/tests/historical/202610280003_professional_plan_day_views.sql`
- `supabase/tests/historical/202610280004_carry_seen_professional_plan_days.sql`
- `supabase/tests/historical/202610280007_professional_plan_day_pending_bases.sql`
- `supabase/tests/historical/202610290002_note_backfill.sql`
