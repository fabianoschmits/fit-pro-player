# FPP — Implementação 01: verificação

Datas de execução: 23–24/11/2026. Branch: `feat/fpp-training-comparison`. Base: `main` em `5b40259`. Node 22.17.0; Supabase CLI 2.122.0. Sem instalação de dependências, merge, deploy ou SQL em produção.

## Entrega

Contrato opcional `comparison.version = 1` com origens personal/professional/repeat/freestyle. Original capturado na preparação antes do Flex; ajustado confirmado uma única vez no início da execução. Entradas preservam `muscleSnapshot`, inclusive customizações removidas do catálogo. O realizado continua derivado das séries concluídas, excluindo aquecimentos, sem uma segunda fonte de verdade.

Motor puro usa os 18 grupos de `muscles.js`, séries ponderadas, proteção contra números inválidos, agregação de exercícios repetidos e uma escala compartilhada. Percentual representa execução de séries ajustadas, aceita mais de 100% e não existe sem denominador válido. Legado e treino livre mostram somente referências comprováveis.

Tela lazy `/progress/training-map?session=<id>` com seleção progressiva, resumo, mapas oficiais frontal/posterior, controle mobile, três mapas no desktop, detalhe por músculo e legenda numérica. Acesso por Evolução, conclusão, Histórico e Home concluída. Sem nova aba inferior. Textos nos 11 packs existentes; português é fonte e inglês é fallback.

## Persistência e segurança

Nenhuma migration necessária. Os campos JSONB existentes `prescription_snapshot` e payload do journal comportam os snapshots; conclusão usa o objeto `workout` da operação `session_completed`. Mantidos limites SQL, RLS, ownership, assignment e versionamento profissional. Sem nova tabela/RPC/SECURITY DEFINER ou incremento da versão global do estado.

Testes de `training-repository.database.test.js` usam o SDK Supabase real e migrations/RPC/RLS em PostgreSQL descartável PGlite. A adaptação de transporte substitui PostgREST, não a lógica SQL. Exercitados: início, ajuste, conclusão, leitura por contexto independente, perda da resposta após conclusão, retry do journal sem duplicação e conta sem acesso à sessão alheia. Isso não equivale a executar a infraestrutura hospedada Supabase ou testes em aparelhos físicos.

`useStore.training-comparison.test.js` verifica início via store real e restauração do cache. `comparison-persistence.test.js`, DTO e recuperação verificam serialização, whitelist, reconexão, confirmação e isolamento. A arquitetura existente não monta automaticamente uma sessão ativa remota como interface completa em um aparelho novo; o contrato é preservado no carregamento/takeover disponível. Histórico concluído em outro contexto é coberto.

## Evidências de desenvolvimento

- Motor: 38 testes. Foram cobertos os 20 grupos exigidos, incluindo warmup, unilateral, supersérie, repetição, substituição/adição, custom, frações, legado, zero, imutabilidade e JSON.
- Persistência: rodada de 10 arquivos, 148 testes aprovados.
- Ciclo local: preparação antes do Flex, repetição e custom excluído, início único e restauração do store possuem testes de integração.
- Revisão independente encontrou sobrescrita possível do ajustado por payload posterior. Acrescentados dois testes que falharam antes da correção; DTO/repositório passaram a preservar a primeira confirmação em ordem de revisão. Rodada de quatro arquivos: 40 testes aprovados.
- Interface: rodada inicial de seis arquivos, 49 testes aprovados.
- Traduções: 29 testes aprovados, incluindo importação dos packs finais para evitar que chaves antigas sobrescrevessem a nova tradução.
- E2E inicial: 12/18 aprovados. O ciclo real Home → Flex → uma série → conclusão → mapa → reload passou em Chromium desktop, Chromium mobile e WebKit mobile. Seis casos revelaram problemas de largura do cartão/foco, corrigidos com regressão posterior.
- E2E final da funcionalidade: **21/21 aprovados**, em 3,9 minutos, sobre cópia da feature com `index.css` intacto da main. Inclui os três navegadores, claro/escuro, 320px, desktop e tablet 768×1024/1024×768, quatro acessos, foco/Escape, troca de sessão, corpo frontal/posterior, escolha de músculo, legado, livre, inexistente, isolamento de conta, paginação e ciclo real Flex/conclusão/reload.
- Foco: regressão StrictMode de fechamento real de sheet, substituição A→B sem tirar foco do novo input e retorno ao diálogo pai. O hook compartilhado restaura foco após o commit do React e aborta se outro diálogo assumir a pilha; o seletor registra explicitamente o trigger no Safari. Testes de acessibilidade/Media mantêm a asserção do elemento correto após aguardar o fechamento.

### Capturas revisadas

Capturas automáticas do checkout de verificação com CSS da main, sem edição de imagem. O overlay verde de diagnóstico de TabBar é anterior à entrega e existe somente em `import.meta.env.DEV`; não integra as builds de produção. A barra fixa aparece na posição do viewport inicial em screenshots de página inteira.

| Contexto | Evidência |
| --- | --- |
| Desktop escuro | [PNG](assets/fpp-training-comparison/desktop-chromium-dark.png) |
| Desktop claro | [PNG](assets/fpp-training-comparison/desktop-chromium-light.png) |
| WebKit mobile escuro | [PNG](assets/fpp-training-comparison/mobile-webkit-dark.png) |
| WebKit mobile claro | [PNG](assets/fpp-training-comparison/mobile-webkit-light.png) |
| Tablet retrato | [PNG](assets/fpp-training-comparison/tablet-768.png) |
| Tablet paisagem | [PNG](assets/fpp-training-comparison/tablet-1024.png) |
| PWA de produção, primeira abertura offline e músculo selecionado | [PNG](assets/fpp-training-comparison/offline-training-map.png) |

## Comandos e resultados

Logs de execução locais usam o prefixo `.comparison-` e não entram no produto. Asserções não foram desativadas para obter aprovação.

Já executados:

| Comando | Resultado verificado |
| --- | --- |
| `npm run check:supabase` | 44 aprovados, 3 skips existentes; boundaries aprovadas |
| `npm run lint` | 14 erros de variáveis não usadas, em arquivos idênticos à main; listados abaixo |
| `npm run typecheck` | 2 erros existentes em exercise-sprite-prompts.js, idêntico à main |
| `npm run check:i18n` | Aprovado: 11 locales, 1766 chaves, 1006 strings de fonte e 1324 exercícios PT |
| Playwright integral, retomado com `--test-list-invert` após interrupções | **535 casos únicos: 380 aprovados, 130 falhas, 25 skips**; lista e diagnósticos no anexo, comparações/reexecuções descritas abaixo |
| ESLint em todos os arquivos JS/JSX/MJS da entrega | Aprovado, zero erros |
| `node node_modules/vitest/vitest.mjs run --maxWorkers=2 --testTimeout=20000 --hookTimeout=30000` (em frontend) | **233 arquivos / 2047 testes aprovados, sem skips**; 428,76s |
| Mesmo comando após acrescentar a regressão de anatomia explicitamente vazia | 232 arquivos aprovados; 2047 testes aprovados; 1 suite falhou no hook de preparo do ícone iOS e sua asserção ficou sem executar; 382,68s |
| `node node_modules/vitest/vitest.mjs run src/pwa-ios-icon.test.js --maxWorkers=1 --testTimeout=20000 --hookTimeout=60000` | **1/1 aprovado**, 44,01s. Portanto, os 2048 testes atuais tiveram suas asserções aprovadas entre a suíte e a reexecução, sem excluir o caso do ícone |
| `npm run build` | Aprovado |
| `npm run build:vercel` | Aprovado |
| `npm run build:mobile:web` | Aprovado |
| `npm run test:e2e:pwa`, seguido da repetição dos oito cenários no mesmo build via `node node_modules/@playwright/test/cli.js test --config=playwright.pwa.config.js --output=test-results-pwa-final` | **6/8 aprovados**, incluindo o novo cold load offline; as duas falhas são as mesmas da main isolada (5/7 antes do novo teste) |

### Falhas anteriores verificadas

Lint: `BmiModal.jsx` (2), `TabBar.jsx` (6), `TabBar.test.jsx` (2), `ConsoleSprites.jsx` (1), `admin-pending-sprites.js` (1), `bmi.test.js` (1), `exercise-sprite-prompts.test.js` (1). Os hashes Git dos arquivos são iguais aos blobs de `5b40259`, sem alterações desta implementação.

Typecheck: `exercise-sprite-prompts.js:62:39` e `:86:39`, TS2339 (`default` em `unknown`). Mesmo arquivo na base. Nenhuma regra desativada.

As primeiras rodadas `npm test` usaram os limites padrão de 5s por teste/10s por hook enquanto havia transformações frias e outras suítes executando. Registraram timeouts de App.auth/onboarding e criação do servidor Vite do teste de ícone, seguidos de cascatas `act`; uma rodada também leu quatro catálogos antes do término da tradução. Falhas de foco síncrono foram corrigidas com asserções após o fechamento e regressões próprias. Uma rodada integral executou os **2047 testes existentes naquele momento** com tempo limitado de 20s/30s e dois workers, sem filtro ou exclusão, e passou integralmente. Repros isoladas de onboarding passaram 11/11 na feature e 11/11 na main; auth/ícone passaram 18/18 na main. As tentativas relativas de mídia em localhost:3000 aparecem nos dois lados no happy-dom, não são chamadas adicionadas pela feature.

A revisão posterior acrescentou um caso: `muscleSnapshot: {}` deve continuar vazio na conclusão, em vez de ser removido e permitir inferência futura pelo catálogo. O teste falhou antes da correção; 33 testes de quatro arquivos passaram depois. A repetição integral subsequente aprovou os outros 2047 testes, mas o ícone atingiu o hook de 30s. Um probe com cache separado mediu `createServer` em 592ms e `transformIndexHtml` em 41416ms durante a carga dos navegadores, descartando a hipótese de colisão única do cache como explicação suficiente. O teste original do ícone passou com setup limitado a 60s; seu arquivo e suas asserções não foram alterados. Não se deve interpretar a última rodada integral como inteiramente verde: a aprovação do ícone foi obtida na reexecução explicitada na tabela.

Revisão independente final: sem crítico/importante pendente no escopo. Micro-reproduções confirmaram troca de diálogos preservando o input ativo e conclusão → projeção persistida → JSON mantendo anatomia vazia e carga zero, mesmo com ID conhecido no catálogo.

PWA: cenários 3 (treino offline) e 4 (sprites em cache) esperam `.corner-nav-toggle`, ausente na navegação atual. Resultado reproduzido em checkout separado de `5b40259`: 5 aprovados, 2 falhas iguais. A feature não altera TabBar, sprites ou esse seletor.

O teste PWA adicionado nesta entrega confirma precache do chunk `TrainingComparison` e de `body-paths` sem visitar a rota antes de desconectar. Abre o mapa offline, recarrega o shell, verifica 100% de execução, troca a etapa e seleciona Peito, conferindo Original 3 / Ajustado 2 / Realizado 2. A primeira versão da fixture forneceu `muscleSnapshot` no formato errado (pesos diretos); a asserção detectou realizado 0. A fixture foi corrigida para `{ muscleWeights: ... }`, o contrato efetivamente gerado pelo app. Nenhuma correção de produção foi necessária para esse teste.

## Performance e preservação

### Matriz E2E ampla e retomada

A coleção integral contém 535 casos. A rodada ampla com seis workers foi interrompida junto da sessão; o log registra 298 testes executados (223 aprovações e 75 falhas), além de seis skips. Os casos ainda em andamento não foram considerados concluídos. As rodadas exploratórias anteriores não entram nessa contagem.

A retomada usa a lista oficial `--test-list-invert` contendo **somente esses 298 resultados já registrados**. `--list` confirmou exatamente 237 casos restantes; a execução segue o worker único padrão, sem remover cenários ou ignorar as falhas anteriores. Essa retomada também foi interrompida após 189 resultados (120 aprovados, 44 falhas e 25 skips). Uma conferência dos títulos completos e dos seis skips repetidos identificou **487 casos únicos concluídos**. A última retomada usa a união dos dois logs e `--list` confirmou **48 casos restantes**. Os skips repetidos são descontados na consolidação dos 535 casos.

O ciclo real Home/Flex/conclusão/reload foi um dos timeouts de 60s sob seis workers; sua repetição isolada na branch aprovou em 10,9s, sem alteração de produção. Além disso, os 21 cenários da feature já haviam passado na matriz normal com CSS da main.

Vinte e três casos cuja falha inicial não apontava diretamente para `.corner-nav-toggle` foram comparados em main e feature, ambas com um worker: main **16 aprovados/7 falhas**; feature **15 aprovados/8 falhas**. Sete falharam nos dois lados: cadastro (desktop/mobile), visitante sem conta (desktop/mobile), onboarding desktop, troca de plano desktop e moderação mobile. Nestes dois últimos, a repetição chegou ao seletor antigo de navegação. A única diferença, `plan-switching.spec.js:196`, atingiu 60s no `page.reload`; a repetição isolada da branch passou em **9,1s**, sem mudança de código. A lista nominal e os diagnósticos estão no [anexo E2E](2026-11-23-fpp-training-comparison-e2e-failures.md). A main também reproduziu onboarding em mobile Chromium e WebKit: **0/2**, com `.plan-wizard` ausente. A última parte terminou com **37 aprovados/11 falhas**, sem skips adicionais. Consolidação dos **535 casos únicos: 380 aprovados, 130 falhas e 25 skips existentes**. Os títulos completos de suites (incluindo os dois contextos de iPhone) e os seis skips duplicados foram reconciliados antes da contagem. Não houve execução integral verde.

Na primeira parte, 51 falhas apontavam ao seletor antigo `.corner-nav-toggle`; na primeira retomada foram 43 e na última, 10: **104 diagnósticos diretos do seletor ausente**, em componente idêntico à main. As outras 26 ocorrências são os 23 casos da comparação pareada, o ciclo real da feature aprovado na repetição e os dois onboardings móveis confirmados na main. Isso delimita a investigação realizada: os resultados iniciais permanecem falhas na matriz, mesmo quando a repetição passa. O anexo relaciona todos os 130 casos e os 25 skips.

Sem biblioteca gráfica ou dependência nova. Na build final a rota tem chunk próprio (~8,76 kB bruto / 2,92 kB gzip); geometria body-paths permanece lazy (~93,27 kB / 40,92 kB gzip). O preview não importa o motor nem a geometria. A tela assina somente workouts/body e memoiza sessão e cálculo. Catálogos grandes e avisos de import dinâmico ineficaz de Capacitor/sheets já pertencem à arquitetura existente.

`frontend/src/index.css` e a pasta `output/` já tinham trabalho anterior. Permanecem fora dos commits desta entrega. Nenhum SVG anatômico, sprite ou migration existente foi alterado.

## Git e limites

Commits de implementação: `0519f3d` (motor), `63a55b4` (persistência), `6263922` (idiomas), `b1a9b23` (foco acessível), `e9c13b9` (ciclo e interface), `0c01cbe` (PWA offline) e `4bf5c6f` (anatomia explicitamente vazia). Documentação consolidada neste relatório, especificação, plano, anexo nominal e sete capturas. Push executado com `git push -u origin feat/fpp-training-comparison`. `git ls-remote --heads origin feat/fpp-training-comparison` confirmou **c9107f22a63fb135b0b6f558787a319e161ee162**, idêntico ao HEAD que contém código, documentação e evidências. Este registro de confirmação acompanha a mesma branch. [Branch no GitHub](https://github.com/fabianoschmits/fit-pro-player/tree/feat/fpp-training-comparison). Sem merge na main, PR ou deploy. Não foram executadas alterações de banco hospedado. A próxima etapa pode consumir este histórico versionado para o Resumo Semanal, sem reconstruir o mecanismo; o resumo não foi implementado aqui.

## Inventário dos arquivos da entrega

| Arquivo | Finalidade |
| --- | --- |
| frontend/e2e/pwa.spec.js | Cold load real da rota, anatomia e snapshots offline. |
| frontend/e2e/training-comparison.spec.js | 21 cenários de acesso, responsividade, temas, seleção e ciclo real. |
| frontend/playwright.config.js | Inclui a feature na matriz WebKit mobile. |
| frontend/scripts/check-pt-br.mjs | Reconhece as fontes PT sem desativar guards de idioma. |
| frontend/src/App.jsx | Rota lazy oficial com HashRouter. |
| frontend/src/components/Media.test.jsx | Testes de regressão e contratos do módulo. |
| frontend/src/components/Modals.focus.test.jsx | Testes de regressão e contratos do módulo. |
| frontend/src/components/accessibility.test.jsx | Testes de regressão e contratos do módulo. |
| frontend/src/components/training/TrainingComparisonBodyMap.jsx | Mapas oficiais, escala comum, seletores e detalhe muscular. |
| frontend/src/components/training/TrainingComparisonPreview.jsx | Cartão leve, URL e ordenação compatível de sessões. |
| frontend/src/components/training/TrainingComparisonPreview.test.jsx | Testes de regressão e contratos do módulo. |
| frontend/src/components/training/TrainingComparisonSummary.jsx | Resumo preparado pelo motor e execução das séries. |
| frontend/src/lib/comparison-persistence.test.js | Testes de regressão e contratos do módulo. |
| frontend/src/lib/dialog-focus.js | Restaura foco após commit e protege StrictMode, pilha e handoff. |
| frontend/src/lib/finish-workout.js | Preserva comparação e anatomia na fronteira de conclusão. |
| frontend/src/lib/finish-workout.test.js | Testes de regressão e contratos do módulo. |
| frontend/src/lib/i18n-core.js | Vocabulário da feature, idiomas e fallback. |
| frontend/src/lib/navigation-contexts.js | Mantém contexto Evolução da navegação na nova rota. |
| frontend/src/lib/navigation-contexts.test.js | Testes de regressão e contratos do módulo. |
| frontend/src/lib/persisted-state.js | Projeção explícita dos novos metadados nos contratos existentes. |
| frontend/src/lib/session-recovery.js | Mantém snapshots durante journal, recuperação e ACK remoto. |
| frontend/src/lib/session-recovery.test.js | Testes de regressão e contratos do módulo. |
| frontend/src/lib/training-comparison-history.test.js | Testes de regressão e contratos do módulo. |
| frontend/src/lib/training-comparison-locales.js | Vocabulário da feature, idiomas e fallback. |
| frontend/src/lib/training-comparison-locales.test.js | Testes de regressão e contratos do módulo. |
| frontend/src/lib/training-comparison.js | Motor puro, snapshots normalizados, métricas e escala comum. |
| frontend/src/lib/training-comparison.test.js | Testes de regressão e contratos do módulo. |
| frontend/src/lib/training-dto.js | Desserialização compatível e primeira confirmação imutável. |
| frontend/src/lib/training-dto.test.js | Testes de regressão e contratos do módulo. |
| frontend/src/lib/training-repository.database.test.js | Testes de regressão e contratos do módulo. |
| frontend/src/lib/training-repository.js | Recupera comparação pelas operações existentes da sessão. |
| frontend/src/lib/workout-session.comparison.test.js | Testes de regressão e contratos do módulo. |
| frontend/src/lib/workout-session.js | Congela anatomia de entrada e ajuste no início único da execução. |
| frontend/src/locales/de.js | Integra traduções da comparação no pack existente. |
| frontend/src/locales/es.js | Integra traduções da comparação no pack existente. |
| frontend/src/locales/fr.js | Integra traduções da comparação no pack existente. |
| frontend/src/locales/hi.js | Integra traduções da comparação no pack existente. |
| frontend/src/locales/it.js | Integra traduções da comparação no pack existente. |
| frontend/src/locales/ko.js | Integra traduções da comparação no pack existente. |
| frontend/src/locales/pl.js | Integra traduções da comparação no pack existente. |
| frontend/src/locales/pt.js | Integra traduções da comparação no pack existente. |
| frontend/src/locales/ru.js | Integra traduções da comparação no pack existente. |
| frontend/src/locales/tr.js | Integra traduções da comparação no pack existente. |
| frontend/src/locales/zh.js | Integra traduções da comparação no pack existente. |
| frontend/src/sheets.jsx | Captura original/repetição e integra conclusão e detalhe histórico. |
| frontend/src/sheets.training-comparison.test.jsx | Testes de regressão e contratos do módulo. |
| frontend/src/store/useStore.js | Transporta comparação e músculos no snapshot de início. |
| frontend/src/store/useStore.training-comparison.test.js | Testes de regressão e contratos do módulo. |
| frontend/src/training-comparison.css | Layout responsivo com tokens, foco e reduced motion. |
| frontend/src/views/Home.jsx | Acesso discreto somente após conclusão sem sessão ativa. |
| frontend/src/views/Home.test.jsx | Testes de regressão e contratos do módulo. |
| frontend/src/views/Stats.jsx | Preview logo após resumo inicial de Evolução. |
| frontend/src/views/TrainingComparison.jsx | Seleção progressiva, estados seguros e composição da tela. |
| frontend/src/views/TrainingComparison.test.jsx | Testes de regressão e contratos do módulo. |
| frontend/src/views/Workout.jsx | Confirma ajuste e preserva anatomia de adições/substituições. |
| docs/superpowers/specs/2026-11-23-fpp-training-comparison-design.md | Contrato, ciclo, fórmulas, segurança e estratégia. |
| docs/superpowers/plans/2026-11-23-fpp-training-comparison.md | Ordem de execução e controle do escopo. |
| docs/superpowers/reports/2026-11-23-fpp-training-comparison-verification.md | Este relatório com resultados e limitações reais. |
| docs/superpowers/reports/2026-11-23-fpp-training-comparison-e2e-failures.md | Casos nominais, diagnósticos e comparação pareada com main. |
| docs/superpowers/reports/assets/fpp-training-comparison/*.png | Sete capturas automatizadas revisadas (temas, dispositivos e offline). |

### Identidade dos arquivos com erros estáticos

| Arquivo | Blob main (5b40259) | Blob local |
| --- | --- | --- |
| frontend/src/components/BmiModal.jsx | 038bc052a12821c0478bc3d0c67bb433cfec8d7b | 038bc052a12821c0478bc3d0c67bb433cfec8d7b |
| frontend/src/components/TabBar.jsx | 87cabac7586cb2735a5d3b61dde65e81c49af9d6 | 87cabac7586cb2735a5d3b61dde65e81c49af9d6 |
| frontend/src/components/TabBar.test.jsx | c102356638be5f01a28ae73b01d06dc3fcfafe11 | c102356638be5f01a28ae73b01d06dc3fcfafe11 |
| frontend/src/features/console/ConsoleSprites.jsx | 417a471de8a51afb1122aa0207df2a30ebe6a2a5 | 417a471de8a51afb1122aa0207df2a30ebe6a2a5 |
| frontend/src/lib/admin-pending-sprites.js | 70388ca2564a79fbf57916bb99c7c00fc51fe085 | 70388ca2564a79fbf57916bb99c7c00fc51fe085 |
| frontend/src/lib/bmi.test.js | 4e3deb98a76f0a94d153a7d4f00e31df20f98aff | 4e3deb98a76f0a94d153a7d4f00e31df20f98aff |
| frontend/src/lib/exercise-sprite-prompts.test.js | 765dce2f4061c8d467e7af6e48dff53ab0e75208 | 765dce2f4061c8d467e7af6e48dff53ab0e75208 |
| frontend/src/lib/exercise-sprite-prompts.js | 8d028fea8971965990e775b4ee31ae818dbf61e3 | 8d028fea8971965990e775b4ee31ae818dbf61e3 |

## Limitações e continuidade

- O CI global permanece sem aprovação integral: lint/typecheck anteriores, seletores legados de navegação/onboarding na matriz E2E e dois cenários PWA. Não foram corrigidos fora do escopo nem desativados. Os timeouts e suas reexecuções estão explicitados.
- Não houve teste em aparelhos físicos, PostgREST hospedado nem alteração em banco/produção. Android Chromium e iPhone WebKit foram verificados por Playwright; SQL/RLS foi exercitado em PostgreSQL descartável com o transporte descrito acima.
- O trabalho preexistente de `index.css` e `output/` não integra os commits. O checkout temporário de main foi removido após preservar evidências, mantendo as dependências originais intactas.
- O mecanismo versionado permite implementar o Resumo Semanal consumindo snapshots e séries concluídas. Nenhuma funcionalidade excluída foi criada.
