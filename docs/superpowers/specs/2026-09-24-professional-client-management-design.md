# FPP Professional Client Management — Design

## Objetivo

Evoluir a área profissional e a área de treinos recebidos para que profissionais consigam administrar clientes, programas e execuções com clareza, enquanto usuários comuns consigam acompanhar o programa profissional ativo, próximos treinos e histórico sem perder seus dados pessoais.

O fluxo deve preservar o modelo do projeto: React/PWA no frontend, Supabase Auth/PostgreSQL/RLS/RPCs no backend e sincronização da conta para o estado local do aplicativo.

## Diagnóstico do fluxo atual

- O dashboard profissional exibe IDs brutos em vez de uma ficha de cliente.
- Programas são publicados com um plano fixo de exemplo, sem editor semanal.
- A atribuição escolhe implicitamente o primeiro cliente ativo.
- Execuções são lidas em lista global do profissional, sem agrupamento por cliente/programa.
- A área do aluno mostra IDs de versões e atribuições, sem um resumo operacional do programa atual.
- O modelo de versões já permite preservar histórico; o frontend ainda não aproveita esse contrato.

## Decisões de produto

### Versões imutáveis

Uma versão publicada ou enviada nunca será editada retroativamente. Alterações no programa criam uma nova versão. O profissional revisa a versão e faz o envio explícito ao cliente. O aluno só troca o calendário ativo quando uma nova atribuição é aceita/aplicada.

### Cliente e privacidade

O profissional verá somente clientes ligados a ele e um resumo mínimo necessário para administração: nome de exibição, avatar quando disponível, data do vínculo, programa ativo, último treino e próximos treinos. Dados pessoais sensíveis, credenciais e snapshots completos nunca serão expostos por consultas genéricas.

### Estado do aluno

O aluno terá um programa profissional ativo separado visualmente do plano pessoal. Ao aplicar uma atribuição, o calendário profissional substitui os agendamentos ativos do calendário, preservando rotinas pessoais e histórico no estado local. A área recebida permitirá revisar o programa, consultar versões/execuções e desvincular ou trocar de profissional sem apagar histórico.

## Arquitetura de frontend

### Área profissional

Substituir o dashboard único por uma navegação interna com quatro áreas:

1. **Visão geral** — contagem de clientes, treinos recentes, próximos envios e alertas.
2. **Clientes** — lista pesquisável; cada cliente abre uma ficha com resumo, programa ativo, histórico de execuções e próximos treinos.
3. **Programas** — criação, edição de rascunho, organização semanal de exercícios, parâmetros de séries/repetições/carga/descanso e publicação de nova versão.
4. **Convites e atividade** — geração/revogação de convites e atividade filtrada por cliente/programa.

O envio terá seleção explícita do cliente, seleção da versão e confirmação com resumo dos dias e exercícios. O programa não será enviado automaticamente ao primeiro vínculo encontrado.

### Área do usuário

Reorganizar “Meus profissionais” em:

1. **Convites e vínculos** — preview, aceite e desvinculação.
2. **Programa atual** — profissional, programa, versão, status e calendário recebido.
3. **Próximos treinos** — próximos dias programados e ações de iniciar.
4. **Histórico** — execuções agrupadas por programa/versão, com status e datas.

O usuário continuará podendo usar seu plano pessoal quando não houver programa profissional ativo.

## Contrato de dados e backend

Manter as tabelas existentes de programas, versões, assignments e executions. Adicionar somente consultas/RPCs necessárias para projeções seguras e operações atômicas, com testes pgTAP e grants mínimos:

- resumo de clientes do profissional atual;
- detalhe de um cliente vinculado, com assignments/executions autorizados;
- criação/atualização de rascunho de programa;
- publicação de uma nova versão validada;
- atribuição explícita de uma versão a um cliente vinculado;
- resumo do programa ativo e histórico do aluno atual.

As operações deverão validar `auth.uid()`, vínculo ativo, ownership do programa e consistência entre `program_id` e `version_id`. Nenhuma RPC aceitará user id do cliente como autoridade para ultrapassar RLS.

## Editor de programas

O editor será baseado no catálogo de exercícios já existente no frontend, sem duplicar a base de exercícios. O profissional poderá:

- selecionar dias da semana;
- adicionar, remover e reordenar exercícios;
- editar séries, repetições, carga, modo, descanso e observações;
- revisar o resumo semanal;
- salvar rascunho;
- publicar nova versão;
- enviar a versão publicada para um cliente selecionado.

O payload semanal será validado antes da publicação, com limites equivalentes aos usados no estado local e sem aceitar IDs vazios ou campos não suportados.

## Segurança e compatibilidade

- Usuários comuns não receberão menus profissionais.
- Profissionais continuarão podendo usar o aplicativo pessoal.
- Um usuário pode possuir simultaneamente as capabilities de aluno e profissional.
- Todas as leituras de cliente/programa/execução permanecerão owner-scoped ou participant-scoped.
- O cliente nunca terá acesso a `service_role`, tokens privados ou snapshots de terceiros.
- O estado local e o snapshot da conta continuarão compatíveis com dados existentes.
- Migrações serão aditivas; nenhum histórico será apagado.

## Plano de verificação

### Testes automatizados

- repository: seleção explícita de cliente, validação de payload e projeções;
- componentes: estados vazio, carregamento, erro, mobile e desktop;
- aluno: aceite, programa ativo, próximos treinos, histórico e troca de versão;
- profissional: clientes, detalhe, editor, revisão, publicação e envio;
- pgTAP: ownership, vínculo, RLS, grants e rejeição de referências inconsistentes;
- regressão: `npm test`, build, i18n, checks Supabase e `git diff --check`.

### QA hospedado

Usar contas de teste existentes sem expor credenciais e sem remover dados de produção. Verificar o fluxo completo profissional → convite → vínculo → criação/edição/publicação → envio → aceite/aplicação → execução → histórico. Testar também usuário sem capability, profissional sem clientes e cliente com múltiplos programas/versões.

### Limitações assumidas

Validação de notificações, comportamento de teclado virtual, safe areas e performance em dispositivos físicos continuará sendo uma etapa manual após o deploy.

## Fora do escopo

- chat profissional/aluno;
- pagamentos ou planos comerciais;
- armazenamento de vídeos/documentos;
- realtime obrigatório;
- alteração retroativa de versões já enviadas;
- painel administrativo global da plataforma.
