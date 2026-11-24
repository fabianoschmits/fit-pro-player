# FPP Weekly Progress

Especificação vinculante: Implementação 02 fornecida pelo usuário em 24/11/2026. Base c722bb5; branch feat/fpp-weekly-progress.

## Arquitetura e contratos

Resumo derivado, schemaVersion 1, sem persistir agregados nem criar tabelas/RPCs. Entrada é S.workouts já reconciliado pelo domínio histórico. IDs de sessão determinam unicidade; datas, nomes e rotinas não. Snapshots e registros de séries continuam sendo as únicas referências históricas. O preview compartilha a agregação básica sem carregar desempenho, insights ou BodyMap.

Calendário usa chaves locais YYYY-MM-DD e Intl no fuso válido do perfil, ou local, com fallback America/Sao_Paulo. Semanas segunda–domingo, fim exclusivo na próxima segunda; conclusão end/completedAt tem precedência sobre d. Datas legadas são datas de calendário. Semana atual compara os dias decorridos com os mesmos dias anteriores, sinalizando o dia atual incompleto. Semanas encerradas comparam sete dias.

Métricas usam séries concluídas sem aquecimento; duração real canônica, com cobertura explícita; repetições somente no modo reps. Treinos ativos/cancelados/futuros e registros inválidos não entram. Dois treinos no mesmo dia contam duas sessões e um dia ativo. Valores ausentes não viram medições zero.

## Músculos e planejamento

compareTraining determina carga ponderada e séries efetivas por sessão. Os 18 grupos e anatomia existentes são reutilizados. Séries diretas são apresentadas somente onde os metadados históricos permitem atribuição direta verificável; participação secundária não é chamada de série literal. Metadados ausentes geram cobertura parcial. Totais de planejamento incluem apenas sessões com as duas referências válidas, com denominadores correspondentes e percentuais sem truncamento.

## Desempenho e insights

Mesmos IDs, modalidades e unidades canônicas; maior carga é descrita como maior carga registrada, sem inferir força. Repetições exigem carga equivalente. Primeiro registro é distinto de recorde; recordes consideram todo o passado disponível antes da sessão e ignoram futuro. Mecanismos existentes de linhas e melhores cargas são reutilizados. Mensagens determinísticas, até três, priorizadas, sem rede/IA externa ou julgamento de saúde/qualidade.

## Interface e integração

Rota lazy /progress/weekly?week=YYYY-MM-DD, contexto Evolução. Acessos: Home após a ação principal, Evolução antes do BodyMap, conclusão junto do mapa e cabeçalho Histórico. Ordem da tela: cabeçalho/seletor, métricas, gráfico, comparação, insights, mapa, planejamento, desempenho e treinos. Componentes pequenos em components/training/weekly; tokens existentes, dois temas, áreas de toque, teclado e movimento reduzido. Lista reutiliza WorkoutDetail. Skeleton antes da restauração; histórico parcial e falha de sincronização mantêm os dados locais. Nenhum parâmetro pessoal.

## Atualização, privacidade e offline

Assinaturas da store invalidam os cálculos ao mudar histórico/conta; evento de retorno e timer único de fronteira de calendário atualizam a semana atual sem deslocar seleção histórica. Nenhum polling. Rota e anatomia reutilizam shell/preload existentes; rasters continuam sob demanda. Conta ativa determina integralmente o histórico exibido. Sem novas consultas, logs de treino ou alteração de RLS.

## Verificação

Relógio fixo de quarta-feira: atual 2 treinos/24 séries/90min, anterior comparável 2/18/80min (quinta anterior excluída). Testes de calendário/DST, agregação/imutabilidade/grande histórico, desempenho/recordes e insights. Playwright Chromium/WebKit com acessos, datas, métricas, gráfico, mapas, planejamento, conta, temas e geometrias; PWA preserva oito casos e amplia cobertura semanal. Suítes integrais e três builds, contagens e limitações no relatório de verificação.

## API do calendário

| Função | Resultado |
| --- | --- |
| getWeekStart / getWeekEnd | Chave da segunda / domingo locais. |
| getWeekRange | start inclusivo, end exclusivo, instantes dos dois limites. |
| getPreviousWeek / getNextWeek | Segunda anterior / seguinte por aritmética de calendário. |
| getWeekDays | Sete chaves de segunda a domingo. |
| normalizeWeekParam | Segunda correspondente; inválida/futura vira semana atual. |
| getComparableWeekRange | Intervalo anterior equivalente, comparableDays e mode. |

Intl determina a data local de timestamps. Aritmética UTC ao meio-dia é usada somente entre chaves de calendário, nunca para cortar um timestamp local. O início do dia usa o primeiro instante existente quando o horário de verão suprime a meia-noite. Registros contendo apenas uma data não recebem horário inventado para ordenar recordes do mesmo dia.

## Contrato derivado e fórmulas

buildWeeklyProgress recebe workouts, weekStart, now, timeZone e exerciseCatalog. Retorna schemaVersion 1 com period, comparisonPeriod, metrics, previousMetrics, deltas, days, muscles, planning, performance, insights, workouts e coverage. Nenhum desses objetos é gravado como histórico novo. buildWeeklyPreview usa a mesma base, sem rankings, recordes ou anatomia, e não lê séries de períodos externos às duas semanas comparáveis.

- Treinos = IDs concluídos válidos únicos. Dias ativos = datas locais distintas desses treinos.
- Séries = linhas done === true que não são aquecimento. Não multiplica unilateral, halteres ou superséries por dois.
- Repetições = soma de r finito e não negativo em linhas concluídas no modo reps. Segundos e distâncias não entram.
- Exercícios = ocorrências de entradas com séries concluídas; uniqueExercises usa IDs canônicos distintos.
- Tempo = soma de workoutDuration apenas onde durationMs ou os dois instantes reais são válidos. Sem cobertura, null; cobertura parcial permanece explícita e não recebe delta percentual.
- Carga muscular = soma da carga realizada de compareTraining em séries ponderadas. Diretamente atribuída usa peso 1 nos metadados salvos da entrada. Quando o fallback legado ao catálogo é necessário, mantém a estimativa ponderada, conta estimatedMuscleSets e apresenta séries diretas como não registradas para os músculos afetados.
- Planejamento = somas das mesmas sessões elegíveis, com planned e adjusted válidos e denominador ajustado positivo. Completion = actualSets / referenceSets × 100; pode superar 100. Não calcula média de percentuais.
- Delta = current − previous. Percentual = delta / previous × 100 somente para referência positiva; anterior zero gera apenas variação absoluta. Valores ausentes tornam comparable false.

A cobertura inclui legacyWorkouts, snapshotWorkouts, unknownDurationWorkouts, unknownMuscleSets e estimatedMuscleSets. Os dados válidos disponíveis continuam utilizáveis quando outra métrica está ausente.

## Desempenho e acesso individual

Valores históricos usam kg canônico; a apresentação converte para kg/lb. Apenas mesmo ID, modalidade reps e configuração unilateral equivalente são comparados. Peso corporal, exercícios assistidos e modalidades time/cardio não recebem comparação convencional de carga. Usa metricRowsForEntry e bestWeightForEntry existentes. Repetições exigem carga equivalente, preservando linhas de todas as sessões da semana. Recordes exigem uma carga anterior positiva menor, considerando o histórico anterior à sessão; completedAt/end determina ordenação do mesmo dia quando disponível. Primeiro registro não é recorde. Cobertura declaradamente parcial permite apenas melhor registro disponível. A ação de exercício abre /progress?exercise=<id> no gráfico já existente.

## Interface, dados e limitações deliberadas

A lista semanal agrupa sessões por data e abre workoutDetailSheet; o mapa individual usa /progress/training-map?session=<id>. Origem profissional é apenas apresentada, sem modificar prescrição ou permissões. URLs contêm somente semana, ID de sessão ou exercício, sem dados pessoais.

A store fornece histórico já carregado e reconciliado sem nova paginação/consulta. Não existe histórico ilimitado remoto adicional nem prova de atividade não registrada. Os dados no dispositivo determinam a cobertura offline. Exercícios sem metadados entram nas séries gerais, mas não ganham músculos inventados. Não se publica uma métrica global de volume como qualidade e não se somam modalidades incompatíveis.

O aviso offline acompanha navigator.onLine e some na reconexão. Erro de sincronização mantém dados locais e oferece retryAccountSync. Um único timer de fronteira diária e eventos de foco/visibilidade/conexão substituem polling. Seleção histórica não avança automaticamente; a seleção corrente acompanha a mudança de semana.

A chave week é normalizada por replace preservando o estado de retorno. Trocas explícitas criam navegação no histórico do browser. min do seletor é a primeira semana disponível; max é a corrente. Sem histórico, a semana atual continua acessível. Na semana histórica vazia não existe ação para iniciar treino no passado.
