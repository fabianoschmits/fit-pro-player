<div align="center">
  <img src="frontend/public/brand-logo.png" alt="Logo oficial" width="420">

  <p>Planeje treinos, acompanhe cargas, registre o peso corporal e visualize sua evolução.</p>

  <p><a href="https://www.fitpp.com.br">Abrir o aplicativo</a></p>
</div>

## Sobre o projeto

Aplicação web progressiva para planejamento e acompanhamento de treinos. O produto possui modo local/demo, sincronização opcional com Supabase, autenticação, histórico, estatísticas, BodyMap, notificações e fluxos para alunos e profissionais.

## Stack

- React 19 + Vite
- Zustand para estado no frontend
- Supabase Auth, PostgreSQL, RLS, RPCs, Edge Functions e Storage conforme o recurso
- PWA e Capacitor para Android/iOS
- Vercel para publicação web

## Executar localmente

Requisitos: Node.js 22.x e npm.

```powershell
Copy-Item .env.example frontend/.env.local
# preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY quando quiser sincronização
npm run setup
npm run dev
```

Sem as variáveis do Supabase, o frontend pode ser usado no modo local/demo. Os dados permanecem no dispositivo e podem ser exportados pelo próprio aplicativo.

## Comandos

```powershell
npm test                              # testes unitários/integrados do frontend
npm run build                         # build web
npm run build:vercel                  # build usado pela Vercel
npm run check:supabase                # fronteiras e migrations do Supabase
npm run check:database                # testes PostgreSQL, quando PG_BIN estiver configurado
npm run audit                         # auditoria de dependências
npm --prefix frontend run check:i18n  # validações de tradução
npm run test:e2e                      # testes end-to-end
```

## Publicação

O deploy web é configurado em [`vercel.json`](vercel.json). Na Vercel, configure apenas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

As migrations são versionadas em [`supabase/migrations`](supabase/migrations) e precisam ser aplicadas ao projeto Supabase separadamente do deploy do frontend. Segredos como chaves VAPID e credenciais de push ficam somente no ambiente servidor/Edge Functions.

## Estrutura

```text
frontend/     aplicação React, PWA, testes e projetos Capacitor
supabase/     migrations, funções, testes e operações do banco
scripts/      verificações de limites, banco e identidade da marca
assets/       identidade visual e materiais oficiais
docs/         operação mobile, notificações e prontidão profissional
```

As rotas profissionais incluem `/professional`, `/professional/students`, `/professional/invites`, `/professional/programs` e `/student/professionals`. O alias `/connect` permanece por compatibilidade.

## Segurança

Não versione `.env`, tokens, chaves privadas, dados de usuários ou artefatos de deploy. Consulte [SECURITY.md](SECURITY.md) para reportar vulnerabilidades.

## Licença

Código, identidade visual e animações de exercícios são proprietários. Todos os direitos reservados.
