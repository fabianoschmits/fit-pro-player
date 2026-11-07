# Auditoria de fluxos — 7 de novembro de 2026

Status: auditoria local concluída. Foram encontrados problemas de fluxo e fragilidades na validação; o projeto não está com todas as verificações verdes.

## Resultado das verificações

| Verificação | Resultado |
|---|---|
| Navegador: desktop Chromium, celular Chromium e celular WebKit | **370 passaram, 46 falharam, 22 pulados**, de 438 cenários, em 19,4 minutos |
| PWA/offline | **7 passaram** |
| Ciclo profissional com SQL real, cópia diagnóstica adaptada à UI e ao sábado | **1 passou**; não elimina as falhas dos três projetos no teste original |
| Unitários/componentes | **1.765 passaram, 2 falharam**, em 203 arquivos |
| Reprodução isolada dos dois arquivos unitários com falha | **22 passaram, 2 falharam** |
| Lint e tipos | Passaram |
| Build padrão, Vercel e mobile web | Os três passaram |
| Testes de notificações | **42 passaram** |
| Catálogo de sprites | **156 exercícios conferidos** |
| Testes do interpretador de resultados SQL | **3 passaram** |
| Contratos/migrations em `check:supabase` | **40 passaram, 3 pulados**; comando completo falhou no verificador estático de tokens |
| Traduções | Falhou: **10 textos sem chave** |
| Biblioteca de planos em PGlite | Bloqueada por ausência de `auth.jwt()` no bootstrap desse script |
| Schema final no PostgreSQL descartável | Bloqueado por instalação incompleta do PostgreSQL local |
| Dependências | 6 vulnerabilidades reportadas: 2 baixas e 4 moderadas; nenhuma alta/crítica |

As 46 falhas E2E distribuem-se por: `application.spec.js` (14), `motion-feedback.spec.js` (2), `plan-library.spec.js` (12), `plan-switching.spec.js` (9), `professional-student-profile.spec.js` (2), `relationship-lifecycle.spec.js` (3) e `workout-silent-autosave.spec.js` (4). A maior parte tem como primeiro ponto de falha a etapa de duração não confirmada ou elementos antigos da UI profissional. Isso não significa que todas as asserções posteriores desses testes estejam validadas: elas deixam de executar após a primeira falha.

## Escopo e ambiente

Auditoria local da aplicação React/Vite, com Node 22.17.0. Navegação exploratória no navegador e execução das verificações do repositório. Nenhum código funcional foi alterado. Dados fictícios criados apenas no armazenamento local do navegador, em `http://127.0.0.1:8083`.

A maioria dos testes E2E usa o Supabase simulado de `frontend/e2e/fixtures.test.js`. O cenário `relationship-lifecycle.spec.js` usa PostgreSQL/WASM (PGlite), aplica as migrations reais e simula somente o transporte de autenticação/API. Portanto, esses testes não comprovam autenticação por e-mail, Storage, entrega de push ou integração com o Supabase publicado. Não foram enviadas mensagens nem alterados dados de usuários reais.

## Achados reproduzidos

### F01 — “Continuar sem conta” fecha a janela sem entrar no aplicativo

Prioridade alta no primeiro acesso. Reproduzido no servidor dos testes, com `VITE_STANDALONE=1` e Supabase configurado, sem sessão e sem armazenamento prévio.

1. Abrir `/`.
2. Clicar em “Entrar ou criar conta” ou em “Abrir”.
3. Clicar em “Continuar sem conta”.
4. A janela fecha e a página inicial continua visível. Repetir “Abrir” retorna à mesma janela.

Causa observada: `frontend/src/components/AuthSheet.jsx:196` vincula o botão somente a `close`. Em `frontend/src/views/Landing.jsx:486`, a escolha de `primaryAction` prioriza `auth.configured`; enquanto isso, `localEntry` oculta o outro acesso de visitante. No modo local sem Supabase, “Começar agora” permite entrar e concluir o onboarding.

Recomendação: conectar a opção de visitante ao fluxo real de entrada; incluir teste de primeiro acesso sem estado semeado, com Supabase configurado e nos modos normal e standalone.

### F02 — Guia de instalação detecta computador, mas abre instruções de Android

Prioridade média. No primeiro treino local, o aviso mostra “Sistema detectado: Computador”, porém Android está selecionado e as instruções citam telefone e barra do Android.

Causa confirmada em `frontend/src/components/PWAInstallPrompt.jsx:28`: a plataforma desktop é convertida deliberadamente para `android` na inicialização. O guia permanente `PWAInstallGuide.jsx` já inicializa com a plataforma detectada.

Recomendação: usar a plataforma detectada como seleção inicial, mantendo a troca manual disponível.

### F03 — Central de ajuda expõe erro técnico no modo sem backend

Prioridade média, restrita ao cenário testado sem Supabase. Caminho: menu → Ajuda e suporte. O FAQ exibe literalmente `supabase-unavailable` e “Tentar novamente”.

`frontend/src/lib/support.js` lança o código e `frontend/src/views/Support.jsx:34` mostra `e.message` diretamente. O formulário de novo chamado continua acessível. A validação dos três campos vazios funciona, sem envio de mensagem.

Recomendação: traduzir erros de infraestrutura para uma orientação acionável e apresentar explicitamente os requisitos de conexão/conta do suporte.

### F04 — Comunidade informa necessidade de conta sem oferecer ação direta de entrada

Prioridade baixa a média, de navegação. Visitante → Comunidade: aparece apenas “Entre na sua conta para acessar a Comunidade.” O menu principal continua disponível, mas a página não apresenta botão de login ou criação de conta.

Recomendação: incluir uma ação de entrada nessa tela e preservar o destino após autenticar.

### F05 — Indicador visual de execução aparece antes de iniciar a série

Prioridade baixa. Falha reproduzida também executando isoladamente `WorkoutExercisePlayer.test.jsx`. O botão principal condiciona o sinal a `executing`, mas os segmentos das séries em `frontend/src/components/WorkoutExercisePlayer.jsx:199` usam apenas série atual, não concluída e desbloqueada. Assim, recebem `is-executing` e `.wp-execution-signal` antes do Play.

Recomendação: alinhar o indicador dos segmentos ao estado efetivo de execução. A jornada manual de iniciar/concluir série e descansar funcionou.

## Fragilidades de testes e estrutura

- Teste de estado inicial desatualizado: `frontend/src/store/useStore.test.js:10` espera sete rotinas, mas a normalização entrega 29. A configuração inicial manual gerou corretamente três treinos após as escolhas feitas. A diferença numérica isolada não comprova defeito de produto.
- Testes de treino antigos não confirmam a etapa de duração antes de procurar “Iniciar série”. Isso causa falhas de seleção/timeout. A jornada manual confirmou duração → série → descanso → encerramento → histórico.
- O cenário SQL real para na solicitação de vínculo porque procura um link dentro de `.management-requests-details` sem expandir o `summary`. O snapshot confirma “Solicitações de vínculo · 1”, com a seção recolhida. A reprodução diagnóstica em `.audit-flow/lifecycle.audit.spec.mjs` acrescenta a expansão, sem alterar o teste original nem código funcional.
- Com a expansão ajustada na cópia diagnóstica, a integração com SQL real avançou por solicitação, aceite, criação, envio e aplicação do plano. Encontrou uma segunda premissa desatualizada do teste: hoje é sábado e o plano prescreve segunda, terça e quinta; a UI oferece corretamente a escolha de treino em dia de descanso, enquanto o teste exige uma sessão já aberta. Na cópia diagnóstica, aguardar a escolha e selecionar a rotina resolveu essa etapa. Resultado final: **1 teste passou em 1,1 minuto**, incluindo troca para plano pessoal, reaplicação profissional, encerramento do vínculo, retorno ao plano pessoal e criação de novo vínculo com dois ciclos distintos. Todas as demais asserções do teste original foram mantidas. Evidência: `.audit-flow/lifecycle-reproduction.log`.
- O teste do resumo compacto de aluno encontrou altura de 246,16 px contra limite de 240 px. Trata-se inicialmente de divergência de layout/especificação; não há evidência nessa asserção de perda de dados ou de navegação bloqueada.
- Há cenários de biblioteca profissional procurando estrutura antiga: título “Treinos recebidos do profissional”, `.received-workout-main`, `.plan-day` na prévia e botão “Em uso”. A implementação atual apresenta cartões por plano, `.received-workout-card` e `TrainingPlanPreview`. Essas falhas precisam ser reconciliadas com a especificação antes de classificá-las como defeitos do fluxo profissional.
- `check:i18n` falha por dez textos usados sem chave correspondente nos pacotes de tradução, principalmente convites e contatos profissionais. Os 11 pacotes têm 1.588 chaves cada, mas esses usos ficam fora deles.
- O verificador `check:supabase` gera dois alertas de tokens. A inspeção aponta falsos positivos: ele cruza palavras em todo o arquivo, sem analisar fluxo de dados. Em `AuthProvider.jsx`, a mutação de URL adiciona `auth_flow`; não foi identificada escrita de token nessa URL. No repositório de fotos, “caches” aparece em um comentário; o token é usado em Authorization para uma Edge Function. A falha do gate é real; vazamento de token não foi comprovado.
- `test:plan-library:database` falha porque o bootstrap PGlite não define `auth.jwt()`, exigida pelas migrations. Não comprova falha de migration no Supabase real.
- `check:database:clean` não consegue iniciar o PostgreSQL instalado: falta `C:/Program Files/PostgreSQL/17/share/postgres.bki`. Os testes SQL do schema final ficaram sem execução.
- Builds emitem aviso de importação dinâmica ineficaz de `src/sheets.jsx`, também importado estaticamente. O precache PWA gerado tem 152 entradas, aproximadamente 47,57 MB; os testes offline passaram, mas o custo de download inicial merece medição em rede móvel.
- `npm audit` informa seis vulnerabilidades em dependências de ferramentas: duas baixas e quatro moderadas. Nenhuma alta/crítica reportada nessa execução. Não foi aplicado `audit fix`.

## Jornada exploratória confirmada

Página inicial sem Supabase → aviso de privacidade → “Começar agora” → sete etapas do onboarding → plano semanal → início → treino em dia de descanso → seleção de rotina → duração → Play → concluir série → descanso → pular descanso → terminar mais cedo → confirmar → nota → resumo → início → histórico → detalhes → fechar com Escape → evolução → editar peso → salvar → menu → suporte → validação de formulário vazio → início → comunidade com bloqueio para visitante.

Dados conferidos: nota preservada, uma série salva, volume de 150 kg no resumo/início/histórico/estatísticas e peso atualizado de 75 para 75,5 kg. O treino curto exibiu zero minutos por arredondamento; isso não foi classificado como falha funcional.

Adicionalmente: alteração de semanal para diário, persistência após recarregar e manutenção das três rotinas; busca “supino” no catálogo retornou nove exercícios e a abertura do supino exibiu animação, instruções e o registro de carga vindo do treino salvo.

Também confirmados manualmente: voltar do catálogo pelo histórico do navegador; criar “Treino da auditoria”, adicionar supino pela prévia e concluir com retorno ao plano; converter para libras nas configurações, refletindo 75,5 kg como 166,4 lb e volume de 150 kg como 330,7 lb no início e no histórico.

## Ordem sugerida de tratamento

1. Corrigir a entrada de visitante no primeiro acesso, especialmente a combinação standalone + Supabase configurado.
2. Atualizar os testes para o fluxo de duração, biblioteca atual e solicitações recolhidas; manter as asserções de persistência e permissões.
3. Corrigir os estados de erro e as ações de entrada nas páginas que dependem de conta/backend.
4. Ajustar seleção de plataforma PWA, indicador de execução e traduções ausentes.
5. Reparar os verificadores e o ambiente de banco para restabelecer uma validação confiável antes de publicação.

## Evidências

Logs locais em `.audit-flow/`: `unit.log`, `unit-reproduction.log`, `e2e-full.log`, `pwa.log`, `lint.log`, `typecheck.log`, `i18n.log`, `build.log`, `build-vercel.log`, `build-mobile.log`, `notifications.log`, `supabase.log`, `plan-database.log`, `database-clean.log`, `dependencies.log`, `catalogue.log` e `database-harness.log`.

Os cenários E2E com falha preservam screenshot, contexto e trace em `frontend/test-results/`. Esses artefatos são locais e podem ser substituídos em uma próxima execução.

## Correções implementadas após a auditoria

O baseline acima foi preservado como registro da primeira execução. As correções autorizadas posteriormente estão na branch local `fix/flow-errors-20261107`.

- A entrada de visitante agora registra a entrada no aplicativo antes de fechar a autenticação. A comunidade oferece entrada/cadastro e conserva a rota de destino.
- O instalador PWA seleciona a plataforma detectada e usa uma única semântica de diálogo. O indicador de execução aparece somente após iniciar a série. O resumo compacto do aluno distribui quatro informações em quatro colunas, preservando o limite de altura.
- `app-errors.js` centraliza mensagens por categoria e impede a exibição de respostas brutas do backend. Os repositórios preservam código/status para classificação. Telas de suporte, comunidade, fotos, conta, privacidade, gestão e console utilizam o formatador; validações específicas e logs técnicos administrativos mantêm seu propósito. Documentação: `docs/mensagens-de-erro.md`.
- As traduções ausentes e o novo catálogo estão nos onze idiomas. Os testes de treino confirmam a duração pela interface; os de biblioteca verificam os cartões atuais e os dados persistidos. O cenário SQL real expande solicitações e escolhe explicitamente o treino no dia de descanso, com relógio fixado.
- O verificador de tokens analisa sintaxe e propagação local de dados, com regressões para atribuições, aliases, URL, cache, console e IndexedDB. Comentários e funções independentes deixam de gerar os dois falsos positivos. Ele não pretende provar ausência de vazamentos arbitrários entre arquivos.
- O harness PGlite aplica todas as migrations em ordem, usa o bootstrap compartilhado e executa as verificações históricas nos checkpoints correspondentes. Não foram acrescentados stubs de regras de negócio.
- O gerador de precache foi substituído por um módulo Node pequeno, mantendo padrões, exclusões, limite de arquivo e revisão por conteúdo. Isso removeu a dependência de ferramentas responsável pelas vulnerabilidades reportadas. O build manteve 152 entradas; os sete testes offline passaram.
- PostgreSQL 17.11 e pgTAP 1.3.4 foram preparados isoladamente em `.audit-flow/pg-runtime`, sem modificar a instalação incompleta de `Program Files`. Para reproduzir a verificação nativa nesta máquina, defina `PG_BIN` para o caminho absoluto de `.audit-flow/pg-runtime/pgsql/bin` antes de executar `npm run check:database:clean`.
- A execução nativa encontrou uma lacuna adicional em `check_email_registered`: faltava guard de conta autenticada e acesso ao schema para o cadastro anônimo. Uma migration adicional preserva a consulta anônima, bloqueia contas suspensas e não concede leitura de perfis nem exclusão de contas ao visitante.

A revisão independente identificou e confirmou a correção de dois detalhes adicionais: prioridade de `23505` sobre HTTP 409 e detecção de destinos de token por atribuição/alias. Não foram encontrados novos achados na revisão focada dessas correções.

## Resultado da validação após as correções

| Verificação | Resultado |
| --- | --- |
| Unitários, `--maxWorkers=4` | 1.786 passaram, 205 arquivos |
| E2E Chromium desktop/celular e WebKit | 425 cenários validados; 23 ignorados pelas condições da suíte |
| PWA offline e atualização de cache | 7 passaram |
| PostgreSQL nativo com pgTAP | 42 arquivos SQL e 4 verificações de concorrência passaram |
| Planos em PostgreSQL/WASM | 18 verificações passaram |
| Contratos e fronteiras de acesso | 44 passaram, 3 ignorados, scanner aprovado |
| Notificações | 42 passaram |
| Lint, tipos, traduções | Aprovados; 11 idiomas, 1.610 chaves |
| Builds padrão, Vercel e mobile web | Aprovados |
| Auditoria de dependências | Zero vulnerabilidades reportadas |
| `git diff --check` | Aprovado |

A rodada E2E completa executou 448 cenários: 419 passaram, 23 foram ignorados e 6 ainda esperavam o texto antigo dos erros HTTP 500. Após atualizar somente essas expectativas, os seis passaram na repetição com `--last-failed`; as asserções de confirmação, cancelamento, tentativa novamente, exclusão/revogação e persistência foram mantidas. A última rodada unitária completa passou após uniformizar também as mensagens das consultas de profissionais e materiais.

Evidências finais em `.audit-flow/`: `final-unit-green.log`, `final-e2e.log`, `final-e2e-recheck.log`, `final-pwa.log`, `final-database-clean-3.log`, `final-plan-database-2.log`, `final-supabase-2.log`, `final-notifications.log`, `final-lint-verified.log`, `final-types-verified.log`, `final-i18n-verified.log`, `final-build-verified.log`, `final-build-vercel-verified.log`, `final-build-mobile-verified.log` e `final-audit.json`.

Escopo de comprovação: ambiente local, respostas simuladas nos E2E usuais e SQL real nos testes de banco e relacionamento. Não houve publicação nem alteração do banco remoto. A nova migration precisa acompanhar a próxima publicação. Login remoto, entrega efetiva de push e serviços de Storage publicados continuam dependendo da configuração e credenciais do ambiente correspondente. Permanecem os avisos de empacotamento sobre importação dinâmica já estática e o tamanho do precache como observações de otimização, sem falha nos testes de build/offline.
