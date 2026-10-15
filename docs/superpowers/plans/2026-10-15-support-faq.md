# FAQ e Central de Suporte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar FAQ e atendimento persistente para usuários, com caixa de entrada administrativa integrada ao Console.

**Architecture:** O Supabase será a fonte de verdade para categorias, artigos, chamados, mensagens e auditoria. Uma camada `support.js` encapsulará RPCs; views de usuário e administrador consumirão essa camada e reutilizarão os componentes, tokens, navegação e linguagem visual já presentes no projeto.

**Tech Stack:** React 19, React Router 7, Supabase JS, PostgreSQL/Supabase RLS, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-10-15-support-faq-design.md`

## Global Constraints

- Seguir o design existente do Fit Pro Player: tokens CSS, componentes de `ui.jsx`, `ManagementLayout`/ConsoleShell e padrões de estados de carregamento/erro/vazio.
- Somente usuários autenticados podem abrir chamados e visualizar seus próprios chamados.
- Toda operação administrativa deve passar por `ops_require_admin()` e por funções RPC com `revoke all`/`grant execute`.
- Não adicionar dependências para a primeira versão.
- Manter mensagens e labels em português nos novos fluxos, com strings centralizadas quando o padrão da tela exigir.
- Não incluir anexos, e-mail, push, SLA, departamentos ou automações nesta entrega.

## Review Focus

- Usuário tentando acessar o chamado de outra pessoa: deve receber vazio/erro seguro; cobrir em teste de RLS/função e detalhe da view.
- Usuário enviando texto inválido ou vazio: deve permanecer na tela com validação e não perder o conteúdo; cobrir no formulário.
- Chamado resolvido recebendo nova mensagem: deve voltar a `pending`; cobrir na função e no repositório.
- Chamado arquivado: não deve aceitar nova mensagem e deve poder ser reaberto pelo admin; cobrir na função e no Console.
- Admin sem papel `admin`: não deve listar nem alterar suporte; cobrir nos testes SQL e no hook de acesso.

### Task 1: Criar o modelo Supabase, RLS e RPCs

**Files:**
- Create: `supabase/migrations/202610150022_support_center.sql`
- Create: `scripts/check-support-migration.test.mjs`

**Interfaces:**
- Produces enums, tables, seeded categories and RPCs named in the spec: `support_create_ticket`, `support_add_user_message`, `support_list_my_tickets`, `support_ticket_detail`, `ops_support_overview`, `ops_support_list_tickets`, `ops_support_ticket_detail`, `ops_support_reply`, `ops_support_update_ticket`, `ops_support_mark_read` plus FAQ read/admin RPCs.

- [ ] **Step 1: Write migration assertions first** for enums, tables, category seed slugs, RLS enablement, grants/revokes, admin guard and status transitions.
- [ ] **Step 2: Run the migration test** with `node --test scripts/check-support-migration.test.mjs`; expected: FAIL because the migration is absent.
- [ ] **Step 3: Implement the migration** with idempotent enums/tables/seeds, constraints, indexes, trigger/event recording, RLS and security-definer RPCs. Keep user-created values derived from `auth.uid()` and validate body/subject lengths in SQL.
- [ ] **Step 4: Run `node --test scripts/check-support-migration.test.mjs`**; expected: PASS.
- [ ] **Step 5: Run `npm run check:supabase`** and fix any boundary or migration convention failures.
- [ ] **Step 6: Commit** with `git add supabase/migrations/202610150022_support_center.sql scripts/check-support-migration.test.mjs && git commit -m "feat: add support center database model"`.

### Task 2: Criar o repositório de suporte

**Files:**
- Create: `frontend/src/lib/support.js`
- Create: `frontend/src/lib/support.test.js`

**Interfaces:**
- `createSupportRepository({ client })` returns `listCategories`, `listFaq`, `createTicket`, `listMyTickets`, `ticketDetail`, `addUserMessage`, `overview`, `listTickets`, `adminTicketDetail`, `reply`, `updateTicket`, `markRead`, `listFaqAdmin`, `saveFaqArticle` and `deleteFaqArticle`.
- Normalized objects use camelCase: `ticketId`, `userId`, `categorySlug`, `status`, `priority`, `assignedAdminId`, `lastMessageAt`, `firstResponseAt` and `messages`.

- [ ] **Step 1: Write repository tests** asserting RPC names/argument mapping, row normalization, empty results and Supabase errors.
- [ ] **Step 2: Run `npm --prefix frontend test -- src/lib/support.test.js`**; expected: FAIL because the module is absent.
- [ ] **Step 3: Implement the repository** following `createConsoleRepository`: one RPC helper, explicit `p_` argument names, no direct broad table reads for support data, and stable normalized return shapes.
- [ ] **Step 4: Run the focused test**; expected: PASS.
- [ ] **Step 5: Commit** with `git add frontend/src/lib/support.js frontend/src/lib/support.test.js && git commit -m "feat: add support repository"`.

### Task 3: Construir o fluxo de suporte do usuário

**Files:**
- Create: `frontend/src/views/Support.jsx`
- Create: `frontend/src/views/SupportTickets.jsx`
- Create: `frontend/src/views/SupportTicket.jsx`
- Create: `frontend/src/views/Support.test.jsx`
- Create: `frontend/src/support.css`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/views/More.jsx`

**Interfaces:**
- Routes: `/support`, `/support/tickets`, `/support/tickets/new`, `/support/tickets/:ticketId`.
- User views consume `createSupportRepository({ client: getBrowserSupabaseClient() })` and `useAuth()`; unavailable/unauthenticated states use existing app patterns.

- [ ] **Step 1: Write view tests** for published FAQ filtering/search, required category/subject/body validation, successful create, ticket list, detail rendering, and archived-ticket reply disabled.
- [ ] **Step 2: Run the focused view tests**; expected: FAIL because routes/views are absent.
- [ ] **Step 3: Implement FAQ and support screens** using existing `AppHeader`, `Section`, `Button`, `TextField`, `TextArea`, icons and CSS tokens. Preserve form values on errors, expose accessible labels/statuses, and render mobile-first layouts.
- [ ] **Step 4: Add routes and replace the `mailto:` action** in `More.jsx` with navigation to `/support`.
- [ ] **Step 5: Run `npm --prefix frontend test -- src/views/Support.test.jsx`**; expected: PASS.
- [ ] **Step 6: Commit** with `git add frontend/src/views/Support.jsx frontend/src/views/SupportTickets.jsx frontend/src/views/SupportTicket.jsx frontend/src/views/Support.test.jsx frontend/src/support.css frontend/src/App.jsx frontend/src/views/More.jsx && git commit -m "feat: add user support and FAQ screens"`.

### Task 4: Integrar suporte ao Console administrativo

**Files:**
- Modify: `frontend/src/views/Console.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/lib/support.js`
- Create: `frontend/src/views/ConsoleSupport.test.jsx`

**Interfaces:**
- Admin route: `/console/support`, rendered through existing `ConsoleShell`/`ConsoleNav`.
- Console consumes repository methods from Task 2 and keeps `useConsoleAccess()` as the authorization boundary.

- [ ] **Step 1: Write Console tests** for support navigation, overview counts, combined filters, ticket selection, reply, mark-read, status/priority/assignment updates, archive/reopen and admin-only fallback.
- [ ] **Step 2: Run the focused tests**; expected: FAIL until the Console support route exists.
- [ ] **Step 3: Add the Support navigation item and page** using the existing Console cards, chips, tables/list rows, motion presets and responsive styling. Keep filters in URL search params where the Console already uses them.
- [ ] **Step 4: Add the ticket detail panel and FAQ management controls** without changing existing users/professionals behavior.
- [ ] **Step 5: Add `/console/support` to `App.jsx` and verify detail route handling does not misclassify support as a user/professional detail route.
- [ ] **Step 6: Run `npm --prefix frontend test -- src/views/ConsoleSupport.test.jsx`**; expected: PASS.
- [ ] **Step 7: Commit** with `git add frontend/src/views/Console.jsx frontend/src/views/ConsoleSupport.test.jsx frontend/src/App.jsx frontend/src/lib/support.js && git commit -m "feat: add support inbox to admin console"`.

### Task 5: Verificação integrada e acabamento visual

**Files:**
- Modify: `frontend/src/support.css` or existing Console CSS location only if needed.
- Modify: `frontend/src/locales/pt.js` if new shared strings require localization entries.

- [ ] **Step 1: Run all frontend tests** with `npm test`; expected: PASS.
- [ ] **Step 2: Run `npm run build`**; expected: successful Vite build.
- [ ] **Step 3: Run `npm run check:supabase`**; expected: PASS including the support migration test.
- [ ] **Step 4: Inspect the rendered support and Console screens** at mobile and desktop widths, checking focus states, long messages, empty states, error states, status colors and visual consistency with the existing design.
- [ ] **Step 5: Fix only scoped visual or accessibility issues found by verification and rerun affected tests/build.
- [ ] **Step 6: Commit** with `git add frontend/src/support.css frontend/src/locales/pt.js && git commit -m "polish: verify support center experience"`.

## Handoff

Implementation should be executed task-by-task, with each task independently tested and committed. The database task must land before frontend repository work; the repository task must land before user/admin views.
