# FPP Professional — Fase 0: arquitetura e especificação

**Status:** proposta arquitetural aprovada para especificação; nenhuma implementação iniciada.

**Escopo desta fase:** auditar a arquitetura atual e definir a integração do FPP Professional com Supabase. Esta fase não cria tabelas, migrations, endpoints, telas, SDKs ou alterações no frontend/backend.

## 1. Objetivo e invariantes

O FPP Professional será um novo domínio relacional dentro do backend existente do Fit Pro Player. Ele permitirá que uma conta seja aluno, profissional, administrador ou uma combinação desses papéis, preservando o uso anônimo/local já existente.

Os invariantes principais são:

1. O estado legado `gym_state_v1` continua funcionando e não é migrado automaticamente.
2. Dados relacionais profissionais não entram no blob pessoal do aluno.
3. Toda autorização sensível é decidida no servidor e reforçada por RLS.
4. Uma `training_program_version` publicada é imutável.
5. Toda execução aponta para a versão realmente usada.
6. Um vínculo não concede acesso retroativo ao histórico pessoal do aluno.
7. Uma execução offline pode ser reenviada sem duplicação.
8. `service_role` nunca chega ao cliente.
9. Códigos de vínculo e códigos de compartilhamento de treino são domínios distintos.

## 2. Auditoria da arquitetura atual

### Identidade e autenticação

O modo self-hosted possui contas reais no backend Node, identificadas por um `user.id` aleatório e autenticadas por passkeys/WebAuthn. A sessão é um cookie HttpOnly assinado pelo backend, com expiração e versão de sessão para logout global. O objeto retornado ao frontend contém essencialmente `id`, `name` e `admin`.

Também existem modos sem conta: visitante web local, build estático/demo e build Capacitor. Neles não há identidade persistente nem sessão de servidor.

### Persistência

O estado pessoal é normalizado no Zustand e persistido em `localStorage` com a chave `gym_state_v1`. O build Capacitor replica o estado em arquivo nativo. No self-hosted, o estado sincronizado é salvo em um arquivo privado `state-{userId}.json`.

O arquivo contém perfil, rotinas, plano semanal, exercícios personalizados, pesos, treinos concluídos, estado ativo, preferências e medições corporais. O servidor remove `active` antes de persistir o estado remoto porque um treino em andamento é local ao dispositivo.

### Sincronização

A sincronização atual é de estado inteiro, usando `_ts`. Alterações locais são marcadas como dirty, enviadas com debounce e reenviadas após reconexão. Uma divergência ou upload obsoleto produz conflito `409`; o cliente preserva as duas cópias e exige escolha explícita entre estado local e remoto.

Essa estratégia não deve ser reutilizada como mecanismo de sincronização relacional do Professional. O novo domínio precisará de registros independentes, IDs gerados pelo cliente quando apropriado e operações idempotentes.

### Planos, treinos e histórico

Rotinas existentes vivem em `S.routines`, com atribuições semanais em `S.week` e exceções em `S.dayPlan`. Exercícios possuem prescrições de séries, repetições, tempo, cardio, carga, modo, aquecimento e superset.

Ao iniciar, o motor cria `S.active` com uma cópia da prescrição e linhas de séries. Ao concluir, grava um item em `S.workouts`, incluindo data, duração, entries, sets concluídos, valores realizados e dados de prescrição suficientes para exibição histórica. O histórico é pessoal e não possui atualmente um `ownerId` explícito dentro de cada registro; o ownership é garantido pelo arquivo associado ao usuário.

### Plataforma e regressão

O frontend é React/Vite/Zustand/React Router, com PWA, service worker, modo Capacitor, safe areas, temas e i18n. A implementação do Professional não deve alterar o fluxo atual de treino, o formato do estado legado, o modo offline ou as rotas existentes sem uma fase específica de integração e testes de regressão.

## 3. Arquitetura alvo com Supabase

O sistema terá dois domínios coexistentes:

```text
FPP legado
  localStorage / Capacitor
      -> gym_state_v1
      -> estado pessoal e histórico local

FPP Professional
  Supabase Auth
      -> identidade persistente
  Supabase PostgreSQL
      -> profiles, roles, vínculos, convites,
         programas, versões, assignments e execuções
```

O backend Node existente continuará sendo a fronteira segura para operações que exigem segredo, compatibilidade com a autenticação legada, auditoria, rate limiting e workflows privilegiados. O cliente poderá usar uma chave pública/anon do Supabase somente quando as policies RLS cobrirem integralmente a operação.

Não haverá microserviço separado nesta etapa. Supabase será a infraestrutura relacional e de contas; a integração ocorrerá dentro da aplicação/backend existente, com separação explícita entre o domínio legado e o domínio Professional.

## 4. Estratégia de identidade e transição de autenticação

A identidade relacional canônica do Professional será `auth.users.id`. Nenhum relacionamento usará email, nome ou username como chave.

A estratégia escolhida é híbrida e temporária:

1. Usuários atuais continuam podendo entrar com o fluxo WebAuthn existente enquanto o legado depender dele.
2. O Supabase Auth será a identidade necessária para recursos relacionais novos.
3. Um usuário autenticado no legado poderá iniciar um fluxo explícito de vinculação de conta. O backend verifica a sessão WebAuthn atual e associa, em operação controlada e auditável, a identidade legada à identidade Supabase.
4. Novos usuários poderão entrar pelo mecanismo que for definido para Supabase Auth na fase de integração; a decisão do provedor de credencial não será tomada na Fase 0.
5. Durante a transição, o backend resolverá a identidade interna a partir da sessão válida e de uma associação de migração, nunca por nome ou email informado pelo cliente.
6. Passkeys não serão removidas simplesmente pela adoção do Supabase. A descontinuação do fluxo legado só poderá ocorrer após cobertura de migração, recuperação e compatibilidade comprovada.

O relacionamento de transição deverá ser único por usuário legado e identidade Supabase, conter timestamps e ser auditável. Não haverá migração automática silenciosa.

## 5. Anônimo versus conta

O modo anônimo permanece válido para treinar, planejar e consultar o histórico local no dispositivo.

Conta será obrigatória para:

- criar perfil profissional;
- aceitar ou manter vínculo profissional;
- possuir alunos;
- criar/publicar programas relacionais;
- receber assignments profissionais;
- compartilhar resultados com um profissional;
- sincronizar dados relacionais entre dispositivos.

Quando um usuário anônimo receber um convite, o convite será preservado por um identificador temporário seguro. Após criar ou acessar uma conta, o sistema associará a conta à identidade autenticada e manterá o `gym_state_v1` local. Nenhuma etapa de conversão poderá limpar ou substituir o estado local sem confirmação explícita e estratégia de backup/reversão.

A associação do estado legado à conta será uma decisão de integração futura. O domínio Professional não presumirá que todo histórico local deva ser copiado para o Supabase.

## 6. Modelo relacional conceitual

Nomes abaixo são contratos conceituais; a normalização final será validada antes das migrations.

### Identidade

- `profiles`: `id` referenciando `auth.users.id`, `display_name`, `avatar_ref` opcional, timestamps.
- `user_roles`: `user_id`, `role` (`student`, `professional`, `admin`), timestamps e origem/auditoria quando necessário. Chave única `(user_id, role)`.
- `legacy_identity_links`: associação controlada entre o identificador legado e `auth.users.id`, com estado e timestamps.

`profiles` não conterá dados profissionais genéricos. Um perfil pode coexistir com vários papéis.

### Profissional e vínculos

- `professional_profiles`: `user_id`, `professional_name`, `bio`, especialidades, localização, registro profissional, status de verificação e timestamps.
- `professional_student_relationships`: `id`, `professional_id`, `student_id`, status, consent version, `created_at`, `accepted_at`, `revoked_at`, `revoked_by`.
- `professional_invites`: `id`, `professional_id`, `secret_hash`, status, expiração, criação, aceite e revogação.
- `workout_share_invites`: entidade independente para importar/copiar uma rotina; não possui poder de criar relacionamento.

Um aluno pode possuir vários profissionais. Cada vínculo tem escopo independente. A unicidade e as regras para vínculos ativos serão definidas por constraints e policies, não pelo frontend.

### Programação

- `workout_templates`: modelo pertencente a um profissional, com estado de arquivamento.
- `training_programs`: identidade lógica editável do programa e seu proprietário.
- `training_program_versions`: snapshot do programa, número/sequência, estado draft/published/archived, autor, publicação e conteúdo normalizado.
- `workout_days`: sessões pertencentes a uma versão.
- `exercise_prescriptions`: exercícios, ordem, séries, repetições, carga, tempo, modo, descanso, notas e extensões futuras.
- `program_assignments`: associação de uma versão publicada a um aluno, com profissional proprietário, vínculo, início, término, estado e versão selecionada.

Uma versão publicada não será atualizada destrutivamente. Alterações produzirão uma nova versão.

### Execução e feedback

- `workout_executions`: aluno, assignment, `program_version_id`, `workout_day_id`, client idempotency key, estado, início, fim e timestamps de sincronização.
- `exercise_executions`: execução, prescription snapshot/reference, resultados reais por série e timestamps.
- `student_feedback`: execução, dificuldade, nota curta e timestamps.
- `audit_events`: ações sensíveis, ator, alvo, contexto mínimo, resultado e timestamp.

Execuções concluídas são históricas. Correções administrativas, se algum dia necessárias, serão explícitas, auditadas e não apagarão silenciosamente o valor original.

## 7. Ownership e autorização

Cada tabela sensível terá ownership explícito ou uma relação transitiva verificável. O servidor não aceitará `professional_id`, `student_id`, `owner_id` ou role como autoridade vinda do cliente.

Regras essenciais:

- o aluno lê e altera apenas seus dados permitidos;
- o profissional lê somente alunos com relacionamento ativo e escopo autorizado;
- o profissional só edita programas/templates próprios;
- o profissional não altera execuções concluídas;
- um profissional não vê dados do vínculo de outro profissional;
- o histórico pessoal anterior ao vínculo permanece privado;
- o aluno decide consentimentos adicionais de compartilhamento;
- o usuário não pode inserir ou promover a própria role `admin`;
- operações administrativas sensíveis usam fluxo explícito, auditável e backend seguro.

## 8. RLS e backend seguro

RLS será requisito de todas as tabelas relacionais sensíveis. Para cada tabela, a especificação de implementação deverá definir separadamente `SELECT`, `INSERT`, `UPDATE` e `DELETE`.

As policies deverão usar `auth.uid()` e funções SQL pequenas, estáveis e testáveis para verificar:

- papel do usuário;
- ownership direto;
- relacionamento profissional-aluno ativo;
- consentimento e escopo do dado;
- imutabilidade de versões publicadas e execuções concluídas.

RLS não será substituído por filtros no React. O backend Node poderá executar operações de serviço usando `service_role` somente em ambiente seguro, com validação de autorização, payload mínimo e auditoria. A chave não será exposta ao frontend, bundle Capacitor, localStorage, logs ou repositório.

## 9. Convites

O código mostrado ao usuário poderá ter formato `FPP-7K4M2P`, mas o banco armazenará apenas uma representação segura do segredo. O código deve ser imprevisível, ter expiração, uso único quando aplicável e rate limiting.

O aceite será transacional: validar hash, status e expiração; verificar identidade autenticada; criar ou atualizar o vínculo; marcar o convite como usado; registrar auditoria. Duas tentativas concorrentes não poderão aceitar o mesmo convite.

Estados conceituais: `pending`, `accepted`, `rejected`, `expired`, `revoked`. Revogar um vínculo não apaga a linha nem o histórico associado.

O código de treino usa tabela, namespace e autorização diferentes. Ele pode importar/copiar uma rotina, mas nunca cria relacionamento profissional.

## 10. Versionamento e fluxo de programação

Um profissional edita um programa em draft. Ao publicar, o sistema cria uma `training_program_version` imutável. Um assignment aponta para uma versão específica, permitindo:

```text
Programa A: v1, v2, v3
João -> assignment v2
Maria -> assignment v3
```

Se João iniciar v2 e o profissional publicar v3, o treino em andamento continuará em v2. A próxima sessão poderá resolver v3 conforme as regras do assignment. Template, programa, versão, assignment e execução nunca serão tratados como sinônimos.

## 11. Offline, sincronização e idempotência

O motor existente continuará funcionando offline. A integração profissional sincronizará versões publicadas e assignments como dados próprios, sem depender do upload do blob inteiro.

Uma execução deverá receber um ID gerado no cliente e uma `idempotency_key` única por tentativa lógica. Retries após timeout deverão ser reconhecidos pelo servidor e retornar o mesmo resultado lógico, sem criar uma segunda execução.

O payload offline conterá a versão usada e snapshot suficiente da prescrição. Nova publicação, revogação ou mudança de assignment não altera um treino já iniciado. Conflitos de programação serão resolvidos por versão; conflitos de resultado serão tratados por IDs idempotentes e estados de execução, não por last-write-wins sobre o histórico.

Realtime não será requisito inicial. Polling, sincronização ao abrir o app e sincronização ao retornar online serão preferidos até que um caso de uso demonstre benefício claro de Realtime.

## 12. Segurança, credenciais e ambientes

Variáveis futuras, sem valores reais nesta fase:

- frontend: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`;
- backend seguro: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` quando necessário;
- deploy: variáveis separadas por ambiente;
- desenvolvimento, preview/staging e produção: projetos/dados Supabase separados.

Nenhum segredo será commitado. `service_role` nunca será usado em Vite, React, Capacitor ou localStorage. Migrations serão a fonte reproduzível do schema; alterações manuais no dashboard não serão a única fonte de verdade.

Devem ser mantidos rate limiting para convites, mensagens genéricas contra enumeração, logs sem segredos, validação de payload, proteção de sessão, headers de segurança e auditoria de ações sensíveis.

## 13. LGPD e retenção

O domínio deve documentar finalidade, base de consentimento, minimização, acesso, revogação, exportação futura, exclusão, anonimização e retenção. O vínculo encerrado permanece como registro mínimo necessário, mas o acesso operacional deve ser bloqueado.

O profissional não recebe automaticamente o histórico anterior do aluno. O compartilhamento retroativo, se criado no futuro, exigirá consentimento adicional e escopo explícito. Logs devem registrar ação e alvo sem armazenar segredos de convite ou dados desnecessários.

## 14. Migrações e deploy

O banco relacional será criado exclusivamente por migrations versionadas. Cada migration deverá poder ser aplicada em ambiente vazio e em ambientes separados sem depender de estado manual do dashboard.

O deploy deverá validar schema, policies, funções auxiliares e configuração por ambiente. Produção nunca será usada como banco de desenvolvimento. A adoção será incremental: primeiro identidade e profiles; depois relações; somente depois programas e execuções.

Não haverá migração automática de `gym_state_v1`, rotinas, histórico ou `active` na Fase 0.

## 15. Fases futuras

1. Supabase base, identidade, profiles e roles.
2. ProfessionalProfile.
3. Convites e relacionamentos.
4. RLS, autorização e backend seguro.
5. Prescrições profissionais.
6. WorkoutTemplate.
7. TrainingProgram e ProgramVersion.
8. ProgramAssignment.
9. Recebimento pelo aluno.
10. Integração com o motor atual.
11. WorkoutExecution e ExerciseExecution.
12. Offline sync e idempotência do Professional.
13. Painel profissional mobile.
14. Templates e duplicação.
15. Feedback.
16. Notificações.
17. Analytics profissional.

Cada fase deverá possuir objetivo, dependências, schema afetado, frontend/backend envolvidos, testes, riscos e critério de conclusão próprios.

## 16. Self-review da Fase 0

Foi verificado que a proposta:

- não confia no frontend para autorização;
- separa RLS, backend seguro e fluxo administrativo;
- não expõe `service_role`;
- não presume email/nome como chave;
- mantém WebAuthn durante transição híbrida;
- preserva usuários anônimos e seu estado local;
- não apaga `gym_state_v1` na conversão para conta;
- separa execução offline e upload idempotente;
- impede mutação de versões publicadas;
- impede acesso retroativo automático ao histórico;
- não depende prematuramente de Realtime ou Storage;
- mantém migrations reproduzíveis;
- separa desenvolvimento, preview/staging e produção;
- não cria tabelas, migrations, dependências, credenciais ou código executável.

Não foram encontrados placeholders de implementação que mudem o contrato arquitetural. A escolha exata do mecanismo de login do Supabase, o desenho final das policies SQL e o schema físico ficam deliberadamente para as fases de integração, quando houver credenciais e testes de ambiente.
