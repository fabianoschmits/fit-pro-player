# Planos e ciclos de vínculo — desenho técnico

## Objetivo e ponto de partida

Implementar os fluxos definidos pelo usuário em 03/11/2026 sem duplicar store, biblioteca, seleção ou design system. SHA inicial após fetch e pull --ff-only: `150300ff93041cfc5982dc517423b7c86f7f95f3`. Nenhuma migration existente será modificada. Mudanças posteriores de main serão incorporadas sem reversão.

Invariantes: confirmação do servidor converge o frontend e fecha o modal; calendário e Workout usam a seleção real; /plan abre nessa seleção; desvinculação restaura o pessoal no servidor; reconexão cria outro ciclo sem ressuscitar assignments; pedido iniciado pelo aluno exige decisão do profissional.

## Evidência inicial

`ProfessionalPlanApplyButton.jsx` captura um snapshot antes da aplicação. Depois do RPC exige revisão igual à revisão atual do store mais um e compara novamente o snapshot. Um realtime N+1 durante a resposta torna ambas as condições inadequadas para uma gravação já confirmada.

`account-domain-sync.js` já mantém bases, revisões, merge e journal pendente. `acceptConfirmedPlan` atualmente recusa confirmação quando existe pending ou flush em andamento e delega a um caminho de leitura remota. Confirmação precisa ter semântica própria.

`PlanLibrary.jsx` mantém choice e deriva atividade de Boolean(assignedProgram). O banco já tem athlete_plan_library, athlete_plan_selection, apply_library_plan com revisão e library_write_execution_plan. A restauração pessoal atual usa rotinas vivas e calendário salvo; essa arquitetura será preservada.

## 1. Confirmação autoritativa e concorrência

Manter apply_library_plan como única RPC de aplicação, uma chamada por confirmação. Antes do RPC sincronizar o journal, conferir conta, revisão e ausência de alterações pendentes não resolvidas. Capturar a revisão esperada e a base pessoal nesse momento, sem comparar a resposta com uma revisão que pode ter avançado por realtime.

Adicionar ao controller existente uma seção exclusiva curta para o domínio plan: aguardar writes anteriores, impedir novos flushes de plan durante aplicação e confirmação, e conservar leituras recebidas com sua revisão. Outros domínios continuam funcionando. A exclusividade é por conta; mudança de escopo invalida o token e nunca escreve na conta seguinte.

acceptConfirmedAccountPlan/acceptConfirmedPlan avança atomicamente seleção, calendário, rotinas profissionais, revisão e base confirmada. A mesma revisão recebida por realtime é idempotente. Leituras inferiores à maior revisão conhecida são ignoradas em todos os caminhos de aplicação de respostas. Se uma revisão posterior legítima já existir, ela prevalece sobre uma confirmação anterior.

Edições pessoais surgidas durante o RPC são calculadas contra a base capturada, preservadas sobre a resposta confirmada e permanecem pendentes quando necessário. O merge não restaura seleção nem prescrição profissional antigas. Conflitos pessoais conservam o journal e os dados de recuperação, mantendo a execução confirmada visível. Nunca repetir automaticamente apply_library_plan para recuperar uma resposta perdida.

Validação estrutural da resposta usa o alvo e a revisão enviados, não um snapshot mutável depois do sucesso. O modal fica aberto durante a operação e em falhas reais; fecha após aceitação da confirmação. Refresh da biblioteca não transforma sucesso em erro nem autoriza nova aplicação.

## 2. Calendário operacional e aba

O mesmo DTO confirmado atualiza routines, week, dayPlan, planMode, assignedProgram, activeLibraryId, activeLibraryTitle, planServerRevision e bases. /plan, detalhes de rotina, Home e Workout continuam usando os resolvers existentes, sem copiar preview para o store.

Criar activePlanSource derivado da seleção real: activeLibraryId, item da biblioteca e correspondência exata de versão com assignedProgram. Enquanto biblioteca carrega, a identificação disponível no estado confirmado serve de fallback sem tratar assignedProgram isoladamente como prova suficiente. Uma identidade de seleção inclui libraryId e versionId.

Ao montar/reentrar na rota e quando a identidade ativa muda, focar sua origem. Choice permanece apenas como escolha temporária de visualização; toque na aba não executa escrita. Aplicação bem-sucedida e sincronização externa reposicionam a aba. Revogação remove opções indisponíveis, inclusive eventual item antigo marcado como selecionado no cache.

## 3. Migration aditiva e ciclos

Criar migration nova para remover unicidade histórica do par profissional/aluno e adicionar índice parcial que admite somente um ciclo corrente válido por par. Revogados permanecem com ID e datas originais. Reconexão sempre insere outra linha. Registrar revoked_by e preservar revoked_at.

Adicionar program_assignments.relationship_id com FK e backfill consistente com os dados existentes. Dados ambíguos não ganham autorização operacional: manter histórico e revogar/quarentenar disponibilidade quando não for possível associar com segurança. Novas gravações exigem ciclo ativo correspondente ao profissional e aluno, inclusive caminhos diretos protegidos por RLS/constraints/triggers apropriados.

Auditar todas as funções que criam, consultam e aplicam assignments. Aplicação exige assignment ativo, relationship_id ativo, participantes corretos e versão pertencente ao programa/profissional. Consultas da biblioteca filtram por essas mesmas condições. Reativação de ciclo antigo ou troca arbitrária de relationship_id não pode contornar a regra.

## 4. Desvinculação e fallback

revoke_professional_relationship autentica um dos participantes, bloqueia o ciclo e coordena locks com seleção/aplicação para serializar corridas. Encerra somente o ciclo alvo e revoga seus assignments, sem apagar biblioteca histórica, execuções, notas, métricas ou progresso.

Se a seleção pertence ao ciclo encerrado, na mesma transação restaura o plano pessoal com rotinas pessoais vivas, calendário e modo pessoais, assignedProgram nulo e revisão incrementada. Usa helper interno compartilhado de escrita existente, com aluno alvo validado; não depende de auth.uid() representar o aluno quando quem encerra é o profissional. Sem snapshot pessoal, cria baseline seguro sem calendário profissional e preserva rotinas pessoais. Se o pessoal já está ativo, não o substitui desnecessariamente.

Na próxima sincronização qualquer dispositivo recebe o fallback persistido. Aplicação simultânea ao encerramento resulta em seleção válida ou erro de autorização; nunca deixa profissional revogado ativo.

## 5. Ativos, Inativos e histórico

ProfessionalStudents passa a ter Ativos (default), Atenção, Sem plano e Inativos. Inativo é aluno com histórico e nenhum ciclo ativo com esse profissional; agrupar por aluno evita duplicação por ciclo. Retorno a vínculo ativo remove da lista de inativos.

ProfessionalStudentPage mantém consulta histórica autorizada de perfil, períodos, planos, execuções e notas segundo a política existente, sem ampliar acesso a dados futuros de outros ciclos/profissionais. Mostrar Vínculo encerrado e último encerramento. Impedir envio/edição tanto na UI como nas RPCs. Seção Vínculo mostra ciclo atual e períodos anteriores ordenados.

## 6. Pedidos de vínculo e consentimento

Criar professional_link_requests com IDs dos participantes, source_invite_id opcional, status pending/accepted/rejected/cancelled, created_at, resolved_at, resolved_by e relationship_id após aceite. Índice único parcial impede pedidos pendentes duplicados por par. RLS permite somente acesso compatível com o participante e RPCs controlam transições.

O fluxo /student/professionals/add cria pedido pending e mostra Solicitação enviada. Não cria relacionamento ativo. O aluno pode consultar o estado resolvido. Revisar accept_professional_invite e grants: código público/reutilizável não representa consentimento dirigido; somente convite explicitamente destinado ao aluno e pré-aprovado pode manter aceite direto. APIs legadas não podem transformar pedido espontâneo em vínculo ativo.

Dashboard profissional mostra cards de pendências com avatar, nome, data e Aguardando resposta; abrir card navega ao perfil da solicitação, sem aceitar no dashboard. DTO/RPC próprio retorna somente dados públicos/disponíveis antes do vínculo e metadados do pedido, sem reutilizar client_detail como se houvesse vínculo.

accept_professional_link_request autentica exatamente o destinatário, bloqueia request e serializa por par, verifica pending e ausência de ciclo ativo, cria novo ciclo e marca pedido accepted com relationship_id em uma transação. Chamadas concorrentes não duplicam vínculo. Pedido já resolvido produz resultado consistente e nenhuma nova linha.

reject_professional_link_request verifica destinatário e pending sob lock, registra rejected e resolução, preserva registro e não cria relacionamento. Atualizações de listas usam mecanismos existentes de refresh/eventos. Novo ciclo não ativa nem torna disponíveis planos antigos.

Usar ManagementLayout, ManagementPanel, ManagementAvatar, ManagementStatus, ManagementLink, Button e useFppAction. Aceitar/Recusar exibem loading/success/error e bloqueiam clique duplo com as microinterações existentes.

## 7. Testes e critérios de entrega

Primeiro adicionar regressão falhando para revisão N, apply confirmado N+1 e realtime N+1 durante roundtrip. Cobrir leitura N tardia, edição pessoal concorrente, mudança de conta, falha real, cancelamento, espera e clique duplo. Testar controller real além de mocks do botão.

Testar calendário profissional com descanso e restauração pessoal nos resolvers de /plan, rotina, Home e Workout; aba no mount, retorno, reload, mudança externa, aplicação e preview manual.

SQL tests cobrem encerramento por cada participante, fallback, preservação de rotinas/histórico/progresso/notas, biblioteca indisponível, assignment antigo após R2, autorização de terceiros, request resolvido e transições proibidas. Testes com duas conexões exercitam aceite simultâneo e aplicação versus revogação, com asserts sobre estado persistido.

E2E completo cobre pedido → dashboard → perfil → aceite → Ativos → envio de plano → aplicação → calendário/treino do dia → pessoal → profissional → revogação → Inativos → novo pedido e ciclo → histórico preservado e plano antigo ausente. Executar Chromium e WebKit conforme configuração atual, sem skips ou asserts enfraquecidos.

Executar lint, typecheck, Vitest completo, testes de notificações, plan-library database, boundaries e SQL completo, supabase db reset, concorrência, i18n/fatigue probe exigidos pela Quality, E2E, PWA, build, build:vercel, mobile:web e audit de produção. Registrar contagens e resultados reais, inclusive limitações do ambiente.

Somente após validação aplicar migration remotamente, confirmar db push --linked --dry-run sem pendências, fazer commit/push em main sem skip ci e acompanhar jobs application/database e deployment Vercel. Revalidar main antes de integrar; não sobrescrever avanço remoto. Nenhuma aprovação adicional de publicação é necessária: o usuário já autorizou essas ações.

Relatório final inclui SHA inicial/final, causa e correções do modal/sync/aba, migration e modelo de ciclos/assignments, fallback e pedidos, arquivos, contagens reais, E2E/SQL, URLs de Actions/Vercel e resultado remoto do dry-run. Falta de qualquer validação obrigatória permanece explícita e impede declarar conclusão total.

## Decisões de abordagem

Recomendação: estender controller, seleção e RPCs existentes, com uma migration coerente para integridade e consentimento. Corrigir apenas o botão deixaria concorrência e revogação vulneráveis; criar um novo store ou sistema paralelo quebraria a fonte única exigida. Implementação será dividida em tarefas verificáveis de sync/aplicação, seleção visual, ciclos/fallback, pedidos e UI/histórico, seguida de validação integrada e entrega.
