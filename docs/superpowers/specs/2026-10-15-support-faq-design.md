# FAQ e Central de Suporte — Especificação de Design

## Objetivo

Adicionar ao Fit Pro Player uma área de FAQ e um canal autenticado de atendimento, permitindo que usuários tirem dúvidas, enviem críticas e sugestões e acompanhem a evolução dos chamados. Administradores devem receber, responder, categorizar, priorizar e arquivar esses chamados dentro do Console existente.

## Escopo aprovado

Incluído:

- FAQ público para usuários autenticados, com busca, categorias, destaque e publicação.
- Abertura de chamado com categoria, assunto e mensagem.
- Histórico de chamados e mensagens do próprio usuário.
- Resposta administrativa em conversa encadeada.
- Filtros e organização administrativa por status, categoria, prioridade, responsável e período.
- Estados `unread`, `read`, `pending`, `answered`, `resolved` e `archived`.
- RLS e funções administrativas protegidas pelo papel `admin` existente.
- Migração Supabase, camada de repositório, rotas, telas, navegação e testes.

Fora do escopo inicial: anexos, envio de e-mail, notificações push, SLA, múltiplos departamentos e respostas automáticas.

## Experiência do usuário

Em “Mais > Ajuda e suporte”, substituir o link `mailto:` por uma tela `/support` com duas áreas:

1. FAQ: campo de busca, chips de categoria e lista expansível de perguntas. Apenas artigos publicados aparecem; artigos destacados podem ser exibidos primeiro.
2. Fale com o administrador: formulário com categoria obrigatória, assunto obrigatório e mensagem obrigatória. Após envio, o usuário recebe confirmação e pode abrir “Meus chamados”.

Usuários autenticados podem visualizar seus chamados em `/support/tickets`, abrir um chamado em `/support/tickets/new` e ver a conversa em `/support/tickets/:ticketId`. Eles só podem inserir novas mensagens enquanto o chamado não estiver arquivado; ao responder um chamado resolvido, ele volta para `pending`.

Categorias iniciais, armazenadas no banco: `question` (Dúvida), `technical` (Problema técnico), `criticism` (Crítica), `suggestion` (Sugestão de melhoria), `feature_request` (Solicitação de recurso), `account` (Conta e acesso), `training` (Treino e exercícios), `privacy` (Privacidade e dados) e `other` (Outro).

## Experiência administrativa

Adicionar `/console/support` ao Console. A tela terá:

- cards com contagem de não lidas, pendentes, respondidas e resolvidas;
- busca por e-mail, nome, assunto ou conteúdo;
- filtros combináveis de status, categoria, prioridade e período;
- lista paginada ordenada por atividade mais recente;
- detalhe do chamado com dados do usuário, conversa e histórico de eventos;
- ações para marcar como lido, alterar status, alterar prioridade, atribuir administrador, responder e arquivar/reabrir;
- editor de FAQ para criar, editar, publicar/despublicar, destacar e ordenar artigos.

Prioridades: `low`, `normal`, `high`, `urgent`; novos chamados iniciam em `normal`, `unread` e `pending`.

## Modelo de dados

### `public.support_categories`

Tabela de referência com `id uuid`, `slug text unique`, `label text`, `description text`, `sort_order integer`, `is_active boolean`, `created_at timestamptz` e `updated_at timestamptz`.

### `public.support_faq_articles`

Campos: `id uuid`, `category_id uuid`, `question text`, `answer text`, `sort_order integer`, `is_featured boolean`, `is_published boolean`, `created_by uuid`, `updated_by uuid`, `created_at timestamptz`, `updated_at timestamptz`, `published_at timestamptz`.

Artigos são conteúdo administrativo; usuários leem somente artigos publicados. Administradores gerenciam todos.

### `public.support_tickets`

Campos: `id uuid`, `user_id uuid`, `category_id uuid`, `subject text`, `status public.support_ticket_status`, `priority public.support_ticket_priority`, `assigned_admin_id uuid`, `last_message_at timestamptz`, `first_read_at timestamptz`, `first_response_at timestamptz`, `resolved_at timestamptz`, `archived_at timestamptz`, `created_at timestamptz`, `updated_at timestamptz`.

Índices: status/updated_at, user_id/updated_at, category_id/status, assigned_admin_id/status. O conteúdo textual de busca será pesquisado por funções administrativas para evitar exposição direta ampla da tabela.

### `public.support_messages`

Campos: `id uuid`, `ticket_id uuid`, `author_id uuid`, `author_kind public.support_author_kind`, `body text`, `read_at timestamptz`, `created_at timestamptz`.

Mensagens são append-only para usuários e administradores; correções de conteúdo não serão suportadas na primeira versão. O trigger atualiza `last_message_at` do chamado. Mensagem do usuário define `pending`; resposta administrativa define `answered` e `first_response_at` quando aplicável.

### `public.support_ticket_events`

Campos: `id uuid`, `ticket_id uuid`, `actor_id uuid`, `event_type text`, `from_value jsonb`, `to_value jsonb`, `created_at timestamptz`.

Registra alterações de status, prioridade, atribuição, leitura, arquivamento e reabertura.

Enums:

- `support_ticket_status`: `unread`, `read`, `pending`, `answered`, `resolved`, `archived`.
- `support_ticket_priority`: `low`, `normal`, `high`, `urgent`.
- `support_author_kind`: `user`, `admin`.

## Segurança e funções

Usuários autenticados terão RLS para inserir chamados/mensagens e ler apenas seus próprios registros. Eles não poderão definir `author_id`, `author_kind`, status, prioridade, atribuição ou datas administrativas; funções de segurança definem esses valores a partir de `auth.uid()`.

Administradores serão verificados por `ops_require_admin()`. Funções protegidas previstas:

- `support_create_ticket(category_slug, subject, body)`;
- `support_add_user_message(ticket_id, body)`;
- `support_list_my_tickets(status, limit, offset)`;
- `support_ticket_detail(ticket_id)`;
- `ops_support_overview()`;
- `ops_support_list_tickets(query, status, category, priority, assigned_admin_id, from_date, to_date, limit, offset)`;
- `ops_support_ticket_detail(ticket_id)`;
- `ops_support_reply(ticket_id, body)`;
- `ops_support_update_ticket(ticket_id, status, priority, assigned_admin_id)`;
- `ops_support_mark_read(ticket_id)`;
- funções administrativas equivalentes para FAQ.

Funções administrativas devem chamar `ops_require_admin()` e ter `revoke all`/`grant execute` alinhados ao padrão de `202610060016_ops_console.sql`. A migração deve incluir seeds idempotentes das categorias iniciais.

## Arquitetura de frontend

Criar uma camada `frontend/src/lib/support.js` com repositório factory, seguindo o padrão de `createConsoleRepository`, para encapsular consultas RPC e normalização de respostas.

Criar views separadas para suporte do usuário e administração. Adicionar as rotas no `App.jsx`, integrar Ajuda e suporte no `More.jsx` e adicionar navegação do suporte ao Console existente. CSS deve aproveitar tokens e componentes atuais, com regras específicas isoladas em `support.css`/`console` apenas quando necessário.

Todos os estados de carregamento, erro, vazio e sucesso devem ser representados. Falhas de envio não podem apagar o texto digitado. A interface deve funcionar em telas móveis e desktop.

## Testes e verificação

- Testes de migração para enums, tabelas, RLS, grants, seeds e funções administrativas.
- Testes do repositório para criação, listagem, detalhe, resposta e atualização de status.
- Testes de views para FAQ, validação do formulário, histórico do usuário, filtros administrativos e transições de estado.
- Testes de rota/navegação para `/support` e `/console/support`.
- `npm test`, `npm run build` e `npm run check:supabase` devem passar.

## Critérios de aceite

1. Um usuário autenticado consegue encontrar uma resposta no FAQ ou abrir um chamado com categoria, assunto e mensagem.
2. O usuário vê somente os próprios chamados e consegue acompanhar respostas e status.
3. Um administrador recebe novos chamados como não lidos e pendentes, consegue responder e organizá-los pelos filtros solicitados.
4. Status, prioridade, atribuição, arquivamento e respostas ficam persistidos e auditáveis.
5. Usuários não conseguem consultar ou modificar chamados de outras pessoas por acesso direto ao Supabase.
6. O fluxo existente do aplicativo e do Console continua funcionando.
