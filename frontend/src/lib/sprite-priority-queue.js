/**
 * Fila Oficial dos 100 Exercícios Prioritários para Criação de Sprites no Fit Pro Player.
 *
 * Selecionados com base em dados públicos de frequência e relevância em academias,
 * excluindo exercícios que já possuem sprites ativos no app (156 ativos).
 *
 * Total imutável: exatamente 100 IDs únicos formatados com 4 dígitos.
 */

export const SPRITE_PRIORITY_CATEGORIES = Object.freeze({
  PEITO: Object.freeze([
    '0757', // smith incline bench press
    '2144', // cable standing fly
    '1299', // cable incline fly
    '1300', // cable incline bench press
    '0596', // leverage chest press
    '0319', // dumbbell incline fly
    '0179', // barbell decline bench press
    '0188', // barbell incline bench press
    '0158', // barbell bench press
    '0169', // barbell wide-grip bench press
    '0321', // dumbbell incline one arm chest press
    '0303', // dumbbell decline fly
  ]),
  COSTAS: Object.freeze([
    '1350', // cable rear pulldown
    '0327', // dumbbell incline row
    '0581', // leverage incline row
    '0588', // leverage reverse grip vertical row
    '0218', // barbell straight leg deadlift
    '0213', // barbell reverse grip bent over row
    '0118', // barbell bent over row
    '1359', // cable seated wide-grip row
    '0189', // barbell incline row
    '1326', // cable one arm seated row
    '0499', // kettlebell one arm row
    '0245', // cable upper row
    '0579', // leverage deadlift
    '3563', // inverted row bent knees
  ]),
  OMBROS: Object.freeze([
    '0426', // dumbbell standing alternate overhead press
    '0091', // barbell rear delt raise
    '0766', // smith overhead shoulder press
    '0404', // dumbbell seated reverse fly
    '0602', // leverage reverse fly
    '0233', // barbell front chest press
    '0355', // dumbbell one arm lateral raise
    '0323', // dumbbell incline rear lateral raise
    '1700', // band standing rear delt row
    '0361', // dumbbell one arm seated overhead press
    '0219', // barbell upright row
  ]),
  BICEPS_E_TRICEPS: Object.freeze([
    '0031', // barbell curl
    '0070', // barbell preacher curl
    '0195', // barbell lying back of the head triceps extension
    '0402', // dumbbell seated preacher curl
    '0298', // dumbbell concentration curl
    '0285', // dumbbell alternate preacher curl
    '0320', // dumbbell incline inner biceps curl
    '0429', // dumbbell standing one arm curl
    '0190', // barbell incline triceps extension
    '0206', // barbell rear decline triceps extension
    '0439', // dumbbell standing alternate vertical extensions
    '0241', // cable triceps pushdown (v-bar)
    '1723', // cable standing reverse grip one arm overhead tricep extension
    '0194', // barbell lying close-grip triceps extension
    '0607', // leverage seated triceps extension
    '0860', // weighted tricep dips
    '0430', // dumbbell standing one arm extension
    '0344', // dumbbell lying triceps extension
    '0423', // dumbbell standing alternate overhead triceps extension
    '1735', // cable supine reverse fly
  ]),
  PERNAS_E_GLUTEOS: Object.freeze([
    '0770', // smith rear lunge
    '0117', // barbell bench squat
    '0811', // weighted round sissy squat
    '0300', // dumbbell counterbalanced squat
    '0413', // dumbbell squat
    '0124', // barbell front chest squat
    '0599', // leverage seated leg curl
    '0598', // leverage seated adduction
    '0582', // leverage leg extension
    '1425', // seated glute stretch
    '2611', // bodyweight drop jump squat
    '0336', // dumbbell lunge
    '0054', // barbell lateral lunge
    '0078', // barbell rear lunge
    '1410', // split squats
    '3769', // landmine squat
    '2368', // smith chair squat
    '0196', // barbell narrow stance squat
    '2286', // suspended split squat
    '0755', // smith hack squat
    '2287', // suspended back fly
    '3193', // frog reverse hyperextension
    '0795', // sled 45° leg press
    '0116', // barbell front squat
    '0533', // kettlebell sumo squat
  ]),
  PANTURRILHAS: Object.freeze([
    '1379', // calf press on seated leg press
    '0417', // dumbbell standing calf raise
    '0773', // smith reverse calf raises
    '0088', // barbell seated calf raise
    '1375', // cable standing calf raise
  ]),
  ABDOMEN_E_CORE: Object.freeze([
    '2135', // cable seated crunch
    '0464', // exercise ball seated crunch
    '3544', // vertical knee raise on parallel bars
    '0873', // oblique crunch
    '0277', // dumbbell side bend
    '0222', // barbell standing twisting overhead press
    '1761', // hanging oblique knee raise
    '0826', // weighted decline sit-up
    '0243', // cable standing lift
  ]),
  ANTEBRACOS: Object.freeze([
    '0082', // barbell reverse wrist curl
    '0247', // cable wrist curl
  ]),
  CARDIO: Object.freeze([
    '2141', // walking on incline treadmill
    '3361', // skater hops
  ]),
})

export const SPRITE_PRIORITY_QUEUE_IDS = Object.freeze([
  ...SPRITE_PRIORITY_CATEGORIES.PEITO,
  ...SPRITE_PRIORITY_CATEGORIES.COSTAS,
  ...SPRITE_PRIORITY_CATEGORIES.OMBROS,
  ...SPRITE_PRIORITY_CATEGORIES.BICEPS_E_TRICEPS,
  ...SPRITE_PRIORITY_CATEGORIES.PERNAS_E_GLUTEOS,
  ...SPRITE_PRIORITY_CATEGORIES.PANTURRILHAS,
  ...SPRITE_PRIORITY_CATEGORIES.ABDOMEN_E_CORE,
  ...SPRITE_PRIORITY_CATEGORIES.ANTEBRACOS,
  ...SPRITE_PRIORITY_CATEGORIES.CARDIO,
])

export const SPRITE_PRIORITY_QUEUE_SET = new Set(SPRITE_PRIORITY_QUEUE_IDS)

export const TOTAL_PRIORITY_QUEUE_EXERCISES = SPRITE_PRIORITY_QUEUE_IDS.length
