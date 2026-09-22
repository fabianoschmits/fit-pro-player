# FPP Professional — Fase 1B: Supabase Auth Bootstrap / User Bearer Bridge

**Status:** especificação arquitetural proposta; nenhuma implementação iniciada.

## 1. Objetivo

A Fase 1B conecta a sessão principal do Fit Pro Player, autenticada por WebAuthn e cookie FPP, ao contexto de identidade exigido pelo Supabase Data API e RLS.

Um usuário com sessão FPP válida e vínculo active em legacy_identity_links poderá obter um JWT Supabase curto, assinado pelo backend com uma chave assimétrica confiada pelo projeto Supabase. O frontend manterá esse JWT somente em memória.

Fluxo normal e após reload:

WebAuthn/FPP login → cookie HttpOnly FPP → backend valida a sessão → resolve legacy_identity_links → emite JWT curto → frontend mantém o bearer em memória → cliente Supabase usa publishable key mais JWT → auth.uid() corresponde ao supabase_user_id vinculado → RLS continua sendo a autoridade.

Esta fase não implementa ProfessionalProfile, migration 004 ou qualquer acesso da Fase 3.

## 2. Contexto atual

A Fase 1 já possui cookie gymsid assinado, validação server-side, logout-all por versão de sessão, cookie HttpOnly com SameSite=Strict, legacy_identity_links e um backend Supabase admin client para operações de identidade.

O frontend atualmente recebe um bearer Supabase somente durante o fluxo manual de vinculação e não o persiste. Após reload, o cookie FPP continua válido, mas a memória JavaScript perde o bearer. O endpoint desta fase resolve exclusivamente essa lacuna.

## 3. Princípios de segurança

- A sessão FPP é a autenticação primária.
- O alvo do token vem exclusivamente da sessão FPP e de legacy_identity_links com status active.
- O frontend não envia user_id, supabase_user_id, email ou role como autoridade.
- O JWT prova identidade; capabilities continuam sendo decididas pelo banco, user_roles, RLS e policies.
- SUPABASE_SECRET_KEY não será signing key nem caminho de edição normal.
- O JWT não conterá professional, student, admin ou verified professional como autoridade.
- A chave privada nunca irá para frontend, Vite, Capacitor, frontend/dist, Git ou logs.
- Nenhum bearer será colocado em localStorage, sessionStorage, IndexedDB, gym_state_v1, URL, logs ou mensagens de erro.
- Logout limpa o bearer em memória; o TTL curto limita a janela de um JWT já emitido.

## 4. Resolução da identidade

O endpoint validará readSession(req), rejeitará sessão ausente, expirada, desabilitada ou invalidada, consultará legacy_identity_links pelo identificador da sessão FPP, exigirá status active e usará somente o supabase_user_id vinculado.

Vínculo ausente, revoked ou inconsistente não será recriado silenciosamente. O contrato será HTTP 409 com identity_not_linked, sem revelar IDs, emails ou vínculos de outros usuários.

Usuário A nunca poderá obter token de B: o endpoint não aceitará parâmetro de identidade e o alvo será derivado server-side.

## 5. Endpoint

Path proposto: POST /api/account/supabase-token. O nome será confirmado contra o dispatch atual durante o planejamento de implementação.

Requisitos: POST; sessão FPP válida; corpo vazio ou objeto vazio; rejeição de user_id, supabase_user_id, email e role no corpo; validação de Origin/Referer quando presentes; resposta sem cache; rate limit; nenhum detalhe interno em erros.

Sucesso retorna somente access_token, token_type Bearer, expires_in e expires_at. O token nunca será gravado em audit log, banco ou erro.

Erros estáveis: 401 not signed in; 409 identity_not_linked; 429 too many requests; 503 supabase auth bootstrap unavailable; 500 account unavailable.

## 6. JWT e claims

Algoritmo aprovado para implementação: ES256, condicionado à confirmação de que o projeto Supabase aceita a chave pública ou JWKS importada para esse issuer. RS256 é apenas fallback de compatibilidade; HS256 não será usado.

Header mínimo: typ JWT, alg ES256 e kid configurado.

Claims mínimos: iss com a URL Auth do projeto; aud authenticated; sub exatamente igual ao supabase_user_id do vínculo; role authenticated; iat; exp.

Não incluir capabilities, email, phone, app_metadata, user_metadata, session_id ou claims de produto sem necessidade comprovada. O frontend não poderá escolher alg, kid, sub, role, aud, iss ou exp.

A implementação usará biblioteca criptográfica mantida, preferencialmente jose, sem implementar JWT ou ECDSA manualmente.

Validação técnica: a documentação oficial do Supabase descreve sub, role, aud, iss, iat e exp como claims relevantes para identidade e RLS; aceita JWT externo assinado por chave importada; e documenta accessToken dinâmico no cliente. Esses pontos deverão ser confirmados contra a configuração real antes do deploy.

## 7. Signing key e ambiente

Variáveis propostas:

- FPP_SUPABASE_JWT_PRIVATE_KEY: PEM ou JWK privado, backend-only.
- FPP_SUPABASE_JWT_KEY_ID: kid configurado no Supabase.
- FPP_SUPABASE_JWT_ISSUER: issuer esperado, sem override do cliente.
- FPP_SUPABASE_JWT_AUDIENCE: authenticated, validado contra allowlist fixa.

A chave privada será distinta por ambiente, ficará em secret manager ou ambiente seguro e não terá valor real no .env.example. Startup deverá falhar fechado quando chave, kid ou issuer forem ausentes ou incompatíveis.

A chave pública ou JWKS será registrada no Supabase por operação explicitamente autorizada. Rotação futura usará chave standby, sobreposição, validação e revogação; rotação automática fica fora desta fase.

## 8. Backend boundary

Criar uma abstração server-only responsável por validar a sessão, resolver o vínculo, construir claims, assinar ES256, aplicar rate limit e gerar a resposta. O admin client existente poderá fazer somente a leitura protegida do vínculo necessária à emissão; não será usado para CRUD normal.

Erros e logs nunca conterão private key, bearer, cookie, assinatura, payload JWT completo ou IDs completos. Observabilidade usará categorias, ambiente, latência, resultado e correlation id.

## 9. Cliente frontend

Criar uma única abstração getSupabaseAccessToken, ensureSupabaseAccessToken, clearSupabaseAccessToken e subscribeSupabaseToken.

Token válido em memória é reutilizado. Token ausente ou próximo da expiração chama o endpoint. Chamadas concorrentes compartilham uma única Promise. Sucesso grava apenas memória. 401 limpa o token. 409, 429 e 503 falham de forma previsível sem loop infinito. Logout limpa imediatamente e impede que Promise antiga reinstale token.

Após reload, a memória começa vazia, o cookie FPP é enviado automaticamente ao endpoint same-origin e um novo bearer é recebido. Nenhum token ou refresh token será persistido.

O cliente Supabase público usará VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY e accessToken dinâmico. A versão instalada de supabase-js será verificada para usar a opção accessToken, em vez de Authorization manual global.

## 10. Expiração e concorrência

TTL inicial proposto: 5 minutos. O token será renovado quando faltarem 30 segundos ou menos. Uma requisição em andamento não será interrompida; a próxima chamada fará uma única renovação.

O módulo manterá token, expiração, Promise de bootstrap e geração monotônica para impedir que resposta antiga sobrescreva token novo. Dez chamadas sem token produzem uma única emissão.

Não haverá refresh token Supabase no browser, blacklist complexa ou retry infinito.

## 11. Logout, CSRF e origem

Logout e logout-all continuarão usando o fluxo existente. O frontend limpa o bearer imediatamente; bootstrap posterior exige novamente o cookie FPP válido. Logout-all invalida a versão da sessão e impede novos bootstraps.

O cookie SameSite=Strict é apenas uma camada. O endpoint aceitará somente POST, validará Origin quando presente, validará Referer quando Origin não estiver presente sob a política aplicável, recusará CORS wildcard com credentials, exigirá Content-Type JSON quando houver corpo e responderá sem cache.

A política para Capacitor será definida a partir da origem nativa real sem enfraquecer a proteção web. POST sozinho não será considerado proteção CSRF suficiente.

## 12. RLS e capabilities

O JWT fornecerá somente contexto de identidade: auth.uid() deriva de sub e o papel PostgreSQL será authenticated. Policies continuarão consultando ownership, user_roles e tabelas de domínio.

Remover professional de user_roles impedirá a capability profissional mesmo que um JWT curto ainda esteja em memória. A futura professional_profiles continuará owner-only e role-gated.

Por padrão, a Fase 1B não exigirá migration PostgreSQL: reutilizará legacy_identity_links e estruturas existentes. Configuração de chave/JWKS será configuração de Auth/deploy, não migration de dados.

## 13. Testes obrigatórios

Backend: sessão válida mais vínculo active emite token; sub corresponde ao vínculo; role é authenticated; claims, expiração, issuer e audience são validados; sessão ausente retorna 401; vínculo ausente ou revoked retorna 409; A nunca recebe token de B; logout e logout-all bloqueiam novo bootstrap; corpo não escolhe identidade; chave ausente falha fechado; logs não vazam segredo; rate limit funciona.

Frontend: memória vazia faz bootstrap; token válido é reutilizado; expiração renova uma vez; reload recupera novo token pelo cookie FPP; chamadas concorrentes compartilham Promise; 401 limpa token; logout impede reinstalação antiga; nenhum token aparece em localStorage, sessionStorage, IndexedDB ou gym_state_v1; cliente usa public key e accessToken dinâmico.

Integração/RLS: JWT válido produz auth.uid() correto; RLS permite dados próprios e bloqueia dados de B; capability profissional removida continua bloqueando operação; usuário sem vínculo não cria vínculo; reload seguido de bootstrap permite acesso ao cliente Supabase.

## 14. Deploy, observabilidade e exclusões

Antes da implementação será necessário confirmar no projeto real a disponibilidade de JWT Signing Keys ou imported signing key, algoritmo, issuer, audience e endpoint JWKS. Nenhuma alteração remota será feita nesta fase.

Eventos permitidos: bootstrap.success, bootstrap.not_signed_in, bootstrap.identity_not_linked, bootstrap.rate_limited, bootstrap.config_unavailable, bootstrap.signing_failed e bootstrap.origin_denied. Registrar somente categoria, ambiente, resultado, duração e correlation id.

Ficam fora: professional_profiles, migration 004, UI Professional Profile, Supabase Auth login tradicional, refresh tokens, Storage, convites, relacionamentos, alunos, programas, assignments, executions, dashboard, Fase 3 e rotação automática.

## 15. Referências técnicas

- https://supabase.com/docs/guides/auth/jwts
- https://supabase.com/docs/guides/auth/jwt-fields
- https://supabase.com/docs/guides/auth/third-party/overview
- https://supabase.com/features/jwt-signing-keys

## 16. Self-review e transição

Esta especificação foi revisada contra os riscos de token persistido, secret no frontend, capabilities no JWT, emissão para usuário errado, vínculo inválido, CSRF, concorrência, refresh infinito, dependência circular e overengineering de OIDC.

A Fase 1B somente poderá entrar em planejamento após aprovação desta spec. A implementação ocorrerá em worktree própria com TDD, testes de bootstrap/reload/RLS, revisão de segurança e configuração de signing key validada. A Fase 2 permanecerá pausada até a Fase 1B ser implementada, testada e integrada.
