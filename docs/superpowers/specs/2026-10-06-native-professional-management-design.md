# Gestão profissional nativa — proposta de desenho

Data: 2026-10-06. Base: `00a2bb0`.
Status: **aprovado pelo usuário; implementação pendente**.
Inventário: `docs/superpowers/reports/2026-10-06-professional-management-inventory.md`.

## 1. Intenção

Transformar a gestão profissional em um espaço de trabalho para personal trainers no celular, preservando programas/versionamento, prescrição completa, vínculos, convites, atribuições, histórico, execução offline e isolamento de contas. A refatoração muda composição, navegação e fronteiras dos componentes, com extensões de dados explícitas para as capacidades solicitadas que não existem.

A imagem fornecida orienta hierarquia e densidade; não será copiada literalmente. Pessoas usam avatares do FPP, com iniciais quando indisponíveis. Miniaturas/animações reais permanecem nos exercícios. Mensagens, avaliações e outros módulos presentes apenas na referência não entram automaticamente no escopo.

## 2. Alternativas e escolha recomendada

1. **Workspace contextual, páginas focadas e navegação própria:** 4 destinos profissionais fixos no celular, sidebar discreta no desktop, um editor por treino e sheets para edições pequenas. Recomendado por atender uso frequente, deep links e ausência de faixas cortadas.
2. **Uma home com todas as funções em sheets:** reduz navegação inicial, mas mistura programa/aluno/versão e cria pilhas longas de overlays. Não recomendado para histórico e edição de semana.
3. **Sidebar/drawer em todos os dispositivos:** acomoda todos os destinos, mas exige abrir menu para cada troca frequente no celular. Usar sidebar apenas no desktop e menu contextual para destinos secundários.

## 3. Navegação

Na área profissional mobile haverá uma única barra de navegação: **Gestão · Alunos · Programas · Convites**. Quatro destinos com rótulos completos, sem overflow horizontal. Ícones pequenos somente nesses destinos e nas ações reconhecíveis. Perfil, catálogo e voltar ao FPP ficam no menu contextual do cabeçalho. Na home também há entrada clara para o perfil.

A barra pessoal global não aparece simultaneamente com a profissional. Treino pessoal em andamento continua acessível por ação global laranja **Retomar treino**, sem confundir a edição do programa com a execução pessoal. Fora da área profissional, a barra pessoal permanece como hoje. No desktop, a mesma árvore usa sidebar; o conteúdo não se torna uma grade de cartões.

Páginas de detalhe usam Voltar contextual para o pai, título compacto e `•••` quando existem ações secundárias. Não repetem um menu horizontal de seções. Filtros curtos podem ocupar duas linhas ou um sheet, sempre sem cortar rótulos. A semana aparece como 7 linhas verticais, não como 7 chips roláveis.

### Árvore proposta

```text
Área profissional /professional
├── Gestão: contagens, atenção, treinos de hoje, atividade e atalhos
├── Alunos /professional/students
│   └── :studentId
│       ├── Visão do aluno: programa, próximo treino, frequência e acessos
│       ├── Treino /training
│       ├── Atribuir ou trocar programa /assign
│       ├── Histórico /history
│       │   └── :executionId — prescrito x realizado
│       ├── Evolução /progress — execuções profissionais compartilhadas
│       └── Observações — edição em sheet, acesso na visão do aluno
├── Programas /professional/programs
│   ├── Novo /new — dados essenciais
│   └── :programId
│       ├── Semana publicada — 7 linhas, treino ou descanso
│       ├── Treino publicado /workouts/:day — consulta
│       ├── Rascunho da semana /edit
│       │   └── Treino em edição /edit/:day
│       ├── Versões /versions
│       │   ├── Consulta da versão /versions/:versionId
│       │   └── Comparação — seleção e revisão em tela própria
│       └── Atribuir — selecionar aluno e revisar versão exata
├── Convites /professional/invites
│   ├── Pendentes / Aceitos / Expirados / Cancelados
│   └── Novo ou compartilhar convite — sheet contextual
├── Perfil /professional/profile
│   └── Editar /edit
└── Exercícios /professional/exercises — catálogo profissional

Aluno /student/professionals
├── Meus profissionais + resumo compacto do programa ativo
├── Adicionar profissional /add — código, prévia e aceite
├── Treinos recebidos /materials — manter alias e recebimento exato
└── :professionalId
    ├── Apresentação
    ├── Treinos recebidos
    ├── Histórico
    └── Vínculo
```

As URLs novas são destinos de organização, não mudam quem pode consultar cada dado. Perfil/aluno/treino/histórico mantêm entradas equivalentes por aliases, redirects ou parâmetros compatíveis. `program`, `version`, `material` e `code` não se perdem nas transições. Na seleção da versão a interface indica qual versão está sendo enviada.

## 4. Composição por página

### Gestão

Header compacto com avatar/nome real do profissional, título e ação contextual. Resumo em linhas/grade tipográfica pequena com alunos ativos, atenção, programados hoje, programas em uso e convites pendentes. Disponíveis e em uso são conceitos distintos.

Atalhos Convidar aluno, Criar programa e Atribuir treino ficam imediatamente acessíveis, sem virar três cartões grandes. Atenção, Hoje e Atividade recente são seções planas com linhas clicáveis. Regras de atenção ficam na ajuda contextual; mensagens vazias direcionam à próxima ação. A última execução usada na atenção continua sendo da atribuição ativa atual; o feed histórico não substitui esse escopo após uma troca de programa.

Treinos de hoje distinguem **programado**, **em andamento** e **concluído**. Não inventar horário de atendimento, atraso clínico ou calendário de consultas. Métricas exatas vêm de agregação no banco, e resultados recentes têm limites/paginação explícitos.

### Alunos

Busca, filtro curto Todos/Com programa/Sem programa/Atenção e lista compacta. Linha: avatar existente, nome, programa atual, última atividade e status. Status textual, não apenas cor. Toque na linha abre aluno; `•••` expõe ações secundárias. Convidar permanece disponível em BottomActionBar ou CTA contextual, evitando duas cópias do mesmo botão.

Manter busca/filtros/posição ao voltar do aluno. Página preserva modo de selecionar aluno para uma versão específica e deixa isso visível no título/contexto.

### Gestão do aluno

Identidade compacta seguida de resumo de frequência e última atividade. Programa atual e próximo treino são linhas de navegação. Seções História, Evolução e Observações têm acessos claros; nenhuma precisa renderizar toda a prescrição dentro de um card.

Principal ação muda conforme contexto: **Prescrever treino** quando não existe programa, **Gerenciar treino** quando existe. Trocar programa/encerrar atribuição/vínculo ficam em ações contextuais com confirmação de efeitos. Editar um programa reutilizado deixa explícito que gera nova versão do modelo; alterar apenas para este aluno usa duplicação para novo programa antes da edição. Nunca modificar silenciosamente prescrições de outros alunos.

Frequência planejada e realizada aparecem separadas, com período claro. Evolução usa dados das execuções atribuídas já compartilhadas. Medidas pessoais permanecem privadas, conforme a seção 9.

### Programas

Lista exclusiva com nome, objetivo quando informado, quantidade de treinos semanais, alunos usando e última alteração. Ativos/disponíveis e arquivados com filtros legíveis. Quando um dado ainda não está preenchido, omitir ou apresentar estado real; não criar números/fotos fictícios.

Criar é a ação principal. Duplicar, editar dados, arquivar/restaurar e atribuir ficam no contexto da linha ou do programa. Duplicar cria programa independente e não copia atribuições de alunos. Restaurar não reativa atribuições encerradas.

### Programa e semana

Header com nome e status; objetivo/descrição ficam em seção curta e editáveis em sheet. Semana em 7 linhas: `Segunda · Peito + Tríceps · 6 exercícios`, ou `Quarta · Descanso`. Para versões antigas, usar nome do dia até que um nome seja definido num novo rascunho.

Toque em um treino abre sua lista de exercícios. Publicado é leitura; Editar semana cria/recupera rascunho a partir da versão mais recente. Versões e comparação ficam em destinos próprios. Atribuir versão publicada permanece direto e mantém o número da versão no fluxo.

### Editor de treino

Uma tela por treino/dia, com contexto do programa e rascunho. Lista compacta com miniatura, nome, `3 × 10`, carga/unidade e descanso. Animar apenas o exercício expandido por solicitação. Não manter dezenas de animações simultâneas.

Adicionar abre sheet de seleção com busca e filtros, seguindo a lista de Exercícios; permite múltiplas adições, preview por seta e botão Adicionar separado. Campo de busca e ação Concluir continuam acessíveis com lista rolando.

Toque na dose abre sheet de edição rápida com séries/reps/carga/descanso ou campos de tempo/cardio. Observação e parâmetros avançados (unidade, esforço, superset) ficam na mesma edição, em hierarquia secundária. Não criar nova página para cada parâmetro. Semântica completa de todos os campos atuais permanece.

`•••` do exercício permite duplicar/remover e mover; reordenação por drag pode complementar os controles acessíveis de mover para cima/baixo. Não depender apenas do gesto de arrastar. Limite 50 orientado pela interface. Remoção tem possibilidade de desfazer ou confirmação proporcional, sem bloquear toda edição.

Rascunho é persistido a cada alteração no dispositivo, por conta/programa. Voltar retorna à semana sem perder o dia. BottomActionBar do treino oferece Adicionar e Concluir treino; a publicação da **semana inteira** ocorre no resumo do rascunho, com revisão, não como publicação isolada do dia. Cancelar, copiar/trocar dias e comparação continuam disponíveis em contexto; copiar sobre dia ocupado confirma.

### Atribuição

Entrada pode partir de aluno, programa ou home. No aluno, selecionar programa e versão; no programa, selecionar aluno e revisar. Uma etapa final mostra aluno, programa, versão, semana resumida e efeito da substituição. Enviar fica fixo e acessível. Nenhum envio acontece ao apenas escolher item.

Após sucesso, mostrar confirmação e programa atualizado sem perder a navegação atual. Retentativa para a mesma versão usa idempotência existente. Guardas preservam seção/conta quando o usuário navega durante request.

### Convites

Lista pequena com status, criação/aceite/validade quando existem e ação contextual. Filtros Pendentes/Aceitos/Expirados; Cancelados preserva convites revogados, em filtro de mais estados se necessário para não apertar navegação.

Novo convite gera um único código e abre sheet com copiar código/link e compartilhar nativo. Reenviar significa compartilhar o convite pendente novamente: não haverá envio automático de email/WhatsApp. Convite expirado oferece Criar novo convite. Não alterar validade de convites antigos nem inventar data de expiração: mostrar Sem prazo quando expires_at é nulo.

### Perfil e catálogo

Perfil de leitura compacto, edição agrupada, onboarding/registro/verificação preservados. Avatar do catálogo ou iniciais conforme dado autorizado disponível.

Catálogo profissional usa a base real de exercícios e o estilo de Library, com busca/filtros/preview. Adicionar ao programa pede programa/treino ou respeita contexto já aberto. Exercícios personalizados locais da área pessoal continuam funcionando nela; compartilhamento de um novo catálogo profissional remoto não é inferido desta refatoração.

### Experiência do aluno

Refinar apenas profissionais/treinos recebidos com seções/listas equivalentes. Apresentação, programas recebidos, histórico e vínculo ficam em páginas claras/links verticais, sem segunda faixa rolável. Material histórico abre a atribuição exata; não altera rotina atual. Iniciar/Retomar continua conectado ao executor pessoal e à atribuição ativa correta.

## 5. Linguagem visual

- Fundo preto/grafite e superfícies um grau mais claras; texto principal branco e secundário cinza. Preservar suporte ao tema claro existente.
- Teal para ações e seleção no workspace profissional; laranja reservado a ações globais de execução como Retomar treino. Tokens locais, sem mudar --acc global para todo o app.
- Manter fonte do FPP; header 18–20px, seção 14–16px, nomes de linha 13–14px, metadados 11–12px com contraste. Campos de formulário mobile em tamanho legível para teclado sem zoom indesejado.
- Escala de espaço 4/8/12/16/24; radius moderado 8–12; divisores de baixo contraste; cards somente quando representam um bloco real, nunca card dentro de card.
- Alvos pelo menos 44px; safe-area inferior; barra de ações sem sobrepor teclado, lista ou navegação; foco visível; texto longo quebra ou expande sem esconder informação crítica.
- Estados busy/empty/error/success consistentes; motions curtas funcionais e respeitando preferências de movimento.

## 6. Componentes e fronteiras

Reaproveitar AppHeader e controles existentes; novas apresentações especializadas isoladas ao feature:

| Componente | Responsabilidade |
|---|---|
| `ProfessionalLayout` / shell contextual | Um header, uma navegação e área de conteúdo; política para ação global de treino |
| `SectionHeader` | Título compacto e ação textual, sem envelope de card |
| `CompactList` | Lista semântica, divisores, loading/vazio e paginação |
| `StudentRow` | Identidade/avatar e dados reais do aluno; callback/link contextual |
| `ProgramRow` | Resumo do programa e ações secundárias |
| `WorkoutRow` | Nome/dia/descanso/quantidade e navegação do treino |
| `ExercisePrescriptionRow` | Miniatura, resumo de dose e editar/reordenar |
| `StatusBadge` | Texto e estado sem depender só da cor |
| `EmptyState` | Próxima ação útil e mensagem curta |
| `SearchBar` | Busca/limpar, rótulo e teclado correto |
| `FilterChips` | Filtros com quebra ou sheet, sem faixa horizontal cortada |
| `BottomActionBar` | Ação principal com safe-area, teclado e espaço reservado |
| `ContextActions` | Menu `•••` em sheet mobile/popover adequado desktop |
| `PrescriptionSheet` | Edição rápida completa de um exercício |
| `ExercisePickerSheet` | Catálogo/preview/adição múltipla |

Hooks de domínio/leitura isolados das views: resumo da gestão, biblioteca paginada, aluno, programa/versões, convites e rascunho semanal. Repositórios continuam como fronteira do Supabase. `useProgramDraft` compartilha a semana entre resumo e tela do dia; não guarda estado apenas no componente que desmonta.

Preservar geração de requests, identidade da conta, pending, timeout, retry e retorno do foco em cada sheet. Não criar dois controladores independentes de histórico/body-scroll nem duplicar a reconciliação de atribuição do App/store.

## 7. Extensões mínimas de dados

Não basta reestilizar as coleções atuais para cumprir todos os requisitos.

1. Projeções/RPC agregadas e paginadas caller-scoped para contagens exatas, agenda do dia, resumos de programas e evolução profissional. Parâmetros de período/timezone definidos para evitar mudança de data por UTC. Agregação não abre leitura de snapshots pessoais.
2. Objetivo opcional e limitado no programa. Continuar aceitando programas antigos sem objetivo.
3. Nomes/metadados dos treinos associados à **versão publicada**, separados do JSON dia → array de exercícios. Não reinterpretar nem regravar as versões antigas. Propagar nomes ao DTO, rotina atribuída e snapshot histórico quando aplicável.
4. Duplicação transacional de programa próprio com a prescrição escolhida; programa novo independente, sem alunos copiados, arquivamento de origem não se transfere automaticamente.
5. Observação privada do profissional por aluno/vínculo, limitada e editável por RPC protegida. Notas da prescrição continuam sendo instruções compartilhadas com o aluno; não confundir esses dados. Leitura/escrita limitada ao profissional titular com vínculo ativo; revogação não abre acesso futuro a dados pessoais.
6. Ler validade/status/aceite de convites e derivar expirado; manter convites atuais sem prazo. Compartilhar novamente usa infraestrutura existente e depende de ação explícita do profissional.

As migrations serão aditivas, com validação, grants e RLS próprios. Todo contrato novo terá testes de outra conta, ausência de sessão, vínculo revogado, ownership, limites e compatibilidade. Não usar service key no browser. Manter uma única atribuição ativa global por aluno e sem alteração automática de versões atribuídas.

Não inclui periodização multissemanal, mensagens, agenda de consultas, cobrança, avaliações clínicas, upload de arquivos ou compartilhamento de exercícios personalizados remotos como consequência da imagem.

## 8. Compatibilidade e matriz de preservação

Antes de retirar uma tela/componente, mapear seu substituto e manter suas ações, estados e deep links. Não retirar compare/archive/restore/copy/swap/advanced/rest/cardio/outbox porque são menos visíveis no desenho.

Os caminhos antigos de edição, queries de seções, convite e material continuam funcionais por redirect compatível, inclusive em notificações e links já compartilhados. Redirect preserva identidade de programa/versão/atribuição. Autorizações e domínio prevalecem sobre o layout novo.

Arquivar, encerrar atribuição e desvincular continuam exigindo confirmação com efeito explícito. Publicar permanece separado de atribuir. Visualizar versões históricas permanece separado de iniciar execução.

## 9. Medidas pessoais

As medidas existem na área pessoal, mas não são compartilhadas com profissionais no contrato atual. Foi perguntado ao usuário se deseja manter essa fronteira ou incluir compartilhamento opcional com consentimento.

Base aprovada: manter medidas pessoais privadas; mostrar evolução das execuções profissionais já compartilhadas. Não houve autorização específica para compartilhar medidas. Uma futura mudança exige consentimento/revogação e contrato próprio. Não ler account_snapshots de outros usuários como atalho.

## 10. Critérios de aceite e verificação

- Todas as ações do inventário têm destino novo ou compatível e estados equivalentes.
- Nenhum menu profissional requer scroll horizontal; cabeçalho, rótulos, ações e dias são legíveis em iPhone pequeno.
- Um profissional cria programa, edita um dia, adiciona múltiplos exercícios, ajusta doses e publica a semana sem preencher uma página de formulários gigantes.
- Draft sobrevive ao voltar/recarregar; cancelar/falha não perde dados; conta trocada não reutiliza rascunho/leitura indevida.
- Atribuir desde home/aluno/programa funciona com versão exata, revisão e confirmação, sem substituir programa por simples navegação.
- Aluno vê e executa só sua atribuição ativa; histórico preserva prescrito versus realizado e não muda sua rotina ativa.
- Convites pendentes/aceitos/expirados/cancelados são derivados de dados reais; código compartilhado e aceite após login/onboarding continuam operacionais.
- Totais e períodos são verdadeiros, sem tratar lista limitada como contagem global.
- Nenhuma nova capacidade reduz RLS ou dá acesso a snapshots pessoais.
- Tema escuro e claro, nomes longos, vazios, erro/retry, keyboard/focus, safe-area, teclado aberto e retorno de sheets conferidos.

Verificação: scripts existentes de testes, builds, idiomas e Supabase, além de SQL em banco descartável para migrations e novos contratos. O projeto não oferece lint/typecheck atualmente; reportar indisponibilidade, não alegar aprovação. Não adicionar um novo sistema de tooling como condição artificial da refatoração.

Playwright: iPhone 375/390/393/430 e desktop 1280/1440; testar todas as entradas e ações do inventário. Chromium em viewport iPhone valida layout, não Safari nativo; executar WebKit se disponível e identificar qualquer limitação.

## 11. Handoff

Após revisão deste desenho, elaborar o plano escrito com tarefas por página, contratos e ordem de integração. A ordem lógica será infraestrutura de navegação/componentes e dados, gestão/alunos, programas/semana/editor, atribuição/histórico, convites/perfil/catálogo, experiência de treinos recebidos e verificação final. Essa ordem não autoriza implementar antes da revisão nem pular testes dos contratos.
