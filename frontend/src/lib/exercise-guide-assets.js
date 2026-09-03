// Local Workout Guide artwork — custom PNG sprite sets only.
// Import new frames: node scripts/import-guide-sprites.mjs
import WORKOUT_GUIDE_PNG_SLUGS from './workout-guide-png-slugs.json' with { type: 'json' }
import WORKOUT_GUIDE_IMPORT_MAP from './workout-guide-import-map.json' with { type: 'json' }

export const WORKOUT_GUIDE_VERSION = '2.0.0'

export const WORKOUT_GUIDE_BY_EXERCISE_ID = Object.freeze({ ...WORKOUT_GUIDE_IMPORT_MAP })

export const WORKOUT_GUIDE_EXERCISE_IDS = Object.freeze(Object.keys(WORKOUT_GUIDE_BY_EXERCISE_ID))
export const WORKOUT_GUIDE_SLUGS = Object.freeze([...new Set(Object.values(WORKOUT_GUIDE_BY_EXERCISE_ID))])
export { WORKOUT_GUIDE_PNG_SLUGS }

// Leading catalogue order — popular compound lifts first.
export const WORKOUT_GUIDE_POPULARITY_IDS = Object.freeze([
  '0047', // incline bench press
  '0030', // close-grip bench press
  '0085', // romanian deadlift
  '0042', // front squat
  '0017', // assisted pull-up
  '3017', // pendlay row
])

const FOUR_FRAME_SEQUENCE = Object.freeze([0, 1, 2, 3])
const FIVE_FRAME_SEQUENCE = Object.freeze([0, 1, 2, 3, 4])

const CUSTOM_SEQUENCES = Object.freeze({
  '1160': FIVE_FRAME_SEQUENCE, // burpee — 5 frames
})

const PNG_SLUG_SET = new Set(WORKOUT_GUIDE_PNG_SLUGS)

const WORKOUT_GUIDE_ASSETS = Object.freeze(Object.fromEntries(
  Object.entries(WORKOUT_GUIDE_BY_EXERCISE_ID).map(([id, slug]) => [
    id,
    Object.freeze({
      duration: 2400,
      sequence: CUSTOM_SEQUENCES[id]
        || (PNG_SLUG_SET.has(slug) ? FOUR_FRAME_SEQUENCE : FOUR_FRAME_SEQUENCE),
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
