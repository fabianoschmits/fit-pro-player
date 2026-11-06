# Referências dos modelos de treino por duração

Consultadas em 6 de novembro de 2026:

- [ACSM — atualização de treinamento resistido de 2026](https://acsm.org/resistance-training-guidelines-update-2026/). A síntese recomenda regularidade, individualização e trabalho dos grandes grupos musculares pelo menos duas vezes por semana. Para hipertrofia, apresenta aproximadamente dez séries semanais por grupo como referência; para força, duas a três séries por exercício com cargas apropriadas. Isso informa a distribuição semanal e os limites de volume, sem transformar tempo disponível em obrigação de acrescentar séries ou cargas.
- [CDC — recomendações de atividade física para adultos](https://www.cdc.gov/physical-activity-basics/guidelines/adults.html). A referência populacional combina 150 minutos semanais de atividade aeróbica moderada (ou equivalente) e fortalecimento em pelo menos dois dias. O componente aeróbico dos objetivos de condicionamento e controle de peso complementa o fortalecimento; uma sessão isolada não garante atingir a recomendação semanal.

## Aplicação no catálogo

`frontend/src/lib/training-templates.js` contém grupos de candidatos, e não prescrições universais. Os parâmetros de objetivo, experiência, frequência e duração são aplicados pelo gerador existente. A ordem favorece padrões compostos, seguida de acessórios complementares. Sessões mistas abrangem empurrar, puxar e membros inferiores conforme a divisão.

Os modelos focados em bíceps, tríceps, antebraços e panturrilhas têm poucos candidatos por intenção: não devem ganhar um número excessivo de exercícios ou séries para preencher uma duração longa. O gerador pode complementar com a atividade aeróbica apropriada ao objetivo e mantém a estimativa como aproximação.

Todos os identificadores foram conferidos no catálogo de animações local. Bicicleta ergométrica (`2138`), escada (`2311`) e ergômetro de esqui (`2142`) aceitam prescrição em minutos. Circuitos corporais usam séries temporizadas. O exercício `0003` é abdominal bicicleta, não uma máquina aeróbica. Não há esteira ou elíptico com animação ativa neste catálogo; nenhum recurso novo é presumido.

Os modelos são escolhas de implementação baseadas nessas recomendações gerais. As fontes não prescrevem estes exercícios específicos nem prometem perda de peso por região corporal.

## Receitas por duração

O catálogo oferece 29 opções focadas e mistas. A divisão semanal usa o número escolhido de dias; com duas sessões, corpo inteiro A/B evita deixar cada grande grupo restrito a uma única sessão. Com três dias de hipertrofia, parte superior, inferior e corpo inteiro repetem os padrões principais. Sete dias incluem recuperação ativa, em vez de sete sessões intensas.

O gerador mantém as regras de repetições, experiência, progressão e cargas iniciais existentes. Os limites por sessão são 18 séries para iniciantes, 22 para intermediários e 26 para avançados, com redução dos acessórios em frequências de cinco dias ou mais. Os descansos explícitos são 120/90 segundos em hipertrofia e 90/60 nos outros objetivos, conforme a posição do exercício. Esses parâmetros são escolhas conservadoras de produto, não uma prescrição universal da ACSM.

A duração reserva uma parcela aeróbica maior no emagrecimento/condicionamento e menor na hipertrofia. A seleção determinística existente escolhe os movimentos dentro do orçamento de musculação. Uma bicicleta ergométrica realmente prescrita em minutos complementa a sessão, em vez de acrescentar séries repetitivas para preencher o relógio. A intensidade deve ser ajustada pelo atleta; a duração não impõe velocidade, carga ou gasto calórico. Sessões de recuperação e grupos pequenos não recebem volume resistido artificial.

Os tempos sugeridos e os personalizados usam o mesmo cálculo local, em segundos. A referência de 60 minutos produz estimativas entre 59 e 60 minutos no catálogo verificado, considerando as três experiências e os quatro objetivos. Tempos curtos podem ficar alguns minutos abaixo da meta; durações muito longas podem terminar antes, pois o bloco aeróbico fica limitado a 60 minutos e o volume resistido não cresce indefinidamente. A estimativa continua aproximada.

## Atualização segura de contas existentes

`node scripts/backfill-automatic-plans.mjs` cria backup e manifesto privados em `.supabase/fpp-plan-backfill/`. A aplicação explícita usa `--apply <manifest.json>` e uma única transação com comparação dos registros originais, revisões dos domínios e bloqueio de concorrência. Não há migration de esquema, RPC nova ou consultas adicionais no uso do aplicativo.

Somente prescrições com assinatura íntegra, ou marcadores positivos e correspondência integral com os modelos anteriores congelados, são elegíveis. A comparação histórica ignora apenas a carga, que é preservada por ocorrência do exercício. Nomes, posição ou IDs de exercícios isoladamente não são prova. Permanecem os IDs das rotinas, calendário, histórico e prescrições profissionais. A rotina de uma sessão ativa é protegida em todas as projeções; identidade ambígua protege toda a conta. O padrão 60 só preenche preferências ausentes, sem substituir uma duração já escolhida.

A alteração posterior do tempo habitual continua exigindo a confirmação existente para readequar planos. Escolher manter os treinos preserva suas prescrições. O ajuste temporário de uma sessão continua independente do plano salvo.
