# FPP — correções de estabilidade

Base: `2456bf66c9bddfdfb508663a50b9b4f474a699ab`. Branch: `fix/fpp-comparison-stability`.

## Registro de execução

- Git atualizado por fast-forward antes de criar a branch; `index.css` e `output/` preexistentes preservados.
- ESLint inicial: 14 erros confirmados nos sete arquivos indicados. Correção restrita a imports/helpers não usados e renderização antiga de pivot que já não era chamada.
- Ordem: estáticos → estado da navegação → helper/suíte de navegação → onboarding/autenticação → PWA → matriz completa → regressões/builds → documentação e push.
- Ruling: a especificação detalhada do usuário é o plano vinculante; não repetir descoberta de design. Manter configuração normal de um worker, sem retries globais ou aumento de timeout.
- Interfaces compartilhadas: normalização da TabBar e helper `openMainNavigation` devem concordar com a barra sempre aberta; onboarding e fixtures devem preservar rascunhos e distinguir a entrada do app da conclusão do perfil.

## Resultados

- Estáticos iniciais: ESLint 14 erros; TypeScript TS2339 nas duas leituras `module.default` (62/86).
- Removidos imports inúteis de BmiModal, ConsoleSprites, admin-pending-sprites e bmi.test; retirados PivotTransition, setOpen, toggleMenu, estado de ativação do pivot e referência antiga de foco. DockSlotButton, morphs e handlers reais mantidos.
- `normalizePromptChunk(unknown)` refina objeto/default; ambos os consumidores usam `loadPromptChunk` e o mesmo Map. Testes exercitam export default, objeto direto, null, ID/chunk ausente, prompt real e identidade do registro em cache. O teste novo falhou antes da implementação.
- Regressões `open:false` com/sem posição falharam antes da normalização; após a correção, 32/32 testes de TabBar/prompts passaram. Foco da opção de movimentação volta ao trigger Mais existente.
- ESLint pós-limpeza: exit 0; typecheck pós-refinamento: exit 0. Repetidos ao final com exit 0.
- Navegação desktop: primeira rodada 20/21; a falha foi uma asserção nova sobre o contêiner do título que também contém a contagem de séries. Corrigido o seletor para o `strong` do título, preservando a igualdade exata.
- Fixture passa a aceitar `guest` e `entered` explicitamente e aplica o estado apenas uma vez, antes da aplicação. Evita scripts concorrentes de limpeza que eram reaplicados a cada reload. `check_email_registered` responde booleano false, conforme as migrations, respeitando overrides dos testes.
- Cadastro: seletor do telefone atualizado para o rótulo real “Telefone”; mantidos testes de dígitos excessivos, acrescentados DDD inválido e bloqueio por ausência de consentimento. Nenhum formulário do produto alterado.
- Substituído o wizard antigo pelo fluxo real de quatro etapas, com preferência final de 40min e caso separado de restauração do rascunho. Landing usa as ações atuais. A CTA “Entrar ou criar conta” da comunidade é intencionalmente mantida: existe nesse contexto e não é o botão removido da Landing.
- Matriz coletada: 543 casos versus 535 anteriores. Nenhum skip novo/retry global/timeout global foi adicionado. Resultado integral registrado abaixo.

As contagens integrais abaixo vêm dos comandos concluídos; diagnósticos e rodadas interrompidas são identificados separadamente.

## Evidências consolidadas até esta etapa

- Node 22.17.0; dependências fixadas preservadas; nenhuma biblioteca adicionada.
- Suíte unitária integral no diretório original: `node node_modules/vitest/vitest.mjs run --maxWorkers=2 --testTimeout=20000 --hookTimeout=30000`: **233 arquivos e 2.053 testes aprovados**, exit 0, 197,11s. Inclui comparação muscular, snapshots, DTO, recuperação e Flex. As reexecuções direcionadas não são somadas a esse total.
- A tentativa inicial no worktree isolado não foi válida: o junction de node_modules resolveu SVGs de country-flag-icons fora da raiz permitida pelo Vite. Reprodução isolada confirmou `Denied ID .../AC.svg?url`. A tentativa foi interrompida e a suíte completa executada no checkout original, sem ampliar permissões do Vite e sem suprimir testes.
- Navegação direcionada em Chromium: 21/21 aprovados; reforço posterior das duas verificações de movimento: 2/2 aprovados. Os casos cobrem 320, 390, 600, 768, 1024 e 1280px nos dois temas. A matriz integral continua sendo a referência final entre navegadores.
- Encontrados e corrigidos dois defeitos reais: clique nativo após arraste abria Mais indevidamente; inset inferior de 24px sobrepunha o espaço dos rótulos. Testes reproduziram ambos antes das correções. O bloqueio existente de clique após arraste agora é respeitado; foco por teclado continua permitido. O CSS mantém 68px úteis da barra e acrescenta apenas o inset seguro móvel. Não altera geometria do BodyMap, sprites, cores ou animações ativas.
- Removidos estilos exclusivos do PivotTransition sem uso. Os testes de movimento verificam término, duração, iteração única e conteúdo visível com movimento reduzido; não ignoram animações infinitas.
- Onboarding: os dois cenários reais passaram isoladamente (conclusão com 40min e retomada de revisão). O fixture incompleto não contém completedAt do perfil antigo, pois isso legitimamente aciona a recuperação legada do produto.
- Ambiente E2E configurado com VITE_STANDALONE=0 para exercitar as CTAs reais da Landing conectada. A configuração PWA permanece própria. Sem aumento de timeout ou retries.
- Verificação visual/browser e builds usam worktree nativo baseado em 2456bf6, com somente os arquivos deste hotfix copiados. O index.css usado é o versionado (hash 9007f3cabec86708f1a9717b17530056a98e5b77); o arquivo local do usuário continua com hash 9f462ff25dce38519db2caa2e4dbf26c2e41cf1f.
- ESLint final após ajustar o caminho do import usado pelo teste: exit 0. TypeScript: exit 0. i18n: 11 idiomas, 1.766 chaves, 1.006 strings de código e 1.324 exercícios PT-BR, exit 0. check:supabase executado na raiz (script não existe no frontend): 44 aprovados, três skips preexistentes e verificação de fronteiras aprovada.
- Nenhuma migration, RPC, permissão, fórmula de treino ou contrato histórico foi alterado. Arquivos do motor, BodyMap, DTO e recuperação permanecem iguais ao commit base.

## Arquivos e escopo das correções

| Arquivo (frontend/) | Finalidade |
| --- | --- |
| src/components/BmiModal.jsx | Imports não utilizados; renderização e IMC intactos. |
| src/components/TabBar.jsx | Retira pivot morto, normaliza open legado, preserva posição, corrige foco e clique pós-arraste. |
| src/components/TabBar.test.jsx | Preferências antigas, drag e teclado, mantendo contextos/ícones/Retomar. |
| src/components/tabbar-motion.css | Inset seguro móvel; remove somente CSS do pivot não renderizado. |
| src/features/console/ConsoleSprites.jsx; src/lib/admin-pending-sprites.js; src/lib/bmi.test.js | Limpeza de imports sem alteração de regras. |
| src/lib/exercise-sprite-prompts.js e .test.js | Refinamento unknown/default, carregador compartilhado e testes de cache/ausência/formato. |
| e2e/fixtures.test.js | Prontidão da barra e estados iniciais explícitos, aplicados uma vez. |
| e2e/corner-navigation.spec.js | Cobertura da barra atual sempre aberta, seis larguras/dois temas, Mais/foco/drag/ícones/contextos. |
| e2e/fpp-flex.spec.js | Onboarding real de quatro etapas e rascunho, preservando testes Flex existentes. |
| e2e/account-phone.spec.js; e2e/audit-regressions.spec.js; e2e/app-launch.spec.js | CTAs e estados atuais, validação de consentimento/telefone e visitante persistente. |
| e2e/page-transitions.spec.js | Usa prontidão compartilhada da navegação atual. |
| e2e/plan-switching.spec.js | Reload com domcontentloaded e verificações de UI existentes. |
| e2e/pwa.spec.js | Recuperação offline real e validação de todos os frames do catálogo sem hashes fixos. |
| playwright.config.js | Modo conectado da Landing nos testes gerais, mantendo matriz/worker/timeouts. |

Busca ativa por `corner-nav-toggle` e `plan-wizard` em e2e e TabBar.test: nenhuma ocorrência. Documentação histórica anterior preservada.


## Matriz integral Playwright — rodada única

Comando: `npm run test:e2e`, configuração normal, um worker, sem filtros. Rodada de 08:06 a 08:52 em 24/11/2026: **543 casos, 518 aprovados, zero falhas, 25 skips preexistentes**, duração 45,8min, exit 0.

| Projeto | Aprovados | Falhas | Skips |
| --- | ---: | ---: | ---: |
| desktop-chromium | 229 | 0 | 0 |
| mobile-chromium | 205 | 0 | 24 |
| mobile-webkit | 84 | 0 | 1 |
| Total | 518 | 0 | 25 |

A referência anterior tinha 535 casos únicos (380 aprovados, 130 falhas e 25 skips), agregados de rodadas interrompidas. A rodada nova foi integral e única. A diferença de oito casos vem de um cenário adicional de navegação por projeto (+3), retomada do rascunho por projeto (+3) e login atual da Landing nos dois Chromium (+2). Os cenários obsoletos de recolhimento foram substituídos pelos da barra permanentemente aberta; os skips existentes da matriz não foram alterados.

Checklist das 130 falhas anteriores: os 104 diagnósticos do toggle removido foram resolvidos no helper e na substituição dos cenários obsoletos. As categorias restantes também foram executadas integralmente: cadastro/login/visitante, onboarding, fotos, abertura do app, comunidade/moderação, gerenciamento, troca de planos, recuperação/histórico e comparativo. Nenhuma falha remanescente na rodada. Não foram somados rechecks à contagem integral.

Navegação: 63/63 casos nos três projetos. Comparativo: 21/21, incluindo temas, acesso via Evolução/Home/Histórico, rota direta, contas distintas, tablet, histórico longo, sessão livre e ciclo real Home → Flex → conclusão → reload. Os testes originais do motor e dos contratos protegidos permanecem inalterados.

Mensagens observadas: o WebKit emitiu `ResizeObserver loop completed with undelivered notifications` em cenários aprovados. Há mensagens esperadas de conflito de revisão em testes que provocam essa resposta, além dos avisos de service worker bloqueado na matriz geral e movimento reduzido. Não se declara console sem mensagens. A suíte unitária também emite ECONNREFUSED de recursos happy-dom e aborts de teardown, mas concluiu os 2.053 testes com exit 0.

## PWA — diagnóstico e correção adicional comprovada

Primeira rodada: sete aprovados e uma falha, 39,2s. Teste 4 encontrou e decodificou os frames online, confirmou todos no cache, mas após reload offline a animação caiu no fallback muscular. O trace mostrou `frames-C7tYe5dZ.js` carregado antes do controle do SW e ausente offline (`ERR_INTERNET_DISCONNECTED`); as imagens responderam 200. Portanto não era um problema de timeout nem de hash do teste.

Correção em `frontend/scripts/precache-manifest.mjs`: os pequenos módulos JS `frames-*` acompanham o shell desde a instalação. Os rasters continuam excluídos do precache e carregados sob demanda no cache limitado existente. No build observado são 156 módulos e 44.332 bytes adicionais, com 156 requisições na instalação. Não se alterou SW, sprite, algoritmo de preload ou limites de cache. Testes do manifesto foram atualizados para exigir o módulo e continuar excluindo as imagens; ambos falharam antes da correção e passaram depois. Revisão independente somente leitura não encontrou bloqueios.

Rodada integral final `npm run test:e2e:pwa`: **8/8 aprovados, zero falhas/skips, 35,8s**, exit 0. Abrange início frio offline, navegação offline, treino iniciado/restaurado com mesmos exercícios/séries/snapshots, todos os frames reais decodificados e animando offline, comparativo lazy e anatomia offline com snapshots/seleção muscular, reinício completo, transição de SW e remoção de caches obsoletos.

A matriz geral de 543 casos foi concluída antes desse ajuste exclusivamente no gerador de build e seu teste. O servidor Vite dessa matriz não usa o gerador; não foi apresentada uma reexecução parcial como se fosse uma nova rodada integral. PWA integral, manifesto unitário, suíte unitária integral e builds foram revalidados após o ajuste.

## Builds e performance

| Comando (frontend/) | Resultado |
| --- | --- |
| npm run build | exit 0; build Vite 3,34s |
| npm run build:vercel | exit 0 |
| npm run build:mobile:web | exit 0 |

Web e Vercel injetaram 350 entradas no manifesto (~56,58MB; antes 194/~56,54MB). Rota TrainingComparison continua lazy: 8,76kB bruto/2,91kB gzip. Anatomia continua lazy: 93,27kB/40,92kB gzip. Entrada atual: 1.141,50kB/315,59kB gzip. Nenhuma dependência adicionada. Permanecem avisos arquiteturais de import dinâmico ineficaz de Capacitor/sheets; os builds não ignoram verificações.

## Preservação e limites

Sem migration ou aplicação de SQL, sem alteração de RLS/permissões, sem deploy ou merge. Sem alteração de fórmulas, registros/rotinas de usuários, planos profissionais, notificações, geometria ou sprites. As dependências de banco usadas pelos testes continuam sendo as previstas pelo projeto.

Os testes usam fixtures de contas e dados de teste, além do cenário SQL existente. A aprovação automatizada não representa execução manual em dispositivos físicos. Os 25 skips preexistentes e os avisos de console acima continuam explicitamente registrados.

## Incidente de limpeza do ambiente de validação

Após os builds, o arquivamento nativo do worktree atravessou os junctions usados para compartilhar node_modules e removeu parte das dependências do checkout principal enquanto a segunda rodada unitária estava em andamento. Essa rodada foi interrompida e não é contabilizada como aprovação. As dependências foram restauradas com `npm ci --no-audit --no-fund` na raiz (26 pacotes) e no frontend (496 pacotes), ambos exit 0, sem alteração de lockfiles. A suíte integral foi reiniciada após a restauração. O hash do index.css do usuário foi novamente confirmado intacto. O worktree de validação foi arquivado; as capturas e logs úteis foram preservados antes da limpeza. Não existe pendência de restauração de dependências.

## Capturas preservadas

- [320px claro](assets/2026-11-24-stability/navigation-320-light.png)
- [320px escuro](assets/2026-11-24-stability/navigation-320-dark.png)
- [1280px claro](assets/2026-11-24-stability/navigation-1280-light.png)
- [1280px escuro](assets/2026-11-24-stability/navigation-1280-dark.png)
- [Treino restaurado offline](assets/2026-11-24-stability/offline-workout.png)
- [Comparativo carregado offline](assets/2026-11-24-stability/offline-training-map.png)

As capturas de navegação foram conferidas visualmente; o texto verde de diagnóstico pertence ao modo de desenvolvimento existente. As capturas PWA vêm da build de teste.

## Verificação final e entrega Git

Última rodada unitária, após correção do manifesto e restauração das dependências: **233/233 arquivos e 2.053/2.053 testes aprovados**, zero falhas, exit 0, 194,12s (09:01:23). O teste de preparação do ícone iOS está incluído na rodada completa; não houve necessidade de exceção nem aumento adicional dos limites solicitados.

Estáticos finais: lint 0 erros (antes 14); typecheck 0 erros (antes dois TS2339); i18n exit 0; check:supabase exit 0 (44 aprovados/três skips existentes). `git diff --check` sem erros. Nenhum skip/retry/exclusão de suíte foi acrescentado. A troca de expectativas do manifesto é uma regressão exigindo a dependência offline ausente, não silenciamento de falha.

Commits de código, a partir de 2456bf6:

- `59d840e` — estado da navegação, clique/foco, safe area, código morto, imports e refinamento dos prompts.
- `a1bd3e8` — fixtures e cobertura atual de navegação, onboarding, autenticação e recarga.
- `052d184` — correção do cache inicial dos módulos dos sprites e testes offline/manifesto.

Relatório e seis capturas registrados em commit próprio. Branch de entrega: [fix/fpp-comparison-stability](https://github.com/fabianoschmits/fit-pro-player/tree/fix/fpp-comparison-stability). Sem merge em main, sem force push e sem publicação em produção. Os logs completos e traces de diagnóstico estão preservados localmente em `.git/fpp-stability-evidence/`; as contagens, comandos, limitações e capturas necessárias à revisão estão neste documento versionado.

Pendências de implementação deste hotfix: nenhuma identificada pelas verificações executadas. Permanecem somente os skips preexistentes, avisos de console documentados e a limitação de não ter feito teste manual em dispositivos físicos. A base está apta à revisão para integração, com BodyMap e Flex preservados. A decisão de merge/publicação permanece fora desta execução.
