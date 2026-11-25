# FPP Training Check-in — implementação 03

Base: `6673db825d042e8ab948b79018dd9f72e901db1b`. Branch: `feat/fpp-training-checkin`.

## Arquitetura e apresentação

Motor puro `training-checkin.js` reutiliza `compareTraining` e as regras existentes de séries concluídas/aquecimento. A referência é o planejamento ajustado confirmado; não há reconstrução de planos antigos. Os limites centralizados são 20% e pelo menos duas séries para redução/aumento, além de exercício omitido, adicionado ou substituição explicitamente registrada. Ocorrências repetidas são consideradas. Cumprir o ajuste do Flex não gera desvio.

O treino é salvo pelo fluxo existente antes da seção opcional no FinishSummary. A mesma sheet permite responder, editar, dispensar e remover com confirmação. Dispensa e remoção impedem nova solicitação automática. Motivos múltiplos, observação textual de até 280 caracteres, nenhuma seleção automática. Acesso também nos detalhes do Histórico e BodyMap individual; treinos legados admitem contexto voluntário sem comparação inventada. O resumo semanal conta cada motivo uma vez por treino, exibe inicialmente três motivos e mantém o limite dos insights. Home inalterada.

## Persistência, sincronização e privacidade

Não existe operação genérica segura para editar o payload imutável de uma conclusão. Por isso o contrato opcional fica em `trainingCheckIns[workoutId]`, dentro das preferências privadas já existentes, e não no payload compartilhável do treino. O contrato de versão 1 contém status `answered`, `dismissed` ou `removed`; respostas incluem identificadores estáveis de motivos, note, sharing `private`, answeredAt/updatedAt e identificador da operação. Tombstones preservam a dispensa após remoção. Nenhum snapshot, série ou identificador de sessão é alterado. A junção com o treino ocorre somente em objetos derivados para apresentação/agregação.

Reutiliza persistência local por escopo, journal de preferências, revisão do servidor e reconciliação de três vias do account-domain-sync. Conflitos concorrentes seguem o tratamento existente, sem escolher automaticamente pelo relógio do dispositivo. A gravação local deve ter sucesso antes de fechar a resposta. Reconexão não cria outra sessão.

A política existente de account_preferences limita leitura ao proprietário (`user_id = auth.uid()`); a gravação exige autenticação e revisão esperada. RPCs profissionais e identidade comunitária consultadas extraem campos explícitos de profile, não o mapa privado. Guards de conta protegem leitura, abertura e gravação. Respostas não entram no payload de execução profissional. Não há opção de compartilhamento, logs de observações ou serviços externos. Nenhuma migration, tabela, RPC ou permissão foi criada.

## Verificação executada

Executada em worktree isolado com CSS versionado, preservando `frontend/src/index.css` e `output/` locais.

| Verificação | Resultado |
| --- | --- |
| ESLint | Aprovado, zero erros |
| `npm run typecheck` | Aprovado |
| `npm run check:i18n` | Aprovado: 11 idiomas, 1.885 chaves |
| `node node_modules/vitest/vitest.mjs run src/lib/training-checkin.test.js --maxWorkers=1` | 15 testes aprovados |
| `npx playwright test --config=playwright.pwa.config.js --grep 'training check-in is optional'` | 1 cenário Chromium mobile aprovado, incluindo offline |
| `npm run build:vercel` | Aprovado |

Os testes unitários cobrem detecção/Flex, ocorrências repetidas, legado, preservação de execução, privacidade, tombstones, agregação, projeção persistida, escopo, conflito e sincronização real do módulo com repositório simulado. O fluxo mobile concluiu treino com alteração, dispensou, respondeu offline, recarregou, consultou BodyMap e semana, editou no Histórico e removeu; após reconectar/recarregar a resposta não reapareceu e o treino permaneceu único com snapshots intactos.

Duas capturas sintéticas ficam fora do Git em `frontend/test-results-checkin/`: `training-checkin-mobile.png` e `weekly-training-context.png`. Logs locais em `.git/fpp-checkin-evidence/`. Build local usou endpoint/chave pública sintéticos para o fluxo offline; a prévia Git usa o ambiente configurado na Vercel. Chunks emitidos: sheet 3,60 kB (gzip 1,49), resumo 1,69 kB (gzip 0,83), motor 5,52 kB (gzip 2,49), CSS 2,03 kB (gzip 0,67). Precache resultante: 362 entradas, aproximadamente 56,70 MB; nenhuma anatomia ou sprite duplicado e nenhuma mudança na estratégia de cache.

## Limitações e próxima etapa

Conforme solicitado, não foram executadas suítes integrais, outros navegadores, builds adicionais nem auditoria geral. O fluxo visual foi Chromium mobile escuro; temas usam tokens existentes, sem validação visual adicional em claro. Não houve teste autenticado contra dados reais de produção; autorização foi verificada pelo contrato SQL e testes direcionados.

O mapa compartilha o limite existente de 262.144 bytes do JSON de preferências. Escritas rejeitadas/conflitantes permanecem locais ou pendentes no mecanismo existente; não há descarte automático para caber no limite. Em grande escala pode ser necessário armazenamento privado específico, a revisar antes de ampliar esse uso.

Para implementação 04, motivos estáveis e vínculo canônico permitem agregação futura. Compartilhamento com profissionais exige contrato backend/consentimento próprio; observações continuam privadas. Nenhum alerta ou painel profissional foi implementado. Esta entrega é somente para revisão em branch, sem merge ou publicação em produção.
