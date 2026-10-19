# Etapa 1 — navegação e contratos do produto

## Objetivo

Reorganizar o Fit Pro Player em torno do ciclo planejar → treinar → acompanhar → ajustar, sem aumentar a quantidade de decisões na tela. Esta especificação define a arquitetura de informação, o comportamento responsivo e os contratos de produto que as etapas de dados e frontend devem respeitar.

## Decisões de produto

1. O uso real exige conta. A demonstração permanece separada, com dados descartáveis e uma ação clara para criar conta; ela não simula sincronização.
2. O servidor será a fonte oficial. O único rascunho local de negócio será o treino em andamento e seus envios ainda não confirmados.
3. Um aluno pode manter vínculos com vários profissionais, mas apenas um programa de treino fica ativo. Materiais dos demais permanecem consultáveis. Trocar o programa ativo exige escolha explícita do aluno.
4. Um profissional acessa somente perfil compartilhado, programa que prescreveu, execuções relacionadas ao vínculo, check-ins compartilhados e suas próprias notas privadas. Notas privadas nunca entram no payload do aluno.
5. Web e aplicativos nativos compartilham as funcionalidades essenciais. Recursos do dispositivo, como notificações locais, podem variar e devem aparecer como capacidade adicional.

## Direção visual

O produto deve parecer um instrumento de treino: direto, legível durante esforço físico e preciso ao revisar dados. A silhueta muscular e a sessão do dia são os elementos reconhecíveis; não acrescentar gradientes decorativos, dashboards de cartões iguais ou novas famílias tipográficas.

### Tokens preservados

- Fundo escuro: `#000000`; superfície elevada: `#0e0e10`.
- Fundo claro: `#eef2f6`; superfície clara: `#f6f8fb`.
- Ação principal: verde-petróleo `#0F8B8D`; foco e ação usam o mesmo token `--acc`.
- Texto principal: `#ffffff` no escuro e `#0f172a` no claro.
- Estados: vermelho para falha/destruição, laranja para atenção e azul para informação.
- Tipografia: pilha nativa atual. Números de séries usam algarismos tabulares; títulos permanecem em sentence case.

### Layout

- Aluno: coluna central de até 720 px, com ação do dia visualmente dominante e blocos separados por ritmo vertical.
- Profissional: até 1232 px, barra lateral a partir de 900 px e navegação horizontal rolável abaixo disso.
- Alinhamento principal à esquerda. Centralização é reservada para estados vazios curtos e confirmações.
- Um bloco pode receber superfície elevada quando representa uma ação atual. Listas e históricos usam linhas/divisores para evitar uma coleção de cartões idênticos.

## Navegação do aluno

### Barra principal

| Item | Rota canônica | Responsabilidade |
| --- | --- | --- |
| Início | `/home` | Ação de hoje, progresso semanal e avisos acionáveis |
| Plano | `/plan` | Agenda, treinos pessoais, programa ativo e biblioteca |
| Treinar | `/workout` | Sessão ativa ou escolha de sessão |
| Evolução | `/progress` | Resumo, histórico, corpo e desempenho |
| Conta | `/account` | Perfil, profissionais, preferências, privacidade e suporte |

O botão Treinar continua destacado por ser uma ação, não um repositório de conteúdo. A aba ativa deve permanecer correta nas rotas filhas.

### Mapa de rotas

```text
/home

/plan
├─ /plan/routines/:routineId
├─ /plan/program
└─ /library
   └─ /library/:exerciseId

/workout
└─ /workout/:workoutId/summary

/progress
├─ /progress/history
│  └─ /progress/history/:workoutId
├─ /progress/body
└─ /progress/exercises/:exerciseId

/account
├─ /account/profile
├─ /account/professionals
│  └─ /account/professionals/:professionalId
├─ /account/settings
├─ /account/privacy
└─ /support
```

Compatibilidade durante a transição:

| Rota atual | Destino |
| --- | --- |
| `/stats` | `/progress` |
| `/history` | `/progress/history` |
| `/body-progress` e `/stats/body-progress` | `/progress/body` |
| `/more` | `/account` |
| `/personal-data` | `/account/profile` |
| `/settings` | `/account/settings` |
| `/student/professionals/*` | `/account/professionals/*` |
| `/plan/r/:id` | `/plan/routines/:id` |

Links antigos usam redirecionamento com substituição de histórico. Notificações e links compartilhados apontam para rotas canônicas assim que cada destino existir.

### Wireframe móvel

```text
┌──────────────────────────────┐
│ Hoje                 avatar  │
│ segunda, 19 de outubro       │
├──────────────────────────────┤
│ TREINO DE HOJE               │
│ Push                         │
│ 6 exercícios · peito · tríceps│
│ [ Começar treino ]           │
├──────────────────────────────┤
│ Esta semana            2 / 3 │
│ S  T  Q  Q  S  S  D          │
├──────────────────────────────┤
│ Acompanhamento               │
│ Programa atualizado          │
│ Ver alterações               │
└──────────────────────────────┘
 Início Plano  ●  Evolução Conta
```

O Início exibe no máximo três regiões: sessão atual, semana e acompanhamento. Peso e gráficos detalhados migram para Evolução; o Início pode mostrar somente uma linha de progresso quando ela exigir ação.

### Evolução

```text
Evolução
[Resumo] [Histórico] [Corpo]

Resumo
• frequência no período
• exercícios em evolução
• peso/meta, quando configurados

Histórico
[buscar treino ou exercício]
[30 dias] [90 dias] [Tudo]
lista cronológica paginada
```

As seções são rotas ou links com estado persistente na URL, não abas que escondem páginas inteiras sem endereço. O detalhe de sessão deixa de ser uma sheet longa.

### Conta

```text
Conta
[avatar] Fabiano
         Ver perfil

Perfil e acompanhamento
  Dados pessoais
  Meus profissionais

Aplicativo
  Preferências
  Notificações
  Privacidade e dados

Ajuda
  Suporte
  Sobre
```

“Mais” deixa de ser o nome de um destino. Biblioteca sai desse menu e passa a pertencer ao Plano.

## Navegação profissional

Os destinos principais serão Visão geral, Alunos e Programas. “Convidar aluno” é uma ação dentro de Alunos e um atalho contextual no painel. Perfil profissional fica no menu de conta.

```text
Desktop
┌─────────────┬────────────────────────────────────┐
│ Visão geral │ Alunos que precisam de atenção    │
│ Alunos      │ ─ Ana · 8 dias sem treinar        │
│ Programas   │ ─ Bruno · sem programa ativo      │
│             │                                    │
│ Conta       │ Agenda de hoje | Atividade recente │
└─────────────┴────────────────────────────────────┘

Aluno / Ana Souza
[Resumo] [Plano] [Evolução] [Acompanhamento]
```

No celular, a navegação do workspace fica horizontal sob o cabeçalho; o conteúdo continua em uma coluna. Nenhuma ação crítica depende de hover.

### Página do aluno

- Resumo: objetivo compartilhado, programa ativo, adesão e próxima ação.
- Plano: versão atribuída, prévia e ação de trocar/encerrar.
- Evolução: sessões, frequência e métricas compartilhadas.
- Acompanhamento: check-ins e notas privadas. Cada tipo tem título e regra de visibilidade.
- Vínculo: ações de encerrar ficam no menu secundário e exigem confirmação com consequência explícita.

## Estados de tela

Toda página que consulta servidor implementa cinco estados no mesmo espaço de conteúdo:

| Estado | Comportamento |
| --- | --- |
| Carregando | Skeleton com a estrutura aproximada; mantém cabeçalho e navegação |
| Vazio | Explica o que aparecerá e oferece uma ação real |
| Falha | Mensagem específica e “Tentar novamente”; mantém dados antigos identificados quando disponíveis |
| Sem permissão | Explica que a conta atual não possui acesso e oferece retorno seguro |
| Conteúdo | Informa atualização pendente ou dado desatualizado junto do bloco afetado |

Status de gravação usa “Salvando”, “Salvo”, “Aguardando envio” e “Não foi possível salvar”. Toast não é o único retorno de uma mutação.

## Contrato da sessão de treino

- O servidor cria a sessão e retorna `sessionId`, `revision`, prescrição congelada e um `writerToken` da instância ativa.
- Cada alteração tem `operationId` estável e `expectedRevision`.
- O rascunho local contém somente conta, sessão, token, revisão e operações ainda não confirmadas.
- Ao assumir em outro dispositivo, o servidor emite novo token. Operações posteriores do token anterior são recusadas e mantidas para exportação/diagnóstico, sem sobrescrever a sessão.
- A conclusão é idempotente por `operationId`. O resumo só informa “salvo” após confirmação.
- Sessão expirada ou usuário diferente não reutiliza o rascunho automaticamente.

## Contrato de programa e vínculos

- Rascunho pertence ao profissional e pode ser salvo sem afetar alunos.
- Publicação cria versão imutável.
- Atribuição aponta para uma versão e não altera o histórico.
- Se outro profissional já mantém o programa ativo, o aluno recebe uma solicitação de troca com origem, versão e consequência. Recusar preserva o programa atual.
- Encerrar vínculo remove acesso futuro e encerra atribuições daquele vínculo; prescrições históricas conservam um snapshot sem reabrir acesso aos dados atuais.
- Lista de alunos, programas e execuções usa RPCs paginadas já existentes após validar o contrato de resposta e as políticas de acesso.

## Critérios de aceitação da Etapa 1

1. Cada recurso essencial do roteiro possui exatamente um destino principal.
2. Rotas antigas têm destino canônico definido.
3. Os fluxos aluno independente, aluno vinculado e profissional que também treina cabem na navegação sem trocar de conta.
4. Mobile e desktop possuem hierarquia equivalente, com adaptação de layout documentada.
5. Estados de rede, permissão, vazio e erro estão definidos para todas as páginas remotas.
6. Sessão, programa ativo, múltiplos vínculos e dados compartilhados possuem regras sem decisão pendente.
7. A Etapa 2 pode criar contratos de banco e frontend sem inferir decisões de produto.

## Revisão contra o briefing

A primeira direção poderia cair em um painel genérico cheio de cartões métricos. Ela foi reduzida para uma ação de treino dominante, listas com divisores e a silhueta muscular como linguagem própria do Fit Pro Player. O verde-petróleo, os temas e a tipografia existentes permanecem; a mudança está na hierarquia e no vocabulário. Isso diminui o risco visual e deixa espaço para o executor e o mapa corporal continuarem sendo os elementos memoráveis.
