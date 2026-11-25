# FPP Professional Insights — implementação 04

Base: implementação 03, `0eed37f98cfc323b7e61ded38cfa6416e09c8a36`. Main verificada em `6673db825d042e8ab948b79018dd9f72e901db1b`, já ancestral da base. Branch: `feat/fpp-professional-insights`.

## Arquitetura e acesso

Central lazy em `/#/professional/insights`, integrada à navegação profissional, dashboard e perfil do aluno. Filtros e alerta selecionado permanecem na URL; detalhes mostram regra, período, evidências e acesso ao planejamento/histórico já existentes. Estados: novo, revisado, adiado por 1/3/7 dias e arquivado/restaurado. Não há editor novo, mensagens automáticas ou notificações.

O motor puro `professional-insights.js` reutiliza comparação ajustada, detecção de alterações e calendário/histórico semanal. Identidade estável por vínculo e regra; o fingerprint registra evidências, sem textos traduzidos. Novos treinos/períodos podem reabrir o acompanhamento; a simples saída de evidências da janela não reabre um alerta revisado. Adiamentos vencidos são avaliados na consulta, sem cron.

Regras implementadas:

| Tipo | Limite |
| --- | --- |
| Falta de tempo / cansaço | 3 respostas explicitamente compartilhadas em 14 dias |
| Equipamento indisponível | 2 respostas compartilhadas em 14 dias |
| Desconforto | 1 resposta com consentimento sensível explícito em 14 dias |
| Execução abaixo do ajustado | 3 dos últimos 5 concluídos em 14 dias abaixo de 75%, mínimo 4 séries ajustadas; relação entre somas |
| Alterações de exercícios | 3 dos últimos 5 elegíveis em 14 dias com omissão/substituição comprovada |
| FPP Flex | 3 dos últimos 5 elegíveis com Flex explícito e redução de pelo menos 20% |
| Frequência reduzida | 2 semanas completas, referência com 3 treinos, redução de 50% e ao menos 2 registros |
| Sem registros recentes | 7 dias completos, histórico anterior recente, planejamento ativo e cobertura comprovada |
| Consistência | 2 treinos em cada uma de 3 semanas completas consecutivas |

## Armazenamento, privacidade e migração

Migration aditiva: `supabase/migrations/202611250001_training_checkins_professional_insights.sql`. **Não aplicada em produção.**

Cria `training_checkins` (privado, um registro por conta/ID textual de treino), `training_checkin_shares` (consentimento por resposta e ciclo de vínculo), `training_checkin_operations` (idempotência por operação; somente hash da solicitação, sem cópia da nota) e `professional_insight_states` (acompanhamento do profissional).

RPCs validam auth.uid(), propriedade de treino concluído canônico, versão, motivos, duplicatas, observação de 280 caracteres, revisão esperada e operação. Datas/revisões são do servidor. Remoção/dispensa limpam motivos e nota; remoção revoga os grants. RLS só permite ao proprietário ler respostas. Profissionais e administradores comuns não recebem acesso à tabela privada. Mutações usam RPCs com search_path explícito e grants mínimos.

O aluno escolhe o profissional e os motivos. Dor/desconforto exige seleção explícita própria. Adicionar motivos à resposta não amplia grants existentes. Observação nunca é compartilhada. Revogação e encerramento de ciclo impedem novas leituras no backend; ciclos futuros não herdam consentimento. Fingerprints retornados também são filtrados por sessão autorizada após revogação parcial. Não há SELECT direto do profissional sobre os estados armazenados.

O histórico de execução não foi duplicado nem alterado. A consulta profissional agrupa até 20 alunos por página (máximo 50), limita a 42 dias e 200 execuções por aluno, preserva autorização por assignment/ciclo e retorna somente projeção de treino, motivos autorizados e estado. Não retorna preferências completas ou observações. Dados profissionais ficam apenas em memória e são ocultados ao ficar offline ou trocar de conta.

Novas respostas autenticadas usam diário individual no estado local já escopado, fora das preferências sincronizadas; reutilizam persistência e eventos de boot/foco/reconexão/retry do sincronizador existente, sem polling ou nova store. Revisões impedem sobrescrita entre dispositivos. Visitantes continuam locais. BodyMap, Histórico e Resumo Semanal recebem a junção autorizada do legado com registros dedicados.

A importação legada é incremental e idempotente. Só limpa o valor legado exato confirmado; preserva outras preferências e tombstones. O dedicado prevalece; legado divergente é conservado em conflito pendente, sem decidir por relógio. Uma PWA antiga pode reintroduzir um legado nas preferências, mas não sobrescreve o dedicado. Novas respostas deixam de consumir o limite de 262.144 bytes das preferências. Durante indisponibilidade da migration, novas operações permanecem locais e pendentes.

## Validação direcionada

Executada em worktree isolado, sem incorporar `index.css` ou `output/` locais. Nenhuma dependência adicionada.

| Comando / verificação | Resultado |
| --- | --- |
| ESLint nos arquivos alterados | Aprovado |
| `npm run typecheck` | Aprovado |
| `npm run check:i18n` | 11 idiomas, 1.961 chaves, aprovado |
| Vitest: `professional-insights.test.js` e `training-checkin-repository.test.js`, 1 worker | 15 testes aprovados |
| `node scripts/test-professional-insights-database.mjs` | Cenário SQL dedicado aprovado: 17 asserções e tentativas negativas de autorização/revisão |
| Playwright `professional-insights.spec.js --project=mobile-chromium` | 1 fluxo aprovado: compartilhar, consultar, revisar, recarregar e revogar |
| PWA com grep `dedicated checkin journal` e `training check-in is optional` | 2 fluxos aprovados: diário autenticado offline/reload/reconexão sem duplicação; conclusão real, dispensa, edição, remoção e agregação semanal |
| `npm run build:vercel` | Aprovado; o mesmo build foi repetido após correções relacionadas |

O PostgreSQL nativo estava incompleto (postgres.bki ausente). O teste de banco aplicou o schema real em PostgreSQL/WASM descartável (PGlite e pgcrypto já fixados no repositório), sem conexão remota. Cobriu proprietário, aluno estranho, profissional sem vínculo, ausência de consentimento, projeção sem notas, consentimento sensível, revogação parcial/total, vínculo encerrado, idempotência, revisão antiga e limpeza legada sem apagar outras preferências.

Falhas encontradas foram corrigidas: fingerprint revelando associações retiradas em revogação parcial; consentimento sensível existente perdido ao editar outro grant; remoção com grants antigos; e deslocamento do botão mobile ao ocultar o contador da observação. O contador agora preserva o espaço sem ficar visível fora da edição. A revisão focada confirmou as duas correções de privacidade.

Capturas sintéticas selecionadas ficam fora do Git nos diretórios de test-results: detalhe profissional mobile e check-in. Revisão mobile escura realizada, com ajuste da barra nativa ao token de destaque e ordenação dos treinos por data; não foi executada matriz visual de todos os temas/navegadores. Precache: 368 entradas, aproximadamente 56,76 MB; nenhuma geometria/sprite duplicado. Chunks aproximados: tela 8,4 kB, hook/motor 6,5 kB, preview 1,1 kB e CSS 2,1 kB antes de gzip.

## Limitações e publicação futura

- A consulta atual só comprova execuções profissionais autorizadas, não todo o histórico pessoal do aluno. Retorna cobertura parcial: redução de frequência, ausência e consistência ficam conservadoramente suprimidas na integração real até existir prova de cobertura completa. O motor e testes cobrem essas regras com evidência completa. As demais regras usam somente registros efetivamente autorizados.
- Conflitos de revisão/legado são preservados e identificados; não há descarte nem resolução automática. Uma interface específica de reconciliação poderá ser necessária para conflitos reais entre dispositivos.
- Sem suíte integral, outros browsers, builds mobile/web redundantes ou auditoria geral. Browser usa transporte sintético; autorização foi exercitada no banco descartável, não em contas reais.
- A prévia depende da migration aprovada para funcionalidade remota completa. Não foi aplicado SQL no Supabase de produção para habilitá-la.
- Ordem futura: aplicar migration aditiva aprovada, verificar permissões, publicar frontend compatível das etapas 03/04, acompanhar importação incremental, confirmar gravação/leitura e acompanhamento. Rollback do frontend não exige remover as tabelas ou contratos legados.

Entrega somente em branch para revisão; sem merge, publicação, implementação 05/06 ou alteração da Home, fórmulas dos BodyMaps e cálculos semanais.
