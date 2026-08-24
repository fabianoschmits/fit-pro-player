import { musclesOf } from './muscles.js'

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
