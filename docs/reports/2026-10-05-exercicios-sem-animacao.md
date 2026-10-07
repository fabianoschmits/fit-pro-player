# Relatório de exercícios sem animações/sprites

Auditoria de 2026-10-05, sobre o catálogo e os arquivos locais do projeto. Commit de referência: `c2b1ead7192b7d2b8798ee6ab46113ab4ae9dcfd`.

## Resultado e significado de “ativo”

- **Biblioteca comum:** 156 exercícios oferecidos para seleção; todos têm animações válidas. **Nenhum exercício dessa biblioteca está sem sprites.**
- **Catálogo profissional:** 1324 exercícios disponíveis para prescrição. **1168 podem ser prescritos e ainda não têm animações/sprites.**
- Dos 1168 pendentes, **16 já têm slug reservado** no mapeamento e **1152 ainda não têm mapeamento de animação**. Os 16 estão incluídos no total; não são um lote adicional.
- **Treinos prontos:** os 39 IDs distintos usados nos modelos atuais têm animações.
- O catálogo comum só libera um exercício quando sua animação está registrada. O profissional utiliza a base completa, inclusive exercícios sem mídia; esses exercícios podem aparecer nos treinos prescritos.
- Esta auditoria cobre o catálogo fixo do projeto. Exercícios personalizados criados nas contas dos usuários não foram consultados e não fazem parte da contagem.

## Arquivos para trabalhar

- [Lista completa dos 1168 pendentes em CSV](2026-10-05-exercicios-sem-animacao.csv): inclui ID, nomes, equipamento, região, músculos, slug reservado, pasta de entrega e instruções originais para identificar cada variação.
- [Primeiro lote de 16 exercícios já mapeados](2026-10-05-primeiro-lote-16-sprites.csv): recorte dos pendentes com nomes de animação já reservados.
- [Lista dos 156 exercícios com animação](2026-10-05-exercicios-com-animacao.csv): conferência para evitar recriar mídia que já existe.
- CSV em UTF-8, com separador ponto e vírgula. Ao importar em Excel/Planilhas, defina “ID do catálogo” como texto para preservar zeros iniciais; a coluna “Referência (texto)” também identifica cada exercício como EX-0189, por exemplo.

## Pendências por região

| Região | Total no catálogo profissional | Com animação | Sem animação |
| --- | --- | --- | --- |
| Abdômen | 169 | 19 | 150 |
| Antebraços | 37 | 2 | 35 |
| Braços | 292 | 24 | 268 |
| Cardio | 29 | 7 | 22 |
| Costas | 203 | 21 | 182 |
| Ombros | 143 | 15 | 128 |
| Panturrilhas | 59 | 7 | 52 |
| Peito | 163 | 19 | 144 |
| Pernas | 227 | 42 | 185 |
| Pescoço | 2 | 0 | 2 |

**Total: 1324 cadastrados / 156 animados / 1168 pendentes.**

## Primeiro lote sugerido: 16 exercícios já mapeados

Este lote é sugerido porque já tem vínculo entre ID e slug. A prioridade é de integração, não uma classificação de frequência de uso ou importância clínica.

| ID | Nome no aplicativo (PT-BR) | Nome original (EN) | Equipamento | Slug reservado |
| --- | --- | --- | --- | --- |
| 3699 | Ombro toque | shoulder tap | Peso corporal | plank-shoulder-tap |
| 1735 | Extensão deitado unilateral com halteres | dumbbell lying single extension | Haltere | single-dumbbell-skullcrusher |
| 0423 | Extensão em pé unilateral com halteres | dumbbell standing one arm extension | Haltere | single-arm-dumbbell-tricep-extension |
| 0471 | Parada de mãos flexão de braços | handstand push-up | Peso corporal | handstand-push-up |
| 2141 | Caminhada elíptico cruzado treinador | walk elliptical cross trainer | Elíptica | elliptical |
| 3361 | Patinador saltos | skater hops | Peso corporal | skater-hop |
| 1326 | Barra fixa supinada | chin-up | Peso corporal | chin-up |
| 0189 | Remada curvada unilateral no cabo | cable one arm bent over row | Cabo | single-arm-cable-row |
| 0499 | Remada invertido | inverted row | Peso corporal | inverted-row |
| 1350 | Remada sentado na máquina articulada | lever seated row | Máquina articulada | machine-row |
| 0602 | Crucifixo inverso sentado na máquina articulada | lever seated reverse fly | Máquina articulada | reverse-pec-deck |
| 0426 | Desenvolvimento em pé acima da cabeça com halteres | dumbbell standing overhead press | Haltere | standing-dumbbell-press |
| 3211 | Flexão de braços ajoelhado (masculino) | kneeling push-up (male) | Peso corporal | knee-push-up |
| 0196 | Pull-through (com corda) no cabo | cable pull through (with rope) | Cabo | cable-pull-through |
| 0599 | Rosca sentado perna na máquina articulada | lever seated leg curl | Máquina articulada | seated-leg-curl |
| 0598 | Sentado quadril adução na máquina articulada | lever seated hip adduction | Máquina articulada | hip-adduction-machine |

## Como preparar os arquivos

- Crie uma pasta por exercício, usando o ID e o nome da coluna “Pasta sugerida para entrega”; exemplo: `0189-single-arm-cable-row/`.
- Entregue quadros separados em PNG com transparência, nomeados `frame_01.png`, `frame_02.png`, `frame_03.png` etc., na ordem da execução.
- Use pelo menos dois quadros. Para movimentos dinâmicos, quatro a seis quadros são um ponto de partida compatível com a maioria dos conjuntos existentes.
- Mantenha a mesma dimensão de tela, escala, enquadramento e perspectiva em todos os quadros de um exercício. Evite cortar partes do corpo ou equipamento.
- Siga o estilo dos sprites atuais. Mostre o aparelho e a variação exata: postura, apoio, pegada, inclinação e execução unilateral/bilateral. Nomes parecidos não significam a mesma animação.
- O nome em português foi exportado exatamente como aparece no aplicativo. Algumas traduções são pouco naturais; use também o nome original, o equipamento e as instruções do catálogo para identificar o movimento.
- Os PNGs são os originais de produção. O aplicativo usa versões WebP otimizadas, atualmente com lado maior de até 768 px; essa conversão pode ser feita na integração.

### Observação para a futura integração

O importador de sprites atual precisa ser ajustado antes de receber novos lotes: ele preserva conjuntos anteriores apenas quando o módulo importa PNG, mas os 156 conjuntos existentes importam WebP. Usá-lo como está pode retirar conjuntos válidos dos manifestos. Os 1.152 exercícios sem vínculo também precisam ser associados explicitamente ao ID antes de serem liberados na biblioteca comum. Esta auditoria não executou importações nem alterou o aplicativo.

## Conferência dos arquivos existentes

- 156 pastas de animação, 156 slugs liberados e 156 entradas de contagem de quadros: correspondência completa.
- 646 quadros WebP usados pelo aplicativo e 646 quadros PNG originais; todos os arquivos referenciados existem.
- A revisão paralela abriu os 1.292 arquivos de imagem: nenhum corrompido e nenhuma divergência de dimensão entre quadros do mesmo conjunto.
- Não há pastas liberadas sem exercício correspondente, conjunto compartilhado entre IDs ou animação completa duplicada entre exercícios.
- Verificação direcionada: `npm --prefix frontend test -- src/lib/exercises.test.js src/lib/exercise-guide-assets.test.js` — 2 arquivos e 9 testes aprovados.

## Fontes do projeto

- [Base completa de exercícios](../../frontend/src/lib/exercises-data.js).
- [Definição da biblioteca comum e catálogo profissional](../../frontend/src/lib/exercises.js).
- [Uso do catálogo completo na prescrição profissional](../../frontend/src/views/ProfessionalPrograms.jsx).
- [Mapeamento por ID e regra de disponibilidade da animação](../../frontend/src/lib/exercise-guide-assets.js).
- [Manifesto de sprites](../../frontend/src/lib/exercise-sprite-slugs.json) e [contagens de quadros](../../frontend/src/lib/exercise-sprite-frame-counts.json).
- [Carregamento das animações](../../frontend/src/components/ExerciseGuideAnimation.jsx).
- [Nomes em português](../../frontend/src/generated/pt-exercise-names.js) e [treinos prontos](../../frontend/src/lib/starter.js).
- [Importador atual](../../frontend/scripts/import-guide-sprites.mjs) e [otimizador de mídia](../../scripts/optimize-app-media.py).

## Lista completa: 1168 exercícios sem sprites

Todos os itens abaixo estão disponíveis no catálogo profissional e ainda não têm sprites utilizáveis no aplicativo. Não foram removidas variações ou agrupados IDs semelhantes. Um slug preenchido significa apenas que o nome já está reservado, sem arquivos de animação.

### Abdômen — 150 pendentes

| ID | Nome no aplicativo (PT-BR) | Nome original (EN) | Equipamento | Slug reservado |
| --- | --- | --- | --- | --- |
| 2297 | Abdominal (completo amplitude mãos atrás cabeça) na bola suíça | stability ball crunch (full range hands behind head) | Bola de estabilidade | — |
| 0267 | Abdominal (mãos acima da cabeça) | crunch (hands overhead) | Peso corporal | — |
| 0272 | Abdominal (na bola suíça, braços estendido) | crunch (on stability ball, arms straight) | Bola de estabilidade | — |
| 0271 | Abdominal (na bola suíça) | crunch (on stability ball) | Bola de estabilidade | — |
| 0001 | Abdominal 3/4 | 3/4 sit-up | Peso corporal | — |
| 0840 | Abdominal acima da cabeça (na bola suíça) com peso adicional | weighted overhead crunch (on stability ball) | Com carga | — |
| 0985 | Abdominal ajoelhado com rotação com faixa elástica | band kneeling twisting crunch | Faixa elástica | — |
| 1758 | Abdominal assistido | assisted sit-up | Assistido | — |
| 0972 | Abdominal bicicleta com faixa elástica | band bicycle crunch | Faixa elástica | — |
| 0507 | Abdominal canivete | jackknife sit-up | Peso corporal | — |
| 0981 | Abdominal canivete com faixa elástica | band jack knife sit-up | Faixa elástica | — |
| 3679 | Abdominal com braços no peitoral | sit-up with arms on chest | Peso corporal | — |
| 0457 | Abdominal com pernas flexionadas e braços estendidos | flexion leg sit up (straight arm) | Peso corporal | — |
| 3204 | Abdominal completo com braços acima da cabeça (masculino) | arms overhead full sit-up (male) | Peso corporal | — |
| 0262 | Abdominal cruzado corpo | cross body crunch | Peso corporal | — |
| 0277 | Abdominal declinado | decline crunch | Peso corporal | — |
| 3670 | Abdominal declinado com peso adicional | weighted decline sit-up | Com carga | — |
| 0071 | Abdominal desenvolvimento com barra | barbell press sit-up | Barra | — |
| 0874 | Abdominal em pé (com corda) no cabo | cable standing crunch (with rope attachment) | Cabo | — |
| 1005 | Abdominal em pé com faixa elástica | band standing crunch | Faixa elástica | — |
| 1007 | Abdominal em pé com rotação com faixa elástica | band standing twisting crunch | Faixa elástica | — |
| 0226 | Abdominal em pé no cabo | cable standing crunch | Cabo | — |
| 0969 | Abdominal em V alternado com faixa elástica | band alternating v-up | Faixa elástica | — |
| 0992 | Abdominal empurrada com faixa elástica | band push sit-up | Faixa elástica | — |
| 0871 | Abdominal encolhido | tuck crunch | Peso corporal | — |
| 0242 | Abdominal encolhido invertido no cabo | cable tuck reverse crunch | Cabo | — |
| 0221 | Abdominal flexão lateral (bosu bola) no cabo | cable side bend crunch (bosu ball) | Cabo | — |
| 0456 | Abdominal flexão perna (com joelhos flexionados) | flexion leg sit up (bent knee) | Peso corporal | — |
| 0495 | Abdominal inclinado com rotação | incline twisting sit-up | Peso corporal | — |
| 0873 | Abdominal invertido no cabo | cable reverse crunch | Cabo | — |
| 0508 | Abdominal janda | janda sit-up | Peso corporal | — |
| 3640 | Abdominal joelho toque | knee touch crunch | Peso corporal | — |
| 0223 | Abdominal lateral no cabo | cable side crunch | Cabo | — |
| 0691 | Abdominal lateral sentado na parede | seated side crunch (wall) | Peso corporal | — |
| 3202 | Abdominal meio (masculino) | half sit-up (male) | Peso corporal | — |
| 0634 | Abdominal negativo | negative crunch | Peso corporal | — |
| 1495 | Abdominal oblíquo versão 2 | oblique crunch v. 2 | Peso corporal | — |
| 3203 | Abdominal prisioneiro meio (masculino) | prisoner half sit-up (male) | Peso corporal | — |
| 3201 | Abdominal quarto | quarter sit-up | Peso corporal | — |
| 2206 | Abdominal rolo invertido | roller reverse crunch | Rolo | — |
| 2429 | Abdominal sapo | frog crunch | Peso corporal | — |
| 0595 | Abdominal sentado (peitoral apoio) na máquina articulada | lever seated crunch (chest pad) | Máquina articulada | — |
| 1452 | Abdominal sentado na máquina articulada | lever seated crunch | Máquina articulada | — |
| 0212 | Abdominal sentado no cabo | cable seated crunch | Cabo | — |
| 3760 | Abdominal sentado versão 2 na máquina articulada | lever seated crunch v. 2 | Máquina articulada | — |
| 0807 | Abdominal suspenso invertido | suspended reverse crunch | Peso corporal | — |
| 0735 | Abdominal versão 2 | sit-up v. 2 | Peso corporal | — |
| 0469 | Abdominal virilha | groin crunch | Peso corporal | — |
| 3314 | Afastado maltese | straddle maltese | Peso corporal | — |
| 3298 | Afastado planche | straddle planche | Peso corporal | — |
| 3119 | Agachamento profundo | potty squat | Peso corporal | — |
| 1714 | Alongamento assistido do reto femoral em decúbito ventral | assisted prone rectus femoris stretch | Assistido | — |
| 1688 | Avanço com rotação | lunge with twist | Peso corporal | — |
| 3303 | Bandeira | flag | Peso corporal | — |
| 3698 | Caminhada com as mãos versão 2 | inchworm v. 2 | Peso corporal | — |
| 0260 | Casulo | cocoons | Peso corporal | — |
| 0138 | Com um base para cima | bottoms-up | Peso corporal | — |
| 3315 | Completo maltese | full maltese | Peso corporal | — |
| 3299 | Completo planche | full planche | Peso corporal | — |
| 0443 | Cotovelo até joelho | elbow-to-knee | Peso corporal | — |
| 2312 | Deitado cotovelo até joelho | lying elbow to knee | Peso corporal | — |
| 0524 | Desenvolvimento flexionado com kettlebell | kettlebell bent press | Kettlebell | — |
| 1015 | Desenvolvimento vertical pallof com faixa elástica | band vertical pallof press | Faixa elástica | — |
| 0011 | Elevação de joelhos suspensa e assistida | assisted hanging knee raise | Assistido | — |
| 0010 | Elevação de joelhos suspensa e assistida com impulso para baixo | assisted hanging knee raise with throw down | Assistido | — |
| 1761 | Elevação de joelhos suspenso oblíquo | hanging oblique knee raise | Peso corporal | — |
| 0012 | Elevação de pernas assistida com impulso lateral para baixo | assisted lying leg raise with lateral throw down | Assistido | — |
| 0013 | Elevação de pernas assistida com impulso para baixo | assisted lying leg raise with throw down | Assistido | — |
| 2963 | Elevação de pernas capitão cadeira estendido | captains chair straight leg raise | Peso corporal | — |
| 0620 | Elevação de pernas deitado banco reto | lying leg raise flat bench | Peso corporal | — |
| 1002 | Elevação de pernas deitado estendido com faixa elástica | band lying straight leg raise | Faixa elástica | — |
| 2333 | Elevação de pernas estendidas suspensa | arm slingers hanging straight legs | Peso corporal | — |
| 0689 | Elevação de pernas sentado | seated leg raise | Peso corporal | — |
| 0600 | Elevação de pernas sentado abdominal na máquina articulada | lever seated leg raise crunch | Máquina articulada | — |
| 2800 | Elevação de pernas sentado alternado (feminino) com barra | barbell sitted alternate leg raise (female) | Barra | — |
| 2799 | Elevação de pernas sentado alternado com barra | barbell sitted alternate leg raise | Barra | — |
| 0475 | Elevação de pernas suspenso estendido | hanging straight leg raise | Peso corporal | — |
| 2802 | Elevação de pernas torcido | twisted leg raise | Peso corporal | — |
| 2801 | Elevação de pernas torcido (feminino) | twisted leg raise (female) | Peso corporal | — |
| 0826 | Elevação de pernas vertical (no paralelo barras) | vertical leg raise (on parallel bars) | Peso corporal | — |
| 0484 | Elevação de quadril (com joelhos flexionados) | hip raise (bent knee) | Peso corporal | — |
| 0491 | Elevação de quadril inclinado perna (perna estendido) | incline leg hip raise (leg straight) | Peso corporal | — |
| 0474 | Elevação de quadril suspenso com pernas estendidas | hanging straight leg hip raise | Peso corporal | — |
| 0476 | Elevação de quadril suspenso estendido com rotação perna | hanging straight twisting leg hip raise | Peso corporal | — |
| 1764 | Elevação de quadril suspenso perna | hanging leg hip raise | Peso corporal | — |
| 0866 | Elevação de quadril suspenso perna com peso adicional | weighted hanging leg-hip raise | Com carga | — |
| 0103 | Em pé ab extensão abdominal com barra | barbell standing ab rollerout | Barra | — |
| 0230 | Em pé elevação no cabo | cable standing lift | Cabo | — |
| 0796 | Em pé roda extensão abdominal | standing wheel rollerout | Roda abdominal | — |
| 0083 | Extensão abdominal a partir de banco com barra | barbell rollerout from bench | Barra | — |
| 0084 | Extensão abdominal com barra | barbell rollerout | Barra | — |
| 0971 | Extensão com roda abdominal assistida por faixa elástica | band assisted wheel rollerout | Faixa elástica | — |
| 0532 | Figura 8 com kettlebell | kettlebell figure 8 | Kettlebell | — |
| 0664 | Flexão de braços até lateral prancha | push-up to side plank | Peso corporal | — |
| 0850 | Flexão lateral (na bola suíça) com peso adicional | weighted side bend (on stability ball) | Com carga | — |
| 0002 | Flexão lateral a 45° | 45° side bend | Peso corporal | — |
| 0222 | Flexão lateral no cabo | cable side bend | Cabo | — |
| 3296 | Frontal alavanca | front lever | Peso corporal | — |
| 0870 | Glúteos elevações | butt-ups | Peso corporal | — |
| 0467 | Gorila chin | gorilla chin | Peso corporal | — |
| 0174 | Judô virada no cabo | cable judo flip | Cabo | — |
| 0562 | Landmine 180 | landmine 180 | Barra | — |
| 3213 | Lateral até lateral toque nos pés (masculino) | side-to-side toe touch (male) | Peso corporal | — |
| 0096 | Lateral flexionado versão 2 com barra | barbell side bent v. 2 | Barra | — |
| 0705 | Lateral ponte versão 2 | side bridge v. 2 | Peso corporal | — |
| 0709 | Lateral quadril (no paralelo barras) | side hip (on parallel bars) | Peso corporal | — |
| 3300 | Lean planche | lean planche | Peso corporal | — |
| 0517 | Moinho avançado com kettlebell | kettlebell advanced windmill | Kettlebell | — |
| 0554 | Moinho com kettlebell | kettlebell windmill | Kettlebell | — |
| 0530 | Moinho duplo com kettlebell | kettlebell double windmill | Kettlebell | — |
| 0777 | Movimento rodízio | spell caster | Haltere | — |
| 0635 | Oblíquo abdominais no chão | oblique crunches floor | Peso corporal | — |
| 3699 | Ombro toque | shoulder tap | Peso corporal | plank-shoulder-tap |
| 0641 | Otis acima | otis up | Com carga | — |
| 3147 | Pélvica inclinação | pelvic tilt | Peso corporal | — |
| 2466 | Ponte - montanha escalador (cruzado corpo) | bridge - mountain climber (cross body) | Peso corporal | — |
| 1687 | Posterior passo até acima da cabeça alcance | posterior step to overhead reach | Peso corporal | — |
| 3239 | Prancha ajoelhado toque ombro (masculino) | kneeling plank tap shoulder (male) | Peso corporal | — |
| 2135 | Prancha frontal com peso adicional | weighted front plank | Com carga | — |
| 0464 | Prancha frontal com rotação | front plank with twist | Peso corporal | — |
| 3544 | Prancha inclinado lateral com peso corporal | bodyweight incline side plank | Peso corporal | — |
| 3663 | Prancha invertido com perna elevação | reverse plank with leg lift | Peso corporal | — |
| 3665 | Prancha power point | power point plank | Peso corporal | — |
| 0650 | Puxada em (na bola suíça) | pull-in (on stability ball) | Bola de estabilidade | — |
| 0570 | Puxada perna em banco reto | leg pull in flat bench | Peso corporal | — |
| 2204 | Rolo corpo serrote | roller body saw | Rolo | — |
| 3016 | Rosca acima | curl-up | Peso corporal | — |
| 0862 | Rotação (acima para baixo) no cabo | cable twist (up-down) | Cabo | — |
| 0583 | Rotação ajoelhado na máquina articulada | lever kneeling twist | Máquina articulada | — |
| 1468 | Rotação caranguejo toque nos pés | crab twist toe touch | Peso corporal | — |
| 2329 | Rotação coluna | spine twist | Peso corporal | — |
| 0112 | Rotação em pé com barra | barbell standing twist | Barra | — |
| 0243 | Rotação no cabo | cable twist | Cabo | — |
| 1707 | Rotação pronado na bola suíça | prone twist on stability ball | Bola de estabilidade | — |
| 0014 | Rotação russa assistida | assisted motion russian twist | Bola medicinal | — |
| 0845 | Rotação russo (pernas acima) com peso adicional | weighted russian twist (legs up) | Com carga | — |
| 2371 | Rotação russo versão 2 com peso adicional | weighted russian twist v. 2 | Com carga | — |
| 0849 | Rotação sentado (na bola suíça) com peso adicional | weighted seated twist (on stability ball) | Com carga | — |
| 0094 | Rotação sentado com barra | barbell seated twist | Barra | — |
| 1011 | Rotação sentado com faixa elástica | band seated twist | Faixa elástica | — |
| 2399 | Rotação sentado no cabo | cable seated twist | Cabo | — |
| 0211 | Russo rotações (na bola suíça) no cabo | cable russian twists (on stability ball) | Cabo | — |
| 3301 | Sapo planche | frog planche | Peso corporal | — |
| 0805 | Suspenso abdominal extensão | suspended abdominal fallout | Peso corporal | — |
| 0473 | Suspenso pike | hanging pike | Peso corporal | — |
| 0858 | Tiros de corrida | wind sprints | Peso corporal | — |
| 1496 | Trenó martelo | sledge hammer | Martelo | — |
| 0640 | Unilateral arremesso ao chão (com bola medicinal) | one arm slam (with medicine ball) | Bola medicinal | — |
| 1014 | V acima com faixa elástica | band v-up | Faixa elástica | — |
| 3420 | V sentado no chão | v-sit on floor | Peso corporal | — |

### Antebraços — 35 pendentes

| ID | Nome no aplicativo (PT-BR) | Nome original (EN) | Equipamento | Slug reservado |
| --- | --- | --- | --- | --- |
| 0721 | Alongamento lateral punho puxada | side wrist pull stretch | Peso corporal | — |
| 0518 | Alternado suspensão clean com kettlebell | kettlebell alternating hang clean | Kettlebell | — |
| 0455 | Dedo roscas | finger curls | Barra | — |
| 1437 | Dedo roscas com halteres | dumbbell finger curls | Haltere | — |
| 0347 | Deitado pronação com halteres | dumbbell lying pronation | Haltere | — |
| 2705 | Deitado pronação no chão com halteres | dumbbell lying pronation on floor | Haltere | — |
| 0349 | Deitado supinação com halteres | dumbbell lying supination | Haltere | — |
| 2706 | Deitado supinação no chão com halteres | dumbbell lying supination on floor | Haltere | — |
| 0854 | Em pé mão contração com peso adicional | weighted standing hand squeeze | Com carga | — |
| 1421 | Flexão de braços modificado até inferior braços | modified push up to lower arms | Peso corporal | — |
| 1411 | Flexão de punhos com as palmas para baixo sobre o banco com barra | barbell palms down wrist curl over a bench | Barra | — |
| 1412 | Flexão de punhos com as palmas para cima sobre o banco com barra | barbell palms up wrist curl over a bench | Barra | — |
| 1016 | Flexão de punhos com faixa elástica | band wrist curl | Faixa elástica | — |
| 0104 | Flexão de punhos em pé costas com barra | barbell standing back wrist curl | Barra | — |
| 0771 | Flexão de punhos em pé costas no aparelho Smith | smith standing back wrist curl | Máquina Smith | — |
| 0224 | Flexão de punhos em pé costas no cabo | cable standing back wrist curl | Cabo | — |
| 0079 | Flexão de punhos invertida com barra — versão 2 | barbell revers wrist curl v. 2 | Barra | — |
| 0082 | Flexão de punhos invertido com barra | barbell reverse wrist curl | Barra | — |
| 0994 | Flexão de punhos invertido com faixa elástica | band reverse wrist curl | Faixa elástica | — |
| 0210 | Flexão de punhos invertido no cabo | cable reverse wrist curl | Cabo | — |
| 0247 | Flexão de punhos no cabo | cable wrist curl | Cabo | — |
| 0401 | Flexão de punhos sentado com as palmas para cima com halteres | dumbbell seated palms up wrist curl | Haltere | — |
| 1426 | Flexão de punhos sentado no aparelho Smith | smith seated wrist curl | Máquina Smith | — |
| 0369 | Flexão de punhos sobre o banco com halteres | dumbbell over bench wrist curl | Haltere | — |
| 0368 | Flexão de punhos sobre o banco invertido com halteres | dumbbell over bench revers wrist curl | Haltere | — |
| 0367 | Flexão de punhos sobre o banco unilateral com halteres | dumbbell over bench one arm wrist curl | Haltere | — |
| 1441 | Flexão de punhos sobre o banco unilateral invertido com halteres | dumbbell over bench one arm reverse wrist curl | Haltere | — |
| 0364 | Flexão de punhos unilateral com halteres | dumbbell one arm wrist curl | Haltere | — |
| 0358 | Flexão de punhos unilateral invertido com halteres | dumbbell one arm reverse wrist curl | Haltere | — |
| 1415 | Flexão de punhos unilateral sentado neutro com halteres | dumbbell one arm seated neutral wrist curl | Haltere | — |
| 0125 | Flexão de punhos versão 2 com barra | barbell wrist curl v. 2 | Barra | — |
| 2288 | Fortalecedor de pegada mãos na máquina articulada | lever gripper hands | Máquina articulada | — |
| 1428 | Punho círculos | wrist circles | Peso corporal | — |
| 0859 | Punho rolo | wrist rollerer | Com carga | — |
| 0399 | Sentado unilateral girar com halteres | dumbbell seated one arm rotate | Haltere | — |

### Braços — 268 pendentes

| ID | Nome no aplicativo (PT-BR) | Nome original (EN) | Equipamento | Slug reservado |
| --- | --- | --- | --- | --- |
| 0643 | Alongamento acima da cabeça tríceps | overhead triceps stretch | Peso corporal | — |
| 1745 | Alongamento sentado tríceps na bola suíça | exercise ball seated triceps stretch | Bola de estabilidade | — |
| 0817 | Alongamento tríceps | triceps stretch | Peso corporal | — |
| 0677 | Argolas mergulhos | ring dips | Peso corporal | — |
| 0140 | Barra fixa bíceps | biceps pull-up | Peso corporal | — |
| 1728 | Coice dois braço tríceps no cabo | cable two arm tricep kickback | Cabo | — |
| 1739 | Coice em pé alternado tríceps com halteres | dumbbell standing alternating tricep kickback | Haltere | — |
| 0420 | Coice em pé com halteres | dumbbell standing kickback | Haltere | — |
| 0860 | Coice no cabo | cable kickback | Cabo | — |
| 0394 | Coice sentado com halteres | dumbbell seated kickback | Haltere | — |
| 1730 | Coice sentado com tronco inclinado alternado com halteres | dumbbell seated bent over alternate kickback | Haltere | — |
| 0398 | Coice sentado unilateral com halteres | dumbbell seated one arm kickback | Haltere | — |
| 1742 | Coice tríceps com cegonha base com halteres | dumbbell tricep kickback with stork stance | Haltere | — |
| 0354 | Coice unilateral com halteres | dumbbell one arm kickback | Haltere | — |
| 1734 | Coices no bola suíça com halteres | dumbbell kickbacks on exercise ball | Haltere | — |
| 0207 | Com pegada invertida tríceps na polia no cabo | cable reverse-grip pushdown | Cabo | — |
| 1721 | Com pegada invertida tríceps testa com barra | barbell reverse grip skullcrusher | Barra | — |
| 0525 | Com um base para cima clean a partir de o suspensão posição com kettlebell | kettlebell bottoms up clean from the hang position | Kettlebell | — |
| 0137 | Corpo acima | body-up | Peso corporal | — |
| 3287 | Cotovelo mergulhos | elbow dips | Peso corporal | — |
| 0296 | Desenvolvimento com pegada fechada com halteres | dumbbell close-grip press | Haltere | — |
| 1731 | Desenvolvimento com pegada fechada com halteres | dumbbell close grip press | Haltere | — |
| 3547 | Desenvolvimento de ombros sentado rosca de bíceps até com halteres | dumbbell seated biceps curl to shoulder press | Haltere | — |
| 0035 | Desenvolvimento declinado com pegada fechada até crânio com barra | barbell decline close grip to skull press | Barra | — |
| 0448 | Desenvolvimento declinado com pegada fechada face com barra W | ez barbell decline close grip face press | Barra EZ | — |
| 1617 | Desenvolvimento declinado unilateral martelo com halteres | dumbbell decline one arm hammer press | Haltere | — |
| 0055 | Desenvolvimento deitado com pegada fechada com barra | barbell lying close-grip press | Barra | — |
| 0338 | Desenvolvimento deitado cotovelo com halteres | dumbbell lying elbow press | Haltere | — |
| 1749 | Desenvolvimento ez barra em pé french | ez bar standing french press | Barra EZ | — |
| 1747 | Desenvolvimento ez barra french no bola suíça | ez bar french press on exercise ball | Barra EZ | — |
| 0048 | Desenvolvimento inclinado com pegada invertida com barra | barbell incline reverse-grip press | Barra | — |
| 1618 | Desenvolvimento inclinado martelo no bola suíça com halteres | dumbbell incline hammer press on exercise ball | Haltere | — |
| 1619 | Desenvolvimento inclinado unilateral martelo com halteres | dumbbell incline one arm hammer press | Haltere | — |
| 1620 | Desenvolvimento inclinado unilateral martelo no bola suíça com halteres | dumbbell incline one arm hammer press on exercise ball | Haltere | — |
| 3291 | Desenvolvimento stalder | stalder press | Peso corporal | — |
| 0436 | Desenvolvimento tate com halteres | dumbbell tate press | Haltere | — |
| 0816 | Desenvolvimento tríceps | triceps press | Peso corporal | — |
| 1736 | Desenvolvimento unilateral french no bola suíça com halteres | dumbbell one arm french press on exercise ball | Haltere | — |
| 1621 | Desenvolvimento unilateral martelo no bola suíça com halteres | dumbbell one arm hammer press on exercise ball | Haltere | — |
| 0065 | Desenvolvimento unilateral no chão com barra | barbell one arm floor press | Barra | — |
| 0526 | Duplo alternado suspensão clean com kettlebell | kettlebell double alternating hang clean | Kettlebell | — |
| 0152 | Extensão concentrado (no joelho) no cabo | cable concentration extension (on knee) | Cabo | — |
| 0194 | Extensão de tríceps acima da cabeça (corda) no cabo | cable overhead triceps extension (rope attachment) | Cabo | — |
| 1771 | Extensão de tríceps ajoelhado com peso corporal | bodyweight kneeling triceps extension | Peso corporal | — |
| 0176 | Extensão de tríceps ajoelhado no cabo | cable kneeling triceps extension | Cabo | — |
| 0149 | Extensão de tríceps alternado no cabo | cable alternate triceps extension | Cabo | — |
| 0018 | Extensão de tríceps assistida em pé (com toalha) | assisted standing triceps extension (with towel) | Assistido | — |
| 1724 | Extensão de tríceps corda alto polia acima da cabeça no cabo | cable rope high pulley overhead tricep extension | Cabo | — |
| 1726 | Extensão de tríceps corda deitado no chão no cabo | cable rope lying on floor tricep extension | Cabo | — |
| 1725 | Extensão de tríceps corda inclinado no cabo | cable rope incline tricep extension | Cabo | — |
| 2186 | Extensão de tríceps declinado com barra W | ez barbell decline triceps extension | Barra EZ | — |
| 0306 | Extensão de tríceps declinado com halteres | dumbbell decline triceps extension | Haltere | — |
| 0061 | Extensão de tríceps deitado com barra | barbell lying triceps extension | Barra | — |
| 0056 | Extensão de tríceps deitado com pegada fechada com barra | barbell lying close-grip triceps extension | Barra | — |
| 1720 | Extensão de tríceps deitado costas de o cabeça com barra | barbell lying back of the head tricep extension | Barra | — |
| 0344 | Extensão de tríceps deitado unilateral pronada com halteres | dumbbell lying one arm pronated triceps extension | Haltere | — |
| 0346 | Extensão de tríceps deitado unilateral supinada com halteres | dumbbell lying one arm supinated triceps extension | Haltere | — |
| 0186 | Extensão de tríceps deitado versão 2 no cabo | cable lying triceps extension v. 2 | Cabo | — |
| 0109 | Extensão de tríceps em pé acima da cabeça com barra | barbell standing overhead triceps extension | Barra | — |
| 0430 | Extensão de tríceps em pé com halteres | dumbbell standing triceps extension | Haltere | — |
| 1727 | Extensão de tríceps em pé com pegada invertida unilateral acima da cabeça no cabo | cable standing reverse grip one arm overhead tricep extension | Cabo | — |
| 1741 | Extensão de tríceps em pé com tronco inclinado dois braço com halteres | dumbbell standing bent over two arm triceps extension | Haltere | — |
| 1740 | Extensão de tríceps em pé com tronco inclinado unilateral com halteres | dumbbell standing bent over one arm triceps extension | Haltere | — |
| 0231 | Extensão de tríceps em pé unilateral no cabo | cable standing one arm triceps extension | Cabo | — |
| 1748 | Extensão de tríceps ez barra deitado com pegada fechada atrás cabeça | ez bar lying close grip triceps extension behind head | Barra EZ | — |
| 2189 | Extensão de tríceps halteres sentado | dumbbells seated triceps extension | Haltere | — |
| 0449 | Extensão de tríceps inclinado com barra W | ez barbell incline triceps extension | Barra EZ | — |
| 0330 | Extensão de tríceps inclinado com halteres | dumbbell incline triceps extension | Haltere | — |
| 1752 | Extensão de tríceps inclinado no aparelho Smith | smith machine incline tricep extension | Máquina Smith | — |
| 0173 | Extensão de tríceps inclinado no cabo | cable incline triceps extension | Cabo | — |
| 0998 | Extensão de tríceps lateral com faixa elástica | band side triceps extension | Faixa elástica | — |
| 0607 | Extensão de tríceps na máquina articulada | lever triceps extension | Máquina articulada | — |
| 2405 | Extensão de tríceps na polia (v barra) (com suporte para bíceps) no cabo | cable triceps pushdown (v-bar) (with arm blaster) | Cabo | — |
| 0241 | Extensão de tríceps na polia (v barra) no cabo | cable triceps pushdown (v-bar) | Cabo | — |
| 2406 | Extensão de tríceps na polia com pegada invertida (W barra) (com suporte para bíceps) no cabo | cable reverse grip triceps pushdown (sz-bar) (with arm blaster) | Cabo | — |
| 1723 | Extensão de tríceps na polia unilateral no cabo | cable one arm tricep pushdown | Cabo | — |
| 0637 | Extensão de tríceps olímpico barra | olympic barbell triceps extension | Barra olímpica | — |
| 1732 | Extensão de tríceps para a frente avanço com halteres | dumbbell forward lunge triceps extension | Haltere | — |
| 0373 | Extensão de tríceps pronar pegada com halteres | dumbbell pronate-grip triceps extension | Haltere | — |
| 0092 | Extensão de tríceps sentado acima da cabeça com barra | barbell seated overhead triceps extension | Barra | — |
| 0453 | Extensão de tríceps sentado com barra W | ez barbell seated triceps extension | Barra EZ | — |
| 2188 | Extensão de tríceps sentado com halteres | dumbbell seated triceps extension | Haltere | — |
| 1718 | Extensão de tríceps sentado com pegada fechada atrás da cabeça com barra | barbell seated close grip behind neck triceps extension | Barra | — |
| 1738 | Extensão de tríceps sentado com pegada invertida unilateral acima da cabeça com halteres | dumbbell seated reverse grip one arm overhead tricep extension | Haltere | — |
| 1737 | Extensão de tríceps sentado com tronco inclinado com halteres | dumbbell seated bent over triceps extension | Haltere | — |
| 1746 | Extensão de tríceps supino na bola suíça | exercise ball supine triceps extension | Haltere | — |
| 0362 | Extensão de tríceps unilateral (no banco) com halteres | dumbbell one arm triceps extension (on bench) | Haltere | — |
| 0337 | Extensão deitado (cruzado face) com halteres | dumbbell lying extension (across face) | Haltere | — |
| 1729 | Extensão deitado alternado com halteres | dumbbell lying alternate extension | Haltere | — |
| 0057 | Extensão deitado com barra | barbell lying extension | Barra | — |
| 1735 | Extensão deitado unilateral com halteres | dumbbell lying single extension | Haltere | single-dumbbell-skullcrusher |
| 0423 | Extensão em pé unilateral com halteres | dumbbell standing one arm extension | Haltere | single-arm-dumbbell-tricep-extension |
| 1733 | Extensão inclinado dois braço com halteres | dumbbell incline two arm extension | Haltere | — |
| 0259 | Flexão de braços com pegada fechada | close-grip push-up | Peso corporal | — |
| 2398 | Flexão de braços com pegada fechada (ajoelhado) | close-grip push-up (on knees) | Peso corporal | — |
| 1701 | Flexão de braços com pegada fechada com bola medicinal | medicine ball close grip push up | Bola medicinal | — |
| 0975 | Flexão de braços com pegada fechada com faixa elástica | band close-grip push-up | Faixa elástica | — |
| 0660 | Flexão de braços com pegada fechada fora halter | push-up close-grip off dumbbell | Haltere | — |
| 2328 | Flexão de braços fechado no bola suíça | narrow push-up on exercise ball | Bola de estabilidade | — |
| 0490 | Flexão de braços inclinado com pegada fechada | incline close-grip push-up | Peso corporal | — |
| 0717 | Flexão de braços lateral | side push-up | Peso corporal | — |
| 1467 | Flexão de braços no inferior braços | push-up on lower arms | Peso corporal | — |
| 0397 | Flexão de punhos sentado neutro com halteres | dumbbell seated neutral wrist curl | Haltere | — |
| 0365 | Flexão de punhos sobre o banco neutro com halteres | dumbbell over bench neutral wrist curl | Haltere | — |
| 0366 | Flexão de punhos sobre o banco unilateral neutro com halteres | dumbbell over bench one arm neutral wrist curl | Haltere | — |
| 3289 | Impossível mergulhos | impossible dips | Peso corporal | — |
| 2402 | Martelo roscas (com suporte para bíceps) com halteres | dumbbell hammer curls (with arm blaster) | Haltere | — |
| 0830 | Mergulho banco com peso adicional | weighted bench dip | Com carga | — |
| 1399 | Mergulho banco no chão | bench dip on floor | Peso corporal | — |
| 0672 | Mergulho invertido | reverse dip | Peso corporal | — |
| 1744 | Mergulho na bola suíça | exercise ball dip | Bola de estabilidade | — |
| 0812 | Mergulho para tríceps (banco perna) | triceps dip (bench leg) | Peso corporal | — |
| 0813 | Mergulho para tríceps (entre bancos) | triceps dip (between benches) | Peso corporal | — |
| 1767 | Mergulho para tríceps no alto paralelo barras com peso adicional | weighted triceps dip on high parallel bars | Com carga | — |
| 0591 | Mergulho para tríceps pronado na máquina articulada | lever overhand triceps dip | Máquina articulada | — |
| 1451 | Mergulho sentado na máquina articulada | lever seated dip | Máquina articulada | — |
| 1753 | Mergulho três banco | three bench dip | Peso corporal | — |
| 0639 | Mergulho unilateral | one arm dip | Peso corporal | — |
| 3302 | Parada de mãos | handstand | Peso corporal | — |
| 0471 | Parada de mãos flexão de braços | handstand push-up | Peso corporal | handstand-push-up |
| 1751 | Pin desenvolvimentos com barra | barbell pin presses | Barra | — |
| 0204 | Posterior impulso no cabo | cable rear drive | Cabo | — |
| 0232 | Puxada alta em pé (com corda) no cabo | cable standing pulldown (with rope) | Cabo | — |
| 0139 | Puxada bíceps fechado elevações | biceps narrow pull-ups | Peso corporal | — |
| 1637 | Rosca acima da cabeça no bola suíça no cabo | cable overhead curl on exercise ball | Cabo | — |
| 1636 | Rosca acima da cabeça no cabo | cable overhead curl | Cabo | — |
| 1644 | Rosca agachado no cabo | cable squatting curl | Cabo | — |
| 1664 | Rosca alto com halteres | dumbbell high curl | Haltere | — |
| 1632 | Rosca arrasto no cabo | cable drag curl | Cabo | — |
| 0031 | Rosca com barra | barbell curl | Barra | — |
| 0446 | Rosca com pegada fechada com barra W | ez barbell close-grip curl | Barra EZ | — |
| 1630 | Rosca com pegada fechada no cabo | cable close grip curl | Cabo | — |
| 0451 | Rosca com pegada invertida com barra W | ez barbell reverse grip curl | Barra EZ | — |
| 1770 | Rosca concentrada bíceps perna | biceps leg concentration curl | Peso corporal | — |
| 0976 | Rosca concentrada com faixa elástica | band concentration curl | Faixa elástica | — |
| 2414 | Rosca concentrada em pé com barra | barbell standing concentration curl | Barra | — |
| 0418 | Rosca concentrada em pé com halteres | dumbbell standing concentration curl | Haltere | — |
| 0421 | Rosca concentrada em pé unilateral com halteres | dumbbell standing one arm concentration curl | Haltere | — |
| 1682 | Rosca concentrada ez barra sentado com pegada fechada | ez bar seated close grip concentration curl | Barra EZ | — |
| 1631 | Rosca concentrada no cabo | cable concentration curl | Cabo | — |
| 0089 | Rosca concentrada sentado com pegada fechada com barra | barbell seated close-grip concentration curl | Barra | — |
| 0403 | Rosca concentrada sentado invertido pegada com halteres | dumbbell seated revers grip concentration curl | Haltere | — |
| 1642 | Rosca concentrada sentado unilateral no cabo | cable seated one arm concentration curl | Cabo | — |
| 0353 | Rosca concentrada unilateral (na bola suíça) com halteres | dumbbell one arm concentration curl (on stability ball) | Haltere | — |
| 2407 | Rosca de bíceps (com suporte para bíceps) com barra | barbell biceps curl (with arm blaster) | Barra | — |
| 2401 | Rosca de bíceps (com suporte para bíceps) com halteres | dumbbell biceps curl (with arm blaster) | Haltere | — |
| 1655 | Rosca de bíceps agachamento com halteres | dumbbell biceps curl squat | Haltere | — |
| 1660 | Rosca de bíceps ajoelhado bola suíça com halteres | dumbbell kneeling bicep curl exercise ball | Haltere | — |
| 0968 | Rosca de bíceps alternada com faixa elástica | band alternating biceps curl | Faixa elástica | — |
| 2403 | Rosca de bíceps alternado (com suporte para bíceps) com halteres | dumbbell alternate biceps curl (with arm blaster) | Haltere | — |
| 0023 | Rosca de bíceps alternado com barra | barbell alternate biceps curl | Barra | — |
| 0285 | Rosca de bíceps alternado com halteres | dumbbell alternate biceps curl | Haltere | — |
| 1649 | Rosca de bíceps alternado com perna elevado no bola suíça com halteres | dumbbell alternating bicep curl with leg raised on exercise ball | Haltere | — |
| 1650 | Rosca de bíceps alternado sentado no bola suíça com halteres | dumbbell alternating seated bicep curl on exercise ball | Haltere | — |
| 1651 | Rosca de bíceps avanço com boliche movimento com halteres | dumbbell bicep curl lunge with bowling motion | Haltere | — |
| 1658 | Rosca de bíceps avanço com com halteres | dumbbell lunge with bicep curl | Haltere | — |
| 1653 | Rosca de bíceps com cegonha base com halteres | dumbbell bicep curl with stork stance | Haltere | — |
| 1634 | Rosca de bíceps deitado no cabo | cable lying bicep curl | Cabo | — |
| 1661 | Rosca de bíceps deitado supino com halteres | dumbbell lying supine biceps curl | Haltere | — |
| 0416 | Rosca de bíceps em pé com halteres | dumbbell standing biceps curl | Haltere | — |
| 1629 | Rosca de bíceps em pé com pegada aberta com barra | barbell standing wide grip biceps curl | Barra | — |
| 2741 | Rosca de bíceps em pé com pegada aberta com barra W | ez-barbell standing wide grip biceps curl | Barra EZ | — |
| 2321 | Rosca de bíceps em pé interno versão 2 com halteres | dumbbell standing inner biceps curl v. 2 | Haltere | — |
| 2404 | Rosca de bíceps ez barra (com suporte para bíceps) | ez-bar biceps curl (with arm blaster) | Barra EZ | — |
| 5201 | Rosca de bíceps garçom com halteres | dumbbell waiter biceps curl | Haltere | — |
| 0315 | Rosca de bíceps inclinado com halteres | dumbbell incline biceps curl | Haltere | — |
| 0322 | Rosca de bíceps inclinado interno com halteres | dumbbell incline inner biceps curl | Haltere | — |
| 1654 | Rosca de bíceps invertido com halteres | dumbbell biceps curl reverse | Haltere | — |
| 0382 | Rosca de bíceps invertido pegada com halteres | dumbbell revers grip biceps curl | Haltere | — |
| 1769 | Rosca de bíceps lateral deitado com peso corporal | bodyweight side lying biceps curl | Peso corporal | — |
| 0575 | Rosca de bíceps na máquina articulada | lever bicep curl | Máquina articulada | — |
| 1683 | Rosca de bíceps no aparelho Smith | smith machine bicep curl | Máquina Smith | — |
| 1652 | Rosca de bíceps no bola suíça com perna elevado com halteres | dumbbell bicep curl on exercise ball with leg raised | Haltere | — |
| 1684 | Rosca de bíceps passo acima unilateral equilíbrio com com halteres | dumbbell step up single leg balance with bicep curl | Haltere | — |
| 1638 | Rosca de bíceps puxada alta no cabo | cable pulldown bicep curl | Cabo | — |
| 0390 | Rosca de bíceps sentado (na bola suíça) com halteres | dumbbell seated biceps curl (on stability ball) | Haltere | — |
| 0847 | Rosca de bíceps sentado (na bola suíça) com peso adicional | weighted seated bicep curl (on stability ball) | Bola medicinal | — |
| 3123 | Rosca de bíceps sentado com faixa elástica | resistance band seated biceps curl | Faixa de resistência | — |
| 1677 | Rosca de bíceps sentado com halteres | dumbbell seated bicep curl | Haltere | — |
| 0393 | Rosca de bíceps sentado interno com halteres | dumbbell seated inner biceps curl | Haltere | — |
| 1679 | Rosca de bíceps sentado unilateral no bola suíça com perna elevado com halteres | dumbbell seated one arm bicep curl on exercise ball with leg raised | Haltere | — |
| 0986 | Rosca de bíceps unilateral acima da cabeça com faixa elástica | band one arm overhead biceps curl | Faixa elástica | — |
| 1668 | Rosca de bíceps unilateral sentado no bola suíça com halteres | dumbbell one arm seated bicep curl on exercise ball | Haltere | — |
| 1656 | Rosca de bíceps v sentado no bosu bola com halteres | dumbbell biceps curl v sit on bosu ball | Haltere | — |
| 1662 | Rosca deitado aberto com halteres | dumbbell lying wide curl | Haltere | — |
| 0182 | Rosca deitado com pegada fechada no cabo | cable lying close-grip curl | Cabo | — |
| 0350 | Rosca deitado supino com halteres | dumbbell lying supine curl | Haltere | — |
| 1645 | Rosca dois braço no banco inclinado no cabo | cable two arm curl on incline bench | Cabo | — |
| 0113 | Rosca em pé com pegada aberta com barra | barbell standing wide-grip curl | Barra | — |
| 0106 | Rosca em pé com pegada fechada com barra | barbell standing close grip curl | Barra | — |
| 0110 | Rosca em pé com pegada invertida com barra | barbell standing reverse grip curl | Barra | — |
| 0853 | Rosca em pé com peso adicional | weighted standing curl | Com carga | — |
| 0229 | Rosca em pé interno no cabo | cable standing inner curl | Cabo | — |
| 0429 | Rosca em pé invertido com halteres | dumbbell standing reverse curl | Haltere | — |
| 0422 | Rosca em pé unilateral (sobre banco inclinado) com halteres | dumbbell standing one arm curl (over incline bench) | Haltere | — |
| 0425 | Rosca em pé unilateral invertido com halteres | dumbbell standing one arm reverse curl | Haltere | — |
| 1680 | Rosca em pé unilateral sobre banco inclinado com halteres | dumbbell standing one arm curl over incline bench | Haltere | — |
| 0317 | Rosca inclinado versão 2 com halteres | dumbbell incline curl v. 2 | Haltere | — |
| 0206 | Rosca invertido no cabo | cable reverse curl | Cabo | — |
| 1675 | Rosca invertido spider com halteres | dumbbell reverse spider curl | Haltere | — |
| 1413 | Rosca invertido unilateral no cabo | cable reverse one arm curl | Cabo | — |
| 1648 | Rosca martelo alternado sentado com halteres | dumbbell alternate seated hammer curl | Haltere | — |
| 0298 | Rosca martelo cruzado corpo com halteres | dumbbell cross body hammer curl | Haltere | — |
| 1657 | Rosca martelo cruzado corpo versão 2 com halteres | dumbbell cross body hammer curl v. 2 | Haltere | — |
| 3560 | Rosca martelo em pé alternado e desenvolvimento com halteres | dumbbell standing alternate hammer curl and press | Haltere | — |
| 0320 | Rosca martelo inclinado com halteres | dumbbell incline hammer curl | Haltere | — |
| 1659 | Rosca martelo no bola suíça com halteres | dumbbell hammer curl on exercise ball | Haltere | — |
| 0636 | Rosca martelo olímpico barra | olympic barbell hammer curl | Barra olímpica | — |
| 1674 | Rosca martelo pronado inclinado com halteres | dumbbell prone incline hammer curl | Haltere | — |
| 0370 | Rosca martelo Scott com halteres | dumbbell peacher hammer curl | Haltere | — |
| 1676 | Rosca martelo sentado alternado no bola suíça com halteres | dumbbell seated alternate hammer curl on exercise ball | Haltere | — |
| 1678 | Rosca martelo sentado com halteres | dumbbell seated hammer curl | Haltere | — |
| 1671 | Rosca martelo unilateral em pé com halteres | dumbbell one arm standing hammer curl | Haltere | — |
| 1666 | Rosca martelo unilateral pronado com halteres | dumbbell one arm prone hammer curl | Haltere | — |
| 1669 | Rosca martelo unilateral sentado com halteres | dumbbell one arm seated hammer curl | Haltere | — |
| 0312 | Rosca martelo versão 2 com halteres | dumbbell hammer curl v. 2 | Haltere | — |
| 0072 | Rosca pronado inclinado com barra | barbell prone incline curl | Barra | — |
| 0374 | Rosca pronado inclinado com halteres | dumbbell prone incline curl | Haltere | — |
| 1647 | Rosca Scott alternado com halteres | dumbbell alternate preacher curl | Haltere | — |
| 1646 | Rosca Scott alternado martelo com halteres | dumbbell alternate hammer preacher curl | Haltere | — |
| 0070 | Rosca Scott com barra | barbell preacher curl | Barra | — |
| 0372 | Rosca Scott com halteres | dumbbell preacher curl | Haltere | — |
| 1627 | Rosca Scott com pegada fechada com barra W | ez barbell close grip preacher curl | Barra EZ | — |
| 0452 | Rosca Scott com pegada invertida com barra W | ez barbell reverse grip preacher curl | Barra EZ | — |
| 1616 | Rosca Scott com pegada invertida na máquina articulada | lever reverse grip preacher curl | Máquina articulada | — |
| 1639 | Rosca Scott corda martelo no cabo | cable rope hammer preacher curl | Cabo | — |
| 1640 | Rosca Scott corda unilateral martelo no cabo | cable rope one arm hammer preacher curl | Cabo | — |
| 0059 | Rosca Scott deitado com barra | barbell lying preacher curl | Barra | — |
| 0428 | Rosca Scott em pé com halteres | dumbbell standing preacher curl | Haltere | — |
| 2293 | Rosca Scott em pé zottman com halteres | dumbbell standing zottman preacher curl | Haltere | — |
| 0081 | Rosca Scott invertido com barra | barbell reverse preacher curl | Barra | — |
| 0384 | Rosca Scott invertido com halteres | dumbbell reverse preacher curl | Haltere | — |
| 0209 | Rosca Scott invertido no cabo | cable reverse preacher curl | Cabo | — |
| 1615 | Rosca Scott martelo pegada na máquina articulada | lever hammer grip preacher curl | Máquina articulada | — |
| 0195 | Rosca Scott no cabo | cable preacher curl | Cabo | — |
| 0402 | Rosca Scott sentado com halteres | dumbbell seated preacher curl | Haltere | — |
| 1673 | Rosca Scott sobre bola suíça com halteres | dumbbell preacher curl over exercise ball | Haltere | — |
| 1414 | Rosca Scott unilateral invertido com halteres | dumbbell one arm reverse preacher curl | Haltere | — |
| 1635 | Rosca Scott unilateral invertido no cabo | cable one arm reverse preacher curl | Cabo | — |
| 1663 | Rosca Scott unilateral martelo com halteres | dumbbell one arm hammer preacher curl | Haltere | — |
| 1633 | Rosca Scott unilateral no cabo | cable one arm preacher curl | Cabo | — |
| 1672 | Rosca Scott unilateral zottman com halteres | dumbbell one arm zottman preacher curl | Haltere | — |
| 1614 | Rosca Scott versão 2 na máquina articulada | lever preacher curl v. 2 | Máquina articulada | — |
| 2294 | Rosca Scott zottman com halteres | dumbbell zottman preacher curl | Haltere | — |
| 1643 | Rosca sentado acima da cabeça no cabo | cable seated overhead curl | Cabo | — |
| 0391 | Rosca sentado com halteres | dumbbell seated curl | Haltere | — |
| 1641 | Rosca sentado no cabo | cable seated curl | Cabo | — |
| 0454 | Rosca spider com barra W | ez barbell spider curl | Barra EZ | — |
| 1628 | Rosca spider com barra W | ez barbell spider curl | Barra EZ | — |
| 1670 | Rosca unilateral em pé com halteres | dumbbell one arm standing curl | Haltere | — |
| 1667 | Rosca unilateral invertido spider com halteres | dumbbell one arm reverse spider curl | Haltere | — |
| 0190 | Rosca unilateral no cabo | cable one arm curl | Cabo | — |
| 1665 | Rosca unilateral pronado com halteres | dumbbell one arm prone curl | Haltere | — |
| 0439 | Rosca zottman com halteres | dumbbell zottman curl | Haltere | — |
| 1458 | Sentado roscas com barra W | ez barbell seated curls | Barra EZ | — |
| 0751 | Supino com pegada fechada no aparelho Smith | smith close-grip bench press | Máquina Smith | — |
| 0352 | Supino com pegada neutra com halteres | dumbbell neutral grip bench press | Haltere | — |
| 1743 | Supino com rotação com halteres | dumbbell twisting bench press | Haltere | — |
| 1625 | Supino declinado com pegada fechada no aparelho Smith | smith machine decline close grip bench press | Máquina Smith | — |
| 2432 | Supino ez barra com pegada fechada | ez-bar close-grip bench press | Barra EZ | — |
| 1719 | Supino inclinado com pegada fechada com barra | barbell incline close grip bench press | Barra | — |
| 2187 | Supino invertido com pegada fechada com barra | barbell reverse close-grip bench press | Barra | — |
| 0052 | Supino jm com barra | barbell jm bench press | Barra | — |
| 0450 | Supino jm com barra W | ez barbell jm bench press | Barra EZ | — |
| 1623 | Supino palmas em inclinado com halteres | dumbbell palms in incline bench press | Haltere | — |
| 1750 | Supino peitoral arremesso com bola medicinal | medicine ball supine chest throw | Bola medicinal | — |
| 1754 | Três banco mergulhos com peso adicional | weighted three bench dips | Com carga | — |
| 0815 | Tríceps mergulhos no chão | triceps dips floor | Peso corporal | — |

### Cardio — 22 pendentes

| ID | Nome no aplicativo (PT-BR) | Nome original (EN) | Equipamento | Slug reservado |
| --- | --- | --- | --- | --- |
| 3222 | Agachamento semi salto (masculino) | semi squat jump (male) | Peso corporal | — |
| 3655 | Avanço caminhando com elevação dos joelhos | walking high knees lunge | Peso corporal | — |
| 3318 | Balanço 360 | swing 360 | Peso corporal | — |
| 2331 | Bicicleta cruzado treinador | cycle cross trainer | Máquina articulada | — |
| 1201 | Burpee com halteres | dumbbell burpee | Haltere | — |
| 2141 | Caminhada elíptico cruzado treinador | walk elliptical cross trainer | Elíptica | elliptical |
| 3666 | Caminhando no inclinado esteira | walking on incline treadmill | Máquina articulada | — |
| 0685 | Corrida | run | Peso corporal | — |
| 0684 | Corrida (equipamento) | run (equipment) | Peso corporal | — |
| 3656 | Corrida curto passada | short stride run | Peso corporal | — |
| 3637 | Deslocamento com roda abdominal | wheel run | Peso corporal | — |
| 3638 | Empurrada até corrida | push to run | Peso corporal | — |
| 3636 | Joelhos altos contra a parede | high knee against wall | Peso corporal | — |
| 3221 | Meio joelho flexões (masculino) | half knee bends (male) | Peso corporal | — |
| 0798 | Parado bicicleta caminhada | stationary bike walk | Máquina articulada | — |
| 3671 | Passo do esquiador | ski step | Peso corporal | — |
| 3672 | Passos para frente e para trás | back and forth step | Peso corporal | — |
| 3361 | Patinador saltos | skater hops | Peso corporal | skater-hop |
| 0501 | Polichinelo burpee | jack burpee | Peso corporal | — |
| 3223 | Salto estrela (masculino) | star jump (male) | Peso corporal | — |
| 3220 | Saltos com pernas afastadas (masculino) | astride jumps (male) | Peso corporal | — |
| 3219 | Tesoura saltos (masculino) | scissor jumps (male) | Peso corporal | — |

### Costas — 182 pendentes

| ID | Nome no aplicativo (PT-BR) | Nome original (EN) | Equipamento | Slug reservado |
| --- | --- | --- | --- | --- |
| 1338 | Abraço na bola suíça | exercise ball hug | Bola de estabilidade | — |
| 1354 | Acima da cabeça arremesso ao chão com bola medicinal | medicine ball overhead slam | Bola medicinal | — |
| 1717 | Agachamento remada (com corda) no cabo | cable squat row (with rope attachment) | Cabo | — |
| 1346 | Alongamento ajoelhado dorsal | kneeling lat stretch | Peso corporal | — |
| 1363 | Alongamento coluna | spine stretch | Peso corporal | — |
| 1405 | Alongamento de costas e peitoral | back pec stretch | Peso corporal | — |
| 1342 | Alongamento deitado lateral dorsal na bola suíça | exercise ball lying side lat stretch | Bola de estabilidade | — |
| 1339 | Alongamento dorsal na bola suíça | exercise ball lat stretch | Bola de estabilidade | — |
| 0794 | Alongamento em pé lateral | standing lateral stretch | Peso corporal | — |
| 1358 | Alongamento lateral deitado no chão | side lying floor stretch | Peso corporal | — |
| 1365 | Alongamento parte superior das costas | upper back stretch | Peso corporal | — |
| 1341 | Alongamento região lombar (pirâmide) na bola suíça | exercise ball lower back stretch (pyramid) | Bola de estabilidade | — |
| 2208 | Alongamento rolo costas | roller back stretch | Rolo | — |
| 2207 | Alongamento rolo lateral dorsal | roller side lat stretch | Rolo | — |
| 0690 | Alongamento sentado região lombar | seated lower back stretch | Peso corporal | — |
| 1332 | Alternado braço elevações na bola suíça | exercise ball alternating arm ups | Bola de estabilidade | — |
| 3297 | Back lever | back lever | Peso corporal | — |
| 0015 | Barra fixa assistida com pegada paralela fechada | assisted parallel close grip pull-up | Máquina articulada | — |
| 1432 | Barra fixa assistida em pé | assisted standing pull-up | Máquina articulada | — |
| 0970 | Barra fixa assistida por faixa elástica | band assisted pull-up | Faixa elástica | — |
| 1429 | Barra fixa com pegada aberta | wide grip pull-up | Peso corporal | — |
| 1367 | Barra fixa com pegada aberta posterior | wide grip rear pull-up | Peso corporal | — |
| 0674 | Barra fixa com pegada invertida | reverse grip pull-up | Peso corporal | — |
| 3293 | Barra fixa do arqueiro | archer pull up | Peso corporal | — |
| 1763 | Barra fixa ombro pegada | shoulder grip pull-up | Peso corporal | — |
| 0670 | Barra fixa posterior | rear pull-up | Peso corporal | — |
| 1326 | Barra fixa supinada | chin-up | Peso corporal | chin-up |
| 1431 | Barra fixa supinada assistida em pé | assisted standing chin-up | Máquina articulada | — |
| 1327 | Barra fixa supinada com pegada fechada | close grip chin-up | Peso corporal | — |
| 2987 | Barra fixa supinada com pegada fechada no mergulho gaiola com peso adicional | weighted close grip chin-up on dip cage | Com carga | — |
| 0627 | Barra fixa supinada misto pegada | mixed grip chin-up | Peso corporal | — |
| 0638 | Barra fixa supinada unilateral | one arm chin-up | Peso corporal | — |
| 3290 | Barra fixa unilateral com peso adicional | weighted one hand pull up | Com carga | — |
| 0253 | Chin elevações (fechado com pegada paralela) | chin-ups (narrow parallel grip) | Peso corporal | — |
| 0680 | Corda escalada | rope climb | Corda | — |
| 1320 | Cruzamento corda sentado remada no cabo | cable rope crossover seated row | Cabo | — |
| 3231 | Dois toque nos pés (masculino) | two toe touch (male) | Peso corporal | — |
| 1343 | Elevação de pernas pronado na bola suíça | exercise ball prone leg raise | Bola de estabilidade | — |
| 3541 | Elevação inclinado y com halteres | dumbbell incline y-raise | Haltere | — |
| 3292 | Elevador | elevator | Peso corporal | — |
| 3669 | Em pé arqueiro | standing archer | Peso corporal | — |
| 1364 | Em pé pélvica inclinação | standing pelvic tilt | Peso corporal | — |
| 1018 | Encolhimento com faixa elástica | band shrug | Faixa elástica | — |
| 0746 | Encolhimento costas no aparelho Smith | smith back shrug | Máquina Smith | — |
| 0305 | Encolhimento declinado com halteres | dumbbell decline shrug | Haltere | — |
| 0304 | Encolhimento declinado versão 2 com halteres | dumbbell decline shrug v. 2 | Haltere | — |
| 0329 | Encolhimento inclinado com halteres | dumbbell incline shrug | Haltere | — |
| 0604 | Encolhimento na máquina articulada | lever shrug | Máquina articulada | — |
| 0767 | Encolhimento no aparelho Smith | smith shrug | Máquina Smith | — |
| 0220 | Encolhimento no cabo | cable shrug | Cabo | — |
| 0580 | Encolhimento sem pegada na máquina articulada | lever gripless shrug | Máquina articulada | — |
| 1439 | Encolhimento sem pegada versão 2 na máquina articulada | lever gripless shrug v. 2 | Máquina articulada | — |
| 3012 | Escápula mergulhos | scapula dips | Peso corporal | — |
| 1362 | Esfinge | sphinx | Peso corporal | — |
| 1322 | Extensão corda banco inclinado remada no cabo | cable rope extension incline bench row | Cabo | — |
| 1333 | Extensão costas com braços estendido na bola suíça | exercise ball back extension with arms extended | Bola de estabilidade | — |
| 1335 | Extensão costas com joelhos fora chão na bola suíça | exercise ball back extension with knees off ground | Bola de estabilidade | — |
| 1334 | Extensão costas com mãos atrás cabeça na bola suíça | exercise ball back extension with hands behind head | Bola de estabilidade | — |
| 1336 | Extensão costas com rotação na bola suíça | exercise ball back extension with rotation | Bola de estabilidade | — |
| 0573 | Extensão costas na máquina articulada | lever back extension | Máquina articulada | — |
| 0184 | Extensão deitado pulôver (com corda) no cabo | cable lying extension pullover (with rope attachment) | Cabo | — |
| 1314 | Extensão lombar na bola suíça | back extension on exercise ball | Bola de estabilidade | — |
| 1772 | Flexão de braços invertida com apoio nos cotovelos | elbow lift - reverse push-up | Peso corporal | — |
| 3295 | Frontal alavanca repetições | front lever reps | Peso corporal | — |
| 0466 | Gironda esterno chin | gironda sternum chin | Peso corporal | — |
| 0835 | Hiperextensão (na bola suíça) com peso adicional | weighted hyperextension (on stability ball) | Com carga | — |
| 0488 | Hiperextensão (no banco) | hyperextension (on bench) | Peso corporal | — |
| 0172 | Inclinado tríceps na polia no cabo | cable incline pushdown | Cabo | — |
| 0720 | Lateral até lateral chin | side-to-side chin | Peso corporal | — |
| 1010 | Levantamento terra com pernas estendidas com faixa elástica | band straight leg deadlift | Faixa elástica | — |
| 0609 | Londres ponte | london bridge | Corda | — |
| 0631 | Muscle-up | muscle up | Peso corporal | — |
| 3312 | Muscle-up (no barra) com peso adicional | weighted muscle up (on bar) | Com carga | — |
| 1401 | Muscle-up (no vertical barra) | muscle-up (on vertical bar) | Peso corporal | — |
| 0558 | Muscle-up com balanço | kipping muscle up | Peso corporal | — |
| 3286 | Muscle-up com peso adicional | weighted muscle up | Com carga | — |
| 1366 | Para cima voltado cachorro | upward facing dog | Peso corporal | — |
| 3304 | Pele o gato | skin the cat | Peso corporal | — |
| 3664 | Prancha lateral com posterior crucifixo com halteres | dumbbell side plank with rear fly | Haltere | — |
| 0022 | Pulôver até desenvolvimento com barra | barbell pullover to press | Barra | — |
| 0073 | Pulôver com barra | barbell pullover | Barra | — |
| 1316 | Pulôver com braços flexionados com barra | barbell bent arm pullover | Barra | — |
| 0034 | Pulôver declinado com braços flexionados com barra | barbell decline bent arm pullover | Barra | — |
| 0037 | Pulôver declinado com pegada aberta com barra | barbell decline wide-grip pullover | Barra | — |
| 3010 | Pulôver ez barra deitado com braços flexionados | ez bar lying bent arms pullover | Barra EZ | — |
| 2285 | Pulôver na máquina articulada | lever pullover | Máquina articulada | — |
| 0983 | Puxada alta ajoelhado unilateral com faixa elástica | band kneeling one arm pulldown | Faixa elástica | — |
| 2330 | Puxada alta com amplitude completa no cabo | cable lat pulldown full range of motion | Cabo | — |
| 0237 | Puxada alta com braços estendidos (com corda) no cabo | cable straight arm pulldown (with rope) | Cabo | — |
| 3117 | Puxada alta com costas apoiadas, pegada fechada e faixa elástica | band fixed back close grip pulldown | Faixa elástica | — |
| 1325 | Puxada alta com pegada aberta posterior atrás da cabeça no cabo | cable wide grip rear pulldown behind neck | Cabo | — |
| 0974 | Puxada alta com pegada fechada com faixa elástica | band close-grip pulldown | Faixa elástica | — |
| 0673 | Puxada alta com pegada invertida máquina | reverse grip machine lat pulldown | Máquina articulada | — |
| 0579 | Puxada alta frontal na máquina articulada | lever front pulldown | Máquina articulada | — |
| 0205 | Puxada alta posterior no cabo | cable rear pulldown | Cabo | — |
| 0678 | Puxada alta rocky barra fixa | rocky pull-up pulldown | Peso corporal | — |
| 3116 | Puxada alta supinada com costas apoiadas e faixa elástica | band fixed back underhand pulldown | Faixa elástica | — |
| 1013 | Puxada alta supinado com faixa elástica | band underhand pulldown | Faixa elástica | — |
| 0245 | Puxada alta supinado no cabo | cable underhand pulldown | Cabo | — |
| 1347 | Puxada alta unilateral lateral aberto na máquina articulada | lever one arm lateral wide pulldown | Máquina articulada | — |
| 3563 | Puxada alta unilateral no cabo | cable one arm pulldown | Cabo | — |
| 3019 | Puxada banco elevações | bench pull-ups | Peso corporal | — |
| 0244 | Puxada com rotação no cabo | cable twisting pull | Cabo | — |
| 0177 | Puxada lateral (com corda) no cabo | cable lateral pulldown (with rope attachment) | Cabo | — |
| 0007 | Puxada lateral alternada | alternate lateral pulldown | Cabo | — |
| 2736 | Puxada lateral com pegada invertida na máquina articulada | lever reverse grip lateral pulldown | Máquina articulada | — |
| 2616 | Puxada lateral com v barra no cabo | cable lateral pulldown with v-bar | Cabo | — |
| 0153 | Puxada lateral cruzado sobre no cabo | cable cross-over lateral pulldown | Cabo | — |
| 0150 | Puxada lateral na polia com barra | cable bar lateral pulldown | Cabo | — |
| 0548 | Puxada sumô alto com kettlebell | kettlebell sumo high pull | Kettlebell | — |
| 1353 | Recepção e acima da cabeça arremesso com bola medicinal | medicine ball catch and overhead throw | Bola medicinal | — |
| 3168 | Remada agachado com peso corporal | bodyweight squatting row | Peso corporal | — |
| 0167 | Remada alta (ajoelhado) no cabo | cable high row (kneeling) | Cabo | — |
| 0581 | Remada alta na máquina articulada | lever high row | Máquina articulada | — |
| 0208 | Remada alta sentada, com costas retas e pegada invertida, na polia | cable reverse-grip straight back seated high row | Cabo | — |
| 0213 | Remada alta sentado (v barra) no cabo | cable seated high row (v-bar) | Cabo | — |
| 0193 | Remada alta unilateral estendido costas (ajoelhado) no cabo | cable one arm straight back high row (kneeling) | Cabo | — |
| 1356 | Remada alta unilateral lateral na máquina articulada | lever one arm lateral high row | Máquina articulada | — |
| 0522 | Remada alternado com kettlebell | kettlebell alternating row | Kettlebell | — |
| 0571 | Remada alternado fechado pegada sentado na máquina articulada | lever alternating narrow grip seated row | Máquina articulada | — |
| 0521 | Remada alternado renegada com kettlebell | kettlebell alternating renegade row | Kettlebell | — |
| 0180 | Remada baixo sentado no cabo | cable low seated row | Cabo | — |
| 1318 | Remada banco inclinado no cabo | cable incline bench row | Cabo | — |
| 3167 | Remada com agachamento e toalha usando o peso corporal | bodyweight squatting row (with towel) | Peso corporal | — |
| 2327 | Remada com pegada invertida (feminino) com halteres | dumbbell reverse grip row (female) | Haltere | — |
| 1317 | Remada com pegada invertida banco inclinado com barra | barbell reverse grip incline bench row | Barra | — |
| 1331 | Remada com pegada invertida banco inclinado dois braço com halteres | dumbbell reverse grip incline bench two arm row | Haltere | — |
| 1330 | Remada com pegada invertida banco inclinado unilateral com halteres | dumbbell reverse grip incline bench one arm row | Haltere | — |
| 1321 | Remada corda elevado sentado no cabo | cable rope elevated seated row | Cabo | — |
| 1323 | Remada corda sentado no cabo | cable rope seated row | Cabo | — |
| 0248 | Remada curvada barra deitado | cambered bar lying row | Barra | — |
| 0118 | Remada curvada com pegada invertida com barra | barbell reverse grip bent over row | Barra | — |
| 1361 | Remada curvada com pegada invertida no aparelho Smith | smith reverse grip bent over row | Máquina Smith | — |
| 3200 | Remada curvada com v barra na máquina articulada | lever bent-over row with v-bar | Máquina articulada | — |
| 1344 | Remada curvada ez barra com pegada invertida | ez bar reverse grip bent over row | Barra EZ | — |
| 0574 | Remada curvada na máquina articulada | lever bent over row | Barra | — |
| 1359 | Remada curvada no aparelho Smith | smith bent over row | Máquina Smith | — |
| 1329 | Remada curvada palma rotacional com halteres | dumbbell palm rotational bent over row | Haltere | — |
| 0064 | Remada curvada unilateral com barra | barbell one arm bent over row | Barra | — |
| 0589 | Remada curvada unilateral na máquina articulada | lever one arm bent over row | Barra | — |
| 0189 | Remada curvada unilateral no cabo | cable one arm bent over row | Cabo | single-arm-cable-row |
| 0159 | Remada declinado sentado com pegada aberta no cabo | cable decline seated wide-grip row | Cabo | — |
| 1328 | Remada deitado deltoide posterior com halteres | dumbbell lying rear delt row | Haltere | — |
| 1345 | Remada dois braço com kettlebell | kettlebell two arm row | Kettlebell | — |
| 0234 | Remada em pé (v barra) no cabo | cable standing row (v-bar) | Cabo | — |
| 3158 | Remada em pé com pegada fechada com peso corporal | bodyweight standing close-grip row | Peso corporal | — |
| 3156 | Remada em pé com pegada fechada unilateral com peso corporal | bodyweight standing close-grip one arm row | Peso corporal | — |
| 3166 | Remada em pé com peso corporal | bodyweight standing row | Peso corporal | — |
| 3161 | Remada em pé unilateral (com toalha) com peso corporal | bodyweight standing one arm row (with towel) | Peso corporal | — |
| 3162 | Remada em pé unilateral com peso corporal | bodyweight standing one arm row | Peso corporal | — |
| 0239 | Remada estendido costas sentado no cabo | cable straight back seated row | Cabo | — |
| 0761 | Remada fechado no aparelho Smith | smith narrow row | Máquina Smith | — |
| 0588 | Remada fechado pegada sentado na máquina articulada | lever narrow grip seated row | Máquina articulada | — |
| 0049 | Remada inclinado com barra | barbell incline row | Barra | — |
| 0327 | Remada inclinado com halteres | dumbbell incline row | Haltere | — |
| 0499 | Remada invertido | inverted row | Peso corporal | inverted-row |
| 0498 | Remada invertido com faixas | inverted row with straps | Peso corporal | — |
| 2300 | Remada invertido flexionado joelhos | inverted row bent knees | Peso corporal | — |
| 2298 | Remada invertido no banco | inverted row on bench | Peso corporal | — |
| 1349 | Remada invertido t barra na máquina articulada | lever reverse t-bar row | Máquina articulada | — |
| 0497 | Remada invertido versão 2 | inverted row v. 2 | Peso corporal | — |
| 0160 | Remada no chão sentado com pegada aberta no cabo | cable floor seated wide-grip row | Cabo | — |
| 1319 | Remada palma rotacional no cabo | cable palm rotational row | Cabo | — |
| 0218 | Remada sentado com pegada aberta no cabo | cable seated wide-grip row | Cabo | — |
| 3144 | Remada sentado estendido costas com faixa elástica | resistance band seated straight back row | Faixa de resistência | — |
| 1350 | Remada sentado na máquina articulada | lever seated row | Máquina articulada | machine-row |
| 0214 | Remada sentado unilateral alternado no cabo | cable seated one arm alternate row | Cabo | — |
| 1324 | Remada superior no cabo | cable upper row | Cabo | — |
| 0808 | Remada suspenso | suspended row | Peso corporal | — |
| 1351 | Remada t barra com pegada invertida na máquina articulada | lever t-bar reverse grip row | Máquina articulada | — |
| 2464 | Remada thibaudeau caiaque no cabo | cable thibaudeau kayak row | Cabo | — |
| 0541 | Remada unilateral com kettlebell | kettlebell one arm row | Kettlebell | — |
| 0990 | Remada unilateral com rotação sentado com faixa elástica | band one arm twisting seated row | Faixa elástica | — |
| 1773 | Remada unilateral com toalha | one arm towel row | Peso corporal | — |
| 0988 | Remada unilateral em pé baixo com faixa elástica | band one arm standing low row | Faixa elástica | — |
| 1313 | Remada unilateral na máquina articulada | lever unilateral row | Máquina articulada | — |
| 1360 | Remada unilateral no aparelho Smith | smith one arm row | Máquina Smith | — |
| 1348 | Remada vertical com pegada invertida na máquina articulada | lever reverse grip vertical row | Máquina articulada | — |
| 1352 | Rosca região lombar | lower back curl | Peso corporal | — |
| 0236 | Rotação em pé remada (v barra) no cabo | cable standing twist row (v-bar) | Cabo | — |
| 0199 | Tríceps na polia (com braços estendidos) versão 2 no cabo | cable pushdown (straight arm) v. 2 | Cabo | — |
| 1355 | Unilateral contra parede | one arm against wall | Peso corporal | — |

### Ombros — 128 pendentes

| ID | Nome no aplicativo (PT-BR) | Nome original (EN) | Equipamento | Slug reservado |
| --- | --- | --- | --- | --- |
| 3305 | Agachamento com desenvolvimento com barra | barbell thruster | Barra | — |
| 0550 | Agachamento com desenvolvimento com kettlebell | kettlebell thruster | Kettlebell | — |
| 3641 | Ajoelhado passo com balanço com peso adicional | weighted kneeling step with swing | Com carga | — |
| 0529 | Arranco duplo com kettlebell | kettlebell double snatch | Kettlebell | — |
| 0067 | Arranco unilateral com barra | barbell one arm snatch | Barra | — |
| 0542 | Arranco unilateral com kettlebell | kettlebell one arm snatch | Kettlebell | — |
| 0844 | Circular braço com peso adicional | weighted round arm | Com carga | — |
| 0128 | Cordas navais | battling ropes | Corda | — |
| 0154 | Crucifixo cruzado sobre invertido no cabo | cable cross-over revers fly | Cabo | — |
| 0993 | Crucifixo inverso com faixa elástica | band reverse fly | Faixa elástica | — |
| 0383 | Crucifixo inverso com halteres | dumbbell reverse fly | Haltere | — |
| 0386 | Crucifixo inverso rotação com halteres | dumbbell rotation reverse fly | Haltere | — |
| 0601 | Crucifixo inverso sentado (com pegada paralela) na máquina articulada | lever seated reverse fly (parallel grip) | Máquina articulada | — |
| 0602 | Crucifixo inverso sentado na máquina articulada | lever seated reverse fly | Máquina articulada | reverse-pec-deck |
| 0240 | Crucifixo inverso supino no cabo | cable supine reverse fly | Cabo | — |
| 0359 | Crucifixo inverso unilateral (com apoio) com halteres | dumbbell one arm reverse fly (with support) | Haltere | — |
| 0341 | Deitado unilateral deltoide posterior com halteres | dumbbell lying one arm deltoid rear | Haltere | — |
| 0520 | Desenvolvimento alternado com kettlebell | kettlebell alternating press | Kettlebell | — |
| 0286 | Desenvolvimento alternado lateral com halteres | dumbbell alternate side press | Haltere | — |
| 0445 | Desenvolvimento anti gravidade com barra W | ez barbell anti gravity press | Barra EZ | — |
| 0523 | Desenvolvimento arnold com kettlebell | kettlebell arnold press | Kettlebell | — |
| 0287 | Desenvolvimento arnold versão 2 com halteres | dumbbell arnold press v. 2 | Haltere | — |
| 0747 | Desenvolvimento atrás da cabeça no aparelho Smith | smith behind neck press | Máquina Smith | — |
| 0290 | Desenvolvimento banco sentado com halteres | dumbbell bench seated press | Haltere | — |
| 1012 | Desenvolvimento com rotação acima da cabeça com faixa elástica | band twisting overhead press | Faixa elástica | — |
| 0299 | Desenvolvimento cuban com halteres | dumbbell cuban press | Haltere | — |
| 2136 | Desenvolvimento cuban versão 2 com halteres | dumbbell cuban press v. 2 | Haltere | — |
| 0148 | Desenvolvimento de ombros alternado no cabo | cable alternate shoulder press | Cabo | — |
| 0997 | Desenvolvimento de ombros com faixa elástica | band shoulder press | Faixa elástica | — |
| 0766 | Desenvolvimento de ombros no aparelho Smith | smith shoulder press | Máquina Smith | — |
| 0219 | Desenvolvimento de ombros no cabo | cable shoulder press | Cabo | — |
| 0404 | Desenvolvimento de ombros sentado (com pegada paralela) com halteres | dumbbell seated shoulder press (parallel grip) | Haltere | — |
| 3122 | Desenvolvimento de ombros sentado com faixa elástica | resistance band seated shoulder press | Faixa de resistência | — |
| 0765 | Desenvolvimento de ombros sentado no aparelho Smith | smith seated shoulder press | Máquina Smith | — |
| 0361 | Desenvolvimento de ombros unilateral com halteres | dumbbell one arm shoulder press | Haltere | — |
| 0590 | Desenvolvimento de ombros unilateral na máquina articulada | lever one arm shoulder press | Máquina articulada | — |
| 0360 | Desenvolvimento de ombros unilateral versão 2 com halteres | dumbbell one arm shoulder press v. 2 | Haltere | — |
| 0869 | Desenvolvimento de ombros versão 2 na máquina articulada | lever shoulder press v. 2 | Máquina articulada | — |
| 2318 | Desenvolvimento de ombros versão 3 na máquina articulada | lever shoulder press v. 3 | Máquina articulada | — |
| 0528 | Desenvolvimento duplo empurrada com kettlebell | kettlebell double push press | Kettlebell | — |
| 0426 | Desenvolvimento em pé acima da cabeça com halteres | dumbbell standing overhead press | Haltere | standing-dumbbell-press |
| 0414 | Desenvolvimento em pé alternado acima da cabeça com halteres | dumbbell standing alternate overhead press | Haltere | — |
| 0788 | Desenvolvimento em pé atrás da cabeça | standing behind neck press | Barra | — |
| 0105 | Desenvolvimento em pé bradford com barra | barbell standing bradford press | Barra | — |
| 0427 | Desenvolvimento em pé palmas em com halteres | dumbbell standing palms in press | Haltere | — |
| 0424 | Desenvolvimento em pé unilateral palma em com halteres | dumbbell standing one arm palm in press | Haltere | — |
| 1700 | Desenvolvimento empurrada com halteres | dumbbell push press | Haltere | — |
| 0547 | Desenvolvimento gangorra com kettlebell | kettlebell seesaw press | Kettlebell | — |
| 0553 | Desenvolvimento militar dois braço com kettlebell | kettlebell two arm military press | Kettlebell | — |
| 0772 | Desenvolvimento militar em pé atrás cabeça no aparelho Smith | smith standing behind head military press | Máquina Smith | — |
| 1456 | Desenvolvimento militar em pé com pegada fechada com barra | barbell standing close grip military press | Barra | — |
| 0774 | Desenvolvimento militar em pé no aparelho Smith | smith standing military press | Máquina Smith | — |
| 0587 | Desenvolvimento militar na máquina articulada | lever military press | Máquina articulada | — |
| 0086 | Desenvolvimento militar sentado atrás cabeça com barra | barbell seated behind head military press | Barra | — |
| 1438 | Desenvolvimento militar sentado dois braço com kettlebell | kettlebell seated two arm military press | Kettlebell | — |
| 0539 | Desenvolvimento militar unilateral até o lateral com kettlebell | kettlebell one arm military press to the side | Kettlebell | — |
| 2397 | Desenvolvimento scott com halteres | dumbbell scott press | Haltere | — |
| 0091 | Desenvolvimento sentado acima da cabeça com barra | barbell seated overhead press | Barra | — |
| 0388 | Desenvolvimento sentado alternado com halteres | dumbbell seated alternate press | Haltere | — |
| 0087 | Desenvolvimento sentado bradford rocky com barra | barbell seated bradford rocky press | Barra | — |
| 0546 | Desenvolvimento sentado com kettlebell | kettlebell seated press | Kettlebell | — |
| 0540 | Desenvolvimento unilateral empurrada com kettlebell | kettlebell one arm push press | Kettlebell | — |
| 0438 | Desenvolvimento W com halteres | dumbbell w-press | Haltere | — |
| 0552 | Dois braço clean com kettlebell | kettlebell two arm clean | Kettlebell | — |
| 0527 | Duplo jerk com kettlebell | kettlebell double jerk | Kettlebell | — |
| 0376 | Elevação com halteres | dumbbell raise | Haltere | — |
| 2470 | Elevação deitado no chão deltoide posterior com halteres | dumbbell lying on floor rear delt raise | Haltere | — |
| 0075 | Elevação deltoide posterior com barra | barbell rear delt raise | Barra | — |
| 0415 | Elevação em pé alternado com halteres | dumbbell standing alternate raise | Haltere | — |
| 3542 | Elevação em T inclinada com halteres | dumbbell incline t-raise | Haltere | — |
| 0041 | Elevação frontal com barra | barbell front raise | Barra | — |
| 0978 | Elevação frontal com faixa elástica | band front raise | Faixa elástica | — |
| 0419 | Elevação frontal em pé acima cabeça com halteres | dumbbell standing front raise above head | Haltere | — |
| 0107 | Elevação frontal em pé sobre cabeça com barra | barbell standing front raise over head | Barra | — |
| 0335 | Elevação frontal lateral até com halteres | dumbbell lateral to front raise | Haltere | — |
| 0164 | Elevação frontal ombro no cabo | cable front shoulder raise | Cabo | — |
| 0387 | Elevação frontal sentado alternado com halteres | dumbbell seated alternate front raise | Haltere | — |
| 0392 | Elevação frontal sentado com halteres | dumbbell seated front raise | Haltere | — |
| 0309 | Elevação frontal versão 2 com halteres | dumbbell front raise v. 2 | Haltere | — |
| 0325 | Elevação inclinado com halteres | dumbbell incline raise | Haltere | — |
| 0977 | Elevação lateral à frente com faixa elástica | band front lateral raise | Faixa elástica | — |
| 0311 | Elevação lateral completo can com halteres | dumbbell full can lateral raise | Haltere | — |
| 0348 | Elevação lateral deitado posterior com halteres | dumbbell lying rear lateral raise | Haltere | — |
| 0408 | Elevação lateral deitado unilateral com halteres | dumbbell side lying one hand raise | Haltere | — |
| 0345 | Elevação lateral deitado unilateral posterior com halteres | dumbbell lying one arm rear lateral raise | Haltere | — |
| 0326 | Elevação lateral inclinado posterior com halteres | dumbbell incline rear lateral raise | Haltere | — |
| 0323 | Elevação lateral inclinado unilateral com halteres | dumbbell incline one arm lateral raise | Haltere | — |
| 3237 | Elevação lateral landmine | landmine lateral raise | Barra | — |
| 0379 | Elevação lateral posterior (com apoio cabeça) com halteres | dumbbell rear lateral raise (support head) | Haltere | — |
| 0380 | Elevação lateral posterior com halteres | dumbbell rear lateral raise | Haltere | — |
| 2317 | Elevação lateral sentado com braços flexionados com halteres | dumbbell seated bent arm lateral raise | Haltere | — |
| 0396 | Elevação lateral sentado com halteres | dumbbell seated lateral raise | Haltere | — |
| 0215 | Elevação lateral sentado posterior no cabo | cable seated rear lateral raise | Cabo | — |
| 0395 | Elevação lateral sentado versão 2 com halteres | dumbbell seated lateral raise v. 2 | Haltere | — |
| 0356 | Elevação lateral unilateral com apoio com halteres | dumbbell one arm lateral raise with support | Haltere | — |
| 0355 | Elevação lateral unilateral com halteres | dumbbell one arm lateral raise | Haltere | — |
| 0192 | Elevação lateral unilateral no cabo | cable one arm lateral raise | Cabo | — |
| 0161 | Elevação para a frente no cabo | cable forward raise | Cabo | — |
| 1017 | Elevação y com faixa elástica | band y-raise | Faixa elástica | — |
| 2143 | Em pé ao redor mundo com halteres | dumbbell standing around world | Haltere | — |
| 2271 | Esquerdo gancho. boxe | left hook. boxing | Peso corporal | — |
| 0100 | Esquiador com barra | barbell skier | Barra | — |
| 0332 | Ferro cruzado com halteres | dumbbell iron cross | Haltere | — |
| 0543 | Pirata superior pernas com kettlebell | kettlebell pirate supper legs | Kettlebell | — |
| 3697 | Remada ajoelhado deltoide posterior (com corda) (masculino) no cabo | cable kneeling rear delt row (with rope) (male) | Cabo | — |
| 1765 | Remada alta (costas pov) com halteres | dumbbell upright row (back pov) | Haltere | — |
| 0437 | Remada alta com halteres | dumbbell upright row | Haltere | — |
| 0123 | Remada alta com pegada aberta com barra | barbell wide-grip upright row | Barra | — |
| 0775 | Remada alta no aparelho Smith | smith upright row | Máquina Smith | — |
| 0246 | Remada alta no cabo | cable upright row | Cabo | — |
| 0363 | Remada alta unilateral com halteres | dumbbell one arm upright row | Haltere | — |
| 0119 | Remada alta versão 2 com barra | barbell upright row v. 2 | Barra | — |
| 0121 | Remada alta versão 3 com barra | barbell upright row v. 3 | Barra | — |
| 0377 | Remada deltoide posterior _ombro com halteres | dumbbell rear delt row_shoulder | Haltere | — |
| 0202 | Remada deltoide posterior (alças) no cabo | cable rear delt row (stirrups) | Cabo | — |
| 0203 | Remada deltoide posterior (com corda) no cabo | cable rear delt row (with rope) | Cabo | — |
| 0076 | Remada deltoide posterior com barra | barbell rear delt row | Barra | — |
| 0762 | Remada deltoide posterior no aparelho Smith | smith rear delt row | Máquina Smith | — |
| 0233 | Remada em pé deltoide posterior (com corda) no cabo | cable standing rear delt row (with rope) | Cabo | — |
| 1022 | Remada em pé deltoide posterior com faixa elástica | band standing rear delt row | Faixa elástica | — |
| 0863 | Rotação deitado externa ombro com halteres | dumbbell lying external shoulder rotation | Haltere | — |
| 0235 | Rotação em pé ombro externa no cabo | cable standing shoulder external rotation | Cabo | — |
| 0216 | Rotação sentado ombro interna no cabo | cable seated shoulder internal rotation | Cabo | — |
| 0864 | Rotação vertical ombro externa com halteres | dumbbell upright shoulder external rotation | Haltere | — |
| 3546 | Sentado alternado ombro com halteres | dumbbell seated alternate shoulder | Haltere | — |
| 3548 | Unilateral acima da cabeça caminhada com halteres | dumbbell single arm overhead carry | Haltere | — |
| 0537 | Unilateral clean e jerk com kettlebell | kettlebell one arm clean and jerk | Kettlebell | — |
| 0538 | Unilateral jerk com kettlebell | kettlebell one arm jerk | Kettlebell | — |

### Panturrilhas — 52 pendentes

| ID | Nome no aplicativo (PT-BR) | Nome original (EN) | Equipamento | Slug reservado |
| --- | --- | --- | --- | --- |
| 1708 | Alongamento assistido de panturrilhas deitado | assisted lying calves stretch | Assistido | — |
| 0257 | Alongamento círculos joelho | circles knee stretch | Peso corporal | — |
| 1378 | Alongamento de panturrilhas com corda | calf stretch with rope | Corda | — |
| 1398 | Alongamento de panturrilhas em pé panturrilhas | standing calves calf stretch | Peso corporal | — |
| 1390 | Alongamento de panturrilhas sentado (masculino) | seated calf stretch (male) | Peso corporal | — |
| 1388 | Alongamento fibulares | peroneals stretch | Corda | — |
| 1407 | Alongamento panturrilha empurrada com mãos contra parede | calf push stretch with hands against wall | Peso corporal | — |
| 1389 | Alongamento posterior tibial | posterior tibialis stretch | Corda | — |
| 1368 | Círculos com os tornozelos | ankle circles | Peso corporal | — |
| 0738 | Elevação de panturrilhas 45° no trenó | sled 45в° calf press | Trenó | — |
| 0284 | Elevação de panturrilhas coice | donkey calf raise | Peso corporal | — |
| 0833 | Elevação de panturrilhas coice com peso adicional | weighted donkey calf raise | Com carga | — |
| 2334 | Elevação de panturrilhas deitado no trenó | sled lying calf press | Trenó | — |
| 1369 | Elevação de panturrilhas dois pernas - (faixa elástica sob ambos pernas) versão 2 com faixa elástica | band two legs calf raise - (band under both legs) v. 2 | Faixa elástica | — |
| 1490 | Elevação de panturrilhas em pé (no um escada) | standing calf raise (on a staircase) | Peso corporal | — |
| 0111 | Elevação de panturrilhas em pé com balanço perna com barra | barbell standing rocking leg calf raise | Barra | — |
| 1372 | Elevação de panturrilhas em pé com barra | barbell standing calf raise | Barra | — |
| 0417 | Elevação de panturrilhas em pé com halteres | dumbbell standing calf raise | Haltere | — |
| 1375 | Elevação de panturrilhas em pé no cabo | cable standing calf raise | Cabo | — |
| 0108 | Elevação de panturrilhas em pé perna com barra | barbell standing leg calf raise | Barra | — |
| 0773 | Elevação de panturrilhas em pé perna no aparelho Smith | smith standing leg calf raise | Máquina Smith | — |
| 1376 | Elevação de panturrilhas em pé unilateral no cabo | cable standing one leg calf raise | Cabo | — |
| 1383 | Elevação de panturrilhas hack | hack calf raise | Trenó | — |
| 1384 | Elevação de panturrilhas hack unilateral | hack one leg calf raise | Trenó | — |
| 2289 | Elevação de panturrilhas na máquina articulada | lever calf press | Máquina articulada | — |
| 3240 | Elevação de panturrilhas na parede (bola de tênis entre joelhos) na bola suíça | exercise ball on the wall calf raise (tennis ball between knees) | Haltere | — |
| 3241 | Elevação de panturrilhas na parede (bola de tênis entre tornozelos) na bola suíça | exercise ball on the wall calf raise (tennis ball between ankles) | Haltere | — |
| 1382 | Elevação de panturrilhas na parede na bola suíça | exercise ball on the wall calf raise | Haltere | — |
| 1370 | Elevação de panturrilhas no chão com barra | barbell floor calf raise | Barra | — |
| 1391 | Elevação de panturrilhas no perna desenvolvimento no trenó | sled calf press on leg press | Trenó | — |
| 0742 | Elevação de panturrilhas para a frente angulado no trenó | sled forward angled calf raise | Trenó | — |
| 0088 | Elevação de panturrilhas sentado com barra | barbell seated calf raise | Barra | — |
| 1371 | Elevação de panturrilhas sentado com barra | barbell seated calf raise | Barra | — |
| 1379 | Elevação de panturrilhas sentado com halteres | dumbbell seated calf raise | Haltere | — |
| 2335 | Elevação de panturrilhas sentado na máquina articulada | lever seated calf press | Máquina articulada | — |
| 1380 | Elevação de panturrilhas sentado unilateral - martelo pegada com halteres | dumbbell seated one leg calf raise - hammer grip | Haltere | — |
| 1381 | Elevação de panturrilhas sentado unilateral - palma acima com halteres | dumbbell seated one leg calf raise - palm up | Haltere | — |
| 0400 | Elevação de panturrilhas sentado unilateral com halteres | dumbbell seated one leg calf raise | Haltere | — |
| 1395 | Elevação de panturrilhas sentado unilateral no aparelho Smith | smith seated one leg calf raise | Máquina Smith | — |
| 0727 | Elevação de panturrilhas unilateral (no um halter) | single leg calf raise (on a dumbbell) | Haltere | — |
| 1386 | Elevação de panturrilhas unilateral coice | one leg donkey calf raise | Peso corporal | — |
| 0999 | Elevação de panturrilhas unilateral com faixa elástica | band single leg calf raise | Faixa elástica | — |
| 0409 | Elevação de panturrilhas unilateral com halteres | dumbbell single leg calf raise | Haltere | — |
| 1000 | Elevação de panturrilhas unilateral invertido com faixa elástica | band single leg reverse calf raise | Faixa elástica | — |
| 1393 | Elevação de panturrilhas unilateral no chão no aparelho Smith | smith one leg floor calf raise | Máquina Smith | — |
| 1392 | Elevação de panturrilhas unilateral no perna desenvolvimento no trenó | sled one leg calf press on leg press | Trenó | — |
| 1396 | Elevação dedos dos pés no aparelho Smith | smith toe raise | Máquina Smith | — |
| 1397 | Em pé panturrilhas | standing calves | Peso corporal | — |
| 0763 | Invertido panturrilha elevações no aparelho Smith | smith reverse calf raises | Máquina Smith | — |
| 1394 | Invertido panturrilha elevações no aparelho Smith | smith reverse calf raises | Máquina Smith | — |
| 2315 | Rotatório panturrilha na máquina articulada | lever rotary calf | Máquina articulada | — |
| 1374 | Salto caixa para baixo com unilateral estabilização | box jump down with one leg stabilization | Peso corporal | — |

### Peito — 144 pendentes

| ID | Nome no aplicativo (PT-BR) | Nome original (EN) | Equipamento | Slug reservado |
| --- | --- | --- | --- | --- |
| 1716 | Alongamento assistido do peitoral maior sentado com bola suíça | assisted seated pectoralis major stretch with stability ball | Assistido | — |
| 1259 | Alongamento atrás cabeça peitoral | behind head chest stretch | Assistido | — |
| 1167 | Alongamento dinâmico peitoral (masculino) | dynamic chest stretch (male) | Peso corporal | — |
| 1272 | Alongamento peitoral com bola suíça | chest stretch with exercise ball | Bola de estabilidade | — |
| 1271 | Alongamento peitoral e frontal de ombro | chest and front of shoulder stretch | Peso corporal | — |
| 3288 | Coreano mergulhos | korean dips | Peso corporal | — |
| 0179 | Crucifixo baixo no cabo | cable low fly | Cabo | — |
| 0302 | Crucifixo declinado com halteres | dumbbell decline fly | Haltere | — |
| 0158 | Crucifixo declinado no cabo | cable decline fly | Cabo | — |
| 1276 | Crucifixo declinado unilateral com halteres | dumbbell decline one arm fly | Haltere | — |
| 0185 | Crucifixo deitado no cabo | cable lying fly | Cabo | — |
| 3234 | Crucifixo hyght halter | hyght dumbbell fly | Haltere | — |
| 0170 | Crucifixo inclinado (na bola suíça) no cabo | cable incline fly (on stability ball) | Cabo | — |
| 0319 | Crucifixo inclinado com halteres | dumbbell incline fly | Haltere | — |
| 1278 | Crucifixo inclinado no bola suíça com halteres | dumbbell incline fly on exercise ball | Haltere | — |
| 1279 | Crucifixo inclinado unilateral com halteres | dumbbell incline one arm fly | Haltere | — |
| 1280 | Crucifixo inclinado unilateral no bola suíça com halteres | dumbbell incline one arm fly on exercise ball | Haltere | — |
| 0188 | Crucifixo médio no cabo | cable middle fly | Cabo | — |
| 1277 | Crucifixo no bola suíça com halteres | dumbbell fly on exercise ball | Haltere | — |
| 0458 | Crucifixo no chão (com barra) | floor fly (with barbell) | Barra | — |
| 0596 | Crucifixo sentado na máquina articulada | lever seated fly | Máquina articulada | — |
| 1285 | Crucifixo unilateral banco com halteres | dumbbell one arm bench fly | Haltere | — |
| 1262 | Crucifixo unilateral declinado peitoral no cabo | cable one arm decline chest fly | Cabo | — |
| 1264 | Crucifixo unilateral inclinado no bola suíça no cabo | cable one arm incline fly on exercise ball | Cabo | — |
| 1288 | Crucifixo unilateral no bola suíça com halteres | dumbbell one arm fly on exercise ball | Haltere | — |
| 1292 | Crucifixo unilateral no bola suíça com halteres | dumbbell one leg fly on exercise ball | Haltere | — |
| 1263 | Crucifixo unilateral no bola suíça no cabo | cable one arm fly on exercise ball | Cabo | — |
| 1286 | Crucifixo unilateral peitoral no bola suíça com halteres | dumbbell one arm chest fly on exercise ball | Haltere | — |
| 0155 | Cruzado sobre variação no cabo | cable cross-over variation | Cabo | — |
| 0519 | Desenvolvimento alternado no chão com kettlebell | kettlebell alternating press on floor | Kettlebell | — |
| 0764 | Desenvolvimento com pegada invertida no aparelho Smith | smith reverse-grip press | Máquina Smith | — |
| 0036 | Desenvolvimento declinado com pegada aberta com barra | barbell decline wide-grip press | Barra | — |
| 0754 | Desenvolvimento declinado com pegada invertida no aparelho Smith | smith decline reverse-grip press | Máquina Smith | — |
| 0303 | Desenvolvimento declinado martelo com halteres | dumbbell decline hammer press | Haltere | — |
| 1261 | Desenvolvimento declinado no cabo | cable decline press | Cabo | — |
| 1260 | Desenvolvimento declinado unilateral no cabo | cable decline one arm press | Cabo | — |
| 0340 | Desenvolvimento deitado martelo com halteres | dumbbell lying hammer press | Haltere | — |
| 0343 | Desenvolvimento deitado unilateral com halteres | dumbbell lying one arm press | Haltere | — |
| 0342 | Desenvolvimento deitado unilateral versão 2 com halteres | dumbbell lying one arm press v. 2 | Haltere | — |
| 0531 | Desenvolvimento estendido amplitude unilateral no chão com kettlebell | kettlebell extended range one arm press on floor | Kettlebell | — |
| 3545 | Desenvolvimento inclinado alternado com halteres | dumbbell incline alternate press | Haltere | — |
| 0758 | Desenvolvimento inclinado com pegada invertida no aparelho Smith | smith incline reverse-grip press | Máquina Smith | — |
| 1283 | Desenvolvimento inclinado no bola suíça com halteres | dumbbell incline press on exercise ball | Haltere | — |
| 0324 | Desenvolvimento inclinado palma em com halteres | dumbbell incline palm-in press | Haltere | — |
| 1281 | Desenvolvimento inclinado unilateral com halteres | dumbbell incline one arm press | Haltere | — |
| 1282 | Desenvolvimento inclinado unilateral no bola suíça com halteres | dumbbell incline one arm press on exercise ball | Haltere | — |
| 1293 | Desenvolvimento no bola suíça com halteres | dumbbell press on exercise ball | Haltere | — |
| 1268 | Desenvolvimento no bola suíça no cabo | cable press on exercise ball | Cabo | — |
| 0856 | Desenvolvimento svend com peso adicional | weighted svend press | Com carga | — |
| 1622 | Desenvolvimento unilateral com pegada invertida com halteres | dumbbell one arm reverse grip press | Haltere | — |
| 1266 | Desenvolvimento unilateral inclinado no bola suíça no cabo | cable one arm incline press on exercise ball | Cabo | — |
| 1290 | Desenvolvimento unilateral no bola suíça com halteres | dumbbell one arm press on exercise ball | Haltere | — |
| 1267 | Desenvolvimento unilateral no bola suíça no cabo | cable one arm press on exercise ball | Cabo | — |
| 1298 | Desenvolvimento unilateral no chão com kettlebell | kettlebell one arm floor press | Kettlebell | — |
| 0040 | Elevação frontal e pulôver com barra | barbell front raise and pullover | Barra | — |
| 0050 | Elevação inclinado ombro com barra | barbell incline shoulder raise | Barra | — |
| 0328 | Elevação inclinado ombro com halteres | dumbbell incline shoulder raise | Haltere | — |
| 1269 | Em pé acima estendido cruzamentos no cabo | cable standing up straight crossovers | Cabo | — |
| 1303 | Empurrada peitoral a partir de 3 pontos base com bola medicinal | medicine ball chest push from 3 point stance | Bola medicinal | — |
| 1312 | Empurrada peitoral com soltura com corrida com bola medicinal | medicine ball chest push with run release | Bola medicinal | — |
| 1304 | Empurrada peitoral reação múltipla com bola medicinal | medicine ball chest push multiple response | Bola medicinal | — |
| 1305 | Empurrada peitoral reação única com bola medicinal | medicine ball chest push single response | Bola medicinal | — |
| 1294 | Extensão pulôver quadril no bola suíça com halteres | dumbbell pullover hip extension on exercise ball | Haltere | — |
| 0653 | Flexão de braços (bosu bola) | push-up (bosu ball) | Bosu | — |
| 0655 | Flexão de braços (na bola suíça) | push-up (on stability ball) | Bola de estabilidade | — |
| 0656 | Flexão de braços (na bola suíça) | push-up (on stability ball) | Bola de estabilidade | — |
| 0658 | Flexão de braços (parede) versão 2 | push-up (wall) v. 2 | Peso corporal | — |
| 3145 | Flexão de braços adicional | push-up plus | Peso corporal | — |
| 3211 | Flexão de braços ajoelhado (masculino) | kneeling push-up (male) | Peso corporal | knee-push-up |
| 0663 | Flexão de braços com bola medicinal | push-up medicine ball | Bola medicinal | — |
| 3327 | Flexão de braços completo planche | full planche push-up | Peso corporal | — |
| 0666 | Flexão de braços elevação unilateral | raise single arm push-up | Peso corporal | — |
| 3021 | Flexão de braços escápula | scapula push-up | Peso corporal | — |
| 3785 | Flexão de braços inclinado (no caixa) | incline push-up (on box) | Peso corporal | — |
| 3011 | Flexão de braços inclinado escápula | incline scapula push up | Peso corporal | — |
| 0492 | Flexão de braços inclinado profundidade salto | incline push up depth jump | Peso corporal | — |
| 1307 | Flexão de braços no bosu bola | push up on bosu ball | Bosu | — |
| 1273 | Flexão de braços palmas | clap push up | Peso corporal | — |
| 3216 | Flexão de braços peitoral toque (masculino) | chest tap push-up (male) | Peso corporal | — |
| 1296 | Flexão de braços pike na bola suíça | exercise ball pike push up | Bola de estabilidade | — |
| 1306 | Flexão de braços pliométrico | plyo push up | Peso corporal | — |
| 0545 | Flexão de braços pliométrico com kettlebell | kettlebell plyo push-up | Kettlebell | — |
| 1274 | Flexão de braços profundo | deep push up | Haltere | — |
| 1275 | Flexão de braços queda | drop push up | Peso corporal | — |
| 1310 | Flexão de braços queda com peso adicional | weighted drop push up | Com carga | — |
| 0258 | Flexão de braços relógio | clock push-up | Peso corporal | — |
| 0803 | Flexão de braços super-homem | superman push-up | Peso corporal | — |
| 0806 | Flexão de braços suspenso | suspended push-up | Peso corporal | — |
| 0725 | Flexão de braços unilateral | single arm push-up | Peso corporal | — |
| 3217 | Flexão hindu modificada (masculino) | modified hindu push-up (male) | Peso corporal | — |
| 0494 | Flexão inclinada com pegada invertida | incline reverse grip push-up | Peso corporal | — |
| 0316 | Inclinado abertura com halteres | dumbbell incline breeding | Haltere | — |
| 0759 | Inclinado ombro elevações no aparelho Smith | smith incline shoulder raises | Máquina Smith | — |
| 0331 | Inclinado torcido crucifixos com halteres | dumbbell incline twisted flyes | Haltere | — |
| 0500 | Isométrico limpadores | isometric wipers | Peso corporal | — |
| 1297 | Isométrico peitoral contração | isometric chest squeeze | Peso corporal | — |
| 2139 | Mãos bicicleta | hands bike | Ergômetro de braços | — |
| 3313 | Mergulho estendido barra com peso adicional | weighted straight bar dip | Com carga | — |
| 1430 | Mergulho para peitoral (no mergulho barra fixa gaiola) | chest dip (on dip-pull-up cage) | Peso corporal | — |
| 0009 | Mergulho para peitoral assistido (ajoelhado) | assisted chest dip (kneeling) | Máquina articulada | — |
| 2364 | Mergulho para peitoral assistido, com pegada aberta (ajoelhado) | assisted wide-grip chest dip (kneeling) | Máquina articulada | — |
| 2363 | Mergulho para peitoral com pegada aberta no alto paralelo barras | wide-grip chest dip on high parallel bars | Peso corporal | — |
| 2462 | Mergulho para peitoral no estendido barra | chest dip on straight bar | Peso corporal | — |
| 2203 | Mobilização dos ombros sentado com rolo | roller seated shoulder flexor depresor retractor | Rolo | — |
| 1302 | Passe de peito com bola medicinal | medicine ball chest pass | Bola medicinal | — |
| 0288 | Pulôver ao redor com halteres | dumbbell around pullover | Haltere | — |
| 0433 | Pulôver com braços estendidos com halteres | dumbbell straight arm pullover | Haltere | — |
| 0375 | Pulôver com halteres | dumbbell pullover | Haltere | — |
| 1255 | Pulôver declinado com barra | barbell decline pullover | Barra | — |
| 1284 | Pulôver deitado no bola suíça com halteres | dumbbell lying pullover on exercise ball | Haltere | — |
| 1295 | Pulôver no bola suíça com halteres | dumbbell pullover on exercise ball | Haltere | — |
| 1291 | Pulôver unilateral no bola suíça com halteres | dumbbell one arm pullover on exercise ball | Haltere | — |
| 1689 | Puxada empurrada e peso corporal | push and pull bodyweight | Peso corporal | — |
| 2209 | Rolo sentado unilateral ombro flexor depressor retrator | roller seated single leg shoulder flexor depresor retractor | Rolo | — |
| 0307 | Rotação declinado crucifixo com halteres | dumbbell decline twist fly | Haltere | — |
| 1270 | Superior peitoral cruzamentos no cabo | cable upper chest crossovers | Cabo | — |
| 0122 | Supino aberto com barra | barbell wide bench press | Barra | — |
| 1258 | Supino aberto com pegada invertida com barra | barbell wide reverse grip bench press | Barra | — |
| 1254 | Supino com faixa elástica | band bench press | Faixa elástica | — |
| 1309 | Supino com pegada aberta declinado no aparelho Smith | smith wide grip decline bench press | Máquina Smith | — |
| 1308 | Supino com pegada aberta no aparelho Smith | smith wide grip bench press | Máquina Smith | — |
| 1256 | Supino com pegada invertida declinado com barra | barbell reverse grip decline bench press | Barra | — |
| 1257 | Supino com pegada invertida inclinado com barra | barbell reverse grip incline bench press | Barra | — |
| 1300 | Supino declinado na máquina articulada | lever decline chest press | Máquina articulada | — |
| 0753 | Supino declinado no aparelho Smith | smith decline bench press | Máquina Smith | — |
| 3758 | Supino em pé na máquina articulada | lever standing chest press | Máquina articulada | — |
| 0045 | Supino guilhotina com barra | barbell guillotine bench press | Barra | — |
| 0321 | Supino inclinado com pegada neutra e halteres | dumbbell incline hammer press | Haltere | — |
| 1299 | Supino inclinado na máquina articulada | lever incline chest press | Máquina articulada | — |
| 0757 | Supino inclinado no aparelho Smith | smith incline bench press | Máquina Smith | — |
| 0169 | Supino inclinado no cabo | cable incline bench press | Cabo | — |
| 1265 | Supino inclinado unilateral no cabo | cable one arm incline press | Cabo | — |
| 1479 | Supino inclinado versão 2 na máquina articulada | lever incline chest press v. 2 | Máquina articulada | — |
| 1624 | Supino invertido com halteres | dumbbell reverse bench press | Haltere | — |
| 1626 | Supino invertido declinado com pegada fechada no aparelho Smith | smith machine reverse decline close grip bench press | Máquina Smith | — |
| 1301 | Supino máquina interno | machine inner chest press | Máquina articulada | — |
| 0576 | Supino na máquina articulada | lever chest press | Máquina articulada | — |
| 0151 | Supino no cabo | cable bench press | Cabo | — |
| 3124 | Supino sentado com faixa elástica | resistance band seated chest press | Faixa de resistência | — |
| 2144 | Supino sentado no cabo | cable seated chest press | Cabo | — |
| 0989 | Supino unilateral com rotação com faixa elástica | band one arm twisting chest press | Faixa elástica | — |
| 1287 | Supino unilateral declinado com halteres | dumbbell one arm decline chest press | Haltere | — |
| 1289 | Supino unilateral inclinado com halteres | dumbbell one arm incline chest press | Haltere | — |
| 0191 | Unilateral lateral com tronco inclinado no cabo | cable one arm lateral bent-over | Cabo | — |

### Pernas — 185 pendentes

| ID | Nome no aplicativo (PT-BR) | Nome original (EN) | Equipamento | Slug reservado |
| --- | --- | --- | --- | --- |
| 1418 | Abraço joelhos até peitoral | hug keens to chest | Peso corporal | — |
| 0102 | Agachamento (ajoelhado) com barra | barbell squat (on knees) | Barra | — |
| 0124 | Agachamento aberto com barra | barbell wide squat | Barra | — |
| 0069 | Agachamento acima da cabeça com barra | barbell overhead squat | Barra | — |
| 1436 | Agachamento alto barra com barra | barbell high bar squat | Barra | — |
| 1685 | Agachamento até acima da cabeça alcance | squat to overhead reach | Peso corporal | — |
| 1686 | Agachamento até acima da cabeça alcance com rotação | squat to overhead reach with twist | Peso corporal | — |
| 1435 | Agachamento baixo barra com barra | barbell low bar squat | Barra | — |
| 1434 | Agachamento baixo barra no aparelho Smith | smith low bar squat | Máquina Smith | — |
| 0026 | Agachamento banco com barra | barbell bench squat | Barra | — |
| 0291 | Agachamento banco com halteres | dumbbell bench squat | Haltere | — |
| 0098 | Agachamento búlgaro lateral com barra | barbell side split squat | Barra | — |
| 0097 | Agachamento búlgaro lateral versão 2 com barra | barbell side split squat v. 2 | Barra | — |
| 2812 | Agachamento búlgaro passo acima com halteres | dumbbell step-up split squat | Haltere | — |
| 0809 | Agachamento búlgaro suspenso | suspended split squat | Peso corporal | — |
| 0099 | Agachamento búlgaro unilateral com barra | barbell single leg split squat | Barra | — |
| 1001 | Agachamento búlgaro unilateral com faixa elástica | band single leg split squat | Faixa elástica | — |
| 0987 | Agachamento búlgaro unilateral unilateral com faixa elástica | band one arm single leg split squat | Faixa elástica | — |
| 2810 | Agachamento búlgaro versão 2 com barra | barbell split squat v. 2 | Barra | — |
| 0750 | Agachamento cadeira no aparelho Smith | smith chair squat | Máquina Smith | — |
| 2803 | Agachamento com apoio com halteres | dumbbell supported squat | Haltere | — |
| 0413 | Agachamento com halteres | dumbbell squat | Haltere | — |
| 0852 | Agachamento com peso adicional | weighted squat | Com carga | — |
| 1420 | Agachamento com salto ajoelhado | kneeling jump squat | Barra | — |
| 0053 | Agachamento com salto com barra | barbell jump squat | Barra | — |
| 3543 | Agachamento com salto queda com peso corporal | bodyweight drop jump squat | Peso corporal | — |
| 0513 | Agachamento com salto versão 2 | jump squat v. 2 | Peso corporal | — |
| 1461 | Agachamento completo (costas pov) com barra | barbell full squat (back pov) | Barra | — |
| 1462 | Agachamento completo (lateral pov) com barra | barbell full squat (side pov) | Barra | — |
| 3281 | Agachamento completo no aparelho Smith | smith full squat | Máquina Smith | — |
| 1545 | Agachamento completo zercher com barra | barbell full zercher squat | Barra | — |
| 0744 | Agachamento deitado no trenó | sled lying squat | Trenó | — |
| 0063 | Agachamento fechado base com barra | barbell narrow stance squat | Barra | — |
| 0741 | Agachamento fechado hack no trenó | sled closer hack squat | Trenó | — |
| 3194 | Agachamento frankenstein | frankenstein squat | Barra | — |
| 1433 | Agachamento frontal (clean pegada) no aparelho Smith | smith front squat (clean grip) | Máquina Smith | — |
| 0024 | Agachamento frontal banco com barra | barbell bench front squat | Barra | — |
| 0029 | Agachamento frontal clean pegada com barra | barbell clean-grip front squat | Barra | — |
| 0533 | Agachamento frontal com kettlebell | kettlebell front squat | Kettlebell | — |
| 0039 | Agachamento frontal peitoral com barra | barbell front chest squat | Barra | — |
| 0534 | Agachamento goblet com kettlebell | kettlebell goblet squat | Kettlebell | — |
| 0046 | Agachamento hack com barra | barbell hack squat | Barra | — |
| 0755 | Agachamento hack no aparelho Smith | smith hack squat | Máquina Smith | — |
| 0051 | Agachamento jefferson com barra | barbell jefferson squat | Barra | — |
| 0786 | Agachamento jerk | squat jerk | Barra | — |
| 0551 | Agachamento levantamento turco (estilo) com kettlebell | kettlebell turkish get up (squat style) | Kettlebell | — |
| 0770 | Agachamento no aparelho Smith | smith squat | Máquina Smith | — |
| 1705 | Agachamento no bosu bola | squat on bosu ball | Bosu | — |
| 0544 | Agachamento pistol com kettlebell | kettlebell pistol squat | Kettlebell | — |
| 0371 | Agachamento pliométrico com halteres | dumbbell plyo squat | Haltere | — |
| 3132 | Agachamento profundo com apoio | potty squat with support | Peso corporal | — |
| 1003 | Agachamento remada com faixa elástica | band squat row | Faixa elástica | — |
| 3769 | Agachamento reverência | curtsey squat | Peso corporal | — |
| 2798 | Agachamento salto passo posterior avanço com barra | barbell squat jump step rear lunge | Barra | — |
| 0851 | Agachamento sissy com peso adicional | weighted sissy squat | Com carga | — |
| 3142 | Agachamento sumô no aparelho Smith | smith sumo squat | Máquina Smith | — |
| 1476 | Agachamento unilateral | one leg squat | Peso corporal | — |
| 0068 | Agachamento unilateral com barra | barbell one leg squat | Barra | — |
| 0411 | Agachamento unilateral com halteres | dumbbell single leg squat | Haltere | — |
| 0101 | Agachamento velocidade com barra | barbell speed squat | Barra | — |
| 0127 | Agachamento zercher com barra | barbell zercher squat | Barra | — |
| 2368 | Agachamentos búlgaros | split squats | Peso corporal | — |
| 1712 | Alongamento assistido de adutores deitado de lado | assisted side lying adductor stretch | Assistido | — |
| 1710 | Alongamento assistido de glúteos e piriforme deitado | assisted lying gluteus and piriformis stretch | Assistido | — |
| 1713 | Alongamento assistido de quadríceps em decúbito ventral | assisted prone lying quads stretch | Assistido | — |
| 1548 | Alongamento cadeira perna estendido | chair leg extended stretch | Peso corporal | — |
| 2571 | Alongamento com balanço sapo | rocking frog stretch | Peso corporal | — |
| 1585 | Alongamento corredores | runners stretch | Peso corporal | — |
| 1709 | Alongamento de glúteos assistido deitado | assisted lying glutes stretch | Assistido | — |
| 1599 | Alongamento de panturrilhas em pé posterior de coxa e com faixa | standing hamstring and calf stretch with strap | Corda | — |
| 1576 | Alongamento de posteriores de coxa perna acima | leg up hamstring stretch | Peso corporal | — |
| 1560 | Alongamento de posteriores de coxa sentado na bola suíça | exercise ball seated hamstring stretch | Bola de estabilidade | — |
| 1512 | Alongamento de quadríceps em quatro apoios | all fours squad stretch | Peso corporal | — |
| 0613 | Alongamento deitado (lateral) quadríceps | lying (side) quads stretch | Peso corporal | — |
| 1419 | Alongamento ferro cruzado | iron cross stretch | Peso corporal | — |
| 1564 | Alongamento intermediário quadril flexor e quad | intermediate hip flexor and quad stretch | Corda | — |
| 1559 | Alongamento quadril flexor na bola suíça | exercise ball hip flexor stretch | Bola de estabilidade | — |
| 2202 | Alongamento rolo quadril | roller hip stretch | Rolo | — |
| 2205 | Alongamento rolo quadril dorsal | roller hip lat stretch | Rolo | — |
| 1424 | Alongamento sentado glúteo | seated glute stretch | Peso corporal | — |
| 2567 | Alongamento sentado piriforme | seated piriformis stretch | Peso corporal | — |
| 0776 | Arranco puxada | snatch pull | Barra | — |
| 3888 | Arranco unilateral com halteres | dumbbell one arm snatch | Haltere | — |
| 1460 | Avanço caminhando | walking lunge | Peso corporal | — |
| 3642 | Avanço com alongamento e peso adicional | weighted stretch lunge | Com carga | — |
| 3644 | Avanço com balanço com peso adicional | weighted lunge with swing | Com carga | — |
| 0054 | Avanço com barra | barbell lunge | Barra | — |
| 0336 | Avanço com halteres | dumbbell lunge | Haltere | — |
| 3582 | Avanço com salto | lunge with jump | Peso corporal | — |
| 3635 | Avanço contralateral para a frente com halteres | dumbbell contralateral forward lunge | Haltere | — |
| 0769 | Avanço de velocista no aparelho Smith | smith sprint lunge | Máquina Smith | — |
| 1410 | Avanço lateral com barra | barbell lateral lunge | Barra | — |
| 0536 | Avanço pass através com kettlebell | kettlebell lunge pass through | Kettlebell | — |
| 0078 | Avanço posterior com barra | barbell rear lunge | Barra | — |
| 0077 | Avanço posterior versão 2 com barra | barbell rear lunge v. 2 | Barra | — |
| 2400 | Barra fixa inverso flexão de pernas (no cabo máquina) | inverse leg curl (on pull-up cable machine) | Peso corporal | — |
| 0749 | Bom-dia com joelhos flexionados no aparelho Smith | smith bent knee good morning | Máquina Smith | — |
| 0090 | Bom-dia sentado com barra | barbell seated good morning | Barra | — |
| 3759 | Bom-dia sentado na máquina articulada | lever seated good morning | Máquina articulada | — |
| 0115 | Bom-dia stiff perna com barra | barbell stiff leg good morning | Barra | — |
| 0555 | Chute para fora sentado | kick out sit | Peso corporal | — |
| 0295 | Clean com halteres | dumbbell clean | Haltere | — |
| 1427 | Com pernas estendidas externo quadril abdutor | straight leg outer hip abductor | Peso corporal | — |
| 3643 | Cossaco agachamentos (masculino) com peso adicional | weighted cossack squats (male) | Com carga | — |
| 0028 | Desenvolvimento clean e com barra | barbell clean and press | Barra | — |
| 3193 | Elevação de glúteos e posteriores de coxa | glute-ham raise | Peso corporal | — |
| 0020 | Equilíbrio na prancha | balance board | Peso corporal | — |
| 0130 | Extensão banco quadril | bench hip extension | Peso corporal | — |
| 0675 | Extensão invertido hiper (na bola suíça) | reverse hyper extension (on stability ball) | Bola de estabilidade | — |
| 3007 | Extensão perna com faixa elástica | resistance band leg extension | Faixa de resistência | — |
| 2286 | Extensão quadril versão 2 na máquina articulada | lever hip extension v. 2 | Máquina articulada | — |
| 2133 | Fazendeiro caminhada | farmers walk | Haltere | — |
| 0016 | Flexão assistida de posteriores de coxa em decúbito ventral | assisted prone hamstring | Assistido | — |
| 0642 | Flexão de braços externo perna chute | outside leg kick push-up | Peso corporal | — |
| 0661 | Flexão de braços interno perna chute | push-up inside leg kick | Peso corporal | — |
| 3662 | Flexão de braços pike até cobra | pike-to-cobra push-up | Peso corporal | — |
| 0778 | Flexão de braços spider caminhada | spider crawl push up | Peso corporal | — |
| 0339 | Flexão de pernas deitado com halter | dumbbell lying femoral | Haltere | — |
| 1417 | Flexão de posteriores de coxa unilateral pernas diagonal chute na bola suíça | exercise ball one legged diagonal kick hamstring curl | Bola de estabilidade | — |
| 1423 | Invertido hiper no banco reto | reverse hyper on flat bench | Peso corporal | — |
| 3667 | Lateral deitado quadril adução (masculino) | side lying hip adduction (male) | Peso corporal | — |
| 1774 | Lateral ponte quadril abdução | side bridge hip abduction | Peso corporal | — |
| 1425 | Leg press 45 graus unilateral no trenó | sled 45 degrees one leg press | Trenó | — |
| 1463 | Leg press 45° (lateral pov) no trenó | sled 45° leg press (side pov) | Trenó | — |
| 1464 | Leg press 45° (vista traseira) no trenó | sled 45в° leg press (back pov) | Trenó | — |
| 0740 | Leg press 45° com pernas afastadas no trenó | sled 45в° leg wide press | Trenó | — |
| 2287 | Leg press alternado na máquina articulada | lever alternate leg press | Máquina articulada | — |
| 2611 | Leg press horizontal unilateral na máquina articulada | lever horizontal one leg press | Máquina articulada | — |
| 0760 | Leg press no aparelho Smith | smith leg press | Máquina Smith | — |
| 0300 | Levantamento terra com halteres | dumbbell deadlift | Haltere | — |
| 0116 | Levantamento terra com pernas estendidas com barra | barbell straight leg deadlift | Barra | — |
| 0434 | Levantamento terra com pernas estendidas com halteres | dumbbell straight leg deadlift | Haltere | — |
| 0578 | Levantamento terra na máquina articulada | lever deadlift | Máquina articulada | — |
| 0752 | Levantamento terra no aparelho Smith | smith deadlift | Máquina Smith | — |
| 0157 | Levantamento terra no cabo | cable deadlift | Cabo | — |
| 1009 | Levantamento terra stiff com faixa elástica | band stiff leg deadlift | Faixa elástica | — |
| 0432 | Levantamento terra stiff com halteres | dumbbell stiff leg deadlift | Haltere | — |
| 1023 | Levantamento terra stiff estendido costas com faixa elástica | band straight back stiff leg deadlift | Faixa elástica | — |
| 0117 | Levantamento terra sumô com barra | barbell sumo deadlift | Barra | — |
| 0811 | Levantamento terra trapézio barra | trap bar deadlift | Barra hexagonal | — |
| 1756 | Levantamento terra unilateral com barra | barbell single leg deadlift | Barra | — |
| 2805 | Levantamento terra unilateral com caixa com apoio com halteres | dumbbell single leg deadlift with stepbox support | Haltere | — |
| 0066 | Levantamento terra unilateral lateral com barra | barbell one arm side deadlift | Barra | — |
| 3215 | Mãos invertido unidas circular toque nos pés (masculino) | hands reversed clasped circular toe touch (male) | Peso corporal | — |
| 3218 | Mãos unidas circular toque nos pés (masculino) | hands clasped circular toe touch (male) | Peso corporal | — |
| 0624 | Marcha sentado (parede) | march sit (wall) | Peso corporal | — |
| 0628 | Monstro caminhada | monster walk | Peso corporal | — |
| 3433 | Nadador chutes versão 2 (masculino) | swimmer kicks v. 2 (male) | Peso corporal | — |
| 1422 | Pélvica inclinação para dentro ponte | pelvic tilt into bridge | Peso corporal | — |
| 2459 | Pneu virada | tire flip | Pneu | — |
| 3523 | Ponte de glúteos dois pernas no banco (masculino) | glute bridge two legs on bench (male) | Peso corporal | — |
| 3562 | Ponte de glúteos dois pernas no banco (masculino) com barra | barbell glute bridge two legs on bench (male) | Barra | — |
| 0668 | Posterior declinado ponte | rear decline bridge | Peso corporal | — |
| 0648 | Potência clean | power clean | Barra | — |
| 1775 | Prancha lateral quadril adução | side plank hip adduction | Peso corporal | — |
| 0196 | Pull-through (com corda) no cabo | cable pull through (with rope) | Cabo | cable-pull-through |
| 0991 | Pull-through com faixa elástica | band pull through | Faixa elástica | — |
| 2808 | Pull-through sumô com halteres | dumbbell sumo pull through | Haltere | — |
| 3533 | Quadríceps | quads | Peso corporal | — |
| 3236 | Quadril elevações ajoelhado (feminino) com faixa elástica | resistance band hip thrusts on knees (female) | Faixa de resistência | — |
| 1582 | Reclinado grande dedos dos pés posição com corda | reclining big toe pose with rope | Corda | — |
| 0582 | Rosca ajoelhado perna na máquina articulada | lever kneeling leg curl | Máquina articulada | — |
| 3235 | Rosca assistido inverso perna no cabo | cable assisted inverse leg curl | Cabo | — |
| 0697 | Rosca auto assistido inverso perna | self assisted inverse leg curl | Peso corporal | — |
| 1766 | Rosca auto assistido inverso perna | self assisted inverse leg curl | Peso corporal | — |
| 0696 | Rosca auto assistido inverso perna (no chão) | self assisted inverse leg curl (on floor) | Peso corporal | — |
| 3195 | Rosca deitado dois unilateral na máquina articulada | lever lying two-one leg curl | Máquina articulada | — |
| 0795 | Rosca em pé unilateral | standing single leg curl | Peso corporal | — |
| 0496 | Rosca inverso perna (banco com apoio) | inverse leg curl (bench support) | Peso corporal | — |
| 0599 | Rosca sentado perna na máquina articulada | lever seated leg curl | Máquina articulada | seated-leg-curl |
| 3639 | Rotação com joelhos flexionados deitado (masculino) | bent knee lying twist (male) | Peso corporal | — |
| 0984 | Rotação interna de quadril deitado com faixa elástica | band lying hip internal rotation | Faixa elástica | — |
| 1466 | Rotação quadril elevação | twist hip lift | Peso corporal | — |
| 0996 | Rotação sentado quadril interna com faixa elástica | band seated hip internal rotation | Faixa elástica | — |
| 1416 | Rotação unilateral da parte inferior do corpo em decúbito ventral na bola suíça | exercise ball one leg prone lower body rotation | Bola de estabilidade | — |
| 1472 | Salto para a frente | forward jump | Peso corporal | — |
| 1473 | Salto para trás | backward jump | Peso corporal | — |
| 1587 | Sentado aberto ângulo posição sequência | seated wide angle pose sequence | Peso corporal | — |
| 0598 | Sentado quadril adução na máquina articulada | lever seated hip adduction | Máquina articulada | hip-adduction-machine |
| 2796 | Subida no banco avanço com halteres | dumbbell step-up lunge | Haltere | — |
| 0114 | Subida no banco com barra | barbell step-up | Barra | — |
| 1008 | Subida no banco com faixa elástica | band step-up | Faixa elástica | — |
| 0535 | Suspensão clean com kettlebell | kettlebell hang clean | Kettlebell | — |
| 3214 | Toque circular nos pés com braços afastados (masculino) | arms apart circular toe touch (male) | Peso corporal | — |
| 0730 | Unilateral plataforma deslize | single leg platform slide | Peso corporal | — |

### Pescoço — 2 pendentes

| ID | Nome no aplicativo (PT-BR) | Nome original (EN) | Equipamento | Slug reservado |
| --- | --- | --- | --- | --- |
| 0716 | Alongamento lateral do pescoço com auxílio da mão | side push neck stretch | Peso corporal | — |
| 1403 | Alongamento pescoço lateral | neck side stretch | Peso corporal | — |

