# Planos e vínculos — implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convergir aplicações confirmadas e implementar vínculos históricos com consentimento.
**Architecture:** Estender o controller de sync, biblioteca e seleção existentes. Integridade e transições de vínculo são transacionais no PostgreSQL.
**Tech Stack:** React, Zustand, Vitest, Playwright, Supabase/PostgreSQL.
**Spec:** ../specs/2026-11-03-plan-relationship-lifecycle-design.md

## Global Constraints

- SHA inicial: 150300ff93041cfc5982dc517423b7c86f7f95f3. Não reverter avanços remotos.
- Uma RPC de aplicação, nenhum store/seleção paralelo, nenhuma migration antiga alterada.
- Preservar todos os dados pessoais e históricos; sem skips ou asserts enfraquecidos.
- Implementação inline autorizada pelo usuário; commit/push/deploy somente após validação.

## Review Focus

- Realtime N+1 durante resposta N+1 e leitura N tardia: confirmar e não regredir.
- Edição pessoal durante aplicação: preservar journal e convergir execução.
- Revogação concorrente com aplicação: nenhum assignment revogado operacional.
- Aceites simultâneos e APIs legadas: nenhum vínculo duplicado ou bypass.
- R2 com mesmo par: R1 consultável, assignments antigos indisponíveis.

## Task 1: Aplicação e sync

Files: ProfessionalPlanApplyButton.jsx/test.jsx, account-domain-sync.js/test.js, useStore.js, AuthProvider.jsx.
Interfaces: seção exclusiva de plan no controller; confirmação com base capturada; token de conta existente.
- [ ] Teste falhando com controller real e realtime N+1 durante roundtrip; modal fecha e seleção N+1 prevalece.
- [ ] Implementar exclusividade, confirmação atômica e rebase pessoal; leitura N é ignorada.
- [ ] Cobrir edição concorrente, conta, dupla aplicação, calendário e executar testes específicos.

## Task 2: Aba ativa

Files: PlanLibrary.jsx/test.jsx e derivação de origem compartilhada quando necessário.
Interfaces: activePlanSource baseado em libraryId + versão; choice apenas visual.
- [ ] Testar troca externa, mount/retorno, aplicação, preview e versão divergente.
- [ ] Implementar derivação e acompanhar mudança de identidade ativa.
- [ ] Executar testes de biblioteca/workspace/workout.

## Task 3: Banco — ciclos, fallback e pedidos

Files: nova migration 202611030001_plan_relationship_lifecycle.sql; SQL tests e testes de duas conexões.
Interfaces: relationship_id em assignments; revoke_professional_relationship; RPCs de criar/listar/detalhar/aceitar/recusar pedidos.
- [ ] Escrever testes de regressão para R1/revogação/fallback/R2, consentimento e autorização; confirmar falha.
- [ ] Migration aditiva, backfill seguro, índice parcial por par, proteção de assignment e biblioteca.
- [ ] Revogação transacional restaura pessoal usando helpers existentes com aluno validado.
- [ ] Pedidos sob locks e grants restritos; APIs legadas seguem consentimento.
- [ ] Executar reset, SQL completo, concorrência e testes plan library.

## Task 4: Interfaces de vínculo

Files: professional-workflow.js/test.js; ProfessionalDashboard, ProfessionalStudents, ProfessionalStudentPage, fluxo StudentProfessionals/Add, rotas e nova página de solicitação.
Interfaces: DTO de solicitação limitado; filtros ativos/inativos e ciclos no detalhe.
- [ ] Testes falhando para pending, perfil, aceite/recusa, inativos e histórico.
- [ ] Reutilizar Management* / Button / useFppAction e atualização existente de listas.
- [ ] Impedir escrita em inativo na UI e no banco; não ativar plano antigo em reconexão.
- [ ] Executar testes específicos e Vitest completo.

## Task 5: Validação integrada e entrega

Files: E2E real de ciclo completo e relatório de execução.
- [ ] E2E pedido → aceite → envio → profissional → pessoal → profissional → revogação → inativo → R2 e histórico, Chromium/WebKit.
- [ ] lint/typecheck/Vitest/notificações/boundaries/SQL/reset/concorrência/i18n/fatigue/PWA/build/Vercel/mobile/audit conforme Quality.
- [ ] Revisão independente final; corrigir achados com regressões e revalidar.
- [ ] Aplicar migration remota somente após validação; dry-run confirma pendências zero.
- [ ] Commit/push main sem skip ci; acompanhar Actions application/database e Vercel.
- [ ] Relatório com SHA, arquivos, contagens e URLs reais; ausência de evidência impede conclusão total.
