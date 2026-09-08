// The ready-made routines shared by onboarding, Settings and the demo build.
import { uid } from './format.js'
import { t } from './i18n-core.js'
import { suggestedWeightFor } from './history.js'

const SPEC = [
  ['Chest Day', 'chest', [['0025', 4, 8], ['0047', 3, 10], ['0289', 3, 10], ['0308', 3, 12], ['0251', 3, 10], ['0314', 3, 10]]],
  ['Back Day', 'back', [['0652', 4, 10], ['0027', 4, 8], ['0198', 3, 10], ['0861', 3, 10], ['0293', 3, 10], ['0238', 3, 12]]],
  ['Leg Day', 'legs', [['0043', 4, 8], ['0085', 3, 10], ['0739', 3, 12], ['0585', 3, 12], ['0586', 3, 12], ['0605', 4, 15]]],
  ['Abs Day', 'abs', [['0274', 3, 15], ['0472', 3, 12], ['0687', 3, 20], ['0630', 3, 30], ['0276', 3, 15], ['0857', 3, 15]]],
  ['Arms Day', 'arm', [['0294', 3, 10], ['0313', 3, 12], ['0080', 3, 12], ['0060', 3, 10], ['0201', 3, 12], ['0447', 3, 10]]],
  ['Shoulders Day', 'shoulders', [['1457', 4, 8], ['0334', 3, 12], ['0120', 3, 12], ['0378', 3, 12], ['2137', 3, 10], ['0405', 3, 12]]],
  ['Glutes Day', 'glutes', [['1409', 4, 10], ['0043', 3, 10], ['0085', 3, 10], ['0381', 3, 12], ['0431', 3, 12], ['0586', 3, 12]]]
]

const signature = routine => (routine?.ex || []).map(ex => ex.id).join('|')
const SPEC_SIGNATURES = SPEC.map(([, , list]) => list.map(([id]) => id).join('|'))
const LEGACY_SIGNATURES = [
  '0025|0047|0289|0308|0251|0314',
  '0652|0027|2330|1323|0293|0076',
  '0043|0085|0739|0585|0586|0605',
  '0274|0472|0687|0630|0002|0267',
  '0031|0313|0070|0060|0201|0057',
  '0091|0334|0041|0076|2137|0326',
  '1409|0043|0085|0054|0431|0586',
]
const signatureIndex = routine => {
  const value = signature(routine)
  const current = SPEC_SIGNATURES.indexOf(value)
  return current !== -1 ? current : LEGACY_SIGNATURES.indexOf(value)
}

// Fresh routine objects (new ids).
export const starterRoutines = st =>
  SPEC.map(([name, emoji, list]) => ({
    id: uid(), name: t(name), starterKey: name, emoji,
    ex: list.map(([id, sets, reps]) => ({ id, sets, reps, weight: suggestedWeightFor(st, id) }))
  }))

/** Display a built-in routine in the active language while custom names stay untouched. */
export const routineName = routine => routine?.starterKey ? t(routine.starterKey) : (routine?.name || '')

/** Mark legacy built-ins so their labels can follow the selected language. */
export function annotateStarterRoutines(st) {
  ;(st.routines || []).forEach(routine => {
    if (routine.starterKey || routine.starterCustomName) return
    const index = signatureIndex(routine)
    if (index !== -1) routine.starterKey = SPEC[index][0]
  })
  return st.routines || []
}

/** Add only missing built-in routines and annotate routines created by older versions. */
export function ensureStarterRoutines(st) {
  annotateStarterRoutines(st)
  const ready = starterRoutines(st)
  const ordered = []
  ready.forEach((candidate, index) => {
    let existing = (st.routines || []).find(r => r.starterKey === candidate.starterKey)
    if (!existing) existing = (st.routines || []).find(r => signatureIndex(r) === index)
    if (existing) {
      existing.starterKey = candidate.starterKey
      ordered.push(existing)
    } else {
      st.routines.push(candidate)
      ordered.push(candidate)
    }
  })
  return ordered
}

/** True when a routine is one of the unmodified built-ins, including legacy copies. */
export function isStarterRoutine(routine) {
  return !routine?.starterCustomName && (!!routine?.starterKey || signatureIndex(routine) !== -1)
}
