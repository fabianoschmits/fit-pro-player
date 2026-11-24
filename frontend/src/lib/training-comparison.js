// Immutable prescriptions and performed work, expressed in weighted work sets.
// A snapshot belongs to an entry position: repeated movements remain independent.
import { EXIDX } from './exercises.js'
import { MUSCLES, MUSCLE_NAME, levelsOf, musclesOf } from './muscles.js'
import { isWarmupRow } from './workout-model.js'

const ORIGINS = ['personal', 'professional', 'repeat', 'freestyle']
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const validNumber = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
const idOf = value => typeof value === 'string' && value.trim() ? value : null
const emptyLoad = () => Object.fromEntries(MUSCLES.map(id => [id, 0]))
const addFinite = (total, value) => Number.isFinite(total + value) ? total + value : total
const sumSets = snapshots => snapshots.reduce((sum, item) => addFinite(sum, item.workSets), 0)

function weightsOf(value) {
  if (!isObject(value)) return {}
  const out = {}
  for (const id of MUSCLES) {
    const weight = value[id]
    if (validNumber(weight) && weight > 0) out[id] = weight
  }
  return out
}

function sourceWeights(source) {
  if (!isObject(source)) return {}
  // Even an empty saved weight map is authoritative; never replace it with a
  // newer catalogue definition or a broad body-part guess.
  if (Object.hasOwn(source, 'muscleWeights')) return weightsOf(source.muscleWeights)
  return weightsOf(musclesOf(source))
}

function entryWeights(entry, resolveExercise) {
  if (isObject(entry.muscleSnapshot)) return sourceWeights(entry.muscleSnapshot)
  const id = entry.id ?? entry.exerciseId
  const resolved = typeof resolveExercise === 'function' ? resolveExercise(id, entry) : null
  return sourceWeights(resolved || EXIDX[id] || entry.exercise || entry)
}

function workCount(entry, performed = false) {
  if (Array.isArray(entry.sets)) {
    return entry.sets.filter(row => isObject(row) && !isWarmupRow(row) && (!performed || row.done === true)).length
  }
  // Completed history requires actual rows. Numeric counts are prescriptions.
  return !performed && validNumber(entry.sets) ? entry.sets : null
}

/** Capture pending or completed prescription rows without retaining live references. */
export function snapshotTrainingEntries(entries, resolveExercise) {
  if (!Array.isArray(entries)) return []
  return entries.flatMap(entry => {
    if (!isObject(entry)) return []
    const exerciseId = idOf(entry.id ?? entry.exerciseId)
    const workSets = workCount(entry)
    if (!exerciseId || workSets === null) return []
    return [{ exerciseId, workSets, muscleWeights: entryWeights(entry, resolveExercise) }]
  })
}

/** Capture the original plan before any Flex selection changes the session. */
export function createTrainingComparison(entries, origin = 'personal', resolveExercise) {
  const source = ORIGINS.includes(origin) ? origin : 'personal'
  return {
    version: 1,
    origin: source,
    planned: source === 'freestyle' ? [] : snapshotTrainingEntries(entries, resolveExercise),
    adjusted: null,
    flexApplied: false,
  }
}

function normalizeSnapshots(value) {
  return value.flatMap(item => {
    if (!isObject(item) || !idOf(item.exerciseId) || !validNumber(item.workSets)) return []
    return [{ exerciseId: item.exerciseId, workSets: item.workSets, muscleWeights: weightsOf(item.muscleWeights) }]
  })
}

/** Invalid optional metadata never invalidates the surrounding workout history. */
export function normalizeTrainingComparison(value) {
  if (!isObject(value) || value.version !== 1 || !ORIGINS.includes(value.origin)
    || !Array.isArray(value.planned)
    || (value.adjusted != null && !Array.isArray(value.adjusted))) return null
  const freestyle = value.origin === 'freestyle'
  return {
    version: 1,
    origin: value.origin,
    planned: freestyle ? [] : normalizeSnapshots(value.planned),
    adjusted: value.adjusted == null ? null : freestyle ? [] : normalizeSnapshots(value.adjusted),
    flexApplied: !freestyle && value.flexApplied === true,
  }
}

/** Capture the final prescription once, when execution starts. */
export function confirmTrainingComparison(active, resolveExercise) {
  const comparison = normalizeTrainingComparison(active?.comparison)
  if (!comparison || comparison.adjusted !== null) return comparison
  const freestyle = comparison.origin === 'freestyle'
  return {
    ...comparison,
    adjusted: freestyle ? [] : snapshotTrainingEntries(active?.entries, resolveExercise),
    flexApplied: !freestyle && active?.flex?.mode === 'adapted',
  }
}

function loadOfSnapshots(snapshots) {
  const out = emptyLoad()
  for (const item of snapshots) {
    for (const id of MUSCLES) {
      const load = (item.muscleWeights[id] || 0) * item.workSets
      if (Number.isFinite(load)) out[id] = addFinite(out[id], load)
    }
  }
  return out
}

function performedSnapshots(entries) {
  if (!Array.isArray(entries)) return []
  return entries.flatMap(entry => {
    if (!isObject(entry)) return []
    const workSets = workCount(entry, true)
    if (!(workSets > 0)) return []
    return [{ exerciseId: idOf(entry.id ?? entry.exerciseId), workSets, muscleWeights: entryWeights(entry) }]
  })
}

// The session has one scale, so equal weighted loads always receive equal shades
// across all three maps, even after Flex removes most of the original plan.
export function thresholdsOf(loads) {
  const max = Math.max(0, ...Object.values(loads).flatMap(load => load ? Object.values(load) : []))
  const rules = [{ at: 0, level: 1, exclusive: true }]
  if (max > 0) {
    for (const [fraction, level] of [[0.25, 2], [0.5, 3], [0.75, 4]]) {
      const at = max * fraction
      rules.push({ at, level, exclusive: at === 0 })
    }
  }
  return rules
}

function percentOf(actual, reference) {
  if (!(reference > 0)) return null
  const value = actual / reference * 100
  return Number.isFinite(value) ? value : null
}

/** A pure, display-ready comparison; legacy and freestyle sessions stay actual-only. */
export function compareTraining(workout) {
  const comparison = normalizeTrainingComparison(workout?.comparison)
  const freestyle = comparison?.origin === 'freestyle'
  const planned = comparison && !freestyle ? comparison.planned : null
  const adjusted = comparison && !freestyle ? comparison.adjusted : null
  const actual = performedSnapshots(workout?.entries)
  const plannedSets = planned === null ? null : sumSets(planned)
  const adjustedSets = adjusted === null ? null : sumSets(adjusted)
  const actualSets = sumSets(actual)
  const hasReference = adjustedSets > 0
  const loads = {
    planned: planned === null ? null : loadOfSnapshots(planned),
    adjusted: adjusted === null ? null : loadOfSnapshots(adjusted),
    actual: loadOfSnapshots(actual),
  }
  const thresholds = thresholdsOf(loads)
  const levels = {
    planned: loads.planned === null ? null : levelsOf(loads.planned, thresholds),
    adjusted: loads.adjusted === null ? null : levelsOf(loads.adjusted, thresholds),
    actual: levelsOf(loads.actual, thresholds),
  }
  const muscles = MUSCLES.map(id => {
    const reference = hasReference ? loads.adjusted[id] : null
    const delta = hasReference ? loads.actual[id] - reference : null
    // Floating-point support weights (e.g. 0.4) must not create false mismatches.
    const same = hasReference && Math.abs(delta) <= Math.max(reference, loads.actual[id]) * Number.EPSILON * 8
    return {
      id,
      label: MUSCLE_NAME[id],
      planned: loads.planned === null ? null : loads.planned[id],
      adjusted: loads.adjusted === null ? null : loads.adjusted[id],
      actual: loads.actual[id],
      reference,
      percent: hasReference ? percentOf(loads.actual[id], reference) : null,
      delta,
      state: !hasReference ? 'unreferenced' : same ? 'matched' : delta < 0 ? 'below' : 'above',
    }
  })
  const relevant = muscles.filter(item => hasReference && (item.reference > 0 || item.actual > 0))
  return {
    version: 1,
    origin: comparison?.origin || null,
    hasComparison: comparison !== null,
    hasPlanned: !!planned?.length,
    hasAdjusted: adjusted !== null,
    flexApplied: comparison?.flexApplied === true,
    reference: hasReference ? 'adjusted' : null,
    loads,
    levels,
    muscles,
    thresholds,
    summary: {
      plannedSets,
      adjustedSets,
      actualSets,
      referenceSets: hasReference ? adjustedSets : null,
      percent: hasReference ? percentOf(actualSets, adjustedSets) : null,
      plannedExercises: planned === null ? null : planned.filter(item => item.workSets > 0).length,
      adjustedExercises: adjusted === null ? null : adjusted.filter(item => item.workSets > 0).length,
      actualExercises: actual.length,
      matchedMuscles: relevant.filter(item => item.state === 'matched').length,
      belowMuscles: relevant.filter(item => item.state === 'below').length,
      aboveMuscles: relevant.filter(item => item.state === 'above').length,
    },
  }
}
