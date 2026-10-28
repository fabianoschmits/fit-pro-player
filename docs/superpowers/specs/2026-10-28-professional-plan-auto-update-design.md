# Atualização automática de planos profissionais

## Objetivo

Quando o profissional publica uma revisão do plano de um aluno, a versão passa a ser a prescrição ativa desse aluno automaticamente. A interface mostra apenas as mudanças acumuladas desde a última versão que o aluno reconheceu.

## Decisões

- `program_versions` continua sendo a fonte imutável de versões e `program_assignments` continua sendo a entrega por aluno.
- Uma migração acrescenta eventos de atualização por aluno e uma confirmação da última versão visualizada. O evento é criado junto com a publicação e a aplicação automática, dentro da mesma transação.
- Uma função interna reutilizável constrói o snapshot de agenda profissional. Ela altera somente `athlete_schedules`, `athlete_routines` e a seleção da biblioteca; execuções existentes continuam referenciando o `prescription_snapshot` já gravado.
- A API da biblioteca devolve a versão-base reconhecida, a versão atual e os dias afetados. O cliente calcula um diff semântico para apresentar texto humano, mantendo a interpretação perto da interface.
- O aluno confirma a atualização uma vez por plano. Confirmações consecutivas fazem o comparativo partir da última versão reconhecida e terminar na versão atual.

## Fluxos

1. Salvar rascunho altera somente `professional_plan_drafts`.
2. Enviar atualização publica a versão, atribui-a, registra o evento e aplica automaticamente se for o primeiro plano profissional ou uma atualização do plano profissional ativo.
3. A agenda atual passa a apontar para a nova versão. Uma sessão já iniciada não muda porque seu snapshot e versão pertencem à própria execução.
4. A biblioteca e a tela do plano recebem badges somente nos dias afetados. Ao abrir o comparativo, o aluno marca a versão atual como vista.

## Segurança e sincronização

As novas funções são `security definer`, checam vínculo ativo e identidade do aluno/profissional, usam a mesma trava consultiva da biblioteca e preservam a checagem de revisão do rascunho. O evento tem chave única por aluno, programa e versão, tornando reenvios idempotentes.
