# Central da plataforma

O acesso administrativo está em **Mais → Central da plataforma**. A Visão geral destaca **Mensagens dos usuários**, com acesso direto à caixa de entrada.

| Página | Rota | Conteúdo |
| --- | --- | --- |
| Visão geral | `/console` | Atendimento, indicadores e atalhos da plataforma |
| Usuários | `/console/users` | Busca, filtros e contas |
| Perfil do usuário | `/console/users/:userId` | Seções de conta/acesso, treinos/evolução e perfil profissional |
| Profissionais | `/console/professionals` | Perfis e verificações |
| Mensagens | `/console/support` | Busca, status, categorias, prioridade, período e paginação |
| Conversa | `/console/support/:ticketId` | Mensagens, resposta, status, prioridade, responsável e arquivamento |
| FAQ | `/console/faq` | Conteúdo publicado e rascunhos |
| Editor do FAQ | `/console/faq/:articleId` | Pergunta, resposta, categoria, destaque, ordem e publicação |

As rotas aparecem depois de `/#` no aplicativo. As seções do perfil usam `?section=account`, `?section=training` e `?section=professional`.

## Layout

A interface usa o fundo e as cores de texto/destaque do Fit Pro Player, com seções alinhadas, listas compactas e divisórias discretas, sem cards envolvendo conteúdo. No celular, a navegação administrativa é horizontal, os filtros adicionais ficam recolhidos e o aplicativo não sobrepõe a barra de treino à conversa. O cabeçalho permanece visível durante a rolagem. No desktop, as mesmas páginas usam navegação lateral.

O módulo está separado em `frontend/src/features/console/`. A view `Console.jsx` mantém as exportações usadas pelas rotas existentes.

## Central de notificações

O sino está no topo de todas as páginas administrativas. A modal lista mensagens de usuários, novos cadastros, verificações pendentes, atualizações de FAQ e eventos profissionais já registrados pelo projeto (programas, vínculos e treinos).

As leituras são persistidas por administrador em `ops_notification_reads`. Clicar em uma notificação marca sua leitura e abre o item correspondente. A lista é paginada e se atualiza ao abrir, ao voltar à janela e a cada 60 segundos enquanto a página está visível. Ações na mesma conversa também atualizam seu conteúdo.

As funções `ops_list_notifications` e `ops_mark_notifications_read` exigem `ops_require_admin()`. O feed interno não tem permissão de execução para clientes. O feed usa os eventos disponíveis no banco e não cria notificações push adicionais.

## Verificação

- Interface: `npm --prefix frontend test -- src/views/ConsoleWorkspace.test.jsx src/features/console/ConsoleNotifications.test.jsx src/views/SupportComposer.test.jsx`.
- Navegador: no diretório `frontend`, `node node_modules/@playwright/test/cli.js test --config=playwright.console.config.js` (porta 8082, desktop e celular).
- Banco: `supabase/tests/202610150024_ops_notification_center.sql` e `supabase/tests/202610150025_ops_notification_routing.sql`. Os testes executam dentro de transações e revertem seus dados de teste.
- Migrações: `202610150024_ops_notification_center.sql` e `202610150025_ops_notification_routing.sql`.
