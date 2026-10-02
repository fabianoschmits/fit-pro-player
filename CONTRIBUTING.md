# Contribuindo

Obrigado por melhorar o Fit Pro Player.

## Preparação

```powershell
Copy-Item .env.example frontend/.env.local
npm install
npm run setup
npm run dev
```

Antes de abrir um pull request, execute:

```powershell
npm test
npm run build
npm run build:vercel
npm run audit
npm --prefix frontend run check:i18n
npm run check:supabase
npx --prefix frontend playwright install chromium
npm --prefix frontend run test:e2e
npm --prefix frontend run test:e2e:pwa
```

Não envie `.env`, `data/`, backups, tokens, certificados, keystores nem chaves de assinatura. Mudanças de interface devem funcionar nos temas claro/escuro e em telas móveis. Mudanças de lógica devem incluir ou atualizar testes.

O projeto é proprietário. Contribuições somente podem ser incorporadas após autorização expressa do titular dos direitos.

Para mudanças no banco, inicie o Supabase local, execute `supabase db reset` e `npm run check:database`. Esse comando só aceita uma URL de banco em loopback. O CI executa migrations e testes SQL em um banco descartável.
