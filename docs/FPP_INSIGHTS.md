# FPP Insights

Módulo administrativo em `/console/insights`, integrado ao Console existente. A autorização usa `user_roles`, `useConsoleAccess`, `AccessGate` e `ops_require_admin()`. Nenhum serviço externo de analytics foi adicionado.

## Estrutura

- `features/console/ConsoleInsights.jsx`: filtros na URL, navegação e composição das seções.
- `features/console/insights/`: indicadores, barras, funis, SVGs de tendência/rosca, estados vazios, consultas independentes e CSS restrito ao módulo.
- `lib/insights-events.js`: catálogo fechado, normalização e identificadores determinísticos de eventos de operações.
- `lib/insights-collector.js`: fila de memória, isolamento de conta, deduplicação, consentimento e lotes.
- `lib/insights-client.js`: contexto de plataforma, versão do pacote, transporte e API `trackInsight(name, properties)`.
- `lib/insights-detector.js`: classificação determinística de tentativas e falhas.
- `lib/insights-operation.js`: observação de respostas confirmadas do repositório de treinamento.
- `lib/insights-performance.js`: observação passiva do encerramento da cortina de abertura.
- `lib/insights-repository.js`: métodos administrativos com cancelamento e cache de 20 segundos, pertencente à instância da página/conta.

O painel tem Visão geral, Dificuldades, Funis, Treinos, Retenção, Desempenho e Suporte. A seção Precisa de atenção mantém os estados aberto, em análise e resolvido no servidor. Atualização automática a cada 60 segundos somente com documento visível e componente montado; atualização manual por bloco. Filtros: período (padrão 7 dias), plataforma, dispositivo, versão e paginação. Intervalos personalizados inválidos não executam consultas.

## Inspeção do Supabase

Antes de escrever as migrations, foi consultado o projeto remoto **Fpp**, referência `bgqavxoxwgheloeubbpf`. Foram examinados schemas, colunas, constraints, índices, RLS, funções, triggers, extensões e histórico de migrations. Confirmados `pg_cron`, os domínios de treinamento, consentimento e suporte; não havia estrutura equivalente de Insights.

Reutilizados: `workout_sessions`, `workout_session_operations`, `privacy_consents`, `privacy_requests`, `profiles`, `user_roles`, `support_tickets`, `support_categories`, `professional_link_requests`, `professional_student_relationships`, `program_assignments`, `athlete_plan_library`, e `ops_require_admin`. `account_snapshots` e `workout_executions` foram inspecionados. Seus históricos não são somados indiscriminadamente às sessões atuais, pois podem representar os mesmos treinos. O painel identifica `workout_sessions` como sua fonte operacional, sem reclassificar registros legados.

Migrations:

1. `202611080001_fpp_insights.sql`: eventos, alertas, auditoria, ingestão, agregação administrativa, exclusão e limpeza. Protege também `ops_log_system_error` com autorização administrativa, preservando assinatura e formato de resposta. A busca no frontend encontrou apenas o consumidor administrativo desse método.
2. `202611080002_insights_support_diagnostics.sql`: diagnóstico técnico voluntário associado ao chamado existente, consulta administrativa e retenção de 30 dias.
3. `202611080003_insights_link_context.sql`: correlação autorizada de solicitações, planos, sessões e ciclos de vínculo profissional, sem retornar perfil ou prescrição.
4. `202611080004_insights_admin_integration.sql`: alertas de alta relevância na central existente de notificações e contexto de chamados no perfil administrativo. O feed anterior é preservado; leitura e dispensa continuam usando os mecanismos existentes.
5. `202611080005_insights_anomaly_rules.sql`: regras de crescimento de falhas/interrupções, concentração por versão/plataforma e queda da conclusão em coortes oficiais elegíveis.
6. `202611080006_insights_scoped_consent.sql`: wrapper compatível de consentimento que rejeita salvamento tardio depois de uma troca de conta.
7. `202611080007_insights_workout_engagement.sql`: ativação e recorrência pela fonte oficial de sessões, com amostra mínima e distinção explícita do histórico legado.

## Ingestão e segurança

`insights_ingest(p_events, p_expected_account)` obtém a identidade de `auth.uid()`. A conta esperada é exclusivamente uma proteção contra troca de conta durante uma requisição, nunca prova de propriedade. Contas anônimas e contas sem consentimento válido não inserem eventos.

Máximo de 25 eventos/32 KB por lote e 500 eventos por conta/hora. Nomes, propriedades, formatos, UUIDs, plataformas, dispositivos, duração e rotas são validados. Campos desconhecidos rejeitam o lote. Eventos com mais de 24 horas ou mais de cinco minutos no futuro não são aceitos. IDs repetidos não são inseridos. Identificadores estáveis das operações evitam duplicações em reenvios após recarregar o aplicativo.

A fila contém no máximo 100 eventos, expira em 24 horas e existe somente em memória. O envio ocorre a cada 15 segundos com documento visível e conexão disponível. Não há armazenamento persistente de identidade analítica, fingerprint ou integração com a fila oficial de treinos. Falhas são silenciosas. Logout/troca de conta descarta a fila. Montagem dupla do StrictMode não limpa eventos válidos nem cria uma segunda observação de rota.

As tabelas têm RLS habilitada, sem privilégios diretos para `anon`/`authenticated`; o acesso ocorre por RPCs específicas. RPCs administrativas verificam `ops_require_admin()`. Consultas são agregadas no PostgreSQL e limitadas a 50 linhas por seção, com offset máximo de 10 mil. Eventos brutos não são carregados no navegador para cálculos. A consulta individual exige consentimento atual e gera auditoria. Os acessos administrativos e alterações de estado dos alertas também são auditados.

Ingestão, exclusão e revogação usam a mesma trava por conta; o consentimento é revalidado depois da trava. Respostas tardias de operações de treino/profissionais são descartadas depois da troca de conta.

## Consentimento, minimização e exclusão

`analytics` permanece desativado por padrão. `readPrivacyConsent()` é verificado ao registrar e ao enviar; a permissão é novamente conferida pelo servidor em `privacy_consents`, finalidade `cookie_preferences`, campo `analytics`. A alteração local dispara `fitproplayer:consent-changed` para interromper imediatamente a coleta e descartar pendências. Mudanças entre abas também são observadas. A coleta aguarda o consentimento da conta atual confirmado pelo modal; uma preferência de outro usuário no dispositivo não é copiada automaticamente. Revogações offline mantêm uma pendência estritamente por conta até sua sincronização e não são revertidas por um consentimento remoto antigo.

Não são enviados nomes, mensagens, URLs completas, parâmetros, tokens, imagens, pose, biometria, medidas corporais ou conteúdo/prescrição de rotinas. A interface voluntária de suporte envia somente categorias técnicas e números limitados, sem habilitar analytics.

Em Privacidade, “Excluir registros de medição” chama `insights_delete_own()`. Revogação registrada e solicitações existentes de exclusão/revogação removem os eventos associados. A exclusão definitiva da conta propaga por FK com `ON DELETE CASCADE`.

Retenção: eventos e alertas até 90 dias; auditoria administrativa até 180 dias; diagnóstico voluntário de suporte até 30 dias. O job `fpp-insights-retention` executa diariamente às 03:23 UTC. Migrations locais sem `pg_cron` podem ser verificadas sem instalar a extensão; no remoto o job precisa ser confirmado após aplicação.

Agregações de telemetria exigem ao menos cinco usuários distintos. Grupos menores são ocultados. “Dados insuficientes” não significa ausência de dificuldades. Métricas operacionais de treino/suporte são identificadas separadamente. Quando filtradas por plataforma/versão/dispositivo, sua população é limitada aos registros correlacionados com a telemetria consentida.

## Eventos e instrumentação

O catálogo completo está em `INSIGHT_EVENTS`. Famílias disponíveis:

- Sessão e navegação: `app_session_started`, `screen_viewed`.
- Onboarding: `onboarding_started`, `onboarding_step_viewed`, `onboarding_step_completed`, `onboarding_validation_failed`, `onboarding_completed`.
- Plano: `plan_creation_started`, `plan_creation_step_completed`, `plan_creation_completed`, `plan_creation_failed`.
- Treino: `workout_start_requested`, `workout_start_confirmed`, `workout_set_recorded`, `workout_progress_recorded`, `workout_finish_requested`, `workout_finish_confirmed`, `workout_abandon_confirmed`, `workout_recovery_succeeded`, `workout_recovery_failed`.
- Flex: `flex_adjustment_started`, `flex_adjustment_completed`, `flex_adjustment_failed`.
- Profissional: `professional_link_requested`, `professional_link_established`, `professional_plan_selected`, `professional_step_completed`.
- Comunidade: `community_feed_viewed`, `community_publish_started`, `community_upload_completed`, `community_publish_completed`, `community_publish_failed`.
- Fotos: `photo_feature_opened`, `photo_selection_started`, `photo_upload_started`, `photo_upload_completed`, `photo_upload_failed`, `photo_comparison_opened`, `photo_comparison_interacted`.
- Técnicos: `action_failed`, `action_retried`, `operation_slow`, `sync_failed`, `sync_recovered`, `asset_load_failed`, `runtime_error`, `storage_failed`, `service_worker_failed`, `flow_interrupted`, `app_open_measured`, `interface_usable`, `page_loaded`.

Registrar um nome no catálogo não cria automaticamente uma fonte de medição: valores só aparecem quando existe emissão observada. Não se calcula uma métrica a partir de um evento que nunca chegou.

Pontos concretos: `PlanWizard`, `RoutineEdit`, `training-repository`, observação do orçamento de recuperação em `session-recovery`, transições de erro/recuperação da sincronização em `App`, `Workout` para escolhas e confirmação do Flex, `professional-workflow`, `Community`, galeria/upload/comparação de fotos e a ponte de categorias de `diagnostics.js`. A cortina mantém sua sequência original: o observador só mede disponibilidade depois de `hidden`, estado `completed` e remoção de `data-launch-restoring`. A única edição no controlador foi uma anotação JSDoc de tipo, sem alteração executável.

Os eventos de etapas não contêm o preenchimento. No onboarding, “salvo” significa gravação local confirmada pelo mecanismo existente, identificada como `local_saved`. Confirmações persistidas de treino só são emitidas depois de uma resposta válida do servidor. Nenhuma reconexão ou rotina automática de sincronização conta como ação humana.

## Indicadores e interpretação

- Fuso das coortes/gráficos: **America/Sao_Paulo**. Consultas usam intervalo `[from,to)`.
- Atividade significativa: navegação observada, início confirmado de treino, acesso à comunidade ou avanço confirmado no onboarding; conexão automática não conta.
- Conclusão de treino: concluídos / sessões finalizadas da coorte por início. Ativos são apresentados separadamente e excluídos desse denominador. A interface chama essa taxa “Conclusão dos finalizados”. Duração considera apenas concluídos.
- Atrito: usuários distintos afetados / usuários com exposição observada à ação no período. Sem denominador suficiente, a taxa fica indisponível. Repetições de um usuário não viram usuários adicionais.
- Três falhas da mesma ação em 60 segundos produzem atrito médio; falha após orçamento de recuperação produz alto atrito. Offline em fila não é falha definitiva. Operações RPC pendentes por 15 segundos só emitem lentidão se a página está visível e conectada. Descanso de treino não é uma operação monitorada.
- Navegação explícita para fora do onboarding produz interrupção. Com erros anteriores, é alto atrito; sem erros, é neutra. Ocultar o app não interrompe o fluxo. A taxa de abandono por janela só usa jornadas com sete dias completos de observação, e permanece indisponível sem amostra elegível.
- Funis: seis definições fechadas, jornadas distintas, etapas confirmadas em ordem, janela de sete dias. Revisitas não acrescentam jornadas. A etapa inicial precisa ocorrer no período selecionado; a conversão pode ocorrer até sete dias depois, limitada ao presente. Etapas sem amostra são protegidas. As coortes recentes ainda podem converter. “Visualizou a etapa” não equivale a concluí-la.
- D1/D7/D30: primeira atividade **observada no histórico retido**, com retorno no dia civil exato, e denominador apenas de coortes cujo dia de retorno já terminou. Não é uma afirmação sobre a primeira utilização de toda a vida da conta. Novos usuários usam `profiles.created_at`, dentro da amostra ativa consentida; recorrentes têm criação anterior ao intervalo.
- DAU/WAU/MAU: usuários distintos com atividade significativa no dia, últimos sete e últimos 30 dias em relação ao fim do filtro. Gráficos diários e semanais contam distintos por janela, e não soma dos dias.
- Período anterior: mesma duração imediatamente anterior, sem preencher comparações que não têm amostra.
- Flex: jornadas com revisão/ajuste, faixas até 30, 35–60 e acima de 60 minutos. Conclusão por faixa cruza a jornada com `workout_sessions`; eventos de interface não substituem o status oficial.
- Suporte: contagem por categoria, média de horas até primeira resposta e resolução; valores inexistentes ficam indisponíveis. Não há inferência de reabertura sem um estado/histórico apropriado.
- Alertas: agrupamento estável por ação, plataforma, versão e dispositivo; mínimo de cinco usuários e dez falhas observadas. Resolver não apaga os eventos nem reabre automaticamente a mesma chave. Alertas com ao menos 20 usuários e 50 ocorrências entram, agrupados pelo ID persistente, no feed administrativo existente. As descrições indicam sinais observados, sem declarar causa confirmada. Não são emitidos pushs aos alunos.

As barras mostram o percentual escrito, nunca uma escala visual arbitrária. Detalhes por toque/teclado exibem quantidades e categorias; os gráficos SVG mantêm valores textuais. Todas as animações respeitam redução de movimento.

Regras adicionais de atenção: crescimento de pelo menos 50% em falhas/interrupções requer ao menos cinco usuários em ambos os períodos e dez ocorrências atuais; concentração por versão exige pelo menos 20 usuários expostos e 20% afetados; lentidão requer cinco usuários e dez ocorrências; queda de conclusão exige 20 sessões finalizadas em cada período, cinco usuários com abandono e redução de ao menos 15 pontos percentuais. Esses alertas também preservam resolução e deduplicação. “Após atualização” não é apresentado como causa comprovada apenas por haver uma versão afetada.

## Como adicionar um evento

1. Acrescentar nome estável ao catálogo do cliente e à lista permitida da ingestão em nova migration.
2. Escolher um ponto específico de intenção ou confirmação; nunca observar toques globais.
3. Usar apenas metadados permitidos; `operation_id` e `journey_id` são UUIDs, sem identidade pessoal embutida.
4. Para uma operação assíncrona, capturar a conta e verificar novamente antes de reportar o resultado.
5. Confirmar persistência no domínio antes de emitir sucesso. Distinguir resultado local de confirmação no servidor.
6. Atualizar a definição do agregado/funil com janela, denominador e regra de ordem explícitos.
7. Testar consentimento, revogação, conta trocada, offline, retries e grupos pequenos. Não inserir dados demonstrativos no banco real.

## Verificação

`node scripts/test-insights-database.mjs` aplica as migrations de produção em PostgreSQL/PGlite descartável e verifica autorização, ingestão, RLS, consentimento, exclusão, D7, filtros, limites, funis e estados de alertas. `insights.test.js` e `insights-repository.test.js` verificam o cliente e os cálculos. `e2e/insights.spec.js` cobre acesso, filtros e layout em desktop, Android e iPhone/WebKit.

O resultado da aplicação remota e os comandos executados devem ser registrados no relatório de entrega, separadamente da validação local. Um dry run não equivale a aplicar uma migration.

## Aplicação e validação da entrega (2026-11-08)

As sete migrations 202611080001–202611080007 foram efetivamente executadas pelo Supabase CLI no projeto Fpp e confirmadas em supabase_migrations.schema_migrations. Índices, RLS, EXECUTE e o job ativo de retenção foram conferidos no remoto. Consultas administrativas, notificações e regras de alertas foram executadas em transação de verificação revertida, sem inserir eventos demonstrativos em produção. A migration anterior 202611070001, já pendente antes desta tarefa, não foi aplicada.

Verificações executadas:

- Suíte ampla: 210 arquivos e 1.822 testes aprovados.
- Após os últimos ajustes: 116 testes direcionados aprovados.
- Banco: 41 verificações em PostgreSQL/PGlite descartável, incluindo as sete migrations reais.
- Navegador: 15 cenários Console/Insights aprovados; rodada adicional de nove cenários Insights também aprovada, com ativação/recorrência, iPhone/WebKit, Android e desktop.
- Limites Supabase: 44 verificações aprovadas, três ignoradas pelo conjunto existente.
- Lint, TypeScript e build de produção aprovados.

O comando de cluster PostgreSQL nativo não pôde inicializar porque a instalação local não contém postgres.bki. A verificação SQL foi realizada com o motor PostgreSQL/PGlite já usado pelo repositório; o banco remoto também passou na verificação transacional. O build mantém o aviso já conhecido sobre import estático/dinâmico de sheets.jsx.

## Arquivos da entrega

Criados:

- `docs/FPP_INSIGHTS.md`
- `frontend/e2e/insights.spec.js`
- `frontend/src/features/console/ConsoleInsights.jsx`
- `frontend/src/features/console/insights/InsightsAlerts.jsx`
- `frontend/src/features/console/insights/InsightsBarChart.jsx`
- `frontend/src/features/console/insights/InsightsDonutChart.jsx`
- `frontend/src/features/console/insights/InsightsEmptyState.jsx`
- `frontend/src/features/console/insights/InsightsFilters.jsx`
- `frontend/src/features/console/insights/InsightsFriction.jsx`
- `frontend/src/features/console/insights/InsightsFunnel.jsx`
- `frontend/src/features/console/insights/InsightsFunnels.jsx`
- `frontend/src/features/console/insights/InsightsKpis.jsx`
- `frontend/src/features/console/insights/InsightsOverview.jsx`
- `frontend/src/features/console/insights/InsightsPanel.jsx`
- `frontend/src/features/console/insights/InsightsPerformance.jsx`
- `frontend/src/features/console/insights/InsightsRetention.jsx`
- `frontend/src/features/console/insights/InsightsSupport.jsx`
- `frontend/src/features/console/insights/InsightsTrendChart.jsx`
- `frontend/src/features/console/insights/InsightsUserExperience.jsx`
- `frontend/src/features/console/insights/InsightsWorkouts.jsx`
- `frontend/src/features/console/insights/insights-labels.js`
- `frontend/src/features/console/insights/insights.css`
- `frontend/src/features/console/insights/useInsightsResource.js`
- `frontend/src/lib/insights-client.js`
- `frontend/src/lib/insights-collector.js`
- `frontend/src/lib/insights-consent.test.js`
- `frontend/src/lib/insights-detector.js`
- `frontend/src/lib/insights-events.js`
- `frontend/src/lib/insights-journeys.js`
- `frontend/src/lib/insights-metrics.js`
- `frontend/src/lib/insights-operation.js`
- `frontend/src/lib/insights-performance.js`
- `frontend/src/lib/insights-repository.js`
- `frontend/src/lib/insights-repository.test.js`
- `frontend/src/lib/insights-transport.test.js`
- `frontend/src/lib/insights.test.js`
- `scripts/test-insights-database.mjs`
- `supabase/migrations/202611080001_fpp_insights.sql`
- `supabase/migrations/202611080002_insights_support_diagnostics.sql`
- `supabase/migrations/202611080003_insights_link_context.sql`
- `supabase/migrations/202611080004_insights_admin_integration.sql`
- `supabase/migrations/202611080005_insights_anomaly_rules.sql`
- `supabase/migrations/202611080006_insights_scoped_consent.sql`
- `supabase/migrations/202611080007_insights_workout_engagement.sql`

Modificados:

- `docs/ADMIN_CONSOLE.md`
- `frontend/playwright.config.js`
- `frontend/src/App.jsx`
- `frontend/src/components/AppLaunchTransition.jsx`
- `frontend/src/components/ErrorBoundary.jsx`
- `frontend/src/components/PlanWizard.jsx`
- `frontend/src/components/PrivacyConsentModal.jsx`
- `frontend/src/components/PrivacyControls.jsx`
- `frontend/src/components/ProgressPhotoCompare.jsx`
- `frontend/src/components/ProgressPhotoGallery.jsx`
- `frontend/src/components/ProgressPhotoUpload.jsx`
- `frontend/src/features/console/ConsoleConversation.jsx`
- `frontend/src/features/console/ConsoleLayout.jsx`
- `frontend/src/features/console/ConsoleOverview.jsx`
- `frontend/src/features/console/ConsoleUserPage.jsx`
- `frontend/src/lib/diagnostics.js`
- `frontend/src/lib/privacy-consent.js`
- `frontend/src/lib/professional-workflow.js`
- `frontend/src/lib/progress-photo-repository.js`
- `frontend/src/lib/session-recovery.js`
- `frontend/src/lib/training-repository.js`
- `frontend/src/main.jsx`
- `frontend/src/sheets.jsx`
- `frontend/src/views/Community.jsx`
- `frontend/src/views/Console.jsx`
- `frontend/src/views/Plan.jsx`
- `frontend/src/views/PrivacyPages.jsx`
- `frontend/src/views/RoutineEdit.jsx`
- `frontend/src/views/Support.jsx`
- `frontend/src/views/Workout.jsx`
- `frontend/vite.config.js`
