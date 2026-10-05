<div align="center">

<img src="assets/banner.svg" alt="Fit Pro Player" width="880">

Planeje treinos, acompanhe cargas, registre o peso corporal e visualize sua evolução.

[Fit Pro Player](https://www.fitpp.com.br)

</div>

## Arquitetura

O Fit Pro Player é uma PWA React hospedada na Vercel e integrada diretamente ao Supabase:

- Supabase Auth cria e autentica contas comuns e profissionais.
- PostgreSQL, RLS e RPCs protegem perfis, funções e sincronização.
- O frontend mantém cache local isolado por conta e suporta uso anônimo no navegador.
- Edge Functions, Storage e Realtime permanecem opcionais e só serão adicionados quando houver necessidade real.

Não existe backend Node, API `/api`, Docker ou armazenamento JSON de produção neste projeto.

## Desenvolvimento local

Requisitos: Node.js 22+ e npm.

```powershell
Copy-Item .env.example frontend/.env.local
# preencha apenas VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY
npm run setup
npm run dev
```

Comandos úteis:

```powershell
npm test
npm run build
npm run check:supabase
npm run audit
npm --prefix frontend run check:i18n
npm --prefix frontend run test:e2e
npm --prefix frontend run test:e2e:pwa
npm run check:database
```

Para o modo demo/local, o frontend também pode ser executado sem variáveis Supabase. Nesse modo os dados ficam no dispositivo e podem ser exportados em JSON.

## Deploy

O projeto é publicado na Vercel. Configure no projeto Vercel apenas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Chaves privadas do Supabase não pertencem ao frontend e não são lidas pelo Vite. Migrations versionadas em `supabase/migrations` são aplicadas separadamente ao projeto Supabase.

A migration `202610020014_professional_readiness.sql` é necessária para a versão profissional: o frontend usa RPCs para criar/editar programas e iniciar/concluir/abandonar execuções. Aplique e valide migrations antes de publicar esse frontend. O push do código não aplica migrations ao banco remoto.

Veja [operação e validação da versão profissional](docs/PROFESSIONAL_READINESS.md) para sincronização, preparação offline, recuperação e testes.

## Notificações

A central em Configurações separa alertas locais dos timers e avisos importantes em segundo plano. Descanso e séries cronometradas não são enviados ao Supabase. PWA usa avisos locais sujeitos à suspensão do navegador; APK Android agenda esses prazos no sistema.

Avisos remotos exigem a migration `202610040015_notifications.sql`, o worker `supabase/functions/push-dispatch` e a instalação administrativa [Cron/Vault](supabase/operations/notifications.sql). Configure somente no servidor `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` e `PUSH_DISPATCH_SECRET`. A chave pública chega ao cliente via RPC. A fila ociosa não invoca a Edge Function.

FCM no APK permanece desativado até configurar Firebase. Veja [integração Android futura](docs/notifications-android-setup.md). Testes de envio: `npm run test:notifications`; testes PostgreSQL: `PG_BIN` apontando para os binários e `NOTIFICATIONS_REQUIRE_DB=1 node --test scripts/check-notification-migration.test.mjs`.

## Estrutura

- `frontend/`: React, Vite, Zustand, PWA e projetos Capacitor.
- `supabase/`: migrations, testes SQL e validações de fronteira.

## Workspaces profissionais

Contas profissionais continuam podendo treinar normalmente e recebem uma workspace separada:

- `/professional`: visão geral;
- `/professional/students`: alunos com vínculo ativo;
- `/professional/students/:studentId`: resumo, treino, histórico e vínculo;
- `/professional/invites`: criação, compartilhamento e revogação de convites;
- `/professional/programs`: programas e versões;
- `/student/professionals`: profissionais vinculados e aceite de convites.

`/connect` permanece apenas como redirect compatível para `/student/professionals`. Profissionais administram somente alunos vinculados; não administram contas, senhas, emails ou roles.
- `docs/MOBILE.md`: notas para builds móveis.

## Segurança

Nunca versione `.env`, credenciais, tokens, chaves privadas, dados de usuários ou artefatos de deploy. Consulte [SECURITY.md](SECURITY.md) para reportar vulnerabilidades.

## Direitos

Código, identidade visual e animações de exercícios do Fit Pro Player são proprietários. Todos os direitos reservados.
