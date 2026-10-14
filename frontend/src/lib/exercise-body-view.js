import { loadOfRoutine, musclesOf } from './muscles.js'

// At list-thumbnail size, one anatomical view is much clearer than two. Use the
// side where the target muscle has its most useful visible surface.
const FRONT_MUSCLES = new Set([
  'chest', 'serratus', 'biceps', 'forearm', 'abs', 'obliques',
  'quadriceps', 'adductors', 'hip-flexors', 'tibialis',
])
const BACK_MUSCLES = new Set([
  'trapezius', 'upper-back', 'triceps', 'lower-back', 'gluteal',
  'hamstring', 'calves',
])
const UPPER_MUSCLES = new Set([
  'trapezius', 'deltoids', 'chest', 'upper-back', 'serratus', 'biceps',
  'triceps', 'forearm', 'abs', 'obliques', 'lower-back', 'hip-flexors',
])
const LOWER_MUSCLES = new Set([
  'gluteal', 'quadriceps', 'hamstring', 'adductors', 'calves', 'tibialis',
])

export function exerciseBodyView(ex) {
  const load = musclesOf(ex)
  const name = String(ex?.n || '').toLowerCase()
  if (load.deltoids && /\b(?:rear|reverse|posterior)\b/.test(name)) return 'back'
  let front = 0
  let back = 0
  for (const [muscle, weight] of Object.entries(load)) {
    if (FRONT_MUSCLES.has(muscle)) front += weight
    if (BACK_MUSCLES.has(muscle)) back += weight
  }

  if (back > front) return 'back'
  if (front > back) return 'front'
  return ex?.bp === 'back' || ex?.bp === 'lower legs' ? 'back' : 'front'
}

export function routineBodyView(routine) {
  const load = loadOfRoutine(routine)
  let front = 0
  let back = 0
  for (const [muscle, weight] of Object.entries(load)) {
    if (FRONT_MUSCLES.has(muscle)) front += weight
    if (BACK_MUSCLES.has(muscle)) back += weight
  }
  return back > front ? 'back' : 'front'
}

export function routineBodyRegion(routine) {
  const load = loadOfRoutine(routine)
  let upper = 0
  let lower = 0
  for (const [muscle, weight] of Object.entries(load)) {
    if (UPPER_MUSCLES.has(muscle)) upper += weight
    if (LOWER_MUSCLES.has(muscle)) lower += weight
  }
  if (upper > lower * 1.25) return 'upper'
  if (lower > upper * 1.25) return 'lower'
  return 'full'
}
