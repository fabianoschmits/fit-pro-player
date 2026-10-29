# Melhorias no espaço profissional: Plano de implementação

> **Para agentes de implementação:** usar a sub-habilidade `superpowers:executing-plans` e executar cada tarefa na ordem. Marcar cada caixa conforme avançar.

**Objetivo:** Mostrar miniaturas musculares nos modelos, histórico do aluno carregado automaticamente e expansível, anotações privadas cronológicas e um aviso compacto para alterações de plano não enviadas.

**Arquitetura:** Estender a listagem paginada de modelos com a prescrição publicada mais recente; reutilizar os componentes de miniatura e detalhes de execução já existentes. Adicionar uma tabela privada de anotações individuais com RPCs limitados ao profissional e migrar o texto legado preservando sua data. Atualizar o perfil do aluno e o cartão de estado do plano sem alterar os fluxos de treino.

**Stack:** React, Vitest, Playwright, Supabase/Postgres (migrações SQL e RPCs SECURITY DEFINER), Vite.

**Spec:** `docs/superpowers/specs/2026-10-29-professional-workspace-improvements-design.md`

## Restrições globais

- Preservar paginação, filtros, ordenação, contagens e contrato de autorização das consultas profissionais existentes.
- Não conceder acesso direto de tabela a `anon` ou `authenticated` para anotações privadas; usar RPCs autenticados e `search_path` fixo.
- Manter o limite de 2.000 caracteres e não expor anotações ao aluno.
- Não criar dados para execuções antigas sem payload/timestamps; mostrar apenas os dados existentes.
- Reutilizar `RoutineMuscleThumb`, `ProfessionalSessionDetail` e os cartões/expansões pessoais de `/history` quando possível.
- Não alterar contratos de treino, atribuição ou execução do aluno.

## Foco de revisão

- Versões de modelo ausentes ou vazias não devem gerar silhueta muscular enganosa. (Tarefa 2)
- Fim/início ausentes ou timestamps inválidos não devem produzir duração falsa ou negativa. (Tarefa 3)
- Página do histórico vazia, falha de rede e respostas paginadas não devem remover o perfil ou impedir repetição. (Tarefa 3)
- Duplo clique ou tentativa de reenvio de anotação não deve duplicar entradas; erro deve preservar o texto digitado. (Tarefa 4)
- Migração repetida ou relacionamento encerrado não deve duplicar ou expor anotação legada. (Tarefa 1)

---

### Tarefa 1: Contratos de banco para modelos e anotações

**Arquivos:**
- Criar: `supabase/migrations/<timestamp>_professional_workspace_history_notes.sql`
- Criar: `supabase/tests/<timestamp>_professional_workspace_history_notes.sql`
- Criar: `scripts/check-professional-workspace-history-notes-migration.test.mjs`
- Modificar conforme o padrão: `package.json` ou script de teste existente

**Interfaces:**
- A resposta de cada item de `professional_programs_page` inclui `weekly_plan` da última versão publicada, ou `{}` quando não houver versão.
- RPC de leitura de anotações retorna linhas `{ id, body, created_at }` do vínculo ativo, mais novas primeiro.
- RPC de inclusão recebe `p_student_id` e `p_body`, grava uma entrada e retorna `{ id, body, created_at }`.
- A tabela usa UUID, IDs de profissional/aluno, texto com limite 2.000, `created_at timestamptz`, e chave estrangeira composta para o vínculo.

- [x] **Passo 1: Criar primeiro testes SQL/estáticos que falhem**
  - Verificar inclusão de `weekly_plan` no RPC sem alterar contagem/paginação/ordenação.
  - Verificar tabela sem privilégios de cliente, grants somente para funções autenticadas e funções `SECURITY DEFINER` com `search_path` fixo.
  - Verificar bloqueio para usuário sem papel profissional, vínculo alheio/encerrado e texto acima do limite.
  - Verificar migração idempotente do legado: corpo não vazio vira uma anotação com o `updated_at` original e o corpo antigo é limpo na mesma transação.

- [x] **Passo 2: Rodar testes e confirmar falha pelo contrato ausente**

Run: `node --test scripts/check-professional-workspace-history-notes-migration.test.mjs` e a suíte SQL Supabase apropriada.  
Expected: falhas específicas porque migração, tabela/RPCs e projeção do plano ainda não existem.

- [x] **Passo 3: Implementar migração e funções**
  - Copiar a função `professional_programs_page` vigente (incluindo filtro `professional_plan_drafts`) e adicionar somente a coluna da prescrição semanal mais recente.
  - Criar a tabela de notas sem leitura/escrita direta, habilitar RLS sem políticas cliente e conceder apenas RPCs a `authenticated`.
  - Implementar migração única da nota antiga com proteção contra duplicação; manter a data original e limpar o registro mutável após copiar.
  - Implementar leitura com relação ativa, ordenação `created_at desc, id desc`, e inclusão autenticada com validação de papel, vínculo, conteúdo não vazio e limite.

- [x] **Passo 4: Executar testes de migração e revisar o diff SQL**
  - Executar `node --test scripts/check-professional-workspace-history-notes-migration.test.mjs`.
  - Executar a suíte SQL de regressão em ambiente local configurado, incluindo testes de permissões e migração de legado.
  - Confirmar que nenhum grant de tabela foi adicionado e que o RPC de modelos conserva a semântica anterior.

---

### Tarefa 2: DTOs e cartões de modelos com miniaturas musculares

**Arquivos:**
- Modificar: `frontend/src/lib/professional-workflow.js`
- Modificar: `frontend/src/lib/professional-workflow.test.js`
- Modificar: `frontend/src/views/ProfessionalPrograms.jsx`
- Modificar: `frontend/src/views/ProfessionalPrograms.test.jsx`
- Modificar: `frontend/src/management-workspace.css` se necessário

**Interfaces:**
- `ProgramSummary` ganha `weeklyPlan` (objeto, padrão `{}`).
- Um adaptador puro converte dias de `weeklyPlan` para uma rotina agregada no formato aceito por `RoutineMuscleThumb`, com IDs de exercício, sets e metadados de músculo preservados.
- Os cartões de modelo usam a miniatura agregada e preferências de corpo existentes; plano sem exercícios mostra estado neutro.

- [x] **Passo 1: Escrever testes falhos para DTO e agrupamento muscular**
  - Testar mapeamento da semana de snake_case RPC e padrão vazio.
  - Testar agregação de exercícios em vários dias, incluindo exercícios sem metadados musculares.
  - Testar cartão mostra miniatura do plano e mantém título/contagem/link.

- [x] **Passo 2: Rodar os testes da tarefa e confirmar falha esperada**

Run: `cd frontend; npx vitest run src/lib/professional-workflow.test.js src/views/ProfessionalPrograms.test.jsx`  
Expected: falhas indicando que `weeklyPlan` é descartado e cartões ainda exibem ícone genérico.

- [x] **Passo 3: Implementar mapeamento e miniaturas**
  - Adaptar o DTO preservando o objeto semanal serializado.
  - Reutilizar `RoutineMuscleThumb` e `loadOfRoutine` em lista agregada, sem consulta extra por cartão.
  - Mostrar estado neutro acessível quando não houver plano publicado ou exercícios.

- [x] **Passo 4: Executar testes afetados e validar visual**
  - Rodar os dois arquivos Vitest.
  - Rodar E2E da lista de modelos e confirmar visualmente miniaturas em modelos com plano e estado sem plano.

---

### Tarefa 3: Histórico automático em cartões expansíveis

**Arquivos:**
- Criar: `frontend/src/lib/professional-execution-display.js` se o adaptador de resumo/duração precisar de unidade própria
- Criar teste correspondente em `frontend/src/lib/professional-execution-display.test.js`
- Modificar: `frontend/src/views/ProfessionalStudentPage.jsx`
- Modificar: `frontend/src/views/ProfessionalStudentPage.test.jsx`
- Modificar: `frontend/src/components/ProfessionalPrescription.jsx` somente para fallback de duração não duplicado
- Modificar: `frontend/e2e/management.spec.js`
- Modificar CSS profissional existente se necessário

**Interfaces:**
- Ao montar perfil, chamar `repo.executionPage({ studentId })` uma vez; acumular páginas seguintes somente pelo controle que aparece quando `hasMore`.
- Cartão mostra data, título de treino, status e resumo dos exercícios realmente feitos.
- A expansão mostra `ProfessionalSessionDetail`; duração usa `payload.start/end` quando válidos, com fallback para `startedAt/completedAt`, e fica omitida se não houver intervalo válido.

- [x] **Passo 1: Criar testes de duração/resumo e UI antes da implementação**
  - Casos com início/fim no payload, fallback de timestamps no DTO, fim anterior ao início e timestamp ausente.
  - Testar carregamento automático uma vez no perfil, inclusive rota direta `?section=history`.
  - Testar card com exercícios realizados, expansão de detalhe, vazio, falha/retry e paginação adicional.
  - Assegurar ausência do botão inicial “Histórico”.

- [x] **Passo 2: Executar testes e confirmar falha esperada**

Run: `cd frontend; npx vitest run src/lib/professional-execution-display.test.js src/views/ProfessionalStudentPage.test.jsx`  
Expected: falha por não chamar executionPage ao entrar, ausência de cards e falta de resumo/fallback.

- [x] **Passo 3: Implementar busca automática, cartões e expansão**
  - Buscar primeira página ao montar o perfil, controlando cancelamento/duplicação quando aluno ou profissional mudar.
  - Usar a forma visual dos cartões expansíveis de `/history`, com dados disponíveis na resposta profissional.
  - Manter `ProfessionalSessionDetail` como detalhe; resolver duração numa função pura que valida timestamps.
  - Manter retry acessível, estado vazio claro, e paginação progressiva sem bloquear conteúdo do perfil.

- [x] **Passo 4: Executar testes unitários e E2E de perfil**
  - Rodar a suíte unitária do repositório e o E2E do perfil profissional.
  - Verificar em viewport móvel resumo, estado expandido e botão de próxima página.

---

### Tarefa 4: Anotações individuais, privadas e datadas

**Arquivos:**
- Modificar: `frontend/src/lib/professional-workflow.js`
- Modificar: `frontend/src/lib/professional-workflow.test.js`
- Modificar: `frontend/src/views/ProfessionalStudentPage.jsx`
- Modificar: `frontend/src/views/ProfessionalStudentPage.test.jsx`
- Atualizar E2E do perfil na tarefa 3, sem duplicar fixture.

**Interfaces:**
- `repo.studentNotes(studentId): Promise<Array<{id:string, body:string, createdAt:string}>>`
- `repo.addStudentNote({studentId, body}): Promise<{id:string, body:string, createdAt:string}>`
- Componente de notas lista mais recentes primeiro; enviar acrescenta a resposta retornada, limpa o campo somente depois de sucesso e mantém texto após falha.
- Proteção contra envio duplo enquanto a chamada está em andamento.

- [x] **Passo 1: Escrever testes falhos de DTO e fluxo de anotações**
  - Testar mapeamento e nomes/args de RPC, erro de autorização propagado e rejeição de resposta inválida.
  - Testar primeira nota e nota seguinte em ordem cronológica, com data/hora local.
  - Testar falha mantém o texto e envio em andamento impede duplicação.
  - Testar o texto legado é apresentado como entrada após migração; nenhuma anotação aparece em área do aluno.

- [x] **Passo 2: Rodar testes e confirmar falha esperada**

Run: `cd frontend; npx vitest run src/lib/professional-workflow.test.js src/views/ProfessionalStudentPage.test.jsx`  
Expected: falha porque a tela ainda usa o campo singular e substituível.

- [x] **Passo 3: Implementar contratos do repositório e UI**
  - Mapear e validar lista/entrada de nota.
  - Carregar notas junto com o perfil e histórico; submit chama RPC append, insere retorno no estado e preserva conteúdo em erro.
  - Exibir data e hora local com `createdAt`; desabilitar apenas submit durante envio e conservar acessibilidade.
  - Remover o editor/salvamento da nota singular da tela; conteúdo legado já foi convertido pela migração.

- [x] **Passo 4: Executar testes de notas e permissões**
  - Rodar Vitest de repositório/perfil.
  - Executar teste SQL da tarefa 1 para tentativa sem papel e vínculo encerrado.

---

### Tarefa 5: Aviso de plano não enviado e integração

**Arquivos:**
- Modificar: `frontend/src/management-workspace.css`
- Modificar: `frontend/src/views/ProfessionalStudentPlan.jsx`
- Modificar: `frontend/src/views/ProfessionalStudentPage.test.jsx`
- Modificar: `frontend/e2e/management.spec.js`

- [x] **Passo 1: Escrever teste de estilo/estado antes da alteração**
  - Com `dirty` ou revisão diferente, validar `data-pending=true`, classe e comportamento semântico de alerta.
  - Estado sincronizado deve conservar estilo de confirmação sem contorno vermelho.
  - Confirmar quadro visual compacto (padding, fonte e border em todos os lados) em largura móvel e desktop.

- [x] **Passo 2: Rodar teste e confirmar falha no indicador existente**

Run: `cd frontend; npx playwright test --project=desktop-chromium e2e/management.spec.js --grep "pending plan status"`  
Expected: falha porque CSS atual aplica somente cor de borda esquerda e tipografia herdada.

- [x] **Passo 3: Implementar estilo compacto usando tokens existentes**
  - Aplicar contorno completo vermelho para pendente, reduzir padding/line-height/font-size e preservar o estilo do estado enviado.
  - Manter as regras existentes de `dirty || revision !== sent_revision`.

- [x] **Passo 4: Executar verificação completa**
  - `cd frontend; npm test`
  - `cd frontend; npm run build`
  - `cd frontend; npx playwright test --project=desktop-chromium e2e/management.spec.js`
  - Rodar testes SQL/RPC e `git diff --check`; revisar todos os usos de histórico em páginas profissional/aluno para garantir que apenas a exibição pedida foi alterada.
  - Documentar falhas ambientais ou existentes sem ocultar seus nomes ou contagens.

---

### Tarefa 6: Revisão e conclusão

**Arquivos:**
- Revisar diff completo de migração, DTO, telas e testes.

- [x] Conferir critérios de aceite do spec item a item e confirmar ausência de regressão na tela pessoal `/history`.
- [x] Confirmar que migrações novas aparecem em `supabase/migrations` e seus testes em `supabase/tests`.
- [x] Confirmar que os testes de unidade, SQL, E2E e build foram executados e registrar resultado.
- [x] Fazer commits de implementação após aprovação do usuário sobre o plano e escolha do modo de execução.

