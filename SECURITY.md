# Política de segurança

## Versões suportadas

A branch `main` recebe correções de segurança. Releases devem ser atualizadas para a versão mais recente disponível.

## Como relatar

Use uma [denúncia privada de vulnerabilidade no GitHub](https://github.com/fabianoschmits/fit-pro-player/security/advisories/new). Não publique detalhes exploráveis em uma issue comum antes da correção.

Inclua, quando possível, a versão/commit, impacto, pré-condições, passos mínimos de reprodução e uma sugestão de mitigação. Não inclua dados reais de usuários ou segredos.

## Escopo operacional

- Proteja o acesso a `./data`: ele contém perfis, chaves públicas de passkey, estados de treino, cookies assinados e logs.
- Nunca versione `.env`, keystores, certificados ou chaves privadas.
- Em produção self-hosted, use HTTPS e faça `RP_ID`/`ORIGIN` corresponderem exatamente ao domínio.
- Para instâncias privadas, habilite `INVITE_ONLY=1`, defina `ALLOW_GUEST=0` e mantenha backups cifrados.
- A versão Vercel não possui backend: os dados permanecem no navegador do usuário e devem ser exportados periodicamente.
