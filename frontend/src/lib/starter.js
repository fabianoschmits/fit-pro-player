// The ready-made routines shared by onboarding, Settings and the demo build.
import { routineId } from './format.js'
import { t } from './i18n-core.js'
import { suggestedWeightFor } from './history.js'
import { isAvailableExercise, isBodyweightEq } from './exercises.js'

const PREVIOUS_SPEC = [
  ['Chest Day', 'chest', [['0025', 4, 8], ['0047', 3, 10], ['0289', 3, 10], ['0308', 3, 12], ['0251', 3, 10], ['0314', 3, 10]]],
  ['Back Day', 'back', [['0652', 4, 10], ['0027', 4, 8], ['0198', 3, 10], ['0861', 3, 10], ['0293', 3, 10], ['0238', 3, 12]]],
  ['Leg Day', 'legs', [['0043', 4, 8], ['0085', 3, 10], ['0739', 3, 12], ['0585', 3, 12], ['0586', 3, 12], ['0605', 4, 15]]],
  ['Abs Day', 'abs', [['0274', 3, 15], ['0472', 3, 12], ['0687', 3, 20], ['0630', 3, 30], ['0276', 3, 15], ['0857', 3, 15]]],
  ['Arms Day', 'arm', [['0294', 3, 10], ['0313', 3, 12], ['0080', 3, 12], ['0060', 3, 10], ['0201', 3, 12], ['0447', 3, 10]]],
  ['Shoulders Day', 'shoulders', [['1457', 4, 8], ['0334', 3, 12], ['0120', 3, 12], ['0378', 3, 12], ['2137', 3, 10], ['0405', 3, 12]]],
  ['Glutes Day', 'glutes', [['1409', 4, 10], ['0043', 3, 10], ['0085', 3, 10], ['0381', 3, 12], ['0431', 3, 12], ['0586', 3, 12]]]
]

// Focused session options, not a seven-day schedule. Compounds precede accessories;
// each list deliberately covers different movement roles with moderate session volume.
// Tuple: exercise id, sets, reps, rest in seconds.
const SPEC = [
  ['Chest Day', 'chest', [['0025', 3, 8, 120], ['0314', 3, 10, 120], ['0227', 3, 12, 75], ['0493', 2, 12, 90]]],
  ['Back Day', 'back', [['0017', 3, 8, 120], ['0027', 3, 8, 120], ['0861', 3, 10, 90], ['0238', 2, 12, 75], ['0489', 2, 12, 90]]],
  ['Leg Day', 'legs', [['0043', 3, 8, 150], ['0085', 3, 10, 120], ['0739', 3, 12, 120], ['0585', 2, 12, 75], ['0586', 2, 12, 75], ['0605', 3, 15, 75]]],
  ['Abs Day', 'abs', [['0274', 2, 15, 60], ['0872', 2, 12, 60], ['0276', 2, 10, 60], ['0979', 2, 12, 60], ['0857', 2, 8, 90]]],
  ['Arms Day', 'arm', [['0447', 3, 10, 90], ['0201', 3, 12, 90], ['0318', 2, 12, 75], ['1722', 2, 12, 75], ['0313', 2, 12, 75], ['0060', 2, 10, 90]]],
  ['Shoulders Day', 'shoulders', [['0405', 3, 8, 120], ['0334', 3, 12, 75], ['0378', 3, 12, 75], ['0406', 3, 12, 90]]],
  ['Glutes Day', 'glutes', [['1409', 3, 10, 120], ['0085', 3, 10, 120], ['0410', 3, 10, 120], ['0228', 2, 12, 75], ['0597', 2, 15, 75]]],
]

const signature = routine => (routine?.ex || []).map(ex => ex.id).join('|')
const SPEC_SIGNATURES = SPEC.map(([, , list]) => list.map(([id]) => id).join('|'))
const PREVIOUS_SIGNATURES = PREVIOUS_SPEC.map(([, , list]) => list.map(([id]) => id).join('|'))
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
  if (current !== -1) return current
  const previous = PREVIOUS_SIGNATURES.indexOf(value)
  return previous !== -1 ? previous : LEGACY_SIGNATURES.indexOf(value)
}

// Fresh routine objects (new ids).
export const starterRoutines = st =>
  SPEC.map(([name, emoji, list]) => ({
    id: routineId(), name: t(name), starterKey: name, emoji,
    ex: list.filter(([id]) => isAvailableExercise(id)).map(([id, sets, reps, rest]) => ({
      id, sets, reps, rest, mode: 'reps', weight: suggestedWeightFor(st, id),
      ...(isBodyweightEq(id) ? { bodyweight: true } : {}),
    }))
  }))

/** Display a built-in routine in the active language while custom names stay untouched. */
export const routineName = routine => routine?.starterKey ? t(routine.starterKey) : (routine?.name || '')

/** Mark legacy built-ins so their labels can follow the selected language. */
export function annotateStarterRoutines(st) {
  ;(st.routines || []).forEach(routine => {
    if (routine.starterCustomName || routine.assigned || routine.planGenerated) return
    const index = signatureIndex(routine)
    if (index === -1) return
    routine.starterKey = SPEC[index][0]
    // Only exact previous built-in exercise lists are upgraded. Arbitrary professional
    // prescriptions and completed sessions are never silently rewritten.
    if (signature(routine) !== SPEC_SIGNATURES[index] || routine.ex.some(entry => entry.rest == null || entry.mode == null)) {
      const defaults = PREVIOUS_SPEC[index][2]
      // A matching exercise list alone does not make an edited prescription ours.
      // Old generated entries only had id/sets/reps/weight. Preserve user-added
      // notes, groups, modes and changed prescriptions rather than guessing.
      const untouched = routine.ex.every((entry, position) =>
        entry.sets === defaults[position][1] && entry.reps === defaults[position][2]
        && Object.keys(entry).every(key => ['id', 'sets', 'reps', 'weight'].includes(key))
        && (!isBodyweightEq(entry.id) || !entry.weight))
      if (!untouched) return
      const previous = new Map(routine.ex.map(entry => [entry.id, entry]))
      routine.ex = starterRoutines(st)[index].ex.map(entry => ({
        ...entry,
        weight: isBodyweightEq(entry.id) ? 0 : (previous.get(entry.id)?.weight ?? entry.weight),
      }))
    }
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
