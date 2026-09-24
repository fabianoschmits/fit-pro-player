# Professional UX Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separar a experiência profissional e a área de profissionais do aluno em páginas mobile-first, mantendo o domínio Supabase seguro e publicando a refatoração na `main`.

**Architecture:** Reutilizar o repository Supabase e as RPCs existentes, extrair páginas e helpers puros por responsabilidade e registrar redirects para rotas antigas. Nenhuma migration é prevista; uma migration só será criada se uma verificação provar que o schema atual não suporta uma ação exigida.

**Tech Stack:** React, React Router HashRouter, Vitest, Supabase RPC/RLS, Vite/PWA, CSS tokens existentes.

**Spec:** `docs/superpowers/specs/2026-09-24-professional-ux-refactor-design.md`

## Global Constraints

- Manter Vercel + React/PWA + Supabase como arquitetura.
- Não renomear tabelas/colunas aplicadas por estética.
- Não permitir que profissional altere email, senha, role ou conta do aluno.
- Não misturar convites pendentes com alunos ativos.
- Preservar versões e execuções antigas ao publicar uma nova versão.
- Preservar navegação normal do usuário que também é profissional.
- Usar TDD para comportamento novo e rodar a suite completa por tarefa.

## Review Focus

- Um aluno sem programa ou sem profissional deve receber empty state acionável; coberto pela Task 4.
- Um convite inválido, expirado ou já aceito não pode criar vínculo; coberto pela Task 3.
- Filtros de alunos não podem misturar status e programa; coberto pela Task 2.
- Um profissional não pode abrir detalhe de aluno sem vínculo ativo; preservado pelo RPC e verificado na Task 5.
- Uma execução V1 deve continuar apontando para V1 após publicação de V2; coberto pela Task 5 e QA hospedado.

### Task 1: Especificação e contratos puros

**Files:**
- Create: `frontend/src/lib/professional-ux.js`
- Test: `frontend/src/lib/professional-ux.test.js`
- Modify: `.superpowers/sdd/2026-09-24-professional-ux-refactor/progress.md`

**Interfaces:**
- Produces `normalizeInviteCode(value)`, `inviteLink(origin, code)`, `filterStudents(students, query, filter)`, `studentStats(student)`, `statusLabel(status)`.

- [ ] Escrever testes failing para normalização de código, deep link, filtros Todos/Com programa/Sem programa e resumo de aluno.
- [ ] Executar `npm --prefix frontend test -- src/lib/professional-ux.test.js` e confirmar falha por módulo ausente.
- [ ] Implementar somente os helpers puros e suas constantes de filtro/status.
- [ ] Reexecutar teste específico e depois `npm test`.
- [ ] Commitar `feat: add professional workspace ux contracts`.

### Task 2: Workspace profissional e navegação semântica

**Files:**
- Create: `frontend/src/components/ProfessionalWorkspaceNav.jsx`
- Create: `frontend/src/components/ProfessionalWorkspaceNav.test.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/views/More.jsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes helpers from Task 1.
- Produces accessible links for `/professional`, `/professional/students`, `/professional/invites`, `/professional/programs`, `/professional-profile`.

- [ ] Escrever testes failing para links ativos, labels e preservação da área normal.
- [ ] Confirmar RED.
- [ ] Adicionar navegação interna e rotas com redirects de `/professional` e `/connect` sem duplicar a tab bar.
- [ ] Adicionar CSS responsivo usando tokens existentes.
- [ ] Confirmar GREEN e rodar `npm test`.
- [ ] Commitar `feat: add professional workspace navigation`.

### Task 3: Página de convites e deep links

**Files:**
- Create: `frontend/src/views/ProfessionalInvites.jsx`
- Create: `frontend/src/views/ProfessionalInvites.test.jsx`
- Create: `frontend/src/views/InviteLanding.jsx`
- Create: `frontend/src/views/InviteLanding.test.jsx`
- Modify: `frontend/src/lib/professional-workflow.js`
- Modify: `frontend/src/views/StudentConnections.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Uses `createInvite`, `invites`, `previewInvite`, `acceptInvite` from the repository.
- Produces one creation flow with code, link, copy/share and pending-only list.

- [ ] Escrever testes failing para normalização, preview sem aceite automático, link e estados pending/active/revoked.
- [ ] Confirmar RED.
- [ ] Implementar a página e o deep link, preservando o código durante auth via query/hash.
- [ ] Adicionar copy/share com fallback seguro e ações de revogar com confirmação.
- [ ] Confirmar GREEN e rodar `npm test`.
- [ ] Commitar `feat: refactor professional invite experience`.

### Task 4: Páginas de alunos e experiência do aluno

**Files:**
- Create: `frontend/src/views/ProfessionalStudents.jsx`
- Create: `frontend/src/views/ProfessionalStudents.test.jsx`
- Create: `frontend/src/views/ProfessionalStudentPage.jsx`
- Create: `frontend/src/views/ProfessionalStudentPage.test.jsx`
- Create: `frontend/src/views/StudentProfessionals.jsx`
- Create: `frontend/src/views/StudentProfessionals.test.jsx`
- Modify: `frontend/src/views/ProfessionalDashboard.jsx`
- Modify: `frontend/src/views/StudentConnections.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes `clientSummaries`, `clientDetail`, `assignProgramVersion`, `revokeRelationship`, `studentOverview`.
- Produces cards, search/filter, detail tabs Resumo/Treino/Histórico/Vínculo e empty/loading/error states.

- [ ] Escrever testes failing para lista sem alunos, filtro, detalhe e CTA do aluno.
- [ ] Confirmar RED.
- [ ] Extrair a lista e o detalhe para páginas dedicadas; limitar cards a uma ação secundária.
- [ ] Substituir `/connect` por `/student/professionals` e manter redirect compatível.
- [ ] Implementar confirmação de encerrar vínculo sem “excluir aluno”.
- [ ] Confirmar GREEN e rodar `npm test`.
- [ ] Commitar `feat: split professional students and student connections pages`.

### Task 5: Página de programas e limpeza do legado

**Files:**
- Create: `frontend/src/views/ProfessionalPrograms.jsx`
- Create: `frontend/src/views/ProfessionalPrograms.test.jsx`
- Modify: `frontend/src/components/ProfessionalProgramEditor.jsx`
- Modify: `frontend/src/views/ProfessionalDashboard.jsx`
- Modify: `frontend/src/index.css`
- Modify: `README.md`

**Interfaces:**
- Consumes program/version helpers and editor from existing domain.
- Produces cards for active/draft/version counts without implicit assignment.

- [ ] Escrever testes failing para criação, publicação e ausência de cliente selecionado.
- [ ] Confirmar RED.
- [ ] Mover a gestão de programas para a página própria e manter editor de versão.
- [ ] Buscar ocorrências de labels/rotas antigas e remover somente consumers substituídos.
- [ ] Confirmar GREEN e rodar `npm test`.
- [ ] Commitar `refactor: organize professional program workspace`.

### Task 6: Verificação, segurança, QA e publicação

**Files:**
- Create: `frontend/scripts/qa-professional-ux.mjs` (temporário, removido antes do commit final)
- Modify: `.superpowers/sdd/2026-09-24-professional-ux-refactor/progress.md`

- [ ] Rodar `npm test`, `npm run build`, `npm --prefix frontend run check:i18n`, `npm run check:supabase`, `npm audit --audit-level=high`, `git diff --check`.
- [ ] Rodar migration list/dry-run e confirmar nenhuma migration nova inesperada.
- [ ] Executar QA hospedado com dois profissionais e dois alunos separados, cobrindo convite, link, inválido, revoke, multi-student, multi-pro, programa, execução e versionamento.
- [ ] Fazer whole-diff review contra `origin/main`, corrigir Critical/Important com TDD.
- [ ] Remover o script temporário, confirmar secrets não versionados e working tree limpo.
- [ ] Commitar correções finais, `git push origin main`, aguardar Vercel Ready e testar `https://www.fitpp.com.br` em viewport mobile/desktop e temas claro/escuro.
