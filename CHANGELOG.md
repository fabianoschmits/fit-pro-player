# Changelog

## Unreleased — Fit Pro Player

- Nova identidade “Fit Pro Player” em web, PWA, Android, iOS, Docker e MCP.
- Novo modo estático local-first para implantação segura na Vercel.
- Configuração local compatível com Windows por meio de um único `npm run dev`.
- Cabeçalhos de segurança adicionados à Vercel e ao nginx.
- Cookies de sessão restritos com `SameSite=Strict`.
- Limite por cliente nos endpoints de registro/login por passkey.
- Mensagens internas de validação WebAuthn deixaram de ser expostas ao cliente.
- Pipelines consolidados no GitHub Actions e imagens preparadas para GHCR.
- Ferramentas de desenvolvimento vulneráveis ou não utilizadas removidas/atualizadas.

## 1.2.9

Base funcional inicial da aplicação antes da personalização Fit Pro Player.
