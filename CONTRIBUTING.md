# Contribuindo

Obrigado por melhorar o Fit Pro Player.

## Preparação

```powershell
Copy-Item .env.example .env
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
```

Não envie `.env`, `data/`, backups, tokens, certificados, keystores nem chaves de assinatura. Mudanças de interface devem funcionar nos temas claro/escuro e em telas móveis. Mudanças de lógica devem incluir ou atualizar testes.

O projeto é proprietário. Contribuições somente podem ser incorporadas após autorização expressa do titular dos direitos.
