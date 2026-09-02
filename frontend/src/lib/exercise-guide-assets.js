// Local Workout Guide artwork. The mapping is deliberately explicit: similar names are not
// enough for exercise instruction, so every entry below was checked for equipment and movement.
// Artwork: Bryl Lim / Everkinetic, CC BY-SA 4.0. See THIRD_PARTY_ASSETS.md.
export const WORKOUT_GUIDE_VERSION = '1.0.0'
export const WORKOUT_GUIDE_COMMIT = 'ba0b709cb20430361b2cb33aaadd20998164a916'

export const WORKOUT_GUIDE_BY_EXERCISE_ID = Object.freeze({
  // Chest and shoulders
  '0025': 'bench-press',
  '0047': 'incline-bench-press',
  '0314': 'incline-dumbbell-press',
  '0289': 'dumbbell-bench-press',
  '0033': 'decline-bench-press',
  '0576': 'machine-chest-press',
  '0577': 'machine-chest-press',
  '0227': 'cable-fly',
  '0662': 'push-up',
  '1457': 'overhead-press',
  '0405': 'seated-dumbbell-press',
  '2137': 'arnold-press',
  '0334': 'lateral-raise',
  '0178': 'cable-lateral-raise',
  '0310': 'front-raise',
  '0378': 'rear-delt-fly',
  '0602': 'reverse-pec-deck',
  '0120': 'upright-row',
  '0308': 'dumbbell-fly',
  '0171': 'incline-cable-fly',
  '0301': 'decline-dumbbell-press',
  '0748': 'smith-machine-bench-press',
  '0251': 'chest-dip',
  '1755': 'weighted-dip',
  '0603': 'machine-shoulder-press',
  '0426': 'standing-dumbbell-press',
  '0584': 'machine-lateral-raise',
  '0162': 'cable-front-raise',
  '0834': 'plate-front-raise',
  '2292': 'bent-over-rear-delt-raise',
  '0225': 'cable-rear-delt-fly',
  '0493': 'incline-push-up',
  '3211': 'knee-push-up',
  '1311': 'wide-push-up',
  '0283': 'diamond-push-up',
  '0279': 'decline-push-up',
  '3294': 'archer-push-up',
  '0699': 'push-up-shoulder-tap',
  '0659': 'wall-push-up',
  '0471': 'handstand-push-up',

  // Back and pulling movements
  '0032': 'deadlift',
  '0085': 'romanian-deadlift',
  '0027': 'barbell-row',
  '0606': 't-bar-row',
  '0293': 'dumbbell-bent-over-row',
  '0292': 'one-arm-dumbbell-row',
  '0861': 'seated-row',
  '1350': 'machine-row',
  '0198': 'lat-pulldown',
  '0818': 'close-grip-lat-pulldown',
  '0238': 'straight-arm-pulldown',
  '0197': 'wide-grip-lat-pulldown',
  '0652': 'pull-up',
  '0017': 'assisted-pull-up',
  '0841': 'weighted-pull-up',
  '1326': 'chin-up',
  '0095': 'shrug',
  '3017': 'pendlay-row',
  '0499': 'inverted-row',
  '0189': 'single-arm-cable-row',
  '0651': 'neutral-grip-pull-up',
  '0572': 'assisted-chin-up',
  '0074': 'rack-pull',
  '0489': 'back-extension',
  '0406': 'dumbbell-shrug',
  '0688': 'scapular-pull-up',
  '3418': 'l-sit-pull-up',
  '3165': 'towel-row',

  // Legs and glutes
  '0043': 'squat',
  '0042': 'front-squat',
  '0743': 'hack-squat',
  '0739': 'leg-press',
  '0410': 'bulgarian-split-squat',
  '0431': 'step-up',
  '0585': 'leg-extension',
  '0586': 'lying-leg-curl',
  '0599': 'seated-leg-curl',
  '0058': 'hip-thrust',
  '3013': 'glute-bridge',
  '0044': 'good-morning',
  '0605': 'standing-calf-raise',
  '0594': 'seated-calf-raise',
  '1757': 'single-leg-romanian-deadlift',
  '0381': 'reverse-lunge',
  '0228': 'cable-kickback',
  '0597': 'hip-abduction-machine',
  '3645': 'single-leg-glute-bridge',
  '1409': 'barbell-glute-bridge',
  '0756': 'smith-machine-hip-thrust',
  '1459': 'dumbbell-romanian-deadlift',
  '0196': 'cable-pull-through',
  '0168': 'cable-standing-hip-adduction',
  '0598': 'hip-adduction-machine',
  '0768': 'smith-machine-bulgarian-split-squat',
  '1760': 'goblet-squat',
  '0549': 'kettlebell-swing',
  '0593': 'reverse-hyperextension',
  '1253': 'donkey-calf-raise',
  '1385': 'leg-press-calf-raise',
  '0514': 'jump-squat',
  '1373': 'calf-raise',
  '1387': 'single-leg-calf-raise',
  '3561': 'glute-bridge-march',
  '0710': 'side-lying-hip-abduction',
  '1408': 'banded-glute-bridge',
  '1004': 'banded-squat',
  '0980': 'banded-kickback',
  '3006': 'banded-seated-hip-abduction',
  '1759': 'pistol-squat',
  '1489': 'sissy-squat',
  '3470': 'forward-lunge',

  // Arms and forearms
  '0294': 'bicep-curl',
  '0313': 'hammer-curl',
  '0592': 'preacher-curl',
  '0868': 'cable-curl',
  '0080': 'reverse-curl',
  '0126': 'wrist-curl',
  '0201': 'tricep-pushdown',
  '1722': 'overhead-tricep-extension',
  '0060': 'skull-crusher',
  '0030': 'close-grip-bench-press',
  '0814': 'dip',
  '0019': 'assisted-dip',
  '0318': 'incline-dumbbell-curl',
  '0297': 'concentration-curl',
  '0447': 'ez-bar-curl',
  '0165': 'rope-hammer-curl',
  '0038': 'drag-curl',
  '0200': 'rope-tricep-pushdown',
  '0351': 'dumbbell-skull-crusher',
  '1735': 'single-dumbbell-skullcrusher',
  '0389': 'dumbbell-overhead-tricep-extension',
  '0423': 'single-arm-dumbbell-tricep-extension',
  '0129': 'bench-dip',
  '0333': 'tricep-kickback',
  '0385': 'wrist-extension',

  // Core, conditioning and mobility
  '0274': 'crunch',
  '0872': 'reverse-crunch',
  '0687': 'russian-twist',
  '0003': 'bicycle-crunch',
  '0630': 'mountain-climber',
  '0276': 'dead-bug',
  '0472': 'hanging-leg-raise',
  '2355': 'hanging-knee-raise',
  '0175': 'cable-crunch',
  '0857': 'ab-wheel',
  '0282': 'decline-sit-up',
  '0832': 'weighted-crunch',
  '0846': 'weighted-russian-twist',
  '0407': 'dumbbell-side-bend',
  '0459': 'flutter-kick',
  '0865': 'lying-leg-raise',
  '3212': 'toe-touch',
  '0006': 'heel-tap',
  '3699': 'plank-shoulder-tap',
  '3360': 'bear-crawl',
  '1471': 'inchworm',
  '3419': 'l-sit-hold',
  '1160': 'burpee',
  '3224': 'jumping-jack',
  '3361': 'skater-hop',
  '3552': 'fast-feet',
  '2612': 'jump-rope',
  '2138': 'cycling',
  '2141': 'elliptical',
  '2142': 'skierg',
  '2311': 'stair-climber',
  '0979': 'banded-pallof-press',
  '1604': 'worlds-greatest-stretch',
  '1511': 'hamstring-stretch',
  '0669': 'cross-body-shoulder-stretch',
  '1377': 'wall-calf-stretch',
  '1494': 'butterfly-stretch',
})

export const WORKOUT_GUIDE_EXERCISE_IDS = Object.freeze(Object.keys(WORKOUT_GUIDE_BY_EXERCISE_ID))
export const WORKOUT_GUIDE_SLUGS = Object.freeze([...new Set(Object.values(WORKOUT_GUIDE_BY_EXERCISE_ID))])

// Relevance order for the catalogue's first results. The leading movements follow the
// most-performed exercises (by logged sets) in StrengthLog's analysis of millions of
// workouts from more than 500,000 users. Their male/female top tens share the first six;
// the remaining entries merge both lists so the default is useful to the whole audience.
// Source: https://www.strengthlog.com/strength-training-statistics/
export const WORKOUT_GUIDE_POPULARITY_IDS = Object.freeze([
  '0025', // supino_com_barra
  '0043', // agachamento_com_barra
  '0032', // levantamento_terra_com_barra
  '0198', // puxada_alta_no_cabo
  '1457', // desenvolvimento_militar_em_pe_com_barra
  '0027', // remada_curvada_com_barra
  '0334', // elevacao_lateral_com_halteres
  '0585', // extensao_de_perna_na_maquina
  '0739', // leg_press_45_graus
  '0058', // elevacao_de_quadril_com_barra
  '0294', // rosca_de_biceps_com_halteres
  '0201', // triceps_na_polia_no_cabo
  '0003', // bicicleta_no_ar
  '0006', // toque_alternado_nos_calcanhares
  '2355', // elevação de pernas suspensa com joelhos flexionados
])

const DEFAULT_SEQUENCE = Object.freeze([0, 1, 2])
const FOUR_FRAME_SEQUENCE = Object.freeze([0, 1, 2, 3])
const FIVE_FRAME_SEQUENCE = Object.freeze([0, 1, 2, 3, 4])
const TWO_FRAME_SEQUENCE = Object.freeze([0, 1])

const CUSTOM_SEQUENCES = Object.freeze({
  '0025': FOUR_FRAME_SEQUENCE, // bench-press
  '0043': FOUR_FRAME_SEQUENCE, // squat
  '0032': FOUR_FRAME_SEQUENCE, // deadlift
  '0198': FOUR_FRAME_SEQUENCE, // lat-pulldown
  '1457': FOUR_FRAME_SEQUENCE, // overhead-press
  '0027': FOUR_FRAME_SEQUENCE, // barbell-row
  '0334': FOUR_FRAME_SEQUENCE, // lateral-raise
  '0585': FOUR_FRAME_SEQUENCE, // leg-extension
  '0739': TWO_FRAME_SEQUENCE,  // leg-press
  '0058': FOUR_FRAME_SEQUENCE, // hip-thrust
  '0294': FOUR_FRAME_SEQUENCE, // bicep-curl
  '0201': FOUR_FRAME_SEQUENCE, // tricep-pushdown
  '0003': FOUR_FRAME_SEQUENCE, // bicycle-crunch
  '0006': FIVE_FRAME_SEQUENCE, // heel-tap
  '2355': FIVE_FRAME_SEQUENCE, // hanging-knee-raise
})

const WORKOUT_GUIDE_ASSETS = Object.freeze(Object.fromEntries(
  Object.entries(WORKOUT_GUIDE_BY_EXERCISE_ID).map(([id, slug]) => [
    id,
    Object.freeze({
      duration: 2400,
      sequence: CUSTOM_SEQUENCES[id] || DEFAULT_SEQUENCE,
      slug,
    }),
  ]),
))

export function exerciseGuideAsset(exercise) {
  return exercise?.id ? WORKOUT_GUIDE_ASSETS[exercise.id] || null : null
}

export function hasExerciseGuideAsset(exercise) {
  return Boolean(exerciseGuideAsset(exercise))
}
