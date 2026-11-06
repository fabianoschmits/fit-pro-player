import { buildSets, modeOf } from './history.js'
import { isWarmupRow, modeForSet } from './workout-model.js'

const MODE_FIELDS = {
  cardio: ['min', 'speed'],
  time: ['sec', 'w'],
  reps: ['w', 'r'],
}

/**
 * Reapply the values from the last session without touching completed rows.
 * Warm-up and work rows are matched independently so an extra warm-up cannot
 * shift every working set by one position.
 */
export function applyPreviousSetValues(currentSets = [], previousSets = [], mode = 'reps') {
  const fields = [...(MODE_FIELDS[mode] || MODE_FIELDS.reps), 'rir', 'rpe']
  const previousByPhase = {
    warmup: previousSets.filter(set => set?.done && isWarmupRow(set)),
    work: previousSets.filter(set => set?.done && !isWarmupRow(set)),
  }
  const phaseIndex = { warmup: 0, work: 0 }

  return currentSets.map(set => {
    const phase = isWarmupRow(set) ? 'warmup' : 'work'
    const candidates = previousByPhase[phase]
    const position = phaseIndex[phase]++
    const source = candidates[Math.min(position, Math.max(0, candidates.length - 1))]
    if (set?.done || !source) return { ...set }

    const next = { ...set }
    fields.forEach(field => {
      if (source[field] == null) delete next[field]
      else next[field] = source[field]
    })
    return next
  })
}

/**
 * Replace one exercise without rewriting work that was already logged.
 * A partially completed exercise becomes a compact completed entry and the
 * replacement is inserted beside it for the remaining work.
 */
export function replaceSessionExercise(entries = [], index, replacement) {
  if (!Array.isArray(entries)) throw new TypeError('Workout entries must be an array')
  if (!Number.isInteger(index) || !entries[index]) throw new RangeError('Workout entry index is invalid')
  if (!replacement?.id || !Array.isArray(replacement.sets)) throw new TypeError('Replacement exercise is invalid')

  const source = entries[index]
  const completedSets = (source.sets || []).filter(set => set?.done).map(set => ({ ...set }))
  const replacementEntry = {
    ...replacement,
    sets: replacement.sets.map(set => ({ ...set })),
    replacedFrom: completedSets.length ? source.id : (source.replacedFrom || source.id),
  }
  if (source.sg && !replacementEntry.sg) replacementEntry.sg = source.sg

  const next = entries.slice()
  if (!completedSets.length) {
    next[index] = replacementEntry
    return { entries: next, replacementIndex: index, preservedIndex: null }
  }

  const preserved = { ...source, sets: completedSets, replacedBy: replacement.id }
  delete preserved.sg
  const followsPartner = !!(source.sg && entries[index - 1]?.sg === source.sg)
  if (followsPartner) {
    next.splice(index, 1, replacementEntry, preserved)
    return { entries: next, replacementIndex: index, preservedIndex: index + 1 }
  }

  next.splice(index, 1, preserved, replacementEntry)
  return { entries: next, replacementIndex: index + 1, preservedIndex: index }
}

/** Build fresh editable rows from a historical entry without sharing references. */
export function resetHistoricalSets(sets = []) {
  return sets.map(set => ({ ...set, done: false }))
}

/** Change today's pending prescription without rewriting completed work or warmups. */
export function editSessionExercise(entry, config) {
  const mode = modeOf({ ...config, id: entry.id })
  const completed = entry.sets.filter(set => set.done && !isWarmupRow(set)).length
  const count = Math.max(completed, Math.max(1, Math.round(Number(config.sets)) || 1))
  // Explicit edits must win over history and confirmed-load smart defaults.
  const fresh = buildSets({ workouts: [], exWeights: {} }, { ...config, id: entry.id, mode, sets: count - completed })
    .slice(0, count - completed)
  let index = 0
  const sets = entry.sets.flatMap(set => {
    if (set.done || isWarmupRow(set)) {
      const originalMode = modeForSet(set, entry.target)
      return [{ ...set, ...(originalMode !== mode ? { mode: originalMode } : {}) }]
    }
    return index < fresh.length ? [{ ...fresh[index++] }] : []
  })
  sets.push(...fresh.slice(index).map(set => ({ ...set })))
  const target = { ...(entry.target || {}) }
  for (const key of ['mode', 'sets', 'reps', 'min', 'sec', 'speed', 'weight', 'bodyweight', 'side', 'prog', 'inc', 'repsMin', 'repsMax']) delete target[key]
  return { ...entry, target: { ...target, ...config, mode, sets: count }, plan: null, sets }
}
