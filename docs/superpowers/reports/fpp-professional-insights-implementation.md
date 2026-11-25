# FPP Professional Insights — implementação 04

Base: implementação 03, `0eed37f98cfc323b7e61ded38cfa6416e09c8a36`. Main verificada em `6673db825d042e8ab948b79018dd9f72e901db1b`, já ancestral da base. Branch: `feat/fpp-professional-insights`.

## Arquitetura e acesso

Central lazy em `/#/professional/insights`, integrada à navegação profissional, dashboard e perfil do aluno. Filtros e alerta selecionado permanecem na URL; detalhes mostram regra, período, evidências e acesso ao planejamento/histórico já existentes. Estados: novo, revisado, adiado por 1/3/7 dias e arquivado/restaurado. Não há editor novo, mensagens automáticas ou notificações.

O motor puro `professional-insights.js` reutiliza comparação ajustada, detecção de alterações e calendário/histórico semanal. Identidade estável por vínculo e regra; o fingerprint registra evidências, sem textos traduzidos. Novos treinos/períodos podem reabrir o acompanhamento; a simples saída de evidências da janela não reabre um alerta revisado. Adiamentos vencidos são avaliados na consulta, sem cron.

Regras implementadas:

| Tipo | Limite |
| --- | --- |
| Falta de tempo / cansaço | 3 respostas explicitamente compartilhadas em 14 dias |
| Equipamento indisponível | 2 respostas compartilhadas em 14 dias |
| Desconforto | 1 resposta com consentimento sensível explícito em 14 dias |
| Execução abaixo do ajustado | 3 dos últimos 5 concluídos em 14 dias abaixo de 75%, mínimo 4 séries ajustadas; relação entre somas |
| Alterações de exercícios | 3 dos últimos 5 elegíveis em 14 dias com omissão/substituição comprovada |
| FPP Flex | 3 dos últimos 5 elegíveis com Flex explícito e redução de pelo menos 20% |
| Frequência reduzida | 2 semanas completas, referência com 3 treinos, redução de 50% e ao menos 2 registros |
| Sem registros recentes | 7 dias completos, histórico anterior recente, planejamento ativo e cobertura comprovada |
| Consistência | 2 treinos em cada uma de 3 semanas completas consecutivas |

## Armazenamento, privacidade e migração

Migration aditiva: `supabase/migrations/202611250001_training_checkins_professional_insights.sql`. **Não aplicada em produção.**

Cria `training_checkins` (privado, um registro por conta/ID textual de treino), `training_checkin_shares` (consentimento por resposta e ciclo de vínculo), `training_checkin_operations` (idempotência por operação; somente hash da solicitação, sem cópia da nota) e `professional_insight_states` (acompanhamento do profissional).

RPCs validam auth.uid(), propriedade de treino concluído canônico, versão, motivos, duplicatas, observação de 280 caracteres, revisão esperada e operação. Datas/revisões são do servidor. Remoção/dispensa limpam motivos e nota; remoção revoga os grants. RLS só permite ao proprietário ler respostas. Profissionais e administradores comuns não recebem acesso à tabela privada. Mutações usam RPCs com search_path explícito e grants mínimos.

O aluno escolhe o profissional e os motivos. Dor/desconforto exige seleção explícita própria. Adicionar motivos à resposta não amplia grants existentes. Observação nunca é compartilhada. Revogação e encerramento de ciclo impedem novas leituras no backend; ciclos futuros não herdam consentimento. Fingerprints retornados também são filtrados por sessão autorizada após revogação parcial. Não há SELECT direto do profissional sobre os estados armazenados.

O histórico de execução não foi duplicado nem alterado. A consulta profissional agrupa até 20 alunos por página (máximo 50), limita a 42 dias e 200 execuções por aluno, preserva autorização por assignment/ciclo e retorna somente projeção de treino, motivos autorizados e estado. Não retorna preferências completas ou observações. Dados profissionais ficam apenas em memória e são ocultados ao ficar offline ou trocar de conta.

Novas respostas autenticadas usam diário individual no estado local já escopado, fora das preferências sincronizadas; reutilizam persistência e eventos de boot/foco/reconexão/retry do sincronizador existente, sem polling ou nova store. Revisões impedem sobrescrita entre dispositivos. Visitantes continuam locais. BodyMap, Histórico e Resumo Semanal recebem a junção autorizada do legado com registros dedicados.

A importação legada é incremental e idempotente. Só limpa o valor legado exato confirmado; preserva outras preferências e tombstones. O dedicado prevalece; legado divergente é conservado em conflito pendente, sem decidir por relógio. Uma PWA antiga pode reintroduzir um legado nas preferências, mas não sobrescreve o dedicado. Novas respostas deixam de consumir o limite de 262.144 bytes das preferências. Durante indisponibilidade da migration, novas operações permanecem locais e pendentes.

## Validação anterior da implementação 04

Executada em worktree isolado, sem incorporar `index.css` ou `output/` locais. Nenhuma dependência adicionada.

| Comando / verificação | Resultado |
| --- | --- |
| ESLint nos arquivos alterados | Aprovado |
| `npm run typecheck` | Aprovado |
| `npm run check:i18n` | 11 idiomas, 1.961 chaves, aprovado |
| Vitest: `professional-insights.test.js` e `training-checkin-repository.test.js`, 1 worker | 15 testes aprovados |
| `node scripts/test-professional-insights-database.mjs` | Cenário SQL dedicado aprovado: 17 asserções e tentativas negativas de autorização/revisão |
| Playwright `professional-insights.spec.js --project=mobile-chromium` | 1 fluxo aprovado: compartilhar, consultar, revisar, recarregar e revogar |
| PWA com grep `dedicated checkin journal` e `training check-in is optional` | 2 fluxos aprovados: diário autenticado offline/reload/reconexão sem duplicação; conclusão real, dispensa, edição, remoção e agregação semanal |
| `npm run build:vercel` | Aprovado; o mesmo build foi repetido após correções relacionadas |

O PostgreSQL nativo estava incompleto (postgres.bki ausente). O teste de banco aplicou o schema real em PostgreSQL/WASM descartável (PGlite e pgcrypto já fixados no repositório), sem conexão remota. Cobriu proprietário, aluno estranho, profissional sem vínculo, ausência de consentimento, projeção sem notas, consentimento sensível, revogação parcial/total, vínculo encerrado, idempotência, revisão antiga e limpeza legada sem apagar outras preferências.

Falhas encontradas foram corrigidas: fingerprint revelando associações retiradas em revogação parcial; consentimento sensível existente perdido ao editar outro grant; remoção com grants antigos; e deslocamento do botão mobile ao ocultar o contador da observação. O contador agora preserva o espaço sem ficar visível fora da edição. A revisão focada confirmou as duas correções de privacidade.

Capturas sintéticas selecionadas ficam fora do Git nos diretórios de test-results: detalhe profissional mobile e check-in. Revisão mobile escura realizada, com ajuste da barra nativa ao token de destaque e ordenação dos treinos por data; não foi executada matriz visual de todos os temas/navegadores. Precache: 368 entradas, aproximadamente 56,76 MB; nenhuma geometria/sprite duplicado. Chunks aproximados: tela 8,4 kB, hook/motor 6,5 kB, preview 1,1 kB e CSS 2,1 kB antes de gzip.

## Limitações e publicação futura

- A cobertura é exclusivamente das execuções autorizadas deste profissional; nunca comprova todo o histórico pessoal. As três regras de período completo são condicionais à prova descrita abaixo. Acima de 200 execuções, fuso não registrado/inválido ou intervalo insuficiente, continuam suprimidas.
- Conflitos de revisão/legado têm resolução explícita no detalhe do check-in; não há mescla automática ou descarte silencioso.
- Sem suíte integral, outros browsers, builds mobile/web redundantes ou auditoria geral. Browser usa transporte sintético; autorização foi exercitada no banco descartável, não em contas reais.
- A prévia depende da migration aprovada para funcionalidade remota completa. Não foi aplicado SQL no Supabase de produção para habilitá-la.
- Ordem futura: aplicar migration aditiva aprovada, verificar permissões, publicar frontend compatível das etapas 03/04, acompanhar importação incremental, confirmar gravação/leitura e acompanhamento. Rollback do frontend não exige remover as tabelas ou contratos legados.

Entrega somente em branch para revisão; sem merge, publicação, implementação 05/06 ou alteração da Home, fórmulas dos BodyMaps e cálculos semanais.

## Correções finais — 25/11/2026

Referência revisada: `35f69171696b66df0c2bfca3c070e61fad20c890`. Continuação na mesma branch, sem alterações na Home, fórmulas, snapshots ou main.

- **Cobertura:** RPC calcula quantidade de execuções concluídas autorizadas e existência de datas inválidas no backend, antes do limite de 200. Retorna escopo, status, intervalo local, truncamento e `personalComplete:false`. A prova exige assignment acessível, fuso conhecido e ausência de truncamento/datas ausentes. O início respeita a aceitação do vínculo; seu primeiro dia incompleto não é considerado coberto. Paginação de alunos não representa totais globais de alertas. Cancelados/ativos/futuros não entram. Há 10 tipos habilitados: 7 baseados em evidências presentes e 3 condicionais (frequência, ausência, consistência) agora disponíveis no escopo profissional comprovado. A interface explicita esse escopo.
- **Fuso/plano:** somente o escalar `reminder.tz` já persistido é projetado, validado em `pg_timezone_names`. Sem ele, usa America/Sao_Paulo explicitamente, identifica fallback e suprime conclusões de período completo. O mesmo fuso acompanha alerta e datas relacionadas. `activePlan` comprova assignment ativo deste vínculo realmente selecionado em athlete_schedules, sem expor preferências.
- **Fila/conflitos:** revisão conflitante bloqueia somente o treino afetado e seus dependentes. Outros treinos continuam; conflitos e versões locais/remotas sobrevivem ao reload fora das preferências sincronizadas. Erros globais interrompem. Falha de replaceState interrompe o adaptador, inclusive após ACK, evitando repetição automática. A sheet mostra ambas as respostas: manter local cria operação nova na revisão remota e revoga compartilhamentos; usar sincronizada descarta somente operações autorizadas daquele treino. Tombstones são preservados; compartilhamento posterior exige nova escolha explícita. Migração divergente também usa essa resolução.
- **Vínculos encerrados:** edição de consentimentos filtra ciclos que não estão na lista ativa. A RPC permite revogação vazia de grant antigo e edição privada sem reativar vínculo; qualquer concessão não vazia continua exigindo vínculo ativo. Revogações seguem filtrando motivos e fingerprints; notas nunca integram o contexto profissional. Cache continua somente em memória, escopado por conta e invalidado em refresh/foco/eventos de vínculo/offline.
- **Migration final:** `202611250002_professional_coverage_checkin_conflicts.sql`, incremental e aditiva, após `202611250001`. Original preservada porque não foi possível atestar o histórico de aplicação de todos os ambientes persistentes. Nenhuma migration foi aplicada remotamente nesta correção.

Validações desta rodada: ESLint dos arquivos alterados, TypeScript e i18n aprovados (11 idiomas/1.969 chaves); **19 testes unitários direcionados**; SQL PostgreSQL/WASM descartável com **23 asserções**, rejeições de autorização/revisão e 35 statements; **1 fluxo Chromium mobile** de conflito, escolha local sem consentimento automático, sincronização e reload. Testes cobrem também cobertura parcial/completa, limites, fuso, resolução remota, tombstone legado, isolamento de fila e falhas de persistência. Sem novas exclusões/skips. Não foram repetidas suítes completas, matriz de navegadores ou PWA integral.

`npm run build:vercel`: aprovado. Primeiro build identificou byte de codificação inválido em texto novo da sheet, corrigido antes da repetição do mesmo build. Precache permanece 368 entradas (~56,77 MB); tela ~8,93 kB, hook/motor ~7,00 kB antes de gzip. Nenhum asset anatômico ou estratégia de cache alterado.

Prévia de branch: https://fit-pro-player-git-feat-fp-27eb42-fabianoschmits-9996s-projects.vercel.app — recibo do commit/deployment final na entrega. Funcionalidade remota depende da revisão/aplicação das migrations; não foi usado Supabase de produção para habilitá-la. Ordem futura permanece: migrations aprovadas, permissões, frontend compatível e migração incremental. Publicação não realizada.

### Recibo Git e prévia

Correções verificadas e enviadas no commit `afc0af04a3990fb59e1d299205138b6064cd518f`. HEAD final da entrega (incluindo este recibo documental): [branch no GitHub](https://github.com/fabianoschmits/fit-pro-player/commits/feat/fpp-professional-insights). Push confirmado, sem alterações pendentes no worktree da implementação.

Prévia criada para o commit das correções: `dpl_6rzd49s9hpWe2nkLYyomnAq5LFrZ`, https://fit-pro-player-r3ks0yiv9-fabianoschmits-9996s-projects.vercel.app — BUILDING na primeira consulta. A URL de branch acima acompanha o HEAD; estado mais recente e hash final no recibo da resposta. Nenhuma publicação em produção ou aplicação remota de migration.

## Publicação conjunta 03/04 — preparação em 25/11/2026

Correção residual: rejeição de concessão a vínculo encerrado agora usa SQLSTATE específico `PCK01`, isolado por treino no mesmo mecanismo de conflito. Resposta privada/diário permanecem locais; manter minha resposta exige ação explícita e envia shares vazio. Erros 42501 de autenticação/propriedade continuam globais. Migration incremental `202611250003_checkin_ended_share_rejection.sql`; migrations anteriores inalteradas.

Projeto de produção confirmado em duas fontes: bundle do domínio oficial e API de gerenciamento autorizada: **Fpp / bgqavxoxwgheloeubbpf / sa-east-1**. Histórico remoto tinha somente as três migrations desta entrega pendentes. Contratos das nove tabelas dependentes conferidos. **202611250001, 202611250002 e 202611250003 aplicadas e registradas**, em ordem, cada uma com transação incluindo recibo em schema_migrations. Nenhum backfill/limpeza global de dados foi executado. Frontend anterior continua compatível com as estruturas aditivas.

Segurança pós-aplicação: quatro tabelas com RLS, nenhum SELECT anônimo; políticas privadas usam auth.uid(); operações e estados sem SELECT direto autenticado; três RPCs públicas do recurso com SECURITY DEFINER/search_path explícito, EXECUTE autenticado e sem EXECUTE anônimo. Guardas de vínculo/consentimento e ausência de projeção de note confirmadas no catálogo de produção. Teste de autorização com dados sintéticos somente no PostgreSQL/WASM descartável: 24 asserções e rejeições esperadas, 35 statements. Nenhum treino de usuário real foi criado/modificado para validação.

Verificações novas: 9 testes do repositório de check-ins aprovados (incluem os 2 casos residuais); ESLint dos 2 arquivos JS alterados, TypeScript e um build Vercel aprovados. Nenhuma tradução alterada; i18n anterior reaproveitado. Sem suítes integrais, matriz Playwright ou PWA completa. Compatibilidade offline coberta pelo diário no teste direcionado, incluindo salvamento privado após reconexão.

Main anterior: `6673db825d042e8ab948b79018dd9f72e901db1b`. Rollback frontend disponível: **dpl_83KckSeWiwqggxnZCRGFMSb7PnVa**, https://fit-pro-player-pcxammmh0-fabianoschmits-9996s-projects.vercel.app, READY, target production. Em rollback, preservar as três migrations aditivas e dados. Recibo de deployment/commit e smoke test será registrado após o deploy oficial da main.
