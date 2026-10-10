# Verificação de convites e envio de treinos — 10/10/2026

O ciclo profissional → convite → vínculo → programa publicado → atribuição → execução do cliente passou com RPCs e RLS reais em PostgreSQL descartável. O Supabase configurado foi inspecionado somente por leitura; não houve criação de contas, convites ou treinos de teste no ambiente remoto, nem publicação de frontend.

## Comportamento confirmado

- Uma conta autenticada pode cadastrar seu próprio perfil profissional pelo `provision_professional_profile`, adquirindo a capacidade profissional.
- O profissional pode gerar convites de código e link. O cliente autenticado consulta o perfil e confirma o vínculo. O aluno adiciona um profissional existente por convite; esse fluxo não cria uma conta em nome de terceiro.
- Somente o profissional proprietário pode atribuir uma versão publicada a um cliente com vínculo ativo. O cliente recebe a versão e a prescrição exatas, inicia e conclui o treino; o profissional acompanha a execução compartilhada.
- Reutilização, aceite pelo próprio emissor, convites revogados/expirados e ações de terceiros ou visitantes são bloqueados. O cliente pode encerrar o vínculo, removendo a atribuição ativa.
- Há apenas um programa ativo por cliente, inclusive quando existem vários profissionais vinculados; um novo envio substitui o programa ativo anterior.

## Problemas encontrados e corrigidos no workspace

1. A tela filtrava convites por `accepted`/`cancelled`, enquanto o banco persiste `active`/`revoked`. A tela agora converte esses estados e apresenta os rótulos de aceite, cancelamento e expiração. Três testes falharam antes da correção e passaram depois; traduções dos rótulos adicionadas aos idiomas disponíveis.
2. O replay das migrações falhava porque a cópia histórica `20261007020952_ops_console_email_cast.sql` tentava substituir `ops_user_detail` com um tipo de retorno já alterado. A função é recriada nessa etapa; as migrações seguintes restauram a assinatura final e as permissões. Nenhuma tabela ou dado é removido. O histórico remoto já contém essa migração; a alteração permite instalação limpa e não reaplica automaticamente a migração no remoto.
3. Dois testes antigos de navegador usavam uma resposta de lista e seletores anteriores à área profissional atual. As fixtures e seletores foram atualizados; os quatro casos desktop/mobile passaram.

## Evidências

- `npm test`: 119 arquivos, 991 testes aprovados.
- `npm run check:supabase` com `PG_BIN` completo e banco obrigatório: 33 testes aprovados, sem skips, incluindo autorização, concorrência e isolamento de materiais.
- O harness de readiness executou também as suites SQL de metadados, leituras profissionais e o novo `202610100018_professional_invite_flow.sql`.
- Playwright focado em convite, rotas, criação de programa, recebimento e envio de versão exata: 14 casos aprovados; dois casos duplicados de viewport explicitamente ignorados.
- Build de produção, verificação de idiomas e `git diff --check` aprovados.
- Revisão independente das correções sem findings bloqueantes.

## Supabase configurado

A consulta de leitura confirmou as 26 versões de migração presentes no repositório e as RPCs de provisionamento, convite, vínculo, envio e leitura, com execução concedida a `authenticated` e negada a `anon` para as funções inspecionadas. Foram encontrados 11 perfis profissionais, cinco convites aceitos, quatro vínculos ativos e três atribuições ativas. Essas contagens confirmam dados existentes; não substituem um novo teste com login e mutações no ambiente publicado.

O usuário autorizou commit e push para produção após esta verificação. O teste completo de novas operações foi realizado no banco descartável; os testes de navegador usam respostas controladas do Supabase. A entrega não exige uma nova migração no banco remoto: a alteração histórica corrige somente o replay em instalações novas.
