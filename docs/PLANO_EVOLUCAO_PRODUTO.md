# Plano de evolução do Fit Pro Player

Data: 19/10/2026. Status: proposta de produto e arquitetura para orientar a construção; funcionalidades abaixo não estão implementadas por este documento.

## 1. Direção do produto

Objetivo: tornar simples o ciclo planejar → treinar → acompanhar evolução → ajustar o próximo treino, para o aluno e seu profissional. Cada funcionalidade deve ter um lugar previsível na interface e um resultado verificável.

Premissas adotadas: foco inicial em treino individual e acompanhamento profissional; uso prioritário no celular para alunos e também no desktop para profissionais; dados atuais de teste podem ser descartados; não há exigência de migrar registros legados. Isso permite um modelo novo, mas não autoriza apagar indiscriminadamente serviços ou bases remotas.

Proposta: servidor como fonte principal, conta obrigatória para uso real, demonstração separada, interface organizada por tarefa e recuperação local limitada ao treino em andamento. Preservar identidade visual, componentes e recursos úteis existentes. Mudanças de navegação devem vir acompanhadas de redirecionamentos de links internos e notificações.

## 2. Estado real e pendências

A inspeção foi de código, rotas e documentação. Não representa auditoria visual em dispositivos nem validação de produção.

- Existem início, plano, executor, estatísticas, histórico, biblioteca, evolução corporal, conta, configurações, suporte, área profissional e console administrativo.
- A navegação do aluno tem Início, Plano, Treinar, Estatísticas e Mais. Histórico e evolução corporal também estão em Mais, dificultando a organização conceitual.
- A área profissional já tem painel, alunos, programas, convites e perfil. Não precisa ser reconstruída do zero.
- O adaptador profissional já oferece resumo do painel, paginação de alunos/programas/execuções, duplicação de programas e notas privadas. Telas inspecionadas ainda usam consultas antigas em parte desses fluxos. Reaproveitar após validar contratos e permissões.
- Offline envolve snapshots da conta, cache de rotas/mídias, dados locais de convidado, espelho nativo e fila de eventos. Remover apenas o botão de download não remove essa arquitetura.
- O service worker também atende notificações e atualização do aplicativo; removê-lo integralmente teria efeitos além do offline.
- Correções de histórico vazio, altura com vírgula e inclusão de exercício foram consolidadas e verificadas na Etapa 0.
- Kg/lb e concorrência entre abas foram especificados, mas ainda não implementados. As quinze mensagens adicionais de localização foram concluídas na Etapa 0.

O contrato de integridade foi esclarecido: `displayUnit` é a preferência de exibição, `massUnit: 'kg'` identifica a representação canônica e `stateSchemaVersion` identifica o formato persistido. Nunca reconverter um estado canônico só porque a exibição está em lb. Como os dados atuais são de teste, estados legados sem esses marcadores podem ser reiniciados em vez de sofrer conversão heurística.

## 3. Decisão sobre offline

| Alternativa | Benefício | Custo ou perda | Decisão proposta |
| --- | --- | --- | --- |
| Offline completo | Usar boa parte do aplicativo sem internet | Sincronização ampla, conflitos, múltiplas cópias, cache e suporte | Retirar do escopo do produto |
| Online estrito | Menor complexidade local | Queda de rede pode interromper o registro do treino | Não recomendado para o executor |
| Online com recuperação de sessão | Dados centrais consistentes e recuperação do treino aberto | Pequeno mecanismo de rascunho e reenvio | Recomendado |

Contrato proposto:

- Entrar, carregar um novo treino, editar/publicar programas, gerenciar alunos e consultar dados atualizados exigem acesso ao servidor.
- O treino já carregado pode continuar registrando séries quando a rede falha. A prescrição daquela sessão fica congelada; não depende de consultar o plano a cada série.
- Rascunho local limitado à sessão e à conta; sem promessa de abrir outros planos ou baixar a biblioteca offline. Sem garantia de recuperação se o usuário apagar o armazenamento ou o sistema o remover.
- Salvar séries no servidor durante a execução, com identificadores estáveis. A cópia local guarda alterações ainda não confirmadas.
- “Concluir” sem rede encerra a execução local e mostra “Aguardando envio”. Não apresenta “Salvo na conta” nem contabiliza a conclusão no painel profissional antes da confirmação do servidor.
- Reconectar envia alterações de modo idempotente. Dois envios da mesma conclusão não criam dois treinos. Erro de autenticação pede nova entrada e só reenvia para a mesma conta; revogação de vínculo recebe tratamento explícito.
- No recarregamento, oferecer recuperação se o rascunho e a aplicação estiverem disponíveis. Em outro dispositivo, recuperar apenas a última versão confirmada pelo servidor.
- Eventos de conexão são pistas; o resultado da requisição define sucesso ou falha. Não depender apenas de `navigator.onLine`.
- Cache de arquivos estáticos pode permanecer para desempenho. Push, instalação PWA e ciclo de atualização são avaliados separadamente do recurso de edição offline.

Retirada gradual: implementar o novo caminho → validar a recuperação → trocar leituras e escritas → desativar convidados persistentes e download offline → remover sincronização integral/arquivos espelhados que ficarem sem uso → revisar testes e documentação. Não manter duas fontes oficiais nem escrita dupla permanente.

## 4. Arquitetura da informação

### Aluno

Manter cinco entradas principais: **Início · Plano · Treinar · Evolução · Conta**.

| Área | Conteúdo | Mudança |
| --- | --- | --- |
| Início | Treino de hoje, continuar sessão, próxima ação e avisos relevantes | Simplificar a página atual; detalhes ficam em suas áreas |
| Plano | Semana, treinos pessoais, programa recebido e acesso à biblioteca | Reorganizar a página existente e deixar a origem do plano explícita |
| Treinar | Exercícios, séries, descanso, execução anterior e status de salvamento | Reaproveitar executor; manter foco na sessão |
| Evolução | Resumo, Histórico, Corpo e análise de desempenho | Reagrupar Stats, History e BodyProgress |
| Conta | Dados pessoais, preferências, profissionais, privacidade e suporte | Substituir o menu genérico Mais por agrupamentos previsíveis |

Histórico passa a ser uma seção da Evolução, com detalhe acessível por URL. Biblioteca passa a ser acessível pelo Plano e pelo seletor de exercícios. O aluno encontra seu profissional pelo cartão de acompanhamento no Plano e pela Conta.

No início, limitar a informação a três blocos principais: ação de hoje; progresso semanal resumido; acompanhamento/avisos. Usuário sem profissional recebe orientação para treinar sozinho ou se conectar, sem área vazia permanente.

### Profissional

Manter Visão geral, Alunos e Programas como destinos principais. Convites ficam em Alunos, com atalho no painel. Perfil profissional fica no menu de conta. No desktop, navegação lateral; no celular, navegação compacta com a mesma hierarquia.

Página de aluno com quatro seções: **Resumo · Plano · Evolução · Acompanhamento**. Vínculo e ações administrativas ficam no cabeçalho/menu secundário. Notas privadas devem estar separadas e identificadas como visíveis somente ao profissional.

O console administrativo continua separado. Não acrescentar controles administrativos à navegação cotidiana do aluno.

### Novas páginas justificadas

| Página/rota conceitual | Quando | Por que precisa de página |
| --- | --- | --- |
| Detalhe de sessão `/progress/history/:id` | Etapa 3 | Histórico compartilhável internamente, notas, séries e comparação; substituir sheet longa |
| Detalhe de exercício `/library/:id` | Etapa 3 | Instruções e evolução pessoal no mesmo contexto |
| Resumo final `/workout/:id/summary` | Etapa 3 | Confirmar conclusão, mostrar resultados e solicitar feedback |
| Central de avisos `/notifications` | Etapa 5 | Avisos persistentes, lidos/não lidos e links para ações |
| Check-in `/check-ins/:id` | Etapa 5 | Formulário e acompanhamento com histórico próprio |
| Revisão de programa `/professional/programs/:id/review` | Etapa 4 | Comparar alterações e confirmar publicação/atribuição |

As rotas são propostas lógicas, compatíveis com o roteador atual; não exigem trocar HashRouter. Expandir páginas existentes para conta, metas e filtros antes de criar destinos novos. Links antigos devem continuar funcionando por redirecionamento.

## 5. Regras de interface

1. Uma ação primária clara por contexto. No executor: registrar; no editor: salvar rascunho/publicar; no histórico: consultar.
2. Sheet para uma decisão curta, como escolher exercício ou data. Página para tarefas longas, múltiplas etapas ou conteúdo que precisa de URL. Evitar sheets sobre sheets.
3. Mesmas palavras em aluno e profissional: programa é um conjunto de treinos; treino é a prescrição; sessão é uma execução. Validar esses nomes em protótipo antes de substituir textos em massa.
4. Uma localização principal por recurso; atalhos apontam para ela, sem criar implementações diferentes.
5. Diferenciar rascunho, publicado, atribuído e arquivado; publicar não significa alterar automaticamente o plano de todos os alunos.
6. Mostrar Salvando, Salvo, Aguardando envio e Falha junto da ação relevante. Toast é complemento, não o único registro de erro ou atualização importante.
7. Manter cores, tipografia, espaçamentos e componentes existentes onde funcionam. Definir padrões reutilizáveis de cabeçalho, filtros, lista, estado vazio, erro e confirmação.
8. Animação não deve atrasar persistência, impedir cliques essenciais ou esconder o resultado. Respeitar redução de movimento e navegação por teclado.
9. Gráficos mostram período, unidade, legenda e explicação. Estimativas de força/recuperação devem ser identificadas como estimativas, sem precisão aparente indevida.
10. Criar estados de carregamento, vazio, sem permissão, falha e tentativa novamente desde o protótipo. Testar nomes longos, traduções e telas pequenas.

## 6. Modelo de dados e regras centrais

Separar dados do servidor, estado transitório da interface e rascunho da sessão. Zustand pode continuar no estado de interface e executor; não precisa ser substituído só por reorganização.

Domínios propostos: perfil/preferências; planos e versões; atribuições; sessões e séries; peso/medidas/metas; vínculos; check-ins/feedback; notificações. Reaproveitar tabelas e RPCs profissionais existentes. Evitar nova tabela quando o contrato existente atende ao requisito.

- Massa/carga canônica em kg; altura/medidas em cm. Preferência visual separada. Converter entradas e apresentações em todos os consumidores, inclusive importação, estatísticas, exportação e prescrições profissionais.
- Registro da sessão conserva a versão da prescrição executada; publicação posterior não reescreve o histórico.
- Mutação por entidade com revisão esperada, controle de propriedade e ID idempotente. Eliminar o upload de toda a conta para editar um único treino.
- Uma sessão ativa por aluno, controlada no servidor. Outro dispositivo oferece continuar assumindo a sessão; gravações atrasadas da instância anterior são recusadas por revisão/token.
- Proposta inicial: vários vínculos profissionais permitidos, mas um programa de treino ativo por aluno. Troca entre responsáveis exige escolha explícita do aluno; profissional não encerra silenciosamente atribuição de outro profissional. Materiais recebidos permanecem separados do programa ativo.
- Listas paginadas e resumos calculados no servidor. Evitar carregar todo o histórico para montar um cartão.
- Permissões validadas no backend para cada leitura/escrita; esconder botões não basta. Reutilizar RLS/RPCs com testes entre duas contas e dois profissionais.
- Alterações de plano invalidam consultas; ao voltar à página ou reconectar, buscar dados atuais. Notificação push não é garantia de atualização nem mecanismo único de consistência.

## 7. Catálogo priorizado de funcionalidades

### Essenciais para a próxima versão

| ID | Entrega | Frontend | Benefício / critério principal |
| --- | --- | --- | --- |
| E01 | Navegação e vocabulário consistentes | Áreas descritas acima | Usuário encontra treino, histórico e profissional sem explorar Mais |
| E02 | Persistência online por domínio | Estados de salvamento nas telas | Alterar uma entidade não sobrescreve outra |
| E03 | Recuperação da sessão | Aviso discreto, retomada e pendência de envio | Queda de rede não duplica nem apaga séries registradas |
| E04 | Unidade kg/lb correta | Campos, gráficos e totais coerentes | Mudar exibição não muda o valor físico armazenado |
| E05 | Histórico pesquisável | Filtros de período, treino/exercício e detalhe | Encontrar e revisar uma execução sem rolar indefinidamente |
| E06 | Comparação com a última execução | Referência junto da série | Saber carga/repetições anteriores durante o treino |
| E07 | Resumo pós-treino | Página dedicada com próximos passos | Confirmar resultado e status real do salvamento |
| E08 | Biblioteca e detalhe de exercício | Busca/filtros e instruções; seletor reutilizado | Encontrar exercício e entender execução/histórico |
| E09 | Painel profissional útil | Prioridades, agenda de treinos e atividade recente | Atender aluno que precisa de ação sem abrir todos |
| E10 | Gestão de alunos paginada | Busca, filtros, contagem correta | Não omitir alunos em listas grandes |
| E11 | Editor e versões completos | Objetivo, nomes, duplicar, prévia, revisão | Reutilizar e publicar programa com efeito compreensível |
| E12 | Notas privadas e contexto do aluno | Seção própria no acompanhamento | Registrar observações sem expô-las ao aluno |

### Segunda entrega, após estabilizar o núcleo

| ID | Entrega | Frontend | Limite inicial |
| --- | --- | --- | --- |
| S01 | Metas de frequência e desempenho | Evolução e resumo no Início | Poucas metas claras; sem gamificação extensa |
| S02 | Check-in e feedback pós-treino | Formulário curto e seção do aluno | Esforço, dificuldade e comentário; sem diagnóstico automático |
| S03 | Avisos persistentes | Central e indicador de não lidos | Plano atualizado, vínculo, feedback e lembretes úteis |
| S04 | Evolução por exercício | Página do exercício e período selecionável | Carga, repetições e estimativas explicadas |
| S05 | Comparação de períodos | Evolução e acompanhamento profissional | Definir métricas antes de acrescentar gráficos |
| S06 | Substituição de exercício | Escolha no executor, original/substituto no resumo | Sugestões curadas; registrar desvio da prescrição |
| S07 | Ajuste de agenda e duplicação de treino | Plano semanal | Não alterar retroativamente sessões realizadas |
| S08 | Relatório de acompanhamento | Exportação a partir do aluno | Período, plano, adesão e evolução; só dados autorizados |

### Condicionais, fora do compromisso inicial

- Sugestão de progressão: depois de histórico consistente; explicar a regra, permitir recusa e não mudar prescrição profissional automaticamente.
- Fotos corporais: somente com finalidade, controle de acesso, armazenamento privado e exclusão definidos; avaliar demanda antes de construir.
- Conversa contextual: começar por feedback associado a sessão/check-in; chat completo só se esse fluxo não resolver a necessidade.
- Agenda de atendimentos: acrescentar apenas se profissionais realmente precisarem marcar consultas/aulas; calendário de treino não é agenda comercial.
- Cobrança/assinaturas: depende de modelo de negócio, acesso por plano e operação de pagamentos; não é pré-requisito da próxima versão.
- Integrações com relógios/saúde: avaliar dispositivos e demanda após estabilização do registro manual.
- IA, rede social, ranking, nutrição, marketplace e múltiplas prescrições simultâneas: fora da sequência inicial; exigem problemas e regras próprios.

## 8. Sequência de construção

| Etapa | Entrega completa | Dependências | Critério de saída |
| --- | --- | --- | --- |
| 0 — Base verificada | Revisar correções locais, fechar i18n, registrar estado atual e corrigir especificação ambígua | Nenhuma | Testes/build executados e pendências registradas sem afirmar conclusão não verificada |
| 1 — UX e contratos | Mapa de páginas, protótipos mobile/desktop, estados de rede, modelo de dados, regra de vínculos e sessões | 0 | Fluxos aluno/profissional percorríveis e critérios escritos por entrega |
| 2 — Dados e conexão | Kg canônico, conta online, persistência por entidade, recuperação de sessão e retirada gradual de offline amplo | 1 | Duas abas/dispositivos, reconexão, reenvio e isolamento de contas testados |
| 3 — Experiência do aluno | Nova navegação, Início/Plano/Evolução/Conta, histórico, detalhe de exercício e resumo de sessão | 2 | Planejar → executar → concluir → consultar funciona em celular e desktop |
| 4 — Experiência profissional | Consultas existentes integradas, alunos, notas, editor, versões, prévia e atribuição | 2; validar integração com 3 | Convidar → aceitar → publicar → atribuir → executar → acompanhar completo |
| 5 — Acompanhamento | Metas, feedback, check-ins, avisos, comparação e substituições | 3 e 4 | Aluno envia informação e profissional consegue agir sobre ela |
| 6 — Consolidação | Relatório, acessibilidade, desempenho, observabilidade, documentação e homologação | 5 | Critérios de lançamento satisfeitos e operação preparada |

### Registro da Etapa 0 — concluída em 19/10/2026

- Regressões: 23 testes focados passaram; o cenário Playwright do editor profissional passou em desktop e mobile.
- Localização: 11 idiomas com 1502 chaves cada, 1007 textos de interface cobertos e pt-BR completo.
- Frontend: 140 arquivos e 1162 testes passaram.
- Build: concluído em 6,66 s. Permanecem dois avisos não fatais de imports dinâmicos ineficazes para `@capacitor/core` e `sheets.jsx`; eles serão tratados na etapa de desempenho, se continuarem relevantes após a reorganização.
- Supabase: 30 verificações passaram, 3 foram ignoradas e nenhuma falhou. As três ignoradas exigem binários PostgreSQL descartáveis (`PG_BIN`); portanto, as asserções SQL reais ainda precisam ser executadas em homologação/local preparado.
- Integridade textual: `git diff --check` sem erros.
- Próxima entrega: Etapa 1 — mapa de navegação, contratos de sessão/vínculo e protótipos mobile/desktop.

Etapas 3 e 4 podem ser divididas em entregas menores; a integração de ponta a ponta é obrigatória antes de chamá-las concluídas. Não abrir vários módulos incompletos ao mesmo tempo.

A etapa 2 é a de maior risco/esforço. Não vale implementar uma plataforma completa de sincronização de snapshots e logo depois descartá-la. Se a versão atual continuar sendo usada enquanto a substituição é construída, aplicar primeiro a correção mínima da revisão por aba. Se estiver restrita a homologação controlada, priorizar diretamente o novo contrato.

Não fixar prazos em dias sem decompor a etapa 2. Estimar após contratos/protótipos e um fluxo vertical validado. Usar tamanho relativo: 0 pequeno; 1 médio; 2 grande; 3 grande; 4 médio/grande; 5 grande e divisível; 6 médio.

## 9. Como evitar perder o controle da construção

Este arquivo é o índice do produto. Cada etapa terá uma ficha de execução própria, vinculada a este plano, com IDs E/S acima e tarefas pequenas. Estado inicial de todas as novas entregas: planejada, não iniciada.

Cada tarefa deve registrar: problema do usuário, página de entrada/saída, estado atual, comportamento esperado, contrato de dados, permissões, estados de erro/vazio/carregamento, testes, dependências e critério de conclusão.

Fluxo de trabalho: planejar → prototipar → implementar um fluxo vertical → testar → revisar interface → homologar → registrar conclusão. Uma tarefa não termina com “backend pronto”; precisa da interface e do caminho real utilizável.

Manter um registro curto de decisões e mudanças de escopo. Funcionalidade nova que surgir entra no backlog e recebe prioridade; não entra informalmente no trabalho em andamento. Evitar reescrever componentes compartilhados durante uma entrega sem necessidade demonstrada.

Para cada etapa concluída, registrar: arquivos/contratos afetados, testes executados, limitações, capturas de telas relevantes e procedimento de ativação/reversão. Ativações graduais podem usar flags temporárias com tarefa de remoção; não duplicar arquitetura indefinidamente.

## 10. Validação e lançamento

Fluxos obrigatórios: aluno independente; aluno vinculado; profissional que também treina; conta nova; lista vazia; histórico grande; rede lenta; falha durante série/conclusão; sessão expirada; troca de conta; duas abas; publicação durante treino; revogação de vínculo; usuário sem permissão.

Testes de domínio: unidades e precisão, versões, revisão concorrente, idempotência e estados da sessão. Testes de banco: isolamento, propriedade e transações. Testes de UI: formulários, foco, mensagens e estados. E2E: ciclo aluno/profissional e recuperação de rede. Homologação: Supabase real de teste e dispositivos alvo.

Verificações existentes: suíte de frontend, build, check:i18n, check:supabase, testes SQL e E2E pertinentes. Testes ignorados por ausência de dependência devem ser registrados como não executados; não contam como aprovação do banco.

Medidas para acompanhar resultado: sucesso ao iniciar/concluir treino; falhas/duplicações de gravação; tempo entre convite e primeiro treino; facilidade de encontrar histórico; uso do painel profissional e conclusão de check-ins. Definir linha de base antes de estabelecer metas numéricas. Telemetria não deve incluir conteúdos privados de notas ou dados desnecessários.

## 11. Pontos a validar na etapa 1

As recomendações já permitem ordenar o trabalho. Antes de implementar contratos irreversíveis, validar: conta obrigatória com demo separada; um programa ativo e vários vínculos; recuperação local limitada; mesmas funcionalidades essenciais em web e nativo; escopo de dados compartilhados com cada profissional.

Esses pontos são decisões de produto propostas, não alegações sobre necessidades já pesquisadas. Não é necessário escolher agora chat, cobrança ou integrações para começar a reorganização.

## 12. Referências técnicas e locais

- `frontend/src/components/TabBar.jsx`, `frontend/src/views/More.jsx`, `frontend/src/App.jsx`: navegação atual.
- `frontend/src/lib/account-sync.js`, `frontend/src/store/useStore.js`: snapshots e coordenação de persistência atuais.
- `frontend/src/lib/professional-workflow.js`, `frontend/src/views/ProfessionalDashboard.jsx`, `frontend/src/views/ProfessionalStudentPage.jsx`: contratos e integração profissional.
- `frontend/public/sw.js`, `frontend/src/components/OfflineControls.jsx`, `docs/PROFESSIONAL_READINESS.md`: offline, notificações e operação.
- [MDN — navigator.onLine](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine): indicador de rede não garante disponibilidade do serviço.
- [MDN — Service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers): cache e ciclo de vida do worker.
- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): autorização de acesso aos dados no servidor.
