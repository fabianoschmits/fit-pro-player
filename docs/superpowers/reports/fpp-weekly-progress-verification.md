# Verificação — FPP Weekly Progress

## Base e preservação

- Base: c722bb5ea0ee8e1b8cbd4d38b7b3cae0b20cafa5, origin/fix/fpp-comparison-stability. Na preparação, origin/main ainda não continha essa base.
- Branch: feat/fpp-weekly-progress. Nenhum merge ou publicação em produção autorizado/executado nesta entrega.
- Node v22.17.0; dependências dos lockfiles; Playwright 1.63.0; Supabase CLI fixada em 2.122.0.
- frontend/src/index.css preexistente preservado: hash 9f462ff25dce38519db2caa2e4dbf26c2e41cf1f, diff 10.713 adições / 2.227 remoções. output/ preexistente também preservado. Nenhum deles deve entrar nos commits.
- Validação browser/build em worktree nativo isolado de c722bb5, com cópias dos arquivos da funcionalidade e dependências físicas próprias. Isso valida o CSS versionado da branch sem sobrescrever o CSS local do usuário.

## Implementação e decisões

Resumo derivado do histórico existente, com calendário local segunda–domingo, comparação de períodos equivalentes, métricas físicas, distribuição muscular, planejamento elegível, desempenho comparável e até três insights determinísticos. Schema derivado 1; nenhum resumo persistido. Preview compartilha a base sem executar recordes/mapas e sem ler séries fora dos períodos comparáveis.

A especificação do usuário foi o plano vinculante; não foi criada outra fase de aprovação de design. Execução inline, testes antes das funções e revisão independente única da implementação. Helpers adicionais em lib/ separam base leve, formatação e relógio de fronteira diária. Nenhuma biblioteca nova.

Snapshots continuam no contrato existente. training-comparison.js recebeu somente o export de thresholdsOf; fórmula, geometria, sprites, DTO e recuperação permaneceram intactos. Sem novo histórico, RPC, tabela, RLS, migration ou requisição Supabase.

A revisão independente encontrou ordenação de recordes completedAt-only e atribuição direta em históricos sem metadados. Ambos foram reproduzidos com testes vermelhos e corrigidos. Séries diretas sem referência histórica confiável aparecem como não registradas; a estimativa ponderada legada permanece identificada como parcial. Também foram corrigidos retenção de linhas para comparação de repetições e desempate de duplicatas por conclusão canônica.

## Arquivos e finalidade

| Grupo | Arquivos |
| --- | --- |
| Calendário/base/formatador/relógio | frontend/src/lib/weekly-progress-calendar.js, weekly-progress-core.js, weekly-progress-format.js, use-weekly-clock.js |
| Motores completos | frontend/src/lib/weekly-progress.js, weekly-progress-performance.js, weekly-progress-insights.js |
| Testes novos | weekly-progress-calendar.test.js, weekly-progress.test.js, weekly-progress-performance.test.js, weekly-progress-insights.test.js, use-weekly-clock.test.js, weekly-progress-locales.test.js e WeeklyMuscleSummary.test.jsx |
| Tela/estilo | frontend/src/views/WeeklyProgress.jsx e frontend/src/weekly-progress.css |
| Integrações | App.jsx, Home.jsx, Stats.jsx, History.jsx, sheets.jsx, lib/navigation-contexts.js e seu teste |
| Reuso de escala | lib/training-comparison.js: export do helper existente |
| Traduções | weekly-progress-locales.js e os 11 packs de locales/ |
| Fixtures existentes | History.test.jsx e Stats.recovery.test.jsx: contexto Router atualizado, asserções preservadas; novo caso de gráfico legado |
| Browser/offline | e2e/weekly-fixtures.js, weekly-progress.spec.js, pwa.spec.js, training-comparison.spec.js e playwright.config.js |
| Preparação iOS | src/pwa-ios-icon.test.js: configuração CSS somente do servidor desse teste |
| Documentação | docs/superpowers/specs/fpp-weekly-progress.md e este relatório |

Componentes em components/training/weekly/: WeeklyActivityChart.jsx, WeeklyMuscleSummary.jsx, WeeklyMuscleSummary.test.jsx, WeeklyPerformanceSummary.jsx, WeeklyPlanningSummary.jsx, WeeklyProgressComparison.jsx, WeeklyProgressEmptyState.jsx, WeeklyProgressHeader.jsx, WeeklyProgressInsights.jsx, WeeklyProgressMetrics.jsx, WeeklyProgressPreview.jsx, WeeklyProgressSkeleton.jsx, WeeklyWorkoutList.jsx

## Acessos

- Home: cartão Sua semana após a ação principal de treino.
- Evolução: indicadores → resumo semanal → BodyMap Planejado × Realizado → demais módulos.
- Conclusão: Ver minha semana junto da ação do mapa; fecha o modal antes de navegar e usa a semana da conclusão.
- Histórico: ação única no cabeçalho, sem repetir botão em cada sessão.
- Rota: /#/progress/weekly; consulta: /#/progress/weekly?week=2026-11-16. Parâmetro normalizado, futuro limitado e estado de retorno preservado.
- Detalhes reutilizam WorkoutDetail; mapa individual reutiliza /progress/training-map?session=<id>; desempenho abre a estatística existente /progress?exercise=<id>.

## Resultados dos comandos

| Comando | Resultado final confirmado |
| --- | --- |
| npm run lint | exit 0, zero erros |
| npm run typecheck | exit 0, zero erros |
| npm run check:i18n | exit 0; 11 packs, 1.846 chaves, 1.062 strings de código, 1.324 exercícios PT-BR |
| npm run check:supabase (raiz, onde o script existe) | 44 aprovados, 3 skips preexistentes, zero falhas; boundary check aprovado |
| node node_modules/vitest/vitest.mjs run --maxWorkers=2 --testTimeout=20000 --hookTimeout=30000 | 240 arquivos / 2.149 testes aprovados, zero falhas, 244,75 s, exit 0 |
| Playwright semanal direcionado | 95/96 na rodada diagnóstica; corrida do teste de retorno do segundo plano corrigida e reproduzida 1/1; resultado integral final abaixo |
| Playwright adicional de músculo sem atividade | 3/3 aprovados, 34,6 s, Chromium desktop/mobile e WebKit |
| Playwright comparativo com nova ordem da Evolução | 6/6 aprovados, 55,7 s, três projetos/dois temas |
| npm run test:e2e | 614 aprovados, 25 skips preexistentes, zero falhas; 639 casos, 53,0 min, exit 0; sem filtros, worker normal 1 |
| npm run test:e2e:pwa | 10 aprovados, zero falhas, 49,3 s, exit 0 |
| npm run build | exit 0 |
| npm run build:vercel | exit 0 |
| npm run build:mobile:web | exit 0 |

As reexecuções direcionadas não são somadas ao total da rodada integral. Os 96 testes unitários novos/estendidos em relação aos 2.053 originais são: 93 nos seis arquivos de motor/relógio/locales, um no componente e dois em testes existentes de navegação/gráfico. A coleta E2E passou de 543 para 639: 32 cenários novos × três projetos. Nenhum skip, retry ou timeout global foi adicionado.

Após a matriz integral, houve somente refinamento de abreviação traduzida de minutos nos insights. O texto final foi validado por 3/3 cenários direcionados nos três projetos (27,8 s), nova rodada PWA 10/10, três builds e verificações estáticas; a suíte unitária integral de 2.149 casos também inclui o texto final. Nenhuma fórmula ou fluxo mudou após a matriz integral.

## Diagnósticos e correções da validação

1. Retorno Home/Histórico: normalizar week estava descartando location.state. setParams agora preserva a origem em normalização, seleção e mudança de semana.
2. Conclusão: os testes novos passaram a confirmar peso e seguir os modais reais; não pulam o fluxo para obter resultado verde.
3. Foreground: esperar somente a URL não garantia commit do seletor React antes de mudar novamente o relógio. O teste espera também o valor do seletor; a aplicação preserva a seleção histórica.
4. Testes existentes: History precisava do contexto MemoryRouter; o mock de Stats precisava de useSearchParams/Link. As asserções funcionais foram mantidas.
5. Gráfico existente: históricos sem start produziam coordenadas não finitas ao abrir a estatística de exercício. Agora usa a data histórica disponível; teste vermelho/verde incluído. Fórmulas estatísticas inalteradas.
6. PWA: o seletor genérico role=status encontrava também o toast global. O teste agora verifica o status dentro da página semanal. Diagnóstico inicial: 9/10; rodada final: 10/10.
7. BodyMap semanal: músculo sem atividade não abria detalhe. A apresentação mostra zero registrado e oferece seletor nativo dos 18 grupos, além do SVG e do ranking. Sem alteração de carga/escala.
8. Teste antigo do comparativo: exigia BodyMap imediatamente após stats-overview. A especificação 02 exige o semanal entre ambos. A asserção agora verifica as duas adjacências, preservando todo o restante. Primeira matriz diagnóstica interrompida após confirmar duas falhas dessa expectativa obsoleta; rodada integral nova iniciada do zero em 13:25.
9. Ícone iOS: a preparação ocasionalmente excedia 30 s. Perfil isolou CSS inline em 17.778 ms, contra createServer em 229 ms. Desabilitar descoberta de dependências não resolveu e foi removido. A descoberta de configuração PostCSS inexistente era a demora: o servidor somente desse teste recebe css.postcss vazio, mantendo vite.config.js, hooks reais, bytes PNG, dimensões, RGB e fallback. CSS caiu para 281 ms; preparação mínima final 508 ms. A rodada integral final inclui o teste, sem ampliar limite ou omiti-lo.

## Calendário, métricas e regressões

Relógio de quarta-feira: atual 2 treinos / 2 dias / 24 séries / 90 min; anterior comparável 2 / 2 / 18 / 80 min, excluindo quinta anterior. Casos de mês/ano/bissexto, timestamp perto da meia-noite, data legada, fuso inválido, DST de 167 horas e meia-noite inexistente aprovados.

Séries concluídas excluem aquecimento/incompletas, sem duplicar unilateral ou supersérie. Snapshots personalizados, substituições, séries extras acima de 100%, cobertura parcial, legado, duplicatas e imutabilidade cobertos. Desempenho exige ID/modalidade/unidade equivalentes; reps exigem carga equivalente; primeiro registro não é PR e futuro não interfere no passado. Insights são locais/determinísticos, sem API externa ou linguagem clínica.

A suíte completa mantém cobertura de BodyMap, Flex, sessão, recuperação, histórico, DTO, Supabase, persistência, navegação, onboarding, autenticação, sprites, fotos e planos profissionais. Nenhuma alteração em permissões, notificações, descanso, geração de rotinas ou fila de exercícios.

## Offline e privacidade

Os oito cenários PWA anteriores foram preservados. Dois cenários novos cobrem rota semanal fria offline, anatomia/seleção, troca de semana, conclusão real offline, reconexão sem duplicidade e reload da semana selecionada. Há asserções das entradas reais de cache WeeklyProgress/body-paths, métricas e ID único da sessão.

A conclusão offline nova utiliza visitante: não é apresentada como teste de sincronização em produção. Transporte autenticado, reconciliação e isolamento continuam cobertos por testes existentes de domínio/DTO e contextos sintéticos. Nenhum dado real de usuário é utilizado. Nenhuma consulta, egress Supabase ou tabela adicional. Não houve operação em produção.

## Performance, bundle e precache

Benchmark sintético de 5.000 sessões: 605 ms na primeira execução registrada, sem limite temporal rígido. O preview não lê séries fora dos períodos comparáveis (teste com getter que falha em acesso indevido). Sem biblioteca de gráficos nova.

| Asset web final | Bruto | Gzip |
| --- | --- | --- |
| WeeklyProgress | 23,12 kB | 7,52 kB |
| WeeklyProgressPreview | 2,27 kB | 0,97 kB |
| weekly-progress compartilhado | 4,57 kB | 1,99 kB |
| CSS semanal | 8,29 kB | 1,96 kB |
| body-paths, inalterado | 93,27 kB | 40,92 kB |
| Entrada | 1.145,00 kB | 317,00 kB |

Baseline de entrada: 1.141,50 / 315,59 kB. Precache: 354 entradas / ~56,66 MB contra 350 / ~56,58 MB. Anatomia reutilizada e nenhum raster duplicado. Permanecem os avisos existentes do bundler sobre imports dinâmicos e timings; não foram suprimidos.

## Capturas e limitações

Capturas exclusivamente sintéticas em frontend/test-results-weekly-evidence/2026-11-24/{full,targeted,pwa}, diretório já ignorado pelo Git. Incluem Home, Evolução, tela completa mobile/desktop, temas, gráfico, mapa, planejamento, desempenho, vazio, semana histórica e offline. Capturas do novo teste ocultam apenas o painel DEV de debug preexistente, sem alterar produto ou asserções. Foram inspecionados desktop completo, 320 escuro e 390 claro.

A matriz cobre Chromium desktop, Chromium Pixel 7 e WebKit iPhone 13; larguras 320, 360, 390, 430, 600, 768 e 1280 nos dois temas. Não equivale a ensaio em aparelhos físicos. Sem testes com contas reais ou mudanças em produção. Metadados antigos ausentes continuam identificados como parciais; ausência de registro não é inferida como ausência de atividade física.

## Git e situação da entrega

Implementação organizada em cinco commits abaixo, além do commit desta documentação. O push utiliza somente feat/fpp-weekly-progress, sem force push ou merge. A prévia é gerada exclusivamente pela integração Git da Vercel; nenhuma implantação manual.

ce1af5f test: stabilize iOS icon HTML preparation
b7b006f test: cover weekly progress and offline navigation
60ce662 feat: connect weekly progress to workout and evolution flows
f0d6119 feat: build weekly progress screen and shared previews
29721ec feat: add weekly progress engines and localized metrics


