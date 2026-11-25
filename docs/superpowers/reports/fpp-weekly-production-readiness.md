# FPP — confiabilidade semanal e publicação

## Base e escopo

Base `089157c1358e14e47f196d5a2436b6d566c7937d`, branch `fix/fpp-weekly-production-readiness`. Correções limitadas à integridade do resumo semanal; implementação 03 não iniciada. `frontend/src/index.css` e `output/` preexistentes preservados e excluídos da entrega. Validações visuais/build usam worktree isolado com CSS versionado. Node 22.17.0, dependências dos lockfiles.

## Problemas reproduzidos

Antes das correções, os testes de integridade reproduziram: recorde pessoal com histórico não comprovado; bloqueio indevido de comparação de períodos quando somente o histórico mais antigo é parcial; insights de primeiro registro/primeira semana e recordes sem evidência; deltas comparáveis sem cobertura; metadados atuais substituindo informações históricas na entrada. Cinco asserções falharam e foram corrigidas. Mapa histórico vazio já era autoritativo: teste confirmou esse contrato sem alterar o BodyMap individual.

O repositório lê até 1.000 sessões e operações por consulta, sem paginação integral. `accountSync.saved` informa fila de escrita, não completude de leitura. A restauração `ready` também não comprova histórico remoto. A tela não fornecia explicitamente o catálogo efetivo.

## Disponibilidade e isolamento

`weeklyHistoryAvailability` recebe restauração, identidade ativa, escopo local, histórico disponível, conectividade e evidência do domínio de leitura. Retorna `loading`, `ready`, `partial` ou `error`, além de flags independentes para recordes, comparação, dados locais, estado vazio e atualização.

A evidência autenticada é emitida somente após validar ambas as respostas de histórico, sem atingir seus limites e com payloads completos. O coordenador existente publica loading/ready/error. A evidência é transitória, pertence à conta e é invalidada na troca de escopo. Uma leitura completa comprovada continua confiável offline durante essa execução. Após reiniciar offline, sem prova persistida de completude, o comportamento é conservador e parcial. Não foi criado outro mecanismo de sincronização.

Visitantes usam o escopo local restaurado. O contexto de autenticação é consultado antes de mostrar os dados: uma divergência de conta oculta imediatamente histórico e catálogo anteriores. Previews e tela usam o mesmo hook; o preview mantém cálculo leve. Skeleton somente sem dados durante carregamento real; dados locais permanecem visíveis com aviso. Erros usam `retryAccountSync`, incluindo nova leitura oficial do histórico. Estado vazio definitivo somente com evidência; ausência offline não é apresentada como ausência de treinos.

## Recordes e comparação

O padrão `historyComplete` do motor de desempenho passou a false. Recordes pessoais, primeiros registros e primeira semana exigem evidência explícita. Em cobertura parcial, mostra melhor registro disponível. `canComparePeriods` é separado da completude histórica: consumidores podem comparar períodos comprovados sem confirmar recordes de todos os tempos. Deltas sem cobertura não possuem percentual nem direção inventados. As mensagens históricas também verificam a evidência.

Sem paginação comprovada, respostas truncadas permanecem parciais; não se presume cobertura de períodos somente porque o usuário está online. O contrato dos snapshots e as fórmulas do BodyMap individual não foram alterados. Datas de calendário permanecem locais e não passam pelo filtro de instante UTC para excluir treinos futuros.

## Exercícios personalizados

O catálogo memoizado parte do catálogo público fonte e somente de `S.customEx` da conta ativa. Não copia o overlay global mutável de exercícios privados e não faz consultas por exercício. Metadados: snapshot histórico (inclusive mapa vazio), exercício histórico da entrada, catálogo autorizado, fallback oficial, indisponível. Exercícios removidos mantêm séries/repetições/tempo sem músculos inventados. Estimativas legadas não passam a ser séries diretas confirmadas. O mesmo catálogo chega ao desempenho e aos nomes dos destaques; modalidades assistidas, peso corporal, cardio e tempo não recebem recordes convencionais de carga.

## Arquivos

- `lib/weekly-history-availability.js`, `lib/use-weekly-history.js`: evidência compartilhada e catálogo por escopo.
- `auth/auth-context.js`, `auth/AuthProvider.jsx`: contexto leve compartilhado, sem alterar autenticação.
- `lib/training-repository.js`, `App.jsx`, `store/useStore.js`: evidência real de leitura e integração ao coordenador/retry existentes.
- Motores `weekly-progress*`: defaults conservadores, prioridade histórica, comparação independente e filtro de data local.
- Tela e componentes semanais: estados de disponibilidade, supressão de deltas incertos e nomes autorizados.
- `exercises.js`: composição do catálogo efetivo a partir da fonte pública e personalizados autorizados.
- Locales semanais: quatro mensagens de disponibilidade nos 11 idiomas.
- Testes de integridade/disponibilidade, desempenho/insights, Playwright semanal e PWA.

## Validação

Logs brutos permanecem localmente em `.git/fpp-production-evidence/`, sem tokens ou dados reais. Os cenários novos utilizam fixtures sintéticas, leituras remotas controladas e ações reais de interface. Rodadas diagnósticas não são contabilizadas como aprovação integral.

| Verificação | Resultado |
| --- | --- |
| `npm run lint` | Zero erros, exit 0 |
| `npm run typecheck` | Zero erros, exit 0 |
| `npm run check:i18n` | 11 idiomas, 1.850 chaves, 1.064 strings de código, 1.324 exercícios PT-BR; exit 0 |
| `npm run check:supabase` na raiz | 44 aprovados, três skips preexistentes, zero falhas; boundary check aprovado |
| Vitest completo `--maxWorkers=2 --testTimeout=20000 --hookTimeout=30000` | 242 arquivos, 2.178 testes aprovados, zero falhas, 335,45 s |
| Integridade semanal direcionada | 82 aprovados em quatro arquivos, exit 0 |
| Playwright disponibilidade/catálogo | Nove casos aprovados nos três projetos; retry separado abaixo |
| Playwright erro/reconexão corrigido | 3/3 aprovados, Chromium desktop/mobile e WebKit, 54,8 s |
| Fotos privadas, Chromium desktop | 1/1 aprovado, 42,6 s |
| `npm run test:e2e:pwa` final | 11 aprovados, zero falhas, 1,2 min; dez cenários anteriores preservados |
| `npm run build`, `build:vercel`, `build:mobile:web` | Três exits 0 |

Foram adicionados 29 testes unitários (disponibilidade e integridade), quatro cenários Playwright × três projetos e um cenário PWA de personalizado após reload offline. O teste antigo de desempenho agora fornece explicitamente histórico completo quando essa é a premissa da asserção; as asserções anteriores foram preservadas. A revisão independente apontou default de comparação e classificação histórica de peso corporal; ambos foram reproduzidos em vermelho e corrigidos.

Conforme a instrução final do usuário para reduzir testes, a repetição longa de `npm run test:e2e` foi interrompida, sem ser declarada verde: até a interrupção havia 85 aprovações e uma falha em fotos. Esse caso começou às 21:25:13 e houve atualização do arquivo App.jsx no ambiente às 21:25:14, contaminando a rodada com HMR; a execução isolada com fonte congelada passou. A matriz anterior de 614 aprovações/25 skips não é apresentada como resultado novo. Nenhum skip, retry ou timeout global foi acrescentado.

O teste novo de reconexão inicialmente tentava clicar em retry depois que o evento online já havia resolvido a sincronização e removido o botão (três timeouts). A correção mantém a asserção: verifica o botão enquanto o erro está ativo e observa a reconexão automática sem clicar num controle já removido. Não houve alteração de produto para fazer esse teste passar. Uma rodada unitária diagnóstica também precedeu a conclusão das fixtures; somente a rodada integral final acima é considerada aprovada.

## Bundle e cache

Web final: entrada 1.145,40 kB / 317,14 kB gzip; WeeklyProgress 24,55 / 7,94 kB; preview 2,69 / 1,14 kB; módulo semanal compartilhado 5,86 / 2,59 kB; CSS semanal inalterado 8,29 / 1,96 kB. Antes do hotfix: entrada 1.145,00 / 317,00 kB, tela 23,12 / 7,52 kB. Precache passou de 354 para 355 entradas, mantendo aproximadamente 56,66 MB; o módulo compartilhado de contexto não duplica anatomia ou sprites. Nenhuma biblioteca nova. Avisos preexistentes do bundler não foram suprimidos.

## Prévia e publicação

Prévia validada: `dpl_HBofxqnap7K2bvg6AhNq55RUb9fe`, commit `379869b42b6e8ff57c577315313df9a475a48c9e`, branch de correção, READY, aliasError null. URL https://fit-pro-player-ldrdvn0ow-fabianoschmits-9996s-projects.vercel.app . A proteção Vercel Authentication permaneceu ativa: acesso por link temporário de dez minutos, revogado após os testes; arquivos locais de credenciais removidos.

Integração fast-forward da main `5b402590a4a00571d82e2541bc4716f97f39749a` para `379869b42b6e8ff57c577315313df9a475a48c9e`, seguida de push oficial. Ancestralidade de `2456bf6`, `c722bb5`, implementação semanal e correções confirmada. Nenhum force push, merge commit ou produção por promoção de preview.

Primeiro deployment publicado: `dpl_4HNmTyNU1anJg6D6A2V3nhxPbvvV`, projeto fit-pro-player, Git main, commit `379869b42b6e8ff57c577315313df9a475a48c9e`, target production, READY em **2026-11-24 21:41:45 −03:00**, aliasError null. URL https://fit-pro-player-jvkw3hqtm-fabianoschmits-9996s-projects.vercel.app . Aliases oficiais `www.fitpp.com.br` e `fitpp.com.br` associados. O commit de encerramento deste relatório altera somente documentação e é integrado pelo mesmo fluxo oficial, sem alterações adicionais de aplicação.

Smoke no domínio https://www.fitpp.com.br concluído às 21:43:06 −03:00: HTTP 200 para aplicação, manifesto com ícones e Service Worker; precache contendo WeeklyProgress, TrainingComparison e body-paths. `fitpp.com.br` responde 308 para `https://www.fitpp.com.br/`, conforme configuração anterior.

Chromium e WebKit: cinco rotas por navegador (`/home`, `/progress`, `/progress/weekly`, `/progress/training-map?session=B`, `/progress/history`), com visitante isolado e dados sintéticos locais. Métricas de dois treinos/24 séries/90 minutos verificadas; anatomia carregada; seleção muscular; navegação inferior; temas claro/escuro; larguras 320, 360, 390, 430, 768 e 1280 sem overflow. Zero exceções JavaScript, zero falhas JS/CSS e zero mensagens console.error nos dois navegadores. Login com credenciais reais não foi executado.

Capturas locais ignoradas em `frontend/test-results-production/{preview,production}/` (26 por rodada), inspecionadas visualmente em 320 escuro e WebKit claro. Capturas de estado parcial offline e teste de fotos também são exclusivamente sintéticas; não foram incorporadas imagens grandes ao Git.

Logs Vercel filtrados pelo deployment publicado e níveis error/fatal, consultas às 21:42:48 e 21:43:31 −03:00, janela de dez minutos: nenhum registro encontrado. A janela efetivamente observada após READY foi de aproximadamente dois minutos; isso não substitui observabilidade de longo prazo e não coleta automaticamente erros do navegador. Os erros de cliente foram verificados separadamente no smoke.

PWA: onze testes locais aprovados, incluindo atualização SW, sessão ativa, retomada offline, histórico, mapas e personalizado após reload. No domínio publicado, manifesto, SW e chunks novos acessíveis. O mecanismo existente posterga reload automático quando a sessão não permite atualização; nenhum armazenamento foi limpo e nenhum logout forçado. Para PWA instalada, aguardar o fluxo normal de atualização e concluir/salvar treino ativo antes de aceitar recarregamento. Sem atualização agressiva ou duplicação de anatomia.

## Produção anterior e rollback

- Main anterior: `5b402590a4a00571d82e2541bc4716f97f39749a`.
- Deployment anterior: `dpl_Ch7fRueGQXPCjXazgv2k41hT5zEq`, READY, target production, Git main, aliasError null.
- URL: https://fit-pro-player-84j9rykqg-fabianoschmits-9996s-projects.vercel.app
- Aliases confirmados: `www.fitpp.com.br`, `fitpp.com.br`.
- Vercel identifica esse deployment como candidato a rollback; ferramenta oficial disponível. Rollback somente em falha crítica, sem apagar dados, alterar DNS, credenciais ou histórico Git.

## Banco e limitações

Nenhuma tabela, migration, RPC, Edge Function, RLS ou configuração Supabase modificada. Nenhuma escrita em contas reais nos testes. A validação funcional remota usa visitante isolado com dados sintéticos; não equivale a login com credenciais de usuário. Viewports emulados não substituem aparelhos físicos. A cobertura limitada de históricos grandes é identificada conservadoramente, sem inferir ausência de atividade.
