# Perfil, convites pessoais e exclusão de modelos profissionais

**Data:** 2026-10-29  
**Status:** Proposta para revisão  
**Escopo:** Correção de salvamento do perfil profissional, código pessoal reutilizável, listagem dos convites gerados e exclusão segura de modelos.

## Objetivo

Permitir que profissionais salvem os próprios dados de perfil, tenham um código pessoal de convite baseado no nome e sobrenome que possam personalizar, consultem esse código junto dos convites gerados e removam modelos que ainda não sustentam dados de alunos.

## Diagnóstico do salvamento do perfil

A edição usa `professional_profiles.upsert(...).select('*').single()` diretamente do navegador. A interface converte SQLSTATE `42501` numa mensagem de falta de acesso, que é a mensagem relatada. Esse `upsert` combina as regras RLS de inserção e atualização da tabela. A tela não consegue distinguir qual regra ou proteção server-side recusou a operação, e os testes existentes simulam a resposta do repositório em vez de executar o contrato real do banco.

A correção proposta troca o `upsert` do fluxo de edição por um RPC `save_professional_profile` autenticado, que valida `auth.uid()` e o papel profissional, atualiza exclusivamente os campos editáveis do perfil próprio e devolve a linha persistida. O RPC nunca aceita nem atualiza `user_id`, datas de criação ou estado de verificação. O cliente deixa de ter privilégios diretos de `INSERT` e `UPDATE` nessa tabela; criação ocorre pelo RPC de provisionamento existente, e edição pelo novo RPC. Falhas de papel, entrada inválida e perfil inexistente usam erros estáveis; a interface mantém o formulário editável e mostra uma explicação compatível com cada erro. Isso elimina o caminho de upsert sujeito às políticas concorrentes de insert/update e testa a mesma fronteira usada pelo cliente.

## Código pessoal e convites individuais

O profissional recebe um único código pessoal reutilizável, separado semanticamente dos convites individuais já criados. Ele deriva do primeiro e do último nome do perfil, concatenados sem espaços, em letras maiúsculas sem acentos nem pontuação. Um nome de uma só palavra usa essa palavra. Se o código já existir globalmente, o banco tenta sufixos numéricos começando em `2` até encontrar um código livre. A verificação e a alocação ocorrem numa transação serializada para evitar colisões concorrentes.

O código pessoal pode ser editado por uma RPC autenticada, com normalização equivalente e resposta `code_taken` para conflito manual. Até a primeira edição manual, mudanças posteriores do nome regeneram o código. Depois de personalizado, o código permanece como escolhido pelo profissional. Na migração, cada perfil existente recebe um código pessoal sem alterar códigos já criados.

O código pessoal será um novo `kind` na tabela de convites existente, com unicidade de um registro por profissional e com a restrição global atual de `code`. Seu estado continua pendente para apresentação, mas a aceitação não o consome nem o ativa/revoga. Qualquer quantidade de alunos pode aceitar esse código, mantendo as regras atuais contra autoaceitação e duplicação de relacionamento. Os convites individuais gerados mantêm o ciclo atual de uso único, aceitação e revogação.

A tela de convites separa o código pessoal editável dos convites individuais. A seção de convites criados lista os estados pendente, aceito e revogado. Apenas convites individuais pendentes expõem a ação de revogação; o código pessoal nunca aparece como consumido ou revogável. QR, cópia de código, link e prévia do aluno usam o código ativo correspondente.

## Exclusão segura de modelos

A tela de detalhes de um modelo próprio terá uma ação explícita “Excluir modelo”, protegida por confirmação. A exclusão permanente só ocorre quando o modelo não tem registros dependentes de atribuição, execução ou histórico. O RPC valida o proprietário e tenta remover modelo e versões na mesma transação. Referências existentes bloqueiam a exclusão e retornam `program_in_use`; a tela explica que o profissional pode arquivar o modelo para removê-lo da seleção sem apagar histórico. A exclusão não arquiva nem altera dados de outros profissionais.

## Dados, autorização e compatibilidade

- Uma migração aditiva adiciona o tipo de convite pessoal e o indicador de personalização, preenche um código pessoal para cada perfil existente e cria apenas as funções necessárias.
- Profissionais não atualizam mais diretamente `professional_profiles`; o provisionamento e as edições passam pelas RPCs próprias, preservando a sincronização do nome com o código pessoal.
- Os RPCs de salvar perfil, editar código e excluir modelo são `SECURITY DEFINER`, usam `search_path` fixo, autenticam `auth.uid()` e verificam o papel/propriedade no banco.
- A unicidade global aproveita `professional_invites.code`; tentativas de atribuição automática coordenam com a criação aleatória de convites para evitar corrida entre os dois fluxos.
- Os convites individuais existentes, a experiência de aceitar convite, os dados de aluno e o arquivamento atual permanecem compatíveis.
- O código pessoal pode mudar por ação do profissional ou enquanto ainda segue automaticamente o nome. Alterar um código invalida links antigos daquele código.
- Excluir modelo sem vínculos remove os metadados e versões desse modelo; qualquer dependência histórica preserva o registro e encaminha para arquivamento.

## Critérios de aceite

1. Um profissional salva o próprio perfil por RPC e os campos persistidos são relidos ao sair e reabrir a edição.
2. O RPC rejeita usuário sem papel profissional, usuário diferente do proprietário, nome/especialidades inválidos e perfil inexistente sem alterar estado de verificação.
3. Perfis atuais e novos recebem um código pessoal derivado de primeiro + último nome, sem espaços; colisões automáticas recebem sufixo numérico.
4. Dois profissionais não podem ter o mesmo código, inclusive contra convites individuais aleatórios; concorrência não cria códigos duplicados.
5. O profissional pode editar o código pessoal; conflito manual é informado sem substituir o código existente. Depois de personalizado, mudar o nome do perfil preserva o código.
6. O código pessoal pode ser aceito por alunos diferentes sem ser consumido; convites individuais continuam de uso único e revogáveis enquanto pendentes.
7. A tela mostra o código pessoal editável e a lista de convites individuais gerados em seus estados atuais.
8. O profissional exclui um modelo próprio sem vínculos após confirmação; tentativa de excluir modelo usado preserva dados e oferece arquivamento.
9. Não-profissionais e proprietários alheios não conseguem gravar perfil, mudar código nem excluir modelo por RPC.

## Verificação

Cobrir repositório e interface do perfil, RPCs e backfill de códigos, colisões e concorrência, aceitação repetida do código pessoal, compatibilidade dos convites existentes, listagem por estado, exclusão sem dependências e recusa segura quando houver histórico. Executar testes SQL no harness local, testes unitários/E2E afetados, verificações Supabase e build.
