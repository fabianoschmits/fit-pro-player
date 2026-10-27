# Etapa 3A — navegação e Início do aluno

## Objetivo

Transformar os destinos atuais do aluno em uma jornada previsível para planejar, treinar e acompanhar a evolução. Esta primeira entrega da Etapa 3 cria os destinos canônicos e melhora a página inicial sem trocar os contratos de dados concluídos na Etapa 2.

## Escopo desta entrega

O aluno terá cinco destinos principais: **Início**, **Plano**, **Treinar**, **Evolução** e **Conta**.

| Destino | Rota canônica | Conteúdo inicial |
| --- | --- | --- |
| Início | `/home` | Treino de hoje ou retomada, resumo semanal e acompanhamento relevante |
| Plano | `/plan` | Semana, rotinas pessoais, programa profissional ativo e biblioteca |
| Treinar | `/workout` | Sessão ativa ou início da sessão planejada |
| Evolução | `/progress` | Métricas, corpo e acesso ao histórico |
| Conta | `/account` | Dados pessoais, preferências, vínculos profissionais, suporte e privacidade |

As páginas existentes continuam sendo reaproveitadas nesta entrega. `Stats` passa a atender a rota e o vocabulário de Evolução; `More` passa a atender Conta. Não haverá duplicação de estado, consultas nem mutações.

## Rotas compatíveis

Os caminhos antigos permanecem utilizáveis e são redirecionados para o destino principal correspondente:

- `/stats` para `/progress`;
- `/more` para `/account`;
- `/history` para `/progress/history`;
- `/body-progress` para `/progress/body`;
- `/settings`, `/personal-data`, `/library` e rotas de profissionais continuam válidas, mas passam a ser acessadas por atalhos dentro dos destinos canônicos.

Os redirecionamentos preservam `search`, `hash` e `state` de navegação quando houver retorno contextual.

## Navegação

A barra inferior e sua variante desktop mantêm cinco posições. A ação central continua sendo Treinar, pois é a ação principal do produto. O item hoje chamado Estatísticas passa a se chamar Evolução e aponta para `/progress`; o item Mais passa a se chamar Conta e aponta para `/account`.

O item selecionado deve corresponder tanto às rotas canônicas quanto às antigas enquanto houver compatibilidade. Rotas de detalhe futuras (`/progress/history/:id`, `/library/:id` e `/workout/:id/summary`) deverão manter o item pai selecionado.

## Página Início

O Início apresenta no máximo três blocos de decisão, nesta ordem:

1. **Treino de hoje**: retomar uma sessão em andamento tem prioridade; sem sessão ativa, iniciar o treino planejado; sem plano, criar um treino ou carregar a sugestão inicial.
2. **Progresso da semana**: calendário/resumo já existente, sem criar uma fonte de dados paralela.
3. **Acompanhamento**: programa profissional ativo quando existir; caso contrário, orientação curta para criar um plano ou conectar um profissional.

Peso e treinos recentes permanecem acessíveis abaixo desses blocos, mas não competem com a ação principal. Cada bloco tem estado de carregamento, vazio e falha compatível com a origem dos dados.

## Conta e Evolução

Conta reorganiza as ações existentes em quatro grupos: Perfil, Preferências, Acompanhamento profissional e Ajuda/privacidade. Evolução conserva gráficos, medidas e histórico já existentes, apenas sob o novo título e rota. Nesta entrega, o histórico ainda pode usar a visualização atual; o detalhe de sessão por URL será a próxima fatia.

## Estados e acessibilidade

- Rotas redirecionadas não podem causar tela em branco nem perder o destino de retorno.
- Cada destino preserva cabeçalho, título de documento e item de navegação atualizados.
- Os botões principais têm rótulos claros, alvo de toque adequado e estado desabilitado apenas durante a ação correspondente.
- A interface mantém temas, redução de movimento, preferências de unidade e o rascunho de sessão da Etapa 2.

## Fora de escopo desta entrega

- Página de detalhe de sessão, detalhe de exercício e resumo final de treino;
- novos dados, tabelas, RPCs ou migrações;
- alteração de regras de sessão, plano ativo ou vínculos profissionais;
- check-ins, metas, avisos persistentes e experiência profissional da Etapa 4.

## Critérios de aceitação

1. A barra de navegação mostra os cinco destinos e seleciona corretamente cada rota canônica.
2. Links antigos chegam ao destino canônico sem perder contexto útil.
3. O Início prioriza continuar sessão, depois iniciar treino planejado e por fim orientar quem ainda não tem plano.
4. Evolução e Conta reúnem os atalhos existentes sem duplicar conteúdo ou estado.
5. O fluxo Início → Plano → Treinar → Evolução → Conta funciona em viewport móvel e desktop.
6. Testes de rota, navegação, estados do Início e regressões dos fluxos de treino existentes passam, assim como o build de produção.
