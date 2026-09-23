# Política de segurança

## Escopo operacional

O frontend é uma PWA hospedada na Vercel e usa o Supabase como autoridade de autenticação e dados. O acesso a dados é protegido por Supabase Auth, PostgreSQL RLS e RPCs com privilégios mínimos.

O navegador pode receber somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca coloque no frontend, no Git ou em logs:

- `SUPABASE_SECRET_KEY`;
- senha do banco;
- access tokens administrativos;
- arquivos `.env` ou dados de usuários.

## Relato

Use uma [denúncia privada de vulnerabilidade no GitHub](https://github.com/fabianoschmits/fit-pro-player/security/advisories/new). Não publique detalhes exploráveis em uma issue comum antes da correção.

Inclua, quando possível, a versão/commit, impacto, pré-condições, passos mínimos de reprodução e uma sugestão de mitigação. Não inclua dados reais de usuários ou segredos.
