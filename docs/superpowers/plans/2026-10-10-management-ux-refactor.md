# Refatoração de gestão UX/UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganizar toda a gestão profissional e do aluno para uma experiência mobile-first, com menos decisões e cliques, preservando backend, permissões e contexto de edição.

**Architecture:** Reutilizar os shells e repositórios existentes. A navegação profissional será integrada à TabBar global quando viável; edições curtas usarão sheets/action sheets no contexto atual; rotas serão mantidas apenas para tarefas complexas e compatibilidade. O editor continuará apoiado em `useProgramDraft` e `useProgramEditorResource`.

**Tech Stack:** React, React Router, Vite, Supabase repositories/RPCs existentes, Vitest, Playwright, CSS tokens atuais.

**Spec:** `docs/superpowers/specs/2026-10-10-management-ux-refactor-design.md`

## Global Constraints

- Não alterar tabelas, RPCs, políticas RLS, schemas ou regras de negócio.
- Não criar duas barras inferiores concorrentes.
- Edições pequenas usam sheet/action sheet e preservam programa, dia, posição, rolagem e rascunho.
- Alvos de toque têm pelo menos 44 px; inputs principais pelo menos 48 px.
- Validar 320, 360, 390, 430 px e desktop, temas claro/escuro, reduced motion e safe-area.
- Manter todas as funcionalidades existentes acessíveis.
- Não fazer limpeza estrutural, migração arquitetural ou reescrita de componentes fora do impacto direto da UX/UI; reutilizar componentes, hooks, repositórios e fluxos funcionais atuais.

## Review Focus

- Troca de conta durante requests de alunos/programas: respostas antigas não podem aparecer; testar em `useProfessionalResource`/telas.
- Exercício editado em sheet: salvar deve manter a mesma lista, índice, rolagem e rascunho; testar no `WorkoutDraftEditor`.
- TabBar global + shell profissional: deve existir uma única navegação inferior; testar rotas profissionais e não profissionais.
- Programas sem exercícios, alunos sem vínculo e convites sem resultados: cada vazio deve oferecer o próximo passo; testar estados de cada lista.
- Teclado, safe-area e tema escuro: CTA fixo não pode cobrir conteúdo nem ficar inacessível; testar Playwright nos quatro viewports.

### Task 1: Mapear e fixar contratos de navegação

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/ProfessionalWorkspaceNav.jsx`
- Modify: componente da TabBar global identificado durante a execução
- Test: `frontend/src/App.management-sync.test.jsx`, `frontend/src/components/ProfessionalWorkspaceNav.test.jsx` ou novos testes correspondentes

**Interfaces:**
- Consumes: rotas atuais e `isProfessionalRoute`.
- Produces: navegação profissional com destinos `home`, `students`, `programs`, `more`, sem barra inferior duplicada; preserva deep links e query de conta/contexto.

- [ ] Escrever testes que confirmem a seleção da navegação por rota, integração com a TabBar existente e ausência de duas barras.
- [ ] Rodar os testes para confirmar a falha antes da implementação.
- [ ] Adaptar o shell para escolher uma única navegação por contexto e manter `/professional/invites`, perfil e exercícios como destinos secundários.
- [ ] Validar desktop, mobile, rota antiga e retorno pelo navegador.
- [ ] Rodar os testes de navegação e commitar `refactor: unify professional navigation`.

### Task 2: Refatorar início profissional e lista de alunos

**Files:**
- Modify: `frontend/src/views/ProfessionalDashboard.jsx`
- Modify: `frontend/src/views/ProfessionalStudents.jsx`
- Modify: `frontend/src/features/professional/components/StudentRow.jsx`
- Modify: `frontend/src/features/professional/components/EmptyState.jsx`
- Test: testes existentes dessas telas e novos testes de estados/itens tocáveis

**Interfaces:**
- Consumes: `useProfessionalLists`, `useProfessionalSession`, workflow repository.
- Produces: início acionável, lista pesquisável em linhas compactas, links para convites dentro de Alunos e nenhuma métrica inventada.

- [ ] Escrever testes para pendências reais, vazio, erro, retry, busca e item inteiro tocável.
- [ ] Implementar composição de início com Adicionar aluno/Criar programa e listas de atenção.
- [ ] Implementar linha compacta de aluno com ações secundárias em `ContextActions`.
- [ ] Adicionar estilos mobile/desktop sem transformar cada item em card.
- [ ] Rodar Vitest focado e commitar `refactor: streamline professional home and students`.

### Task 3: Reorganizar página dedicada do aluno

**Files:**
- Modify: `frontend/src/views/ProfessionalStudentPage.jsx`
- Modify: páginas/hooks de treino, histórico, progresso e atribuição relacionados
- Test: `ProfessionalStudentPage.test.jsx` e testes de retorno/contexto

**Interfaces:**
- Consumes: relações e recursos existentes, query `section`, `program` e `version`.
- Produces: resumo prioritário, programa atual e atividade em disclosure/rotas existentes, com histórico e vínculo secundários.

- [ ] Escrever testes para cada seção, query preservada, loading/vazio/erro e troca de aluno.
- [ ] Reorganizar a hierarquia e ações para que Gerenciar treino seja a CTA principal.
- [ ] Preservar links de histórico, progresso, atribuição, execução e vínculo.
- [ ] Validar troca rápida de aluno sem resposta atrasada e commitar `refactor: simplify professional student workspace`.

### Task 4: Refatorar biblioteca de programas e tela do programa

**Files:**
- Modify: `frontend/src/features/professional/pages/ProgramLibraryPage.jsx`
- Modify: `frontend/src/features/professional/components/ProgramRow.jsx`
- Modify: página de detalhe do programa existente
- Test: testes de biblioteca/detalhe e novos testes de ações contextuais

**Interfaces:**
- Consumes: `programPage`, versões e ações existentes.
- Produces: biblioteca por linhas, busca/filtro compactos e detalhe com metadados, versões e ações secundárias contextualizadas.

- [ ] Escrever testes para lista disponível/arquivada, vazio, busca, abrir, duplicar, editar e atribuir.
- [ ] Implementar linhas contínuas e menu contextual sem estatísticas inventadas.
- [ ] Manter retorno para biblioteca com conta, busca, posição e rolagem.
- [ ] Rodar testes e commitar `refactor: simplify program library`.

### Task 5: Editor de dia e `ExerciseEditSheet`

**Files:**
- Modify: `frontend/src/features/professional/pages/ProgramWorkoutPage.jsx`
- Modify: `frontend/src/features/professional/components/WorkoutDraftEditor.jsx`
- Create: `frontend/src/features/professional/components/ExerciseEditSheet.jsx`
- Modify: `frontend/src/features/professional/components/ExercisePrescriptionRow.jsx`
- Test: `WorkoutDraftEditor.test.jsx`, novos testes de `ExerciseEditSheet` e preservação de contexto

**Interfaces:**
- Consumes: `useProgramDraft`, `WEEK_DAYS`, prescrição e helpers atuais.
- Produces: item de exercício tocável, sheet 75–90% da viewport, campos principais + disclosure “Mais opções”, menus duplicar/mover/substituir/remover.

- [ ] Escrever teste que abre o sheet, edita séries/carga, salva e mantém dia, índice, rolagem e draft.
- [ ] Escrever testes para cancelar, Escape, validação, RIR/RPE, superset/notas/unidade e resposta atrasada.
- [ ] Implementar o sheet controlado pelo editor sem criar uma nova rota.
- [ ] Implementar menu contextual do exercício e alternativa acessível de mover acima/baixo.
- [ ] Validar safe-area, teclado, foco e reduced motion; commitar `refactor: edit exercises in context`.

### Task 6: Picker múltiplo e menu de ações do dia

**Files:**
- Modify: `frontend/src/features/professional/components/ExercisePickerSheet.jsx`
- Modify: `frontend/src/components/ProfessionalExercisePicker.jsx` se ainda for consumidor
- Modify: `WorkoutDraftEditor.jsx`
- Test: `ExercisePickerSheet.test.jsx` e testes de ações do dia

**Interfaces:**
- Consumes: catálogo existente e mutações do draft.
- Produces: busca, filtros úteis, seleção múltipla, itens já adicionados, conclusão explícita e opções Copiar/Mover/Trocar/Limpar no menu do dia.

- [ ] Escrever testes de seleção múltipla, duplicidade, cancelamento, conclusão e retorno ao índice/rolagem.
- [ ] Escrever testes das quatro ações do dia e confirmações destrutivas.
- [ ] Implementar sheets e menus mantendo mutations existentes.
- [ ] Rodar focados e commitar `refactor: streamline exercise and day actions`.

### Task 7: Rascunho, revisão e publicação

**Files:**
- Modify: `frontend/src/features/professional/components/WeekDraftSummary.jsx`
- Modify: `frontend/src/features/professional/components/BottomActionBar.jsx`
- Modify: `ProgramWeekPage.jsx`, `ProgramWorkoutPage.jsx`
- Test: `WeekDraftSummary` e testes de publicação existentes

**Interfaces:**
- Consumes: draft API e RPC de publicação existentes.
- Produces: barra contextual acima da safe-area/TabBar e fluxo Editar → Revisar → Publicar com resumo e alertas.

- [ ] Escrever testes para estados salvo/salvando/erro, revisão, confirmação, falha do RPC e retorno após publicar.
- [ ] Implementar barra fixa sem cobrir conteúdo ou navegação.
- [ ] Implementar revisão com dias, exercícios e alertas vindos do draft real.
- [ ] Rodar Vitest e commitar `refactor: add contextual review and publish flow`.

### Task 8: Fluxos do aluno e prescrição

**Files:**
- Modify: `frontend/src/components/StudentProgramOverview.jsx`
- Modify: `frontend/src/components/ProfessionalPrescription.jsx`
- Modify: `frontend/src/views/StudentProfessionals.jsx`
- Modify: `frontend/src/components/StudentProfessionalInvite.jsx`
- Test: testes existentes dessas telas e novos testes do wizard de vínculo

**Interfaces:**
- Consumes: workflow repository e estados atuais de atribuição/execução.
- Produces: próximo treino como CTA, semana/programa/histórico secundários, prescrição hierárquica e fluxo de convite por etapas.

- [ ] Escrever testes para próximo treino, vazio, atribuição encerrada, materiais e os quatro estados do vínculo.
- [ ] Implementar a hierarquia sem linguagem técnica e sem perder links de histórico/material.
- [ ] Implementar seleção por etapa no convite mantendo deep link e RPCs.
- [ ] Validar retorno e commitar `refactor: simplify student training experience`.

### Task 9: CSS, responsividade e integração

**Files:**
- Modify: `frontend/src/professional.css`
- Modify: estilos dos shells e componentes tocados
- Create: `frontend/e2e/management-ux.spec.js`

**Interfaces:**
- Consumes: componentes implementados nas tasks anteriores.
- Produces: composição mobile-first, uma navegação única, safe-area, foco, reduced motion e layout desktop intermediário.

- [ ] Escrever testes Playwright para 320/360/390/430 px e desktop, profissional/aluno, tema claro/escuro, teclado e rolagem horizontal.
- [ ] Organizar CSS por shell, listas, sheets, barras fixas, estados e desktop; remover apenas regras comprovadamente obsoletas.
- [ ] Rodar os testes visuais e corrigir clipping, CTA atrás da TabBar, targets menores que 44 px e títulos longos.
- [ ] Rodar `npm test`, `npm run build:vercel`, `npm --prefix frontend run check:i18n`, `npm run check:supabase` e e2e.
- [ ] Commitar `refactor: complete management UX`.

### Task 10: Revisão final e integração

**Files:**
- Review: todos os arquivos das tasks anteriores
- Test: suíte completa e verificação de diff

- [ ] Conferir que nenhum RPC/schema/RLS foi alterado.
- [ ] Conferir rotas antigas, links de convite, troca de conta e preservação de rascunho.
- [ ] Rodar a suíte completa sem filtros e registrar falhas reais.
- [ ] Fazer revisão de acessibilidade e segurança de contexto.
- [ ] Preparar push/publicação somente após todas as verificações passarem.
