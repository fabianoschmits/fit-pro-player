# Native Professional Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer a gestão profissional e os treinos recebidos como experiência compacta e nativa, preservando integralmente os fluxos inventariados.

**Architecture:** Repositório Supabase mantém as fronteiras de autorização; projeções agregadas e metadados aditivos alimentam páginas focadas. Um shell profissional substitui a navegação duplicada, e um rascunho semanal por conta conecta resumo e editor de cada treino. Sheets cuidam das alterações pequenas usando o controlador de Dialog existente.

**Tech Stack:** React/JSX, React Router, Zustand, CSS existente, Supabase/PostgreSQL, Vitest/Testing Library, Playwright; sem novas dependências obrigatórias.

**Spec:** `docs/superpowers/specs/2026-10-06-native-professional-management-design.md`

## Global Constraints

- Escopo: gestão do usuário/profissional e treinos recebidos; outras áreas mantêm apresentação e comportamento atuais.
- Uma única navegação profissional mobile: Gestão · Alunos · Programas · Convites; nenhuma faixa horizontal cortada.
- Fundo preto/grafite, branco/cinza, teal local ao feature; laranja nas ações globais de execução. Preservar tema claro.
- Fonte FPP; header 18–20px, seção 14–16px, nomes 13–14px, metadados 11–12px. Campos mobile 16px.
- Espaçamento 4/8/12/16/24; radius 8–12; alvos pelo menos 44px; safe-area e espaço reservado para barras.
- Pessoas usam avatares existentes autorizados ou iniciais. Exercícios usam miniaturas/animações reais.
- Pedido adicional aprovado: skeletons com dimensões próximas do conteúdo real em dados dinâmicos do feature; estado busy acessível, sem números fictícios, shimmer desligado em reduced-motion, dados atuais mantidos em refresh de fundo.
- Preservar 7 dias, limite de 50 exercícios/dia, todos os campos de prescrição e seus limites já validados.
- Publicação da semana separada da atribuição; versões históricas imutáveis; uma atribuição ativa global por aluno.
- Novos limites: objetivo opcional 160 caracteres; nome de treino 80; observação privada 2000. Não reduzir limites existentes.
- Observações privadas somente para profissional titular com vínculo ativo. Medidas/account_snapshots continuam privados.
- Preservar outbox offline, gerações de requests, isolamento de contas, timeout/retry e retomada do executor pessoal.
- Nenhum schema destrutivo, service key no browser ou teste SQL destrutivo em produção. `docs/reports/` pertence ao usuário.
- Não declarar lint/typecheck aprovados: estes scripts/configurações não existem atualmente.

## Review Focus

1. Conta trocada durante request/sheet/publicação: nenhuma leitura ou mutation local da conta antiga; tarefas 1, 2, 4 e 8.
2. Mais de 200 alunos/500 registros: totais exatos e paginação sem omissão/duplicação; tarefa 2.
3. Nome longo, iPhone 375px e teclado aberto: ação, foco e conteúdo acessíveis sem overflow horizontal; tarefas 3 e 9.
4. Programa/atribuição histórica aberta por link: não substituir rotina ativa nem publicar/atribuir implicitamente; tarefas 5, 6 e 8.
5. Vínculo revogado ou convite sem validade: acesso negado para notas privadas e nenhuma expiração inventada; tarefas 1 e 7.

## Mapa de arquivos e contratos

Preservar views como entradas e decompor suas responsabilidades em `frontend/src/features/professional/`. Evitar uma migração geral das pastas do aplicativo.

- `supabase/migrations/202610090016_professional_program_metadata.sql`: objetivo, nomes versionados, duplicação e notas privadas; testes SQL com mesmo basename em `supabase/tests/`.
- `supabase/migrations/202610090017_professional_workspace_reads.sql`: projeções agregadas/paginadas; testes SQL correspondentes.
- `frontend/src/lib/professional-workflow.js`: novos métodos do repositório, contratos normalizados e compatibilidade dos antigos.
- `frontend/src/lib/assigned-program.js`: nomes versionados na rotina atribuída, sem mudar arrays de prescrição.
- `frontend/src/features/professional/components/`: ProfessionalLayout, SectionHeader, CompactList, StudentRow, ProgramRow, WorkoutRow, StatusBadge, EmptyState, SearchBar, FilterChips, BottomActionBar, ContextActions, ExercisePrescriptionRow, PrescriptionSheet e ExercisePickerSheet; um arquivo JSX por componente. `AppHeader` existente ganha variante compacta.
- `frontend/src/features/professional/hooks/useProfessionalResource.js`: requests por conta/contexto com timeout/retry. `useProgramDraft.js`: CRUD local da semana. `useProfessionalLists.js`: busca/filtro/paginação e retorno à lista.
- `frontend/src/features/professional/pages/`: ProgramWeekPage, ProgramWorkoutPage, ProgramVersionsPage, ProgramComparePage, ProgramAssignPage, StudentTrainingPage, StudentAssignPage, StudentHistoryPage, StudentExecutionPage, StudentProgressPage e ProfessionalExercisesPage; um arquivo por página.
- `frontend/src/features/professional/routes.js`: construção de destinos/compatibilidade; `frontend/src/App.jsx`: integração lazy das rotas e política de navegação.
- `frontend/src/professional.css`: tokens/classes estritamente locais.
- Views existentes ProfessionalDashboard, ProfessionalStudents, ProfessionalStudentPage, ProfessionalPrograms, ProfessionalInvites, ProfessionalProfile e StudentProfessionals/Detail/Materials: entradas refatoradas, sem funções removidas.
- Testes focados junto aos módulos (`*.test.js`/`*.test.jsx`); E2E `frontend/e2e/professional-native.spec.js`. Atualizar fontes de traduções existentes, sem inglês literal na UI traduzida.

**DTOs compartilhados (JS; documentar com JSDoc, não introduzir TypeScript):**
- `WeekDraft = {title, description, objective, weeklyPlan, workoutTitles}`; `weeklyPlan` mantém dia → array de prescrições existente, `workoutTitles` dia → string.
- `Page<T> = {items: T[], total: number, offset: number, hasMore: boolean}`; ordenar sempre por data e UUID como desempate.
- `StudentSummary`: campos atuais mais `avatarRef`, `currentProgram`, `lastActivityAt`, `attentionReasons`.
- `ProgramSummary = {id,title,description,objective,archived,workoutCount,studentCount,lastChangedAt}`.
- `DashboardSummary = {activeStudents,attentionStudents,todayWorkouts,activePrograms,pendingInvites,today,recentActivity}`; `today` e `recentActivity` são listas limitadas com contagens globais independentes.

### Task 1: Metadados de programa, duplicação e notas privadas

**Files:** Criar migration/test SQL 016; modificar `professional-workflow.js`, `professional-workflow.test.js`, `assigned-program.js`, `assigned-program.test.js`; criar `scripts/check-professional-native-migration.test.mjs` e incluí-lo em `package.json`.

**Interfaces:**
- Manter todos os métodos/RPCs antigos. Produzir `updateProgramMetadata({programId,title,description,objective})`, `publishProgramDraft({programId,weeklyPlan,workoutTitles})`, `duplicateProgram({programId,versionId,title})`, `studentNote(studentId)`, `saveStudentNote({studentId,body})`.
- RPCs respectivos: `update_program_metadata(p_program_id uuid,p_title text,p_description text,p_objective text)`, `publish_program_version_with_titles(p_program_id uuid,p_weekly_plan jsonb,p_workout_titles jsonb)`, `duplicate_professional_program(p_program_id uuid,p_version_id uuid,p_title text)`, `professional_student_note(p_student_id uuid)`, `save_professional_student_note(p_student_id uuid,p_body text)`.
- Publicar retorna versão com `workout_titles`; duplicar retorna `{program,version}` (version null quando origem sem versão); nota retorna `{body,updatedAt}`. DTO usa camelCase apenas na fronteira JS, SQL snake_case.
- Objetivo em `programs`; nomes em `program_versions`; `professional_student_notes` PK `(professional_id,student_id)`, body/updated_at. Leitura/escrita de nota somente por RPC com sessão, role e vínculo ativo; negar DML direto autenticado. Nome antigo vazio usa fallback do dia.

- [ ] Escrever testes: `rejects_cross_owner_metadata_and_duplication` (42501/sem alteração), `notes_require_active_owner_relationship` (outro profissional/aluno/anon/revogado negados), `publishes_titles_without_mutating_old_versions` (array antigo idêntico, título novo propagado), `duplicate_has_no_assignments` (programa independente/não arquivado), `metadata_limits` (160/80/2000 aceitos, +1 negados), `assigned_title_falls_back_for_legacy` (novo nome ou dia).
- [ ] Rodar RED: `npm --prefix frontend test -- --run src/lib/professional-workflow.test.js src/lib/assigned-program.test.js`; `npm run check:database` em banco local descartável. Falha deve demonstrar contrato ausente; se banco local indisponível, registrar bloqueio, não alegar teste SQL aprovado.
- [ ] Implementar contratos aditivos, delegando validação da prescrição aos validadores existentes. Duplicação/publicação são transacionais; grants explícitos, search_path fixo. Capturar nomes em novas execuções sem regravar histórico antigo.
- [ ] Rodar GREEN dos comandos anteriores e `npm run check:supabase`; confirmar regressões do workflow existentes.
- [ ] Commit somente arquivos desta tarefa: `feat: add professional program metadata and private student notes`.

### Task 2: Leituras reais, paginação e hooks seguros

**Files:** Criar migration/test SQL 017, `hooks/useProfessionalResource.js`, `hooks/useProfessionalLists.js` e testes adjacentes; modificar `professional-workflow.js`/test e guard estático da tarefa 1.

**Interfaces:**
- Repositório: `dashboardSummary({localDate,timeZone}) -> DashboardSummary`, `studentPage({search,status,offset,limit}) -> Page<StudentSummary>`, `programPage({search,archived,offset,limit}) -> Page<ProgramSummary>`, `executionPage({studentId,search,status,from,to,offset,limit}) -> Page<Execution>`.
- RPCs `professional_dashboard_summary(p_local_date date,p_timezone text)`, `professional_students_page(p_search text,p_status text,p_offset int,p_limit int)`, `professional_programs_page(p_search text,p_archived bool,p_offset int,p_limit int)`, `professional_executions_page(p_student_id uuid,p_search text,p_status text,p_from timestamptz,p_to timestamptz,p_offset int,p_limit int)`; limite 1–100, offset >=0. Status aluno all/with_program/without_program/attention.
- `useProfessionalResource({accountId,resourceKey,load}) -> {data,status,error,retry,isCurrent}`; 10s request timeout, auth initialization mantém regra existente. `useProfessionalLists({accountId,resourceKey,loadPage,initialFilters}) -> {items,total,status,error,filters,setFilters,loadMore,retry}`; páginas 30 alunos/20 programas/20 execuções. Não usar comprimento limitado como total.

- [ ] Escrever `counts_beyond_previous_caps` (>200 alunos/>500 execuções, totais exatos), `timezone_midnight_agenda` (data local respeitada), `attention_uses_current_assignment` (histórico anterior não determina alerta), `list_reset_discards_pending_page` (busca muda durante paginação), `account_switch_discards_response` (promessa antiga não escreve).
- [ ] RED: `npm --prefix frontend test -- --run src/features/professional/hooks`; `npm run check:database` local.
- [ ] Implementar agregação caller-scoped sem N+1; programa conta alunos ativos distintos e lastChangedAt=max(metadata,published). Agenda considera dia da semana local, frequência/execuções somente dados compartilhados. Hooks reutilizam regras de geração existentes.
- [ ] GREEN: mesmos comandos mais `npm run check:supabase` e testes de `professional-ux`/`professional-workflow`.
- [ ] Commit: `feat: add paginated professional workspace projections`.

### Task 3: Shell e componentes compactos

**Files:** Criar componentes do mapa exceto os três específicos de prescrição/picker; `features/professional/routes.js`; modificar `App.jsx`, `components/AppHeader.jsx`, `components/ProfessionalWorkspaceNav.jsx`, `professional.css`; criar `ProfessionalLayout.test.jsx`, `CompactList.test.jsx`, `routes.test.js` adjacentes.

**Interfaces:** `ProfessionalLayout({title,backTo,action,children})`; `SectionHeader({title,action})`; `CompactList({children,status,empty,onLoadMore,hasMore})`; `StudentRow({student,to})`, `ProgramRow({program,to,onAction})`, `WorkoutRow({day,title,count,to})`; `StatusBadge({status,children})`; `EmptyState({title,description,action})`; `SearchBar({value,onChange,label})`; `FilterChips({options,value,onChange})`; `BottomActionBar({children})`; `ContextActions({label,items})`, items `{id,label,onSelect,disabled,destructive}`. `professionalPath({kind,id,day,versionId,studentId}) -> string` cobre toda árvore aprovada.

- [ ] Escrever `only_one_navigation_in_professional_routes` (4 destinos completos, TabBar pessoal ausente, retomada existente acessível), `long_labels_wrap_without_scroll`, `sheet_returns_focus_and_back_once`, `avatar_uses_authorized_asset_or_initials`, `legacy_links_keep_exact_identity`.
- [ ] RED: `npm --prefix frontend test -- --run src/features/professional/components src/features/professional/routes.test.js`.
- [ ] Implementar shell desktop/sidebar e mobile/bottom, componentes sem envelopes aninhados e CSS local. Usar Dialog existente para contexto; não adicionar outro controlador de popstate/body lock. Barra de ação reserva espaço e se adapta ao teclado.
- [ ] GREEN: mesmo comando e testes existentes de WorkspaceNav/App/sheets. Conferir protótipo 375px e desktop antes de migrar consumidores.
- [ ] Commit: `feat: introduce compact professional workspace navigation`.

### Task 4: Rascunho semanal e editor rápido de treino

**Files:** Criar `hooks/useProgramDraft.js`/test, `pages/ProgramWeekPage.jsx`, `pages/ProgramWorkoutPage.jsx`/tests, ExercisePrescriptionRow/PrescriptionSheet/ExercisePickerSheet e testes; modificar `components/ProfessionalProgramEditor.jsx`, `components/ProfessionalExercisePicker.jsx`, `store/useStore.js` e testes de cache.

**Interfaces:** `useProgramDraft({accountId,programId,initialDraft}) -> {draft,dirty,updateMetadata,setWorkoutTitle,addExercise,updateExercise,removeExercise,duplicateExercise,moveExercise,copyDay,swapDays,clearAfterPublication}`; operações exercício recebem dia + índice estável/contexto atual. `PrescriptionSheet({open,prescription,onSave,onClose})`, `ExercisePickerSheet({open,prescriptions,onAdd,onClose})`, `ExercisePrescriptionRow({prescription,index,onEdit,onAction})`.

- [ ] Escrever `draft_survives_day_navigation_and_reload`, `draft_never_crosses_accounts`, `failed_publish_keeps_entire_week`, `copy_requires_overwrite_confirmation`, `quick_edit_preserves_cardio_time_effort_and_notes`, `picker_search_expand_multi_add_limit_50` (nome compacto, uma animação expandida, adicionar mantém aberto, 51º negado), `duplicate_and_move_preserve_prescription`.
- [ ] RED: `npm --prefix frontend test -- --run src/features/professional/hooks/useProgramDraft.test.js src/features/professional/pages/ProgramWorkoutPage.test.jsx src/components/ProfessionalProgramEditor.test.jsx`.
- [ ] Implementar semana de sete linhas e `/programs/:programId/edit/:day`; metadados/títulos locais no draft, exercício compacto com sheet completo. Manter copy/swap, mover cima/baixo acessível, duplicar/remover/observação, defaults reais. Publicar somente no resumo da semana e limpar draft apenas após sucesso da conta/contexto atual.
- [ ] GREEN: mesmos testes mais picker, store cache-isolation e professional-program. Conferir teclado e voltar em editor no celular.
- [ ] Commit: `feat: build fast per-workout editor with persistent weekly drafts`.

### Task 5: Biblioteca, versões e atribuição do programa

**Files:** Refatorar `views/ProfessionalPrograms.jsx`/test; criar ProgramVersionsPage/ProgramComparePage/ProgramAssignPage e testes; integrar ProgramWeekPage/WorkoutPage leitura e rotas App.

**Interfaces:** Rotas `/programs`, `/new`, `/:programId`, `/:programId/workouts/:day`, `/:programId/edit`, `/:programId/edit/:day`, `/:programId/versions`, `/:programId/versions/compare`, `/:programId/versions/:versionId`, `/:programId/assign?version=UUID`. Declarar prefixo `/professional`. Consome tarefas 1–4 e métodos existentes assign/revoke/archive/restore.

- [ ] Escrever `filters_and_return_preserve_search`, `version_comparison_keeps_full_prescriptions`, `duplicate_selected_version_is_independent`, `archive_confirms_and_restore_does_not_reactivate`, `assign_requires_review_and_exact_version`, `published_week_is_read_only`.
- [ ] RED: `npm --prefix frontend test -- --run src/views/ProfessionalPrograms.test.jsx src/features/professional/pages/ProgramVersionsPage.test.jsx src/features/professional/pages/ProgramAssignPage.test.jsx`.
- [ ] Implementar lista objetivo/treinos/alunos/última alteração, criar/editar metadata, contexto duplicar/arquivar/restaurar/atribuir, versões separadas e comparação completa. Criação segue para draft; atribuição escolhe aluno, versão e confirma impacto da substituição global. Query antiga program/version resolve para identidade exata, nunca troca programa por leitura.
- [ ] GREEN: mesmos testes, testes antigos de programa/editor e build frontend.
- [ ] Commit: `feat: organize program library versions and assignment flow`.

### Task 6: Home, alunos e acompanhamento

**Files:** Refatorar ProfessionalDashboard/Students/StudentPage e testes; criar StudentTrainingPage/AssignPage/HistoryPage/ExecutionPage/ProgressPage com testes; integrar rotas App.

**Interfaces:** `/professional/students/:studentId` central, subrotas `training`, `assign`, `history`, `history/:executionId`, `progress`. Página central consome client detail existente + nota da tarefa 1; páginas paginadas consomem tarefa 2. Atribuição desde home/programa/aluno converge na revisão de versão da tarefa 5.

- [ ] Escrever `dashboard_counts_and_shortcuts_use_real_data`, `student_filters_and_avatar_summary`, `student_sections_have_distinct_routes`, `history_prescribed_vs_actual_survives_revocation`, `notes_are_private_and_fail_closed`, `progress_never_reads_personal_snapshots`, `assign_keeps_explicit_section_and_selected_version`, `unlink_clears_only_current_account_assignment`.
- [ ] RED: `npm --prefix frontend test -- --run src/views/ProfessionalDashboard.test.jsx src/views/ProfessionalStudents.test.jsx src/views/ProfessionalStudentPage.test.jsx src/features/professional/pages/StudentHistoryPage.test.jsx`.
- [ ] Implementar home compacta com atenção/hoje/atividades e atalhos; lista de alunos; central com resumo/programa/próximo treino/frequência e links verticais. Histórico separado com filtros/paginação, detalhes completos, evolução por execuções compartilhadas. Notas em sheet. Trocar programa e editar prescrição individual oferecem cópia independente, sem editar modelo ou alunos implicitamente. Revogar/desvincular exigem confirmação explícita.
- [ ] GREEN: mesmos testes mais assigned-program/professional-events e client request regressions existentes.
- [ ] Commit: `feat: rebuild student management and training follow-up`.

### Task 7: Convites, perfil e catálogo

**Files:** Refatorar ProfessionalInvites/Profile e respectivos testes, ProfessionalProfileForm; criar ProfessionalExercisesPage/test; ajustar repository invites select e App rotas.

**Interfaces:** Convites filtro URL `status=pending|accepted|expired|cancelled`; dados incluem expires_at/accepted_at/accepted_by. `/professional/exercises` usa catálogo EXDB existente; query `program` + `day` quando houver destino para adicionar. Perfil mantém /professional-profile alias, /profile e /profile/edit.

- [ ] Escrever `no_expiry_invite_stays_pending`, `expired_invite_requires_new_code`, `reshare_uses_user_initiated_existing_share`, `cancel_requires_confirmation`, `profile_provisioning_and_verification_remain`, `catalog_preview_and_contextual_add`, `local_custom_exercise_is_not_shared`.
- [ ] RED: `npm --prefix frontend test -- --run src/views/ProfessionalInvites.test.jsx src/views/ProfessionalProfile.test.jsx src/views/ProfessionalProfile.onboarding.test.jsx src/features/professional/pages/ProfessionalExercisesPage.test.jsx`.
- [ ] Implementar listas de convites/status reais, compartilhar novamente sem simular envio; perfil compacto e formulário preservando limites/onboarding/verificação; catálogo busca/filtros/arrow-animation igual picker, seleção explícita de programa/dia quando ausente.
- [ ] GREEN: mesmos testes, StudentProfessionalInvite e professional-profile/workflow.
- [ ] Commit: `feat: refine invitations professional profile and exercise catalog`.

### Task 8: Experiência do aluno e links compatíveis

**Files:** Refatorar StudentProfessionals/StudentProfessionalDetail/StudentProfessionalMaterials e testes; criar `features/professional/pages/ReceivedProfessionalSection.jsx`/test; modificar routes.js/App e assigned-program apenas se necessário.

**Interfaces:** `/student/professionals/:professionalId` apresentação central; subrotas `/training`, `/history`, `/history/:executionId`, `/relationship`. `/materials?material=assignmentId` mantém versão/atribuição exata. `/connect`, `/invite/:code`, code/section/program/version/material e retorno onboarding continuam operacionais; parâmetros não consumidos preservados.

- [ ] Escrever `old_material_link_preserves_active_plan`, `legacy_section_redirect_preserves_query_identity`, `invite_survives_login_and_onboarding`, `student_has_only_personal_navigation`, `start_uses_active_assignment_and_outbox`, `unmounted_unlink_invalidates_stale_reads_without_cross_account_write`.
- [ ] RED: `npm --prefix frontend test -- --run src/views/StudentProfessionals.test.jsx src/views/StudentProfessionalDetail.test.jsx src/views/StudentProfessionalMaterials.test.jsx src/components/StudentProfessionalInvite.test.jsx src/features/professional/routes.test.js`.
- [ ] Implementar páginas/seções recebidas compactas, sem segundo menu horizontal; histórico/material somente leitura, iniciar/retomar conectado ao executor existente. Remover consumidores antigos de ManagementPanel/navvisibility apenas após mapear substituto; conservar componentes ainda usados fora do escopo.
- [ ] GREEN: mesmos testes mais assigned-program, store sync e professional-events; conferir notificações/deep links.
- [ ] Commit: `feat: align received training experience and legacy deep links`.

### Task 9: Idiomas, integração e validação em iPhone

**Files:** Criar `frontend/e2e/professional-native.spec.js`; modificar `frontend/playwright.config.js` só para projetos/viewport necessários, fontes de tradução existentes e `professional-english.js`; criar `docs/superpowers/reports/2026-10-09-professional-native-verification.md`.

**Interfaces:** Matriz inventário → rota nova → teste/evidência no relatório. iPhone 375/390/393/430px; desktop 1280/1440px, dark/light. Fixtures locais autenticadas separadas de produção, sem dados fictícios no produto.

- [ ] Escrever E2E `professional_end_to_end_program_and_student`, `invite_accept_and_received_workout`, `long_text_keyboard_and_sheet_back`, `legacy_link_and_historical_assignment`, `request_failure_retry_and_account_switch`. Assert sem overflow (`scrollWidth <= clientWidth`), um nav, ação acessível, foco devolvido, draft recuperado, versão exata, histórico não altera executor. Exercitar os fluxos preservados de copy/swap/advanced/compare/archive/restore/revoke.
- [ ] RED: `npm run test:e2e -- --grep professional-native` antes de ajustes; registrar testes realmente executados e não confundir skip com passe.
- [ ] Integrar textos em todos os idiomas existentes; corrigir somente defeitos demonstrados da matriz. Conferir visualmente screenshots reais por viewport/tema, vazio/erro/longos/teclado. Executar WebKit se disponível; relatar Chromium viewport como tal.
- [ ] GREEN final: `npm test`, `npm run check:supabase`, `npm run check:database` local, `npm --prefix frontend run check:i18n`, `npm run build`, `npm run build:vercel`, E2E focado. Não repetir checks sem mudança/falha nova. Reportar indisponibilidade de SQL/Safari/lint/typecheck com precisão.
- [ ] Pedir revisão independente de todo diff e corrigir achados com regressão focada; relatório contém mudanças, cobertura, limitações e funcionalidades preservadas. Commit: `test: verify native professional management flows`.

## Execução e entrega

O usuário já escolheu agentes Superpowers. Após revisão deste plano, executar tarefas sequenciais com implementador e revisor por tarefa, ledger de decisões e revisão final. Usar workspace isolado conforme skill; não alterar trabalho alheio. A autorização anterior para migrations/commit/push em produção permanece registrada, mas aplicar migrations novas somente após validação dos contratos e revisar o diff final antes da entrega. Nunca executar fixtures SQL destrutivas contra Supabase remoto; não exibir `.env`.

## Autorrevisão do plano

Cobertura: árvore/componentes/visual (3), dados e segurança (1–2), editor (4), programas/versões (5), home/alunos/acompanhamento (6), convites/perfil/exercícios (7), aluno/compatibilidade (8), idiomas e verificações (9). Os cinco riscos de Review Focus têm testes nomeados nas tarefas proprietárias. Assinaturas de leitura, metadata e draft são únicas; o formato dia → array e as fronteiras existentes permanecem. Medidas privadas é a base aprovada, sem funcionalidade nova de consentimento inferida.
