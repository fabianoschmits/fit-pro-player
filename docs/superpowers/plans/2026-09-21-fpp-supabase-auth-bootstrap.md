# FPP Supabase Auth Bootstrap / User Bearer Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Entregar bootstrap sob demanda de um JWT Supabase ES256 curto para sessões FPP vinculadas, mantendo o token somente em memória e preservando o RLS como autoridade de autorização.

**Architecture:** O backend autentica pelo cookie HttpOnly gymsid, resolve legacy_identity_links e assina um JWT com sub, role=authenticated e exp. O frontend usa um broker único em memória, single-flight e renovação nos últimos 30 segundos; o cliente Supabase usa accessToken dinâmico e publishable key. A importação/ativação da signing key real é stop gate posterior.

**Tech Stack:** Node.js 22 ESM, @supabase/supabase-js 2.116.0, jose 6.1.0 fixado, React 19, Vite 8, Vitest, Node test runner, Supabase Data API/RLS e Capacitor 7.

**Spec:** docs/superpowers/specs/2026-09-21-fpp-supabase-auth-bootstrap-design.md

## Global Constraints

- JWT customizado usa somente sub, role=authenticated e exp; não adicionar iss, aud, iat ou capabilities.
- Header: typ=JWT, alg=ES256, kid=FPP_SUPABASE_JWT_KEY_ID.
- FPP_SUPABASE_JWT_PRIVATE_KEY e FPP_SUPABASE_JWT_KEY_ID são server-only; nunca usar SUPABASE_SECRET_KEY para assinar.
- TTL de 5 minutos; renovar quando faltarem 30 segundos ou menos; sem refresh token Supabase.
- Bearer nunca entra em localStorage, sessionStorage, IndexedDB, gym_state_v1, URL, logs, Git, bundle ou Capacitor.
- Endpoint: POST /api/account/supabase-token; o cliente não escolhe identidade, role ou email.
- Não criar usuário, vínculo, tabela, migration, RLS policy ou alteração remota.
- Guest/local mode não inicia bootstrap automaticamente.
- Autorização continua em auth.uid(), user_roles, ownership e RLS.
- Origins Capacitor são provisórios até validação física.
- Cada implementação termina com RED, GREEN, regressão e commit próprio.
- Importação, ativação e rotação da chave real exigem stop gate e autorização explícita.

## Review Focus

- Link ativo para usuário Supabase inexistente: falha fechada sem token; Task 2.
- Dez consumidores simultâneos: um bootstrap, mesmo token e Promise liberada após erro; Task 4.
- Reload: broker e cliente reconstruídos, cookie preservado e novo bearer; Task 5.
- Origin inválido, ausente na web ou Capacitor não validado: negar sem wildcard; Tasks 3 e 7.
- Logout/logout-all: limpar broker sem tentar revogar JWT emitido; Task 5.

---

### Task 1: Baseline isolado e contratos

**Files:**
- Read: api/server.js, api/supabase/routes.js, api/supabase/identity.js, api/supabase/client.js
- Read: frontend/src/lib/api.js, frontend/src/lib/supabase-config.js, frontend/src/views/Settings.jsx, frontend/src/store/useStore.js
- Read: scripts/check-supabase-boundaries.mjs, scripts/check-supabase-boundaries.test.mjs

**Interfaces:**
- Consumes: main em 918d67d.
- Produces: baseline registrada, sem mudança funcional.

- [ ] Step 1: Na execução, criar worktree com git worktree add .worktrees/fpp-supabase-auth-bootstrap -b codex/fpp-supabase-auth-bootstrap main e entrar nela.
- [ ] Step 2: Rodar npm test; npm run build; npm --prefix frontend run check:i18n; npm run check:supabase; git diff --check. Esperado: todos passam.
- [ ] Step 3: Confirmar paths com git status --short --branch e rg -n "POST /api/account|logout/all|linkSupabaseIdentity|createClient|SUPABASE_SECRET_KEY|VITE_SUPABASE" api frontend scripts.
- [ ] Step 4: Não criar commit se a baseline não alterar arquivos; nenhum comando remoto deve ser executado.

### Task 2: Configuração server-only, signer ES256 e identidade

**Files:**
- Create: api/supabase/jwt-config.js, api/supabase/jwt-signer.js, api/supabase/jwt-signer.test.js
- Modify: api/package.json, api/package-lock.json, .env.example, api/supabase/identity.js, api/supabase/client.js
- Test: api/supabase/identity.test.js, api/supabase/client.test.js

**Interfaces:**
- Consumes: readSession, cliente admin server-only e legacy_identity_links.
- Produces: readSupabaseJwtConfig(env), createSupabaseJwtSigner({ config, now }) e repository.getBootstrapIdentity({ legacyUser }).
- signForUser({ supabaseUserId }) retorna { token, expiresAt, expiresIn }.
- getBootstrapIdentity retorna { supabaseUserId } ou erro classificado sem expor IDs.

- [ ] Step 1: Escrever RED em jwt-signer.test.js usando crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }) para fixture efêmera. Testar configuração/kid ausentes, defaults ttlSeconds=300 e renewalWindowSeconds=30, assinatura verificável, header typ/alg/kid, claims sub/role/exp e expiração.
- [ ] Step 2: Rodar node --test api/supabase/jwt-signer.test.js; esperar FAIL porque os módulos não existem.
- [ ] Step 3: Adicionar dependência com npm install --prefix api --save-exact jose@6.1.0. Usar importPKCS8 ou importJWK e SignJWT com header typ JWT, alg ES256 e kid. Não adicionar iss, aud, iat ou capabilities.
- [ ] Step 4: Implementar getBootstrapIdentity: buscar vínculo por legacyUser.id, exigir status active, validar UUID, confirmar auth.users por API administrativa server-only e retornar somente o UUID. Não criar usuário, vínculo ou migration.
- [ ] Step 5: Cobrir vínculo ausente, revoked, UUID inválido, usuário Auth inexistente, A nunca emitindo sub B e sucesso válido. Rodar node --test api/supabase/jwt-signer.test.js api/supabase/identity.test.js api/supabase/client.test.js.
- [ ] Step 6: Commitar com git add dos arquivos da task e git commit -m "feat: add server-only Supabase JWT signer".

### Task 3: Endpoint de bootstrap e política de origem

**Files:**
- Create: api/supabase/origin-policy.js, api/supabase/origin-policy.test.js, api/supabase/routes.test.js
- Modify: api/supabase/routes.js, api/server.js, api/server.integration.test.js

**Interfaces:**
- Consumes: readSession, readBody, repository.getBootstrapIdentity, signer.signForUser, json, ORIGIN e origins server-side.
- Produces: createOriginPolicy({ allowedOrigins, nativeOrigins }) com check(req) e POST /api/account/supabase-token.
- Resposta: { access_token, token_type: Bearer, expires_in, expires_at }.

- [ ] Step 1: Escrever RED da política para origin permitido, evil origin, referer inválido, request web sem Origin/Referer e Capacitor não configurado. Não usar wildcard.
- [ ] Step 2: Escrever RED da rota: sessão ausente 401; origem inválida 403; link ausente, revoked ou inconsistente 409 identity_not_linked; signer indisponível 503; campos user_id, supabase_user_id, role ou email 400; sucesso 200 sem IDs, payload ou segredo.
- [ ] Step 3: Rodar node --test api/supabase/origin-policy.test.js api/supabase/routes.test.js; esperar FAIL.
- [ ] Step 4: Implementar POST-only: validar Origin/Referer, chamar readSession, aceitar objeto vazio, resolver identidade server-side, assinar, responder Cache-Control no-store e mapear 401/403/409/503/500 conforme a spec.
- [ ] Step 5: Reutilizar takeAuthRate(req) no dispatch existente; não criar infraestrutura nova.
- [ ] Step 6: Rodar node --test api/supabase/origin-policy.test.js api/supabase/routes.test.js api/server.integration.test.js; esperar PASS.
- [ ] Step 7: Commitar com git commit -m "feat: add Supabase bearer bootstrap endpoint".

### Task 4: Broker frontend em memória

**Files:**
- Create: frontend/src/lib/supabase-token-broker.js, frontend/src/lib/supabase-token-broker.test.js
- Modify: frontend/src/lib/api.js
- Test: frontend/src/lib/api.account.test.js

**Interfaces:**
- Consumes: api(path, opts) e cookie FPP same-origin.
- Produces: createSupabaseTokenBroker({ requestBootstrap, clock }), getAccessToken() e clear().

- [ ] Step 1: Escrever RED com relógio controlado: token saudável reutiliza; ausente faz bootstrap; até 30 segundos renova; dez chamadas concorrentes fazem exatamente uma requisição e recebem o mesmo token; erro libera inFlight; 401/403 limpa; nenhum storage recebe bearer.
- [ ] Step 2: Rodar npm --prefix frontend test -- src/lib/supabase-token-broker.test.js; esperar FAIL.
- [ ] Step 3: Implementar somente token, expiresAt, inFlight e generation em memória; parse defensivo de exp; finally libera inFlight; clear impede reinstalação por resposta antiga; guest/local mode não faz bootstrap.
- [ ] Step 4: Adicionar em api.js POST sem Authorization para /api/account/supabase-token, credentials same-origin e corpo {}. Preservar linkSupabaseIdentity(accessToken).
- [ ] Step 5: Rodar npm --prefix frontend test -- src/lib/supabase-token-broker.test.js src/lib/api.account.test.js e commitar com git commit -m "feat: add in-memory Supabase token broker".

### Task 5: Cliente Supabase, reload e logout

**Files:**
- Create: frontend/src/lib/supabase-client.js, frontend/src/lib/supabase-client.test.js
- Modify: frontend/package.json, frontend/package-lock.json, frontend/src/store/useStore.js, frontend/src/views/Settings.jsx, frontend/src/lib/supabase-config.js
- Test: frontend/src/store/useStore.sync.test.js e teste focado de Settings

**Interfaces:**
- Consumes: getPublicSupabaseConfig(), broker, useStore.signOut() e useStore.signOutAll().
- Produces: createFppSupabaseClient({ url, publishableKey, accessToken }), getFppSupabaseClient() e clearFppSupabaseAuth().

- [ ] Step 1: Escrever RED para publishable key pública, callback accessToken, ausência de secret key, persistSession=false, autoRefreshToken=false, detectSessionInUrl=false e config ausente retornando null.
- [ ] Step 2: Rodar npm --prefix frontend test -- src/lib/supabase-client.test.js; esperar FAIL.
- [ ] Step 3: Adicionar npm install --prefix frontend --save-exact @supabase/supabase-js@2.116.0.
- [ ] Step 4: Implementar um único createClient com auth persistente desabilitado e accessToken: async () => broker.getAccessToken(). Nunca usar secret key ou Authorization global.
- [ ] Step 5: Integrar clearFppSupabaseAuth() após logout aprovado e logout-all; manter token manual somente no SupabaseAccountSheet e limpar/invalidate broker após vínculo bem-sucedido.
- [ ] Step 6: Criar teste de reload com servidor/harness HTTP: login fornece cookie; primeira emissão ocorre; broker/cliente são destruídos; cookie permanece; nova instância faz novo POST e cliente alcança endpoint autenticado. Não testar apenas zerando variável na mesma instância.
- [ ] Step 7: Rodar npm --prefix frontend test -- src/lib/supabase-client.test.js src/lib/supabase-token-broker.test.js src/store/useStore.sync.test.js e commitar com git commit -m "feat: connect Supabase client to FPP bearer broker".

### Task 6: Boundary estático e documentação operacional

**Files:**
- Modify: .env.example, scripts/check-supabase-boundaries.mjs, scripts/check-supabase-boundaries.test.mjs
- Create: docs/superpowers/operations/fpp-supabase-signing-key-runbook.md

**Interfaces:**
- Consumes: env server-only e paths rastreados.
- Produces: check que rejeita private key/JWT env no frontend e runbook sem material privado.

- [ ] Step 1: Escrever RED para FPP_SUPABASE_JWT_PRIVATE_KEY, FPP_SUPABASE_JWT_KEY_ID, VITE_FPP_SUPABASE_JWT_PRIVATE_KEY, SUPABASE_SECRET_KEY, persistência explícita e Authorization Bearer em frontend.
- [ ] Step 2: Rodar node --test scripts/check-supabase-boundaries.test.mjs; esperar FAIL nos fixtures novos.
- [ ] Step 3: Adicionar ao .env.example nomes vazios FPP_SUPABASE_JWT_PRIVATE_KEY, FPP_SUPABASE_JWT_KEY_ID e FPP_SUPABASE_BOOTSTRAP_ORIGINS. Não tocar .env ignorado nem valores reais.
- [ ] Step 4: Criar runbook curto para geração ES256, armazenamento seguro, import como standby, conferência kid/alg, stop antes de rotate/activate, JWKS/Data API/RLS e rollback. Nunca incluir private key, bearer, cookie ou dados pessoais.
- [ ] Step 5: Rodar node --test scripts/check-supabase-boundaries.test.mjs e npm run check:supabase; commitar com git commit -m "test: enforce Supabase bootstrap secret boundaries".

### Task 7: Stop gate remoto e validação hosted futura

**Files:**
- Read: spec e runbook da Task 6.
- Modify: nenhum arquivo antes de autorização.

**Interfaces:**
- Consumes: implementação local completa, chave pública/JWK e kid somente após autorização.
- Produces: relatório de gate sem alteração de código, banco ou Auth.

- [ ] Step 1: Rodar npm test; npm run build; npm --prefix frontend run check:i18n; npm run check:supabase; git diff --check e confirmar branch limpa.
- [ ] Step 2: Registrar separadamente LOCAL IMPLEMENTATION COMPLETE, REMOTE SIGNING KEY CONFIGURED e HOSTED END-TO-END VALIDATED.
- [ ] Step 3: Após autorização futura, validar JWKS kid/ES256, custom JWT + publishable apikey, auth.uid(), RLS A/A, RLS A/B, expiração, assinatura/kid errados, logout e origins Capacitor reais.
- [ ] Step 4: Não importar, ativar, rotacionar signing key, criar usuários, mudar Auth, RLS, migrations ou dados sem nova autorização.

### Task 8: Revisão final e compatibilidade

**Files:**
- Read: todos os arquivos modificados nas Tasks 2–6.
- Test: todos os testes Fase 1B e regressão.

**Interfaces:**
- Consumes: signer, endpoint, broker, cliente, logout, boundary e runbook.
- Produces: branch local pronta para revisão, sem migration e sem alteração remota.

- [ ] Step 1: Rodar node --test api/supabase/jwt-signer.test.js api/supabase/origin-policy.test.js api/supabase/routes.test.js api/supabase/identity.test.js e npm --prefix frontend test -- src/lib/supabase-token-broker.test.js src/lib/supabase-client.test.js src/store/useStore.sync.test.js.
- [ ] Step 2: Rodar npm test; npm run build; npm --prefix frontend run check:i18n; npm run check:supabase; git diff --check.
- [ ] Step 3: Confirmar WebAuthn, login, guest/local mode, gym_state_v1, workout engine, history, active workout, Capacitor existente e identity-link manual; confirmar ausência de migration, Professional Profile, Fase 2 e Fase 3.
- [ ] Step 4: Rodar rg -n "FPP_SUPABASE_JWT_PRIVATE_KEY|SUPABASE_SECRET_KEY|Authorization: Bearer|access_token" frontend api docs scripts; confirmar nenhum segredo real, bearer em logs/bundle ou private key no frontend.
- [ ] Step 5: Commitar somente correção real com git commit -m "fix: close Supabase bootstrap review findings".
- [ ] Step 6: Entregar para revisão antes de merge; implementação local, configuração remota e hosted validation permanecem estados separados.

## Self-review do plano

- Spec coverage: signer, claims/header, auth.users, endpoint, CSRF, rate limit existente, broker, single-flight, reload, logout/logout-all, cliente Supabase, RLS hosted, secrets, envs, Capacitor gate, documentação e exclusões estão cobertos.
- Placeholder scan: não há marcador de tarefa incompleta ou instrução genérica sem comando/teste; origins nativos estão explicitamente provisórios.
- Type/interface consistency: signForUser, getBootstrapIdentity, originPolicy.check, createSupabaseRoutes, createSupabaseTokenBroker e createFppSupabaseClient são consistentes.
- Review Focus coverage: os cinco riscos têm teste ou gate identificado.
- Scope check: nenhuma migration, usuário, Professional Profile, Fase 2 ou Fase 3; dependências novas são somente jose 6.1.0 no backend e @supabase/supabase-js 2.116.0 no frontend.
- Execution method: recomendo subagent-driven development; a fase cruza criptografia, sessão/CSRF, concorrência frontend, RLS e gate remoto, tornando revisão independente por task valiosa.
