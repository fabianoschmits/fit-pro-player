# FPP - Infraestrutura histórica e Planejado × Realizado

Data: 23/11/2026. Especificação fornecida e execução integral autorizada pelo usuário nesta conversa. Branch: `feat/fpp-training-comparison`, base `main` em `5b40259`.

## Objetivo e escopo

Preservar o planejamento original e a seleção confirmada de uma sessão, comparando-os com as séries efetivamente concluídas. A entrega inclui captura, persistência, recuperação, motor puro, BodyMap e acessos em Evolução, pós-treino, Histórico e Home. Não inclui resumo semanal, check-in, alertas profissionais, periodização, relógios, equipamentos por local ou anilhas.

## Arquitetura

Reutilizar Zustand, os registros `active`/`workouts`, o journal `session-recovery`, `training-repository`, DTO e as operações `session_completed`. Não criar tabela, sincronização, catálogo muscular ou fonte paralela para o realizado. Preservar a versão global do estado, geometria SVG, sprites, componentes FPP, temas e navegação atual.

O motor `lib/training-comparison.js` normaliza e calcula resultados sem efeitos colaterais. O ciclo de vida em `sheets.jsx` prepara a comparação; `Workout.jsx` confirma a execução via `workout-session.js`. A view lazy consome resultados memoizados. O cartão de descoberta é leve e não importa BodyMap.

## Contrato opcional

```js
comparison: {
  version: 1,
  origin: 'personal', // personal | professional | repeat | freestyle
  planned: [{ exerciseId: '0025', workSets: 3, muscleWeights: { chest: 1, triceps: 0.4 } }],
  adjusted: null, // array após início; null identifica preparação ainda não confirmada
  flexApplied: false
}
```

O campo é `comparison` tanto no ativo quanto no histórico. `adjusted: null` é apenas o estado intermediário da preparação; `[]` representa seleção vazia explícita. Sessão livre preserva `origin: 'freestyle'`, `planned: []` e, após início, `adjusted: []`, sem inventar referência. Ausência, versão desconhecida ou metadados inválidos degradam a disponibilidade do comparativo e nunca invalidam o treino inteiro.

Cada snapshot tem cópias independentes. IDs repetidos permanecem representados por entrada e são agregados pelo motor. Nenhuma consulta ao plano atual reconstrói planejamento histórico. Metadados mínimos incluem apenas identificador, séries de trabalho e pesos canônicos.

## Ciclo da sessão e Flex

1. `beginWorkout` prepara entradas pessoais/profissionais; `beginWorkoutFromHistory` prepara uma repetição independente. Cada entrada congela seus metadados musculares conhecidos.
2. Capturar `planned` antes da revisão de duração e antes de qualquer filtro Flex. Marcar origem, mantendo assignment, execução e versão profissional existentes.
3. Revisar Flex com o algoritmo atual e a regra de grupos de supersérie intactos. Nunca alterar `planned`.
4. No início real, capturar `adjusted` das entradas selecionadas, uma única vez. Enfileirar o `active` atualizado usando a operação já existente.
5. Edições, substituições ou adições durante execução preservam ambos os snapshots. Novas entradas congelam seus próprios músculos; realizadas são as séries registradas.
6. `buildCompletedWorkout` preserva `comparison` e os snapshots por entrada. A mesma conclusão é persistida localmente e enviada no `payload.workout`, com idempotência existente.

Preparações antigas sem snapshot permanecem antigas: iniciar/retomar não fabrica um original retroativo. Repetir um treino antigo cria uma sessão nova, cuja referência são as entradas escolhidas para a repetição, com metadados históricos disponíveis.

## Cálculos

Para cada grupo de `MUSCLES`/`MUSCLE_NAME`:

`séries ponderadas = soma(séries de trabalho × peso do músculo)`.

Original e ajustado usam `workSets`; realizado usa somente linhas `done` que não são `isWarmupRow`. Usar `musclesOf` e os mesmos grupos canônicos do FPP. Não usar kg, duplicar unilateral, duplicar supersérie ou transformar cardio sem músculo desenhável em músculo inventado. Contar linhas de cardio/cronometradas segundo o contrato de séries existente. Entradas adicionadas/substituídas contam seu trabalho real, não a composição original.

O percentual geral é `séries concluídas / séries ajustadas × 100`, somente com denominador válido e positivo. Não truncar acima de 100%; sem referência retornar `null` e explicar. É execução de séries, não saúde ou qualidade pessoal. Valores negativos/não finitos e chaves não canônicas não contaminam o cálculo. A escala visual é calculada uma vez com o máximo dos três estados daquela sessão e compartilhada nos três BodyMaps via `thresholds`.

## Persistência, segurança e compatibilidade

Inspeção técnica: `workout_sessions.prescription_snapshot` e `workout_session_operations.payload` já são JSONB. A conclusão transporta `workout` integralmente; não é necessária tabela nova nem incremento de schema global. A whitelist local/journal precisa aceitar o novo contrato. DTO conserva ausência histórica, copia/normaliza o campo novo e verifica proprietário/ID como antes.

O snapshot da preparação vai em `startSessionRecovery.prescriptionSnapshot`. A confirmação e o progresso seguem no `payload.active` das operações existentes. Na leitura de sessão ativa, somente operações do mesmo usuário e sessão podem complementar a seleção confirmada; o original da preparação continua autoritativo. O fluxo existente não inaugura nesta entrega uma nova UI de transferência de treino entre dispositivos.

Recuperação local e conclusão offline mantêm o contrato junto do treino. A reconexão reenvia o journal idempotente. Troca de conta conserva isolamento, descarta respostas tardias e não associa sessões de outra pessoa. Profissionais mantêm permissões e versionamento atuais; nenhuma sugestão altera automaticamente a prescrição.

Customizações usam `muscleSnapshot` congelado por entrada, preferido ao catálogo atual. A edição/exclusão posterior do custom não reescreve o histórico. Para legados, o realizado utiliza somente metadados históricos ou do catálogo ainda disponíveis, sem inventar comparação.

## Tela, componentes e rotas

- Rota HashRouter lazy: `/progress/training-map?session=<id>`; sem ID seleciona a conclusão mais recente. ID inexistente nunca cai silenciosamente no último treino.
- Título: “Planejado × Realizado”; subtítulo: “Veja como o seu treino aconteceu.”
- Seletor de sessões limitado/progressivo em sheet; resumo compacto de exercícios e séries; estados Original/Ajustado/Realizado; mapa frontal/posterior; detalhe por músculo; legenda de séries ponderadas.
- Mobile: segmentado e mapa grande. Desktop: comparação simultânea somente com largura suficiente. Sem sexta aba ou acesso administrativo.
- `TrainingComparisonPreview`: descoberta leve em Evolução, após métricas iniciais; estado vazio permite começar treino. Não altera os gráficos ou fotos existentes.
- Pós-treino: “Ver mapa do treino”, abaixo do BodyMap e antes de compartilhar/Home. Histórico: “Mapa do treino”. Fechar o sheet antes de navegar; sessão local serve mesmo com envio pendente.
- Home: “Ver músculos treinados” somente no estado concluído sem treino ativo.
- Legado: “Este treino foi registrado antes do novo comparativo. Você ainda pode visualizar os músculos trabalhados.” Livre: apenas realizado com ausência de referência explícita.

Textos seguem a internacionalização existente. Usar tokens, classes e ícones oficiais, áreas de toque, foco/teclado, ARIA e reduced motion. Não esconder significado apenas em cor. SVG mantém altura reservada enquanto carrega e seu tratamento de erro/retry existente.

## Estratégia de testes e revisão

Motor: sem/com Flex, omitidos, parcial, undone, aquecimento, supersérie, unilateral, repetido, substituído/adicionado, custom excluído, legado/vazio, pesos inválidos, fracionários, acima de 100%, zero, JSON e imutabilidade.

Persistência: whitelist, start, confirmação, conclusão, restauração local, DTO e repositório em contexto independente, offline/reconexão/idempotência e isolamento. Exercitar contratos SQL existentes com banco descartável, sem mutação em produção.

Interface/E2E: quatro acessos, URL direta, sessão inválida/vazia/antiga/livre, segmentados, detalhe muscular, seletor, retorno, claro/escuro, celular/desktop/iPhone, ausência de overflow e screenshots. Rodar lint, typecheck, suite, i18n, limites Supabase e builds web/Vercel/mobile, E2E e PWA. Registrar comandos e resultados reais no relatório de verificação; revisar diff, segurança, acessibilidade e bundle antes do push exclusivo da branch.
