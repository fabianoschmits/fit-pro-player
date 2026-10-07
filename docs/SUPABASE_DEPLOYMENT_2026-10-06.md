# Supabase deployment — ops console (2026-10-06)

Projeto: **Fpp** (`bgqavxoxwgheloeubbpf`).

## Aplicado

- Migration `202610060016_ops_console`
- Coluna `profiles.suspended_at`
- RPCs `ops_*` (require_admin, overview, list/detail users & professionals, set display name / suspended / professional role / verification, update professional profile, delete user)
- Seed do role `admin` para `schmitsfabiano@outlook.com` (`4871d9b4-09ba-4768-806c-c608ebbfe42f`)

## Validação

- `user_roles` do operador contém `admin` (além de `student` / `professional` se já existiam)
- `npm run check:supabase` — teste `ops console migration seeds admin and gates every RPC` passa
