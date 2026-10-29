# Melhorias no espaço de acompanhamento profissional

**Data:** 2026-10-29
**Status:** Proposta para revisão
**Escopo:** Miniaturas dos modelos, histórico de execução do aluno, anotações privadas e aviso de plano pendente.

## Objetivo

Deixar os modelos e o acompanhamento do aluno mais informativos para o profissional: visualizar o foco muscular de cada treino-modelo, consultar execuções sem um botão de carregamento manual, registrar anotações privadas datadas e identificar rapidamente alterações de plano ainda não enviadas.

## Contexto atual

- A listagem de modelos chama `professional_programs_page`, que retorna metadados e contagem de treinos, mas não inclui a versão semanal necessária para calcular miniaturas musculares.
- O perfil do aluno mostra uma atividade resumida e um botão “Histórico”; somente depois do clique chama `professional_executions_page`. O componente `ProfessionalSessionDetail` já exibe prescrição, séries realizadas, cargas e duração quando o payload contém início e fim.
- Anotações são um único registro por vínculo profissional-aluno em `professional_student_notes`, com corpo mutável e `updated_at`. A tela mostra um campo de texto e salva por substituição, sem lista cronológica.
- O estado pendente do plano usa somente uma borda esquerda colorida, ocupando o estilo genérico de cartão.

## Comportamento proposto

### Modelos

Cada cartão da listagem de modelos mostra uma miniatura muscular correspondente aos exercícios da versão publicada mais recente. A miniatura usa o mesmo `RoutineMuscleThumb` e a mesma agregação de grupos musculares usados nos treinos pessoais. Modelos sem uma versão publicada ou sem exercícios mantêm um estado neutro discreto. A tela de detalhe e o editor de modelos não mudam.

### Histórico no perfil do aluno

Ao abrir o perfil, carregar a primeira página de execuções automaticamente, incluindo quando a seção “Histórico” estiver selecionada por link direto. Substituir a lista textual e o botão inicial por cartões de execução que mostram data, nome do treino, status e exercícios realizados em resumo. A expansão de um cartão reutiliza `ProfessionalSessionDetail` para apresentar os dados registrados de prescrição e execução, mais a duração total calculada a partir dos horários disponíveis (primeiro `payload.start/end`, com fallback a `startedAt/completedAt`).

A apresentação será conferida contra os cartões de treino e expansão de detalhes da tela pessoal `/history`, adaptada aos dados que o profissional tem permissão para ver. A consulta continua paginada pelo limite existente; um controle “Carregar mais” aparece somente quando houver páginas adicionais. Erros de carregamento ficam visíveis e permitem tentar novamente. Não fabricar valores ausentes em execuções antigas.

### Anotações privadas

Adicionar um registro imutável por envio, com identificador, profissional, aluno, texto e instante de criação. As anotações permanecem privadas e cada escrita/leitura valida profissional autenticado e vínculo ativo, seguindo o limite de 2.000 caracteres e os RPCs existentes.

Na migração, converter o texto legado não vazio em uma entrada datada com o `updated_at` original e limpar o campo legado na mesma transação, sem perder conteúdo. Na interface, o profissional escreve uma nova anotação numa caixa de composição; ao enviar, ela aparece na lista abaixo com data e hora local. O formulário limpa somente após confirmação de persistência. Erros mantêm o texto para nova tentativa. Não permitir editar ou apagar entradas nesta entrega.

### Aviso de plano pendente

Quando houver alterações não enviadas, exibir aviso compacto com contorno vermelho em todos os lados, texto menor e espaçamento reduzido. O estado enviado mantém o estilo atual. A condição visual continua ligada a `dirty || revision !== sent_revision`.

## Arquitetura e dados

- Estender o RPC paginado de modelos para incluir a semana da versão publicada mais recente em cada item, sem consultas por cartão. Manter limite, filtros, ordenação, contagens e metadados já existentes.
- Converter a semana serializada pelo RPC no formato de rotina já aceito por `RoutineMuscleThumb`; derivar uma carga agregada de todos os treinos da versão para a miniatura do modelo.
- Criar tabela sem acesso direto do cliente para entradas de anotação e RPCs de leitura/escrita sob `SECURITY DEFINER`, com `search_path` fixo, verificação de papel profissional e vínculo ativo. O RPC de escrita cria uma linha e retorna a linha criada; a leitura retorna as entradas mais recentes primeiro.
- Mapear execuções usando o contrato existente `toExecution` e renderizar o detalhe já existente, evitando duplicação da apresentação de séries.

## Segurança, privacidade e compatibilidade

- Alunos nunca recebem acesso às anotações privadas.
- Profissionais só podem ler ou escrever anotações do próprio vínculo ativo.
- Não conceder privilégios diretos de tabela a `anon` ou `authenticated`; expor somente RPCs autenticados.
- A migração preserva o texto legado, seu instante de atualização e o limite atual de caracteres.
- Execuções sem payload completo continuam visíveis; detalhes ausentes aparecem como indisponíveis, sem bloquear o cartão.

## Fora de escopo

- Editar, apagar, compartilhar ou sincronizar anotações privadas com o aluno.
- Alterar regras de execução, conteúdo de treinos, histórico pessoal do aluno ou permissões gerais do espaço profissional.
- Carregar todas as páginas de execução numa única resposta.

## Critérios de aceite

1. Cada modelo com versão publicada mostra a miniatura muscular derivada dos exercícios dessa versão; sem exercícios, o cartão não apresenta foco muscular falso.
2. Ao entrar no perfil do aluno, a página busca execuções sem exigir clique num botão “Histórico”.
3. Cartões de execução resumem data, treino e exercícios realizados; expandi-los mostra os dados realmente disponíveis, incluindo duração total quando existirem timestamps.
4. A paginação adicional só aparece quando a resposta informa `hasMore`; erros permitem repetir a busca.
5. Enviar uma anotação cria uma entrada separada, aparece abaixo com data/hora e sobrevive a nova entrada, recarregamento e reabertura do perfil.
6. Texto legado é migrado uma vez sem perda e vira uma anotação cronológica.
7. RPCs rejeitam leitura/escrita por usuário sem papel profissional ou sem vínculo ativo; a tabela não pode ser lida diretamente pelo cliente.
8. Aviso de rascunho não enviado tem contorno vermelho completo e dimensões/tipografia menores, sem alterar o estilo enviado.

## Verificação

Cobrir funções puras de adaptação dos dados, contrato do repositório/RPC, UI de modelos e perfil com histórico carregado, expansão e paginação, fluxo de notas com sucesso/erro e estados de aviso pendente/enviado. Verificar migração SQL e executar a suíte frontend e o build de produção.
