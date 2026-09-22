# FPP Professional — Fase 2: Professional Profile

**Status:** especificação arquitetural aprovada para planejamento; nenhuma implementação iniciada.

## 1. Objetivo e decisões

A Fase 2 cria a fundação do perfil profissional do FPP Professional. Um usuário com capability `professional` poderá criar, consultar e editar o próprio perfil profissional. A tabela ficará preparada para exposição contextual futura, mas nesta fase cada usuário autenticado só poderá consultar o próprio perfil; não haverá enumeração global de profissionais.

Decisões congeladas:

- uma única entidade: `public.professional_profiles`;
- nenhum `professional_profiles_public` nesta fase;
- a tabela conterá somente dados profissionais apropriados para exposição futura a usuários autorizados, sem transformar isso em permissão de leitura global nesta fase;
- `anon` e `public` não terão acesso;
- `SELECT` direto ficará limitado ao proprietário; acesso contextual de outros usuários será definido somente na Fase 3;
- escrita ficará limitada ao próprio usuário com role `professional`;
- `service_role` não será usado na edição normal;
- dados administrativos, documentos, evidências, moderação, finanças e auditoria futura ficarão fora desta tabela;
- migrations 001, 002 e 003 permanecem imutáveis; a nova mudança será a migration 004.

## 2. Relação com a Fase 1

`professional_profiles.user_id` será PK e FK para `auth.users(id)`, identificando o proprietário. A role `professional` em `user_roles` será pré-requisito para criação. Um perfil não concede role, não promove o usuário e não substitui a autorização do servidor.

`profiles.display_name` continuará sendo o nome da pessoa exibido no FPP. Não haverá outro `display_name` em `professional_profiles`.

## 3. Modelo final

Tabela: `public.professional_profiles`.

| Campo | Tipo conceitual | Obrigatório | Exposição | Semântica |
|---|---|---:|---|---|
| `user_id` | `uuid` | sim | exposição futura autorizada; SELECT direto somente do proprietário | PK/FK para `auth.users`; não editável |
| `professional_name` | `text` | sim | exposição futura autorizada; SELECT direto somente do proprietário | nome profissional ou marca |
| `bio` | `text` | não | exposição futura autorizada; SELECT direto somente do proprietário | apresentação curta |
| `specialties` | `text[]` | não | exposição futura autorizada; SELECT direto somente do proprietário | slugs limitados de especialidades |
| `city_region` | `text` | não | exposição futura autorizada; SELECT direto somente do proprietário | cidade ou região declarada |
| `registration_type` | `text` | não | exposição futura autorizada; SELECT direto somente do proprietário | tipo declarado, como `CREF` |
| `registration_number` | `text` | não | exposição futura autorizada; SELECT direto somente do proprietário | número declarado |
| `verification_status` | enum | sim | exposição futura autorizada; SELECT direto somente do proprietário | estado controlado pelo sistema |
| `created_at` | `timestamptz` | sim | exposição futura autorizada; SELECT direto somente do proprietário | controlado pelo banco |
| `updated_at` | `timestamptz` | sim | exposição futura autorizada; SELECT direto somente do proprietário | controlado pelo trigger |

Não haverá `display_name` nem `avatar_ref` na tabela. A proposta original perdeu esses dois campos para evitar fontes concorrentes. `profiles.display_name` é a identidade geral da pessoa; `professional_profiles.professional_name` é o nome profissional ou de marca. O campo persistido canônico do avatar continua sendo `profiles.avatar_ref`; `avatarId` é apenas o vocabulário do frontend/resolvedor de assets existente, não uma segunda coluna ou sistema de avatar.

Limites previstos:

- `professional_name`: obrigatório, trim, não vazio, máximo 120 caracteres;
- `bio`: opcional, máximo 2.000 caracteres;
- `specialties`: no máximo 8 itens, cada um com no máximo 40 caracteres, lowercase e sem duplicação;
- `city_region`: opcional, máximo 120 caracteres;
- `registration_type`: opcional, máximo 40 caracteres;
- `registration_number`: opcional, máximo 80 caracteres.

## 4. Avatar

Será reutilizado `profiles.avatar_ref` e o mecanismo atual de `avatarId`/assets locais. O frontend combinará os dados do perfil geral com o perfil profissional para renderização: lê `profiles.avatar_ref`, mapeia esse valor para a referência `avatarId`/asset já existente e não persiste um novo campo. Não haverá Storage, upload ou coluna de avatar concorrente nesta fase.

## 5. Especialidades

Será usado um array simples de slugs, sem tabela de taxonomia. Valores sugeridos:

```text
musculacao, hipertrofia, emagrecimento, condicionamento,
funcional, forca, mobilidade, corrida, outros
```

O banco limitará quantidade, tamanho e duplicação, mas não congelará uma lista extensa. O frontend terá opções traduzíveis e novos slugs poderão ser adicionados de forma compatível. `outros` cobre áreas não previstas.

## 6. Registro e verificação

`registration_type` e `registration_number` representam informação declarada, não validação oficial. A UI deverá separar “registro informado” de “registro verificado”.

`verification_status` será preparado para `unverified`, `pending`, `verified` e `rejected`, iniciando sempre em `unverified`. O profissional não poderá inserir ou alterar esse campo; uma futura alteração administrativa deverá ser um fluxo explícito, privilegiado e auditado. Não haverá processo oficial de verificação nesta fase.

O cliente não poderá inserir nem alterar o status, inclusive para `unverified`; o default do banco estabelecerá `unverified` na criação. Uma futura alteração administrativa deverá ser um fluxo privilegiado, explícito e auditado.

## 7. Estados derivados

Não haverá flags persistidas:

- **`NO_PROFILE`:** não existe linha para o usuário;
- **`INCOMPLETE`:** existe linha, mas `professional_name` está vazio ou `profiles.display_name` não fornece identificação geral utilizável;
- **`COMPLETE`:** existe linha, `professional_name` é válido e `profiles.display_name` está disponível.

Bio, cidade, specialties e registro permanecem opcionais. Perfil completo significa apto para identificação em futura experiência de convite, não cria convite nem vínculo.

## 8. Grants, ownership e RLS

Grants previstos:

- `public`/`anon`: nenhum grant;
- `authenticated`: `SELECT`, `INSERT` e `UPDATE`, limitados por RLS;
- `authenticated`: nenhum `DELETE`;
- `service_role`: somente acesso operacional futuro explicitamente necessário.

Policies previstas:

1. `SELECT` para `authenticated`, somente quando `user_id = auth.uid()`; isso impede a enumeração e a leitura direta do perfil de outro usuário na Fase 2;
2. `INSERT` somente quando `user_id = auth.uid()`, existir role `professional` e `verification_status = 'unverified'`;
3. `UPDATE` somente no próprio registro, com `user_id = auth.uid()` antes e depois, e enquanto o usuário mantiver a role `professional`;
4. nenhuma policy de `DELETE` para cliente.

Os campos foram escolhidos para serem potencialmente exponíveis em uma futura experiência autorizada, mas não são globalmente enumeráveis nem diretamente legíveis por outros usuários nesta fase. A Fase 3 deverá conceder somente acesso contextual, por policy, RPC seguro, endpoint backend ou projeção mínima. Se um futuro dado não puder ser exposto nem nesse contexto, nascerá em outra tabela restrita.

## 9. Campos controlados pelo sistema

Trigger de proteção, seguindo o padrão seguro já estabelecido no projeto, deverá rejeitar alteração de:

- `user_id`;
- `created_at`;
- `verification_status` por operações do cliente;
- `updated_at` fornecido pelo cliente.

O trigger também atualizará `updated_at` com timestamp do servidor, sem aceitar esse valor do cliente. `user_id`, `verification_status` e `created_at` são controlados pelo sistema; `verification_status` nasce como `unverified` e só um futuro fluxo privilegiado poderá mudá-lo. Constraints, trigger e policies serão testados no banco; frontend não será mecanismo de segurança.

Se o usuário perder ou tiver removida a role `professional`, a linha existente será preservada: não haverá `DELETE` automático nem limpeza destrutiva. As policies e o backend deverão impedir novas operações profissionais enquanto a capability estiver ausente; restauração, desativação ou eventual solicitação de eliminação serão decisões explícitas de fases futuras.

## 10. UX mobile-first

Fluxo:

```text
Área profissional → Meu perfil profissional → Editar perfil → Preview
```

A tela terá poucos campos, uma ação principal e estados claros: sem perfil, incompleto, completo, carregando, erro ao salvar, sucesso e capability ausente. O preview mostrará nome profissional, avatar reutilizado, bio, specialties, cidade, registro declarado e status claramente rotulado.

Não haverá dashboard, alunos, convites, treinos profissionais ou analytics.

Salvar exigirá conexão nesta fase. Perfil previamente disponível poderá ser exibido conforme o cache existente, mas não haverá fila, merge ou sync offline específico. Sem conexão, salvar informará claramente que a conexão é necessária e preservará os valores enquanto a tela permanecer aberta.

## 11. Migration 004 prevista

`202609210004_professional_profiles.sql` conterá somente:

- enum `professional_verification_status`;
- tabela `professional_profiles`;
- PK/FK, constraints, índices necessários e defaults;
- grants explícitos;
- RLS e policies;
- função/trigger de proteção e `updated_at`.

Não alterará migrations 001–003, `profiles`, `user_roles`, Auth, WebAuthn ou `gym_state_v1`. Não criará tabelas de convites, relationships, students, programs, templates, assignments ou executions.

## 12. Testes previstos

### pgTAP

Provará: criação pelo Professional A; leitura própria; negação de leitura do perfil de B por A; negação de leitura direta por Student autenticado; negação de edição de B; negação de criação por Student; negação para `anon`; negação de auto-verificação; proteção de `user_id`, `created_at`, `verification_status` e `updated_at`; negação de DELETE; retenção da linha após perda de role; RLS habilitada; grants mínimos; estados derivados.

### Backend

Testará normalização, limites, capability professional, rejeição de auto-verificação, erros de RLS, ausência de enumeração, leitura do próprio contrato e regressão da Fase 1.

### Frontend

Testará acesso condicional, estados sem/incompleto/completo, formulário, preview, validação, loading, erro, offline ao salvar e avatar reutilizado. Deverá cobrir regressão de treinos, histórico, modo anônimo, logout, PWA e WebAuthn.

## 13. Riscos

- O acesso futuro de convidados deve ser contextual e mínimo; um `SELECT` amplo não poderá ser reaberto apenas porque os campos são potencialmente exponíveis.
- `registration_number` pode ser confundido com verificado se a UI não diferenciar os conceitos.
- Mudanças futuras em `profiles.display_name` precisam ser refletidas sem duplicar dados.
- `text[]` é simples e evolutivo, mas não suporta metadados ricos sem uma futura entidade.
- Salvar online exige comunicação clara para não criar expectativa de offline completo.

## 14. Exclusões explícitas

Ficam fora: convites, relacionamentos, lista de alunos, programas, templates, assignments, execuções, dashboard, CREF oficial, Storage, documentos, moderação, finanças, notificações, analytics, Realtime, sync offline profissional, migração de `gym_state_v1` e alterações no motor de treinos, histórico, PWA, WebAuthn ou modo anônimo. Em particular, a Fase 3 definirá como o fluxo de convite terá acesso contextual mínimo — policy, RPC seguro, endpoint backend ou projeção — sem conceder `SELECT` amplo nesta tabela.

## 15. Critério de transição

Esta especificação deve ser aprovada antes de invocar `writing-plans`. A implementação ocorrerá em branch própria, com migration cronológica nova e ciclo TDD RED/GREEN para banco, backend e frontend.
