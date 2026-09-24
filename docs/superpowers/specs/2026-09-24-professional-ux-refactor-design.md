# Professional UX Refactor Design

## Objetivo

Transformar a área profissional, a gestão de alunos, convites, programas e a área “Meus profissionais” em uma experiência mobile-first, clara e navegável, sem criar um backend paralelo nem renomear o domínio Supabase já aplicado.

## Decisões

- O produto mantém Vercel + React/PWA + Supabase Auth/PostgreSQL/RLS/RPCs.
- Profissional continua sendo também usuário normal; a entrada profissional será um workspace separado da tab bar principal.
- “Aluno” significa relacionamento profissional ativo; “convite” significa tentativa pendente; “programa” é versionado; “treino” é uma execução diária.
- O profissional poderá ver apenas alunos com vínculo ativo e execuções dos programas que ele atribuiu.
- As tabelas e policies existentes serão reutilizadas. Não haverá rename destrutivo nem uma tela genérica de administração de usuários.
- A navegação será composta por páginas próprias, com redirects de `/connect` e `/professional` antigo preservados quando necessário.

## Arquitetura de informação

Área profissional:

- `/professional` — Visão geral e ações rápidas.
- `/professional/students` — Alunos ativos, busca e filtros reais.
- `/professional/students/:studentId` — resumo, treino, histórico e vínculo.
- `/professional/invites` — criação, cópia, compartilhamento e convites pendentes.
- `/professional/programs` — programas e versões.
- `/professional/profile` — redirect compatível para o perfil profissional existente.

Área do aluno:

- `/student/professionals` — profissionais vinculados, adicionar profissional, preview e aceite.
- `/invite/:code` — deep link que preserva o código e leva à confirmação após autenticação.

## Componentes e dados

- `ProfessionalWorkspaceNav` fornece navegação interna compacta e acessível.
- `ProfessionalStudents` renderiza cards, busca, filtros e estados vazios sem carregar detalhes N+1.
- `ProfessionalStudentPage` usa `professional_client_detail` e separa resumo, treino, histórico e vínculo.
- `ProfessionalInvites` usa o RPC de convite existente e apresenta código/link no mesmo card.
- `ProfessionalPrograms` mantém o editor e as versões, mas remove atribuição implícita a “primeiro cliente”.
- `StudentProfessionals` substitui o fluxo fragmentado de `/connect`, mantendo preview antes do aceite.
- Helpers puros normalizam status, filtros, deep links e resumos para testes unitários.
- O repository Supabase continua sendo o único ponto de acesso de domínio; componentes não farão consultas `.from()` espalhadas.

## Segurança

- Nenhum componente terá permissão para editar email, senha, role ou conta do aluno.
- Encerrar vínculo será uma ação explícita e perigosa; revogar convite ficará separado de alunos ativos.
- Nenhuma política RLS será enfraquecida. Os RPCs continuam security definer com `auth.uid()` e `search_path` restrito.

## Estados e acessibilidade

Todas as páginas terão loading local, erro com retry, empty state com CTA, labels e targets de toque confortáveis. Tabs terão `role=tablist/tab`, foco visível e layout responsivo para 320, 360, 390, 430, 768 e 1280 px. O design usa tokens, tipografia, cores e dark/light existentes.

## Verificação

- Testes unitários para status, filtros, convite/deep link e summaries.
- Testes de componentes para empty/loading/error/success e ações críticas.
- Suite existente, build, i18n, boundaries Supabase, audit e diff check.
- QA hospedado com dois profissionais e dois alunos separados, cobrindo convite, aceite, atribuição, execução, histórico, revoke e isolamento.
- Smoke browser em produção para as rotas novas, light/dark, mobile/desktop e console sem erros fatais.
