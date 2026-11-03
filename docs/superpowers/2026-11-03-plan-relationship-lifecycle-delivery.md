# Entrega: seleção de planos e ciclos de vínculo

SHA inicial: `150300ff93041cfc5982dc517423b7c86f7f95f3`.

## Comportamento implementado

O modal comparava o snapshot mutável após a confirmação do servidor. O realtime da própria gravação podia mudar esse snapshot, transformando um sucesso em conflito e mantendo o modal aberto. `ProfessionalPlanApplyButton` agora valida antes da RPC e aceita a resposta confirmada pelo sync controller, sem repetir o RPC. Um gate no domínio de plano impede leituras antigas durante a confirmação; revisão descarta respostas atrasadas. A confirmação avança workspace, revisão, base e seleção em conjunto. Edições pessoais concorrentes, inclusive no cache de outra aba, são mescladas ou preservadas em journal de conflito pendente.

`activePlanSource` deriva a aba da seleção real, validando biblioteca e versão. Entrar novamente em `/plan` acompanha o plano ativo; tocar na outra aba apenas visualiza. A resposta de `apply_library_plan` continua sendo a única fonte da aplicação e atualiza rotinas, semana, dayPlan, assignedProgram, identificação da biblioteca e revisão, usados pelo calendário e Workout.

A migration nova `202611030001_plan_relationship_lifecycle.sql` permite ciclos históricos e protege um único ciclo corrente por par. Assignments e rascunhos referenciam `relationship_id` e seus participantes. O backfill preserva registros existentes e drena triggers diferidos antes dos ALTERs; um teste com banco previamente populado cobre essa atualização.

Desvincular encerra somente o ciclo atual, registra autor/data, revoga seus assignments e restaura o plano pessoal na mesma transação quando necessário. Planos encerrados desaparecem da biblioteca operacional e não podem ser reaplicados após reconexão. Rotinas pessoais e histórico permanecem. O encerramento congela perfil/medidas autorizados para consulta histórica; execuções e notas anteriores continuam disponíveis. Exclusão de conta também restaura o pessoal e mantém ordem consistente de locks.

A área profissional abre em Ativos e oferece Atenção, Sem plano e Inativos. Perfis inativos exibem encerramento, períodos, planos e execuções em leitura; operações que exigem vínculo ativo ficam indisponíveis. A reconexão cria outro ID sem reativar material anterior.

O aluno solicita vínculo pendente. O dashboard apresenta os pedidos com link para perfil limitado pré-consentimento. Aceitar/recusar usam Button/useFppAction, bloqueio contra clique duplo e RPCs autenticadas com locks. Aceitar cria novo ciclo; recusar preserva o pedido resolvido. Códigos reutilizáveis não permitem contornar aprovação via RPC legada; convites explícitos únicos mantêm sua pré-aprovação.

## Validação local

- Vitest: 187 arquivos, 1.651 testes aprovados.
- Banco limpo PostgreSQL real: 36 arquivos SQL, quatro grupos de concorrência e atualização de banco legado populado.
- Plan library PostgreSQL/WASM: 16 grupos aprovados, incluindo upgrade populado.
- Quality DB com REQUIRE_DB: seis testes aprovados, zero skips.
- E2E: matriz de 355 casos executada; 328 aprovados inicialmente, 22 skips preexistentes e cinco falhas corrigidas/reexecutadas. Reexecução focada: seis aprovados. Fluxo completo com SQL real aprovado em Chromium desktop, Chromium mobile e WebKit mobile.
- PWA: sete testes aprovados.
- Lint, typecheck, i18n, notificações, TAP, fatigue probe, build, build Vercel e build mobile web aprovados.
- Auditoria de produção: zero vulnerabilidades. Auditoria completa respeita o limite high da Quality: 18 achados em dependências de desenvolvimento (dois low, 16 moderate).
- `supabase db reset` executado em instância PostgreSQL nativa descartável no loopback, com bootstrap local dos schemas Supabase; Docker não está disponível nesta máquina. A CI usa o stack Supabase completo.
- Revisão independente concluída após correções de histórico, exclusão e ordem dos locks.

Os resultados remotos, SHA entregue, URL da GitHub Actions e deployment Vercel são informados no relatório final da conversa.

## Arquivos da implementação
- `docs/superpowers/plans/2026-11-03-plan-relationship-lifecycle.md`
- `docs/superpowers/specs/2026-11-03-plan-relationship-lifecycle-design.md`
- `frontend/e2e/application.spec.js`
- `frontend/e2e/fixtures.test.js`
- `frontend/e2e/management.spec.js`
- `frontend/e2e/modal-dismissal.spec.js`
- `frontend/e2e/plan-switching.spec.js`
- `frontend/e2e/relationship-lifecycle.spec.js`
- `frontend/playwright.config.js`
- `frontend/src/App.jsx`
- `frontend/src/App.management-sync.test.jsx`
- `frontend/src/components/StudentProfessionalInvite.jsx`
- `frontend/src/components/StudentProfessionalInvite.test.jsx`
- `frontend/src/components/training/PlanLibrary.jsx`
- `frontend/src/components/training/PlanLibrary.test.jsx`
- `frontend/src/components/training/ProfessionalPlanApplyButton.jsx`
- `frontend/src/components/training/ProfessionalPlanApplyButton.test.jsx`
- `frontend/src/components/useRelationshipRefresh.js`
- `frontend/src/lib/account-domain-sync.js`
- `frontend/src/lib/confirmed-plan.js`
- `frontend/src/lib/plan-application-convergence.test.js`
- `frontend/src/lib/professional-english.js`
- `frontend/src/lib/professional-workflow.js`
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
- `frontend/src/store/useStore.js`
- `frontend/src/views/InviteLanding.test.jsx`
- `frontend/src/views/Plan.jsx`
- `frontend/src/views/Plan.switching.test.jsx`
- `frontend/src/views/ProfessionalDashboard.jsx`
- `frontend/src/views/ProfessionalDashboard.test.jsx`
- `frontend/src/views/ProfessionalLinkRequestPage.jsx`
- `frontend/src/views/ProfessionalLinkRequestPage.test.jsx`
- `frontend/src/views/ProfessionalStudentPage.jsx`
- `frontend/src/views/ProfessionalStudentPage.test.jsx`
- `frontend/src/views/ProfessionalStudents.jsx`
- `frontend/src/views/ProfessionalStudents.test.jsx`
- `frontend/src/views/StudentProfessionals.jsx`
- `frontend/src/views/StudentProfessionals.test.jsx`
- `scripts/lifecycle-browser-database.mjs`
- `scripts/plan-relationship-concurrency.mjs`
- `scripts/plan-relationship-upgrade.mjs`
- `scripts/run-clean-database-tests.mjs`
- `scripts/run-database-tests.mjs`
- `scripts/test-plan-library-database.mjs`
- `supabase/migrations/202611030001_plan_relationship_lifecycle.sql`
- `supabase/tests/202610020014_professional_readiness.sql`
- `supabase/tests/202610290001_exercise_sprite_requirement.sql`
- `supabase/tests/202610290003_professional_profile_invites_model_delete.sql`
- `supabase/tests/202611030001_plan_relationship_lifecycle.sql`
