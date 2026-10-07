# Central (ops console) — desenho entregue

Data: 2026-10-06.  
Status: **implementado e aplicado no projeto Supabase Fpp**.  
Commit: `9e98c63`. Migration remota: `202610060016_ops_console`.

## Intenção

Área discreta para o operador da plataforma gerir utilizadores e profissionais, sem superfície nomeada “admin”. Só contas com role `admin` veem o link e executam as RPCs.

## Superfície

| Item | Valor |
|------|--------|
| Rota | `/console` (+ `/users`, `/users/:userId`, `/professionals`) |
| Título UI | Central |
| Link | Mais → “Central” (só se `admin`) |
| View | `frontend/src/views/Console.jsx` |
| Repo | `frontend/src/lib/console.js` |

## Segurança

- Seed: role `admin` para `4871d9b4-09ba-4768-806c-c608ebbfe42f` quando o user existe em `auth.users`.
- Todas as RPCs `ops_*` são `security definer` e chamam `ops_require_admin()`.
- Soft-guard na UI; hard-guard no servidor.
- Contas admin não podem ser suspensas/apagadas via ops; o operador não suspende/apaga a própria conta.
- Contas suspensas (`profiles.suspended_at`) são desconectadas no `AuthProvider`.

## Funções (v1)

**Visão geral:** contagens de utilizadores, profissionais, verificação pendente, suspensos, novos (7d).

**Utilizadores:** listar/pesquisar; detalhe; editar nome; conceder/remover role profissional; suspender/reativar; apagar conta.

**Profissionais:** listar/filtrar por verificação; aprovar/rejeitar/marcar pendente; editar perfil profissional.

## Fora de escopo (v1)

Impersonação, audit log, ações em massa, alteração de email/password de terceiros.
