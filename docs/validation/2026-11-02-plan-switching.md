# Plano profissional/pessoal — correção e validação

Base obrigatória: `503815b7c0153d98612083f98a5121e726fc0810` (main limpa).

## Causa e correção do modal

A falha reproduzida ocorre **depois de applyLibraryPlan/parsePlan e antes de applyDomainState/replaceState/close**. `normalizeState()` acrescenta metadados como `starterKey` ao carregar rotinas prontas. Essa normalização não marca o plano como pendente de sincronização; o banco pode legitimamente continuar com a prescrição sem esse metadado. A comparação literal anterior rejeitava a resposta válida como `changed-personal-routine`. O backend já havia confirmado, mas o frontend mantinha a seleção/revisão anterior e o modal aberto.

O teste de regressão reproduziu essa falha antes da correção. Agora a comparação usa a mesma representação normalizada que o store recebe. Contagem, IDs duplicados, rotinas assigned, nome, exercícios, carga e repetições continuam protegidos. Escopo da conta, revisão, alterações locais concorrentes e seleção esperada continuam sendo verificados antes de substituir o store. O modal fecha somente após a resposta confirmada e a atualização do store.

## Visualização e plano ativo

Conforme esclarecimento do usuário, cabeçalho e calendário **principais** continuam mostrando o plano ativo. `choice` controla apenas a área de visualização. A opção pessoal tem um preview separado de semana, modo e dayPlan, derivado da biblioteca existente no servidor e das rotinas pessoais atuais. Não existe um segundo armazenamento de planos. IDs excluídos/assigned são filtrados; descansos null/rest são mantidos. Sem snapshot, o preview usa calendário inicial vazio seguro.

Aplicar pessoal/profissional utiliza o backend existente. O seletor permanece na opção escolhida, enquanto seleção, assignedProgram, revisão e calendário são atualizados pelo resultado do servidor. Sem profissional disponível ou ativo, o fluxo pessoal não ganha seletor nem biblioteca profissional vazia.

## Revisões e migrations

A nova migration `202611020007_require_explicit_plan_revision.sql` corrige outro defeito reproduzido: revisão NULL explícita contornava a comparação de revisão. A chamada de dois argumentos agora rejeita NULL/negativo com 22023 e revisão desatualizada com 40001. A API antiga de um argumento resolve a revisão sob o mesmo bloqueio transacional e delega com um valor concreto. Migrations antigas, inclusive 005/006, não foram alteradas.

A migration 007 foi aplicada no Supabase remoto; `supabase db push --linked --dry-run` confirmou zero migrations pendentes.

## Validação local

- Instalação limpa: `npm ci` e `npm ci --prefix frontend` passaram.
- Lint e typecheck: passaram.
- Vitest completo: **1.608 testes, 186 arquivos, todos passaram**. Uma tentativa sob carga concorrente teve timeout no teste App.auth e efeitos subsequentes no mesmo arquivo; o arquivo foi reexecutado sem alterações (13/13) e a suíte completa reexecutada com dois workers (1.608/1.608).
- Notifications: **42/42**.
- Biblioteca/PostgreSQL WASM: **13 suítes**.
- `check:supabase` com runtime PostgreSQL nativo: **42/42, zero skips**.
- TAP runner: **3/3**.
- PostgreSQL nativo criado do zero: **34/34 arquivos SQL**, com todas as migrations, incluindo 005/006/007.
- Traduções: 11 locales, 1.554 chaves; check:i18n passou.
- Fatigue probe: 108.000 comparações e 14.076 comparações de edição/exclusão, passou.
- Builds normal, Vercel e mobile/web: passaram.
- Audit de produção: zero vulnerabilidades. Audit completo passou no limite high do workflow; dependências de desenvolvimento reportam 2 low e 16 moderate.
- PWA E2E: **7/7**.
- E2E completo: **318 passaram, 22 skips preexistentes, 340 enumerados**. Desktop Chromium: 152; mobile Chromium: 130; WebKit: 36. Os 21 casos da nova alternância passaram nos três projetos sem skips. Os skips antigos são matrizes específicas de viewport já executadas em outro projeto.

O `supabase db reset` local foi tentado e não conseguiu inspecionar o serviço: Docker/Supabase local indisponível. `check:database` na porta padrão 54322 também não encontrou serviço. O runner de banco limpo executou os 34 arquivos com um runtime PostgreSQL completo já disponível, sem usar o banco remoto. O reset Supabase real integra o job database do GitHub Actions; o status final e os links do CI são informados na entrega.

São **2.020 execuções individuais aprovadas** somando Vitest, notifications, check:supabase nativo, TAP, E2E e PWA, além das 13 suítes da biblioteca e dos 34 arquivos SQL (sem somar novamente suas asserções).

## Cenários cobertos

- Pessoal → profissional → pessoal: aplicação confirmada, modal fecha, tab permanece, calendário principal/header mudam imediatamente; rotinas e workout corretos.
- Dez alternâncias reais no teste SQL: revisões crescentes, seleção correta e rotinas pessoais atuais preservadas.
- Criação, renomeação, exercícios/cargas/repetições editados e exclusão durante profissional: atualizações atuais preservadas, excluída não reaparece, referências inválidas removidas, nenhuma assigned vira pessoal.
- Modo semanal/diário, week, dayPlan, descanso null/rest e calendário seguro sem snapshot.
- Usuário sem profissional e somente histórico indisponível: fluxo pessoal normal, criação, edição, calendário e modo.
- Entrega, nova versão, preview e reconhecimento de atualização não aplicam; versão antiga ativa permanece identificável.
- Cancelamento, clique duplo, Aplicando…, falha de sync/save/apply, resposta inválida, troca de conta, conflito de revisão e falha de refresh após sucesso.
- Servidor confirmou/resposta perdida: sincronização converge nos dois sentidos, sem reaplicar, duplicar seleção ou incrementar revisão novamente; resposta antiga e escopo encerrado não sobrescrevem.
- E2E com duas sessões compartilhando servidor/revisão: A aplica; B recebe conflito, preserva o estado anterior e converge após reload sem aplicar novamente.
- Reload pessoal/profissional e navegação /plan → /plan/r/:id → /workout; prescrição profissional real verificada em sets/reps/carga.
- Plan ID de outra conta, assignment revogado, relacionamento inativo, revisão inválida/desatualizada, atomicidade e guardas de conta nas suítes SQL.

## Arquivos alterados

Produção:
- frontend/src/components/training/PlanLibrary.jsx
- frontend/src/components/training/ProfessionalPlanApplyButton.jsx
- frontend/src/lib/personal-plan-preview.js
- supabase/migrations/202611020007_require_explicit_plan_revision.sql

Testes e infraestrutura:
- frontend/src/components/training/PlanLibrary.test.jsx
- frontend/src/components/training/ProfessionalPlanApplyButton.test.jsx
- frontend/src/lib/personal-plan-preview.test.js
- frontend/src/lib/plan-application-convergence.test.js
- frontend/src/lib/professional-workflow.test.js
- frontend/src/views/Plan.personal-routines.test.jsx
- frontend/src/views/Plan.switching.test.jsx
- frontend/e2e/application.spec.js
- frontend/e2e/plan-library.spec.js
- frontend/e2e/plan-switching.spec.js
- frontend/playwright.config.js
- scripts/test-plan-library-database.mjs
- supabase/tests/202610280001_library_updates.sql
- supabase/tests/202610310001_explicit_library_plan_application.sql
- supabase/tests/202611020005_personal_professional_switching.sql
- docs/validation/2026-11-02-plan-switching.md

Os dois testes SQL antigos foram adaptados para identificar explicitamente a versão mais recente, preservando a verificação da versão anterior ainda ativa. Nenhum teste novo foi marcado como skip. E2E usa o servidor canônico controlado das fixtures; os testes SQL executam as funções reais em bancos descartáveis.
