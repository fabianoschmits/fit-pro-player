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
```

Para o modo demo/local, o frontend também pode ser executado sem variáveis Supabase. Nesse modo os dados ficam no dispositivo e podem ser exportados em JSON.

## Deploy

O projeto é publicado na Vercel. Configure no projeto Vercel apenas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Chaves privadas do Supabase não pertencem ao frontend e não são lidas pelo Vite. Migrations versionadas em `supabase/migrations` são aplicadas separadamente ao projeto Supabase.

## Estrutura

- `frontend/`: React, Vite, Zustand, PWA e projetos Capacitor.
- `supabase/`: migrations, testes SQL e validações de fronteira.
- `docs/MOBILE.md`: notas para builds móveis.

## Segurança

Nunca versione `.env`, credenciais, tokens, chaves privadas, dados de usuários ou artefatos de deploy. Consulte [SECURITY.md](SECURITY.md) para reportar vulnerabilidades.

## Direitos

Código, identidade visual e animações de exercícios do Fit Pro Player são proprietários. Todos os direitos reservados.
