# Professional Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Aplicar a auditoria aprovada e preparar o app para testes profissionais completos.
**Architecture:** Preservar arquitetura existente; adicionar fronteiras pequenas para sincronização, outbox, acessibilidade e operações profissionais.
**Tech Stack:** React 19, Vite, Zustand, Supabase PostgreSQL, Capacitor, Vitest.
**Spec:** docs/superpowers/specs/2026-10-02-professional-readiness-design.md

## Global Constraints
- Node 22; UI pt-BR com catálogos existentes; nenhuma chave privada no frontend.
- Trabalhar na branch master autorizada. Não apagar nem aplicar migrations em produção.
- Não há exigência de migração de clientes antigos. Preservar segurança e correção de novos dados.
- Agentes têm propriedade de arquivos e não fazem commit/push; coordenador integra e revisa.

## Review Focus
- Respostas após logout não atingem outra conta: Task 2 teste integrado.
- Offline após concluir não perde execução: Task 3 outbox/retry.
- Escrita direta não contorna RPC: Task 1 teste SQL de papéis.
- Teclado e leitor de tela conseguem fechar diálogo e recuperar foco: Task 4 DOM/E2E.
- Update/reload durante sessão não interrompe trabalho: Task 5 teste SW/coordenador.

### Task 1: Banco profissional e contratos
Files: supabase/migrations nova 202610020014, supabase/tests nova; scripts/check-professional-readiness-migration.test.mjs. Não editar frontend.
Interfaces: preservar nomes dos RPCs existentes; adicionar operações seguras/idempotentes de execução e update/archive de programas; documentar assinaturas em relatório.
- [x] Reproduzir policies permissivas e concorrência em testes SQL/guards.
- [x] Implementar ownership/foreign-key invariants, revogação, single active assignment, idempotência execução, payload bounds, snapshot first-insert lock.
- [x] Rodar guards/testes disponíveis e relatar limitações de banco local.
- [x] Revisão independente antes de conclusão.

### Task 2: Conta, sincronização e persistência
Files: App.jsx, views/Settings.jsx, store/useStore.js, lib/account-sync.js, account-cache.js, mobile.js, backup-state.js e testes correspondentes; novos módulos específicos permitidos.
Interfaces: state.pendingProfessionalEvents será mantido pelo Task 3; não editar esse módulo; status de persistência/sync exposto por useStore para UI.
- [x] Testes red para revisão base, conflito preservado, resposta stale, falha quota, recuperação/limpeza native.
- [x] Implementar coordenação sync com proteção geração, cópias de conflito e resolução UI; separar limpar local/excluir conta.
- [x] Validar backups/snapshots, espelho mais recente e falhas visíveis; diagnóstico local sem conteúdo privado.
- [x] Rodar suites focadas e fornecer relatório de integração.

### Task 3: Jornada e ferramentas profissionais
Files: sheets.jsx, views/Workout.jsx, todas views Professional*, StudentProfessionals.jsx, componentes ProfessionalProgramEditor.jsx/StudentProgramOverview.jsx, lib/professional-*.js, assigned-program.js, finish-workout.js e respectivos testes. Não editar App/Settings/store/index.css/ui/Modals/locales.
Interfaces: fila usa useStore.update em S.pendingProfessionalEvents; renderer shell coordenador inclui flush em online/auth; usar RPCs acordados com Task 1 quando disponíveis.
- [x] Testes red início por todas telas, prescrição imutável, descanso, campos temporais, validação finita e dia local.
- [x] Centralizar início/finish/abandon com outbox scoped e idempotente, conservar execução no histórico e expor flushProfessionalEvents.
- [x] Editor com rascunho, pendência, notas/descanso/cardio/esforço/grupos, duplicar/ordenar, metadados, versões/arquivar/atribuição contextual.
- [x] Pendências reais, detalhe realizado/prescrito, busca/paginação e rótulos traduzíveis.
- [x] Rodar suites focadas e documentar interfaces novas.

### Task 4: UI compartilhada e identidade
Files: components/ui.jsx, Modals.jsx, LineChart.jsx, outros shared, index.css e testes; integração mínima nos arquivos de agentes só após retorno.
- [x] Testes de nome acessível, foco restaurado/inert/Escape e gráfico operável.
- [x] Implementar Dialog compartilhado, nomes dos controles, tokens faltantes, legibilidade/layout desktop, estados consistentes.
- [x] Validar telas no navegador e refinar mobile/desktop.

### Task 5: Offline, mídia e observabilidade
Files: public/sw.js, main.jsx, lib/offline-plan.js, componentes OfflineStatus/SyncStatus/Diagnostics e assets/scripts.
- [x] Teste reload não interrompe sessão ativa, cache preparado por plano, falhas claras.
- [x] Otimizar sprites/avatars para WebP com resolução apropriada; relatório tamanho antes/depois.
- [x] Preparar conteúdo essencial offline, limites cache e status de progresso; diagnósticos mínimos locais.

### Task 6: Entrega e validação
Files: package*.json, frontend/package*.json, .github/workflows, docs, README/CONTRIBUTING/MOBILE, frontend/e2e e configuração Playwright.
- [x] Corrigir CI filtros/jobs e Supabase local SQL; atualizar dependência vulnerável.
- [x] E2E local para convites/treino/backup e jornadas profissionais mocked boundary; docs operação e release.
- [x] Executar npm test, check:supabase, check:i18n, fatigue probe, builds web/mobile, audit, E2E e banco local se disponível.

### Task 7: Revisão e publicação Git
- [x] Revisor independente da alteração completa; corrigir pendências e repetir verificações pertinentes.
- [x] Registrar relatório de conclusão com checks e limitações verificadas.
- [ ] Commit, push origin master sem force, confirmar hash remoto e git limpo.
