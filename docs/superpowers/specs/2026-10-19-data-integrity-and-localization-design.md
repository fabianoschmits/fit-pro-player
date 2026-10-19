# Correções de integridade de dados, sincronização e localização

## Objetivo

Corrigir os defeitos encontrados na revisão do Fit Pro Player em ambiente de teste. Os dados existentes podem ser reformatados ou substituídos: não há requisito de preservação ou retrocompatibilidade de valores salvos em libras.

O resultado esperado é que todas as medidas persistidas usem quilogramas, duas abas não possam sobrescrever silenciosamente uma à outra e a checagem de internacionalização seja executada sem mensagens ausentes.

## Escopo

Esta entrega cobre três correções relacionadas ao estado persistido:

1. Normalização de massa e carga para quilogramas.
2. Controle de concorrência entre abas usando uma revisão por instância do aplicativo.
3. Cobertura das mensagens que hoje falham em `check:i18n`.

Ficam fora deste escopo novas funcionalidades de treino, páginas para profissionais e mesclagem automática de conflitos entre dispositivos. Conflitos continuarão explícitos e preservarão as duas cópias para escolha do usuário.

## Dados em quilogramas

O novo contrato separa três conceitos: `displayUnit` guarda a preferência visual (`kg` ou `lb`), `massUnit` identifica a unidade canônica do estado e tem sempre o valor `kg`, e `stateSchemaVersion` identifica o formato persistido. Todo valor persistido que represente massa ou carga é canônico em kg. O campo legado `S.unit` será removido depois que todos os consumidores usarem `displayUnit`.

Ao selecionar `lb`, entradas e leituras serão convertidas na borda da interface. Ao confirmar uma alteração, a interface converte o valor para kg antes de chamar a store; ao renderizar, converte kg para lb. Nenhuma rotina de domínio, exportação, histórico ou sincronização dependerá da unidade de visualização. Alterar `displayUnit` nunca transforma os valores persistidos.

`normalizeState` será a fronteira obrigatória de saneamento do formato atual. Um estado só pode ser tratado como canônico quando `massUnit === 'kg'` e `stateSchemaVersion` corresponder à versão nova. Como o ambiente contém apenas dados de teste, estados anteriores ou sem esses marcadores serão substituídos pelo estado inicial; não haverá inferência nem conversão heurística baseada em `S.unit`. As estruturas abrangidas no formato novo são:

- `profile.startWeight`, `targetW` e cada `bodyweight[].w`;
- `exWeights`;
- cargas de exercícios de rotina e do treino ativo, incluindo metas e séries registradas;
- cargas de cada treino concluído, inclusive séries históricas.

Funções únicas de apresentação converterão kg para a unidade visual e a entrada visual para kg, com arredondamento definido por tipo de campo. Elas não percorrem nem reescrevem o estado. Importações com unidade explícita convertem cada valor para kg antes de persistir; arquivos ambíguos exigem que o usuário indique a unidade.

Após a adoção do contrato, a troca na configuração altera somente `displayUnit`. O texto da tela de configurações explicará que os números são apresentados na unidade escolhida e armazenados internamente em kg.

## Sincronização entre abas

O defeito atual vem de `fpp_account_sync_v1:<usuário>` ser compartilhado no `localStorage`: uma aba antiga lê a revisão que outra aba acabou de gravar e a usa como se fosse a sua revisão-base.

Cada instância da store manterá uma variável privada `baseRevision`. Ela é definida quando a aba ativa a conta, puxa um snapshot remoto, resolve um conflito ou conclui um upload. Ela nunca será atualizada por uma gravação feita por outra aba. A metadata compartilhada continuará indicando se existe alteração local, mas não será fonte da revisão esperada em operações CAS.

Todo upload enviará `baseRevision`. Se outra aba ou dispositivo já tiver gravado, o RPC retornará conflito. A aba manterá sua cópia local, buscará o snapshot vencedor e exibirá a resolução existente. Isso impede a sobrescrita silenciosa sem inventar uma mesclagem de registros que não existe no modelo de snapshots.

Para reduzir o tempo de estado desatualizado, a store publicará uma notificação leve por `BroadcastChannel`, com fallback para evento `storage`. A mensagem contém somente o escopo, a origem e a revisão publicada; nunca contém treinos ou dados pessoais. Ao recebê-la de outra aba do mesmo usuário, a store marca a sincronização como `REMOTE_AHEAD` e evita novos uploads automáticos até a próxima sincronização. A gravação manual subsequente usa a revisão-base da própria aba e, se necessário, gera conflito em vez de substituir o servidor.

O canal é fechado ou ignorado quando o escopo muda. Eventos com a origem da própria aba e mensagens de outro usuário são ignorados. A ausência de `BroadcastChannel` não altera a segurança, pois a CAS continua usando `baseRevision` local.

## Localização

As quinze chaves estáticas localizadas em `RoutineEdit`, `Workout`, `BodyMap` e `ErrorBoundary` serão adicionadas aos onze pacotes de idioma. As chaves usarão o texto-fonte atual e valores traduzidos em cada arquivo; não serão atendidas por fallback para português ou inglês.

`check-locales.mjs` continuará sendo a verificação de paridade e `check-source-strings.mjs --strict` deixará de encontrar mensagens sem entrada.

## Erros e recuperação

- Valores inválidos de carga permanecem ausentes em vez de virarem zero durante a normalização.
- Um erro ao gravar dados locais deixa o estado em memória disponível para exportação e mantém o erro de persistência atual.
- Um conflito remoto sempre preserva cópias local e remota na área de conflito já existente.
- Falha ao criar o canal entre abas é ignorada: a CAS é suficiente para evitar perda de dados.

## Testes e verificação

Os testes unitários deverão provar que um estado em libras é normalizado uma única vez e que a troca de unidade posterior não altera valores canônicos. Exercícios de rotina, treino ativo, séries concluídas, peso corporal e metas devem aparecer no caso de teste.

Os testes de sincronização deverão criar duas stores isoladas que compartilham o mesmo armazenamento e simular a sequência: ambas leem a revisão 2, a primeira salva a revisão 3, a segunda tenta enviar com a revisão-base 2 e entra em conflito. Nenhum upload da segunda aba pode usar a revisão 3 sem antes ter carregado o snapshot vencedor.

Por fim, a entrega executará `npm --prefix frontend run check:i18n`, os testes relevantes, a suíte completa de frontend, o build e `npm run check:supabase`.
