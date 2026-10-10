# Refatoração completa de UX/UI da gestão profissional e do aluno

## Objetivo

Transformar a gestão de profissionais, alunos, programas e vínculos em uma experiência mobile-first, simples e prática, preservando regras de negócio, contratos Supabase, rascunhos, versões, permissões, modo offline e rotas existentes.

## Princípios

- A área profissional usa quatro destinos principais: Início, Alunos, Programas e Mais.
- Convites pertencem ao contexto de Alunos; perfil e exercícios ficam em Mais/contexto secundário.
- Uma tarefa principal por tela não implica uma rota nova para cada edição.
- Pequenas edições permanecem na tela atual usando bottom sheet, action sheet ou modal.
- Listas compactas com divisores são o padrão para alunos, exercícios, dias, histórico e programas; cards ficam reservados a blocos realmente independentes.
- Ações secundárias ficam em menus contextuais; ações destrutivas continuam confirmadas.
- O caminho frequente usa o mínimo de toques, sem etapas intermediárias sem função.
- Todos os fluxos funcionam em 320, 360, 390 e 430 px, sem rolagem horizontal e com alvos de toque de pelo menos 44 px.
- Ações frequentes ficam em zonas alcançáveis com uma mão, respeitando safe-area e a navegação existente.

## Navegação

`ProfessionalLayout` continua sendo o shell contextual. Antes de criar qualquer barra nova, a implementação analisará a TabBar global existente e fará seus destinos assumirem Início, Alunos, Programas e Mais quando o shell e o estado de autenticação permitirem. Nunca haverá duas barras inferiores concorrentes.

`ProfessionalWorkspaceNav` continua útil como navegação contextual desktop ou em rotas complexas, mas poderá ser substituída por links de contexto no mobile. `/professional/invites` permanece acessível dentro de Alunos e por links antigos. A navegação do aluno mantém Meus profissionais, Materiais e Adicionar profissional.

## Início profissional

`ProfessionalDashboard` mostra apenas itens acionáveis derivados de dados reais: convites pendentes, alunos sem programa, atividade recente e alunos sem atividade quando essa informação existir. Não inventar métricas. Ações principais: Adicionar aluno e Criar programa. Loading, vazio, erro, disabled e offline reutilizam os estados existentes.

## Alunos e página do aluno

`ProfessionalStudents` vira uma lista pesquisável e paginada; o item inteiro é tocável e mostra avatar, nome, estado do vínculo, programa atual e última atividade quando disponível. Não haverá vários botões por item. Convites ficam em entrada ou filtro secundário.

`ProfessionalStudentPage` prioriza Resumo, Programa atual, Atividade recente e Evolução. Histórico e ações avançadas continuam acessíveis em seções secundárias. O caminho comum continua direto: Alunos → aluno → Gerenciar treino → dia → exercício → editar → salvar.

## Programas e editor

`ProgramLibraryPage` usa linhas compactas com programa, dias configurados, atualização e ações contextuais. Não mostra estatísticas que o backend não fornece.

O editor mantém `useProgramDraft`, `useProgramEditorResource` e os contratos atuais, apresentando Programa → Semana → Dia → Exercício sem obrigar uma nova rota para cada nível:

1. A tela do programa mostra metadados e sete linhas de dia, cada uma com exercícios ou descanso.
2. A tela do dia mostra exercícios resumidos como linhas: número, nome, prescrição curta e menu `⋮`.
3. Tocar no corpo do exercício abre um `ExerciseEditSheet` alto, de aproximadamente 75–90% da viewport, sobre a tela atual.
4. O sheet mostra Séries, Repetições/duração, Carga e Descanso. “Mais opções” revela RIR/RPE, superset, notas, unidade e demais configurações existentes.
5. Salvar ou cancelar fecha o sheet e mantém programa, dia, posição da lista, rolagem e rascunho.
6. `ExercisePickerSheet` permite busca, seleção múltipla, indicação dos itens adicionados e conclusão explícita, retornando ao mesmo dia e posição.
7. Duplicar, mover, substituir e remover ficam no menu contextual do exercício; mover para cima/baixo continua como alternativa acessível ao drag-and-drop.
8. Copiar treino, mover para outro dia, trocar dias e limpar dia ficam no menu contextual do dia, sem controles permanentes.

O rascunho continua salvo pela implementação atual. Uma `BottomActionBar` contextual fica acima da safe-area e da TabBar global, mostrando Rascunho salvo, Salvando ou erro e, quando aplicável, `[Revisar]`. A publicação segue Editar → Revisar → Publicar com o RPC existente.

## Vínculos e convites

`StudentProfessionalInvite` mantém RPCs e estados atuais, mas apresenta uma etapa por vez: código, profissional, confirmação e sucesso. O profissional acessa convites pelo contexto de Alunos. Estados pendente, aceito, expirado e cancelado continuam reais do backend.

## Experiência do aluno

`StudentProgramOverview` prioriza Próximo treino, CTA Iniciar treino, Esta semana, Programa e Histórico. `ProfessionalPrescription` apresenta nome, séries/repetições, carga e descanso em hierarquia clara; RIR/RPE, superset e notas só aparecem quando existem.

## Contexto e retorno

Editar exercício, adicionar exercício, alterar séries, abrir opções do dia, copiar treino e consultar detalhes retornam ao mesmo ponto: programa, dia, posição, rolagem e rascunho. Sheets e action sheets controlam foco, Escape, aria e retorno sem resetar contexto.

## Componentes e estilo

Reutilizar `ManagementLayout`, `ProfessionalLayout`, `ManagementUI`, `CompactList`, `SearchBar`, `EmptyState`, `Skeleton`, `ContextActions`, `BottomActionBar` e sheets existentes. Criar apenas peças pequenas quando necessário: linhas de aluno, programa, dia, prescrição e `ExerciseEditSheet`.

O `professional.css` será organizado por shell, listas, editores e estados, removendo regras comprovadamente sem uso. A identidade existente e os tokens atuais permanecem. A diferença virá de tipografia, alinhamento, densidade e divisores, sem gradientes ou sombras decorativas. Safe areas, foco visível e reduced motion serão preservados.

## Dados, permissões e testes

Nenhuma tabela, RPC, política RLS ou schema será alterado. Telas continuam usando repositórios e hooks existentes, nunca tabelas diretamente. Cada consulta mantém loading, vazio, erro, sucesso, disabled e offline quando aplicável.

Testes unitários cobrem componentes e reducers; integração cobre preservação de rota, conta, dia, posição e rascunho; Playwright valida 320, 360, 390, 430 px e desktop, incluindo profissional, aluno, convite, edição em sheet, adicionar múltiplos exercícios, revisão/publicação e retorno após troca de conta.

## Critério de aceite

Um profissional identifica pendências, abre um aluno, edita o treino, adiciona exercícios, revisa/publica e atribui um programa sem tela gigante, navegação duplicada ou perda de contexto. Um aluno identifica o próximo treino, inicia, consulta programa, lê prescrições e adiciona um profissional sem entender a arquitetura interna. Funcionalidades existentes continuam acessíveis e os testes atuais permanecem verdes.
