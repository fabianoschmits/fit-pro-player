# Integração semanal da Home

## Escopo e base

Base: `37d4bb6ad8013c6804c43727f7f30ebd8147e339`, produção/main. Branch: `fix/fpp-home-weekly-integration`.

O cartão independente “Sua semana” foi removido exclusivamente da Home. A seção original “Esta semana” mantém os sete dias, os controles de navegação, calendário mensal e planejamento por dia. Abaixo dos dias existe um único link semântico “Ver resumo semanal”, com ícones oficiais `chart` e `chevronRight`, token `--acc`, fundo transparente e área mínima de 44 px. Peso corporal continua imediatamente depois da seção semanal, com o separador existente.

## Arquivos

- `frontend/src/views/Home.jsx`: integração, seleção semanal, contador autorizado e marcações concluídas.
- `frontend/src/home-weekly.css`: estilos locais do acesso, foco e toque.
- `frontend/src/components/AppHeader.jsx`: estado opcional de retorno, preservando a chamada antiga quando ausente.
- `frontend/src/components/training/weekly/WeeklyProgressHeader.jsx` e `frontend/src/views/WeeklyProgress.jsx`: propagação do estado de retorno.
- `frontend/src/views/Home.test.jsx`, `frontend/src/components/ui.test.jsx`: regressões de estrutura, datas, histórico e navegação.
- `frontend/e2e/weekly-progress.spec.js`: cenários atualizados e validação responsiva.
- `frontend/e2e/pwa.spec.js`: entrada offline pelo acesso integrado.

`Stats.jsx` e seu `<WeeklyProgressPreview />` permanecem intactos. Histórico e conclusão mantêm seus acessos. Nenhum arquivo dos motores musculares, snapshots, Flex ou recordes foi alterado.

## Calendário e contador

O calendário usa `getWeekStart`, `addCalendarDays` e `calendarDate`, com `useWeeklyClock` e o fuso efetivo do perfil. Não há conversão para data visual com `toISOString().slice()`. O destaque de hoje usa o mesmo fuso da semana.

`buildWeeklyPreview` calcula a semana selecionada com o histórico autorizado por `useWeeklyHistory`; utiliza filtragem e deduplicação canônicas. O cálculo completo de desempenho/anatomia não é chamado pela Home. As marcações concluídas são derivadas dos dias desse resumo. Durante transições de conta, nem os registros antigos nem as marcações de planejamento da conta anterior são expostos pelo calendário.

Na semana atual, meta planejada e sequência existentes são preservadas. Semanas anteriores mostram apenas treinos concluídos; não recebem a meta ou a sequência atuais. Semanas históricas vazias confirmadas usam a mensagem existente de ausência de registros no período.

Semanas futuras continuam navegáveis e planejáveis, mas não apresentam o link. O resumo não recebe silenciosamente a semana atual quando o calendário está no futuro. A navegação transmite a segunda-feira em `?week=YYYY-MM-DD`, `weeklyBackTo: '/home'` e seleção vinculada ao escopo em estado transitório do roteador. Voltar restaura essa seleção sem gravação de perfil ou Supabase.

## Disponibilidade e isolamento

As decisões de carregamento, cobertura parcial e vazio definitivo são as do helper compartilhado de produção. Carregamento sem dados mostra “Atualizando seu histórico…”, mantendo os sete dias visíveis. Dados locais permanecem utilizáveis durante sincronização e offline. Histórico parcial é identificado; ausência não comprovada não vira zero definitivo. A seleção restaurada só é aceita para o mesmo escopo.

## Evidências e testes

Os testes novos falharam antes da implementação pela ausência do link integrado. A primeira rodada de navegador revelou que o `href` real do HashRouter começa com `#`; a expectativa foi corrigida para a URL real. A primeira suíte unitária integral encontrou uma incompatibilidade no contrato de `AppHeader`: o segundo argumento era enviado mesmo sem estado. O código foi corrigido para preservar exatamente `navigate(backTo)` quando não há estado; o teste antigo foi mantido e foi acrescentado teste do retorno com estado.

- ESLint, TypeScript e i18n: aprovados, zero erros; 11 idiomas com 1.850 chaves.
- Playwright direcionado final: **12 aprovados, zero falhas, zero skips**, em 2,4 minutos; quatro cenários nos três projetos existentes.
- PWA final: **11 aprovados, zero falhas**, em 1,3 minuto, incluindo entrada integrada offline, troca de semana, treino offline, reconexão e atualização de Service Worker.
- Supabase: **44 aprovados, zero falhas, três skips preexistentes**, executado na raiz.
- Builds `build`, `build:vercel`, `build:mobile:web`: aprovados.
- Suíte unitária integral final: **2.186 aprovados, zero falhas, 242 arquivos**, em 351,40 segundos. A rodada anterior apresentou 2.183 aprovações e uma falha no contrato do header; não foi contabilizada como aprovação integral.

Comandos utilizados no frontend, em worktree isolado com dependências próprias:

```text
npm run lint
npm run typecheck
npm run check:i18n
node node_modules/vitest/vitest.mjs run --maxWorkers=2 --testTimeout=20000 --hookTimeout=30000
npx playwright test e2e/weekly-progress.spec.js --grep 'Home integrated|Progress card|Home calendar'
npm run test:e2e:pwa
npm run build
npm run build:vercel
npm run build:mobile:web
```

Na raiz: `npm run check:supabase`.

A matriz Playwright completa não foi repetida: foram executados cenários direcionados em Chromium desktop, Chromium mobile e WebKit mobile, conforme o escopo solicitado. Nenhum skip ou timeout global foi adicionado.

## Revisão visual

Dados exclusivamente sintéticos. Capturas de antes: `frontend/test-results-home-weekly/local/before-home-390-webkit.png` (produção de referência). Depois: `frontend/test-results-home-weekly/local/browser/`, incluindo 320, 360, 390, 430, 768 e 1280 px, temas escuro e claro, três projetos de navegador. Esses arquivos são evidências locais ignoradas e não entram no Git.

A revisão confirma a remoção do cartão duplicado, link integrado e espaço menor entre calendário e peso corporal. A geometria dos testes exige ausência de rolagem horizontal e alvo de toque >= 44 px. O cenário de navegação verifica semana atual/anterior, mudança do contador, retorno e ocultação no futuro; outro cenário verifica o carregamento autenticado sem zero prematuro. O cartão de Evolução é verificado separadamente.

## Banco, bundle e preservação local

Sem alterações de banco, migrations, RLS, RPC, consultas ou contratos persistidos. Sem dependências novas e sem mudança da estratégia de cache. O precache é regenerado pelo mecanismo existente: **354 entradas, aproximadamente 56,67 MB** no build Vercel. Home JS: 17,83 kB / 5,70 kB gzip; CSS Home: 2,35 kB / 0,82 kB gzip. Entrada principal: 1.145,40 kB / 317,15 kB gzip; rota semanal: 24,73 kB / 7,98 kB gzip. A entrada principal mantém praticamente o tamanho da referência (317,14 kB gzip). Anatomia e sprites não foram duplicados.

As alterações preexistentes de `frontend/src/index.css` e `output/` foram preservadas e excluídas da entrega. Hash do CSS local preservado: `9f462ff25dce38519db2caa2e4dbf26c2e41cf1f`. As validações usam o CSS versionado em worktree isolado.

## Publicação e rollback

Rollback anterior preparado: `dpl_2VKnNwrRw6Zga7Fyq7Nh4p3U8A6t`, READY, main `37d4bb6ad8013c6804c43727f7f30ebd8147e339`, URL `https://fit-pro-player-2dd8p8tqs-fabianoschmits-9996s-projects.vercel.app`.

A integração ocorrerá por main após os gates, sem force push e sem promoção direta de prévia. IDs e resultados efetivos da publicação serão registrados na conclusão.
