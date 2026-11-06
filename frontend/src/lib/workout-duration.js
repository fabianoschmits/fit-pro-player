import { modeOf, supersetUnits } from './history.js'
import { EXIDX, exerciseName, exOr } from './exercises.js'
import { modeForSet } from './workout-model.js'
import { normalizePreferredWorkoutMinutes } from './profile.js'

export const normalizeWorkoutMinutes = normalizePreferredWorkoutMinutes
export const getPreferredWorkoutMinutes = profile => normalizeWorkoutMinutes(profile?.preferredWorkoutMinutes)
const seconds = (value, fallback = 0) => Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.round(Number(value)) : fallback
const configOf = exercise => exercise.target || exercise
const restOf = (exercise, context) => seconds(configOf(exercise).rest ?? context.restSec ?? context.rest, 90)
const rowsOf = exercise => Array.isArray(exercise.sets) ? exercise.sets : Array.from({ length: Math.min(200, Math.max(1, seconds(exercise.sets, 1))) }, () => ({}))
function rowDuration(row, exercise) {
  const config = configOf(exercise)
  const mode = modeForSet(row, { ...config, mode: config.mode || modeOf(config) })
  if (mode === 'cardio') return seconds(Number(row.min ?? config.min ?? 20) * 60)
  if (mode === 'time') return seconds(row.sec ?? row.seconds ?? row.durationSec ?? config.sec, 45)
  return seconds(Number(row.r ?? row.reps ?? config.reps ?? config.repsMax ?? 10) * 3)
}

/** Estimated seconds; rows include only explicitly prescribed warmups. */
export function estimateExerciseDuration(exercise, context = {}) {
  const rows = rowsOf(exercise)
  return rows.reduce((sum, row, index) => sum + rowDuration(row, exercise)
    + (index < rows.length - 1 ? seconds(row.rest, restOf(exercise, context)) : 0), 0)
}

/** Supersets rest after each round, using its last active member's rest. */
export function estimateWorkoutDuration(exercises = [], context = {}) {
  if (!exercises.length) return 0
  const units = supersetUnits(exercises)
  let total = 45 + Math.max(0, units.length - 1) * 75
  total += Math.floor((exercises.length - 1) / 3) * 45
  for (const indices of units) {
    if (indices.length === 1) { total += estimateExerciseDuration(exercises[indices[0]], context); continue }
    const members = indices.map(index => ({ exercise: exercises[index], rows: rowsOf(exercises[index]) }))
    const rounds = Math.max(...members.map(member => member.rows.length))
    for (let round = 0; round < rounds; round++) {
      const active = members.filter(member => member.rows[round])
      total += active.reduce((sum, member) => sum + rowDuration(member.rows[round], member.exercise), 0)
      const last = active[active.length - 1]
      if (round < rounds - 1 && last) total += seconds(last.rows[round].rest, restOf(last.exercise, context))
    }
  }
  return total
}

function musclesOf(exercise, context) {
  const ex = context.exerciseIndex?.[exercise.id] || EXIDX[exercise.id] || exercise
  return [...new Set(exercise.muscleGroups || ex.muscleGroups || [ex.tg || ex.muscle || ex.bp || exercise.id])]
}

// Use the catalogue's canonical names rather than translated labels. Order still
// breaks ties, and unknown/custom movements retain their original order.
const MAIN_MOVEMENT = /\b(bench press|chest press|shoulder press|overhead press|military press|leg press|squat|deadlift|lunge|row|pull[- ]?up|chin[- ]?up|pull[- ]?down|dip|hip thrust|push[- ]?up|step[- ]?up|clean|snatch)\b/i
function fundamentalPriority(exercise, context) {
  const ex = context.exerciseIndex?.[exercise.id] || EXIDX[exercise.id] || exercise
  return MAIN_MOVEMENT.test(ex.n || ex.name || EXIDX[exercise.id]?.n || '') ? 1 : 0
}

/** Deterministic positional selection: fundamental movements, coverage, then order. */
export function fitWorkoutToMinutes(exercises = [], targetMinutes, context = {}) {
  const target = normalizeWorkoutMinutes(targetMinutes)
  const units = supersetUnits(exercises)
  const chosen = new Set()
  const estimate = indices => estimateWorkoutDuration(exercises.filter((_, index) => indices.has(index)), context)
  const add = unit => unit.forEach(index => chosen.add(index))
  if (estimateWorkoutDuration(exercises, context) <= target * 60) exercises.forEach((_, index) => chosen.add(index))
  else if (units.length) {
    const priorityOf = unit => Math.max(...unit.map(index => fundamentalPriority(exercises[index], context)))
    const first = [...units].sort((a, b) => priorityOf(b) - priorityOf(a) || a[0] - b[0])[0]
    add(first)
    const covered = new Set(first.flatMap(index => musclesOf(exercises[index], context)))
    let remaining = units.filter(unit => unit !== first)
    while (remaining.length) {
      const ranked = remaining.map(unit => {
        const muscles = [...new Set(unit.flatMap(index => musclesOf(exercises[index], context)))]
        const fresh = muscles.filter(muscle => !covered.has(muscle)).length
        const cardio = unit.some(index => modeOf(configOf(exercises[index])) === 'cardio')
        const goalBonus = cardio && ['lose_weight', 'improve_fitness'].includes(context.goal) ? 1 : 0
        return { unit, muscles, score: priorityOf(unit) * 300 + fresh * 100 + goalBonus * 35 + 20 / (unit[0] + 1) }
      }).sort((a, b) => b.score - a.score || a.unit[0] - b.unit[0])
      const next = ranked.find(item => estimate(new Set([...chosen, ...item.unit])) <= target * 60)
      if (!next) break
      add(next.unit)
      next.muscles.forEach(muscle => covered.add(muscle))
      remaining = remaining.filter(unit => unit !== next.unit)
    }
  }
  const selectedIndices = exercises.map((_, index) => index).filter(index => chosen.has(index))
  return { selectedIndices, omittedIndices: exercises.map((_, index) => index).filter(index => !chosen.has(index)),
    selectedKeys: selectedIndices.map(index => `position:${index}`), estimatedSeconds: estimate(chosen), targetMinutes: target }
}

export function createFlexSelection(active, targetMinutes, preferredMinutes, context = {}) {
  const target = normalizeWorkoutMinutes(targetMinutes)
  const preferred = normalizeWorkoutMinutes(preferredMinutes)
  const adapted = target !== preferred
  const selected = new Set(adapted ? fitWorkoutToMinutes(active.entries, target, context).selectedIndices : active.entries.map((_, index) => index))
  return { targetMinutes: target, preferredMinutes: preferred, mode: adapted ? 'adapted' : 'full', phase: adapted && active.entries.length ? 'review' : 'confirmed',
    estimatedMinutes: Math.ceil(estimateWorkoutDuration(active.entries.filter((_, index) => selected.has(index)), context) / 60),
    outline: active.entries.map((entry, index) => ({ key: `position:${index}`, exerciseId: entry.id, name: exerciseName(exOr(entry.id)),
      sets: Array.isArray(entry.sets) ? entry.sets.length : entry.sets, ...(entry.sg ? { sg: entry.sg } : {}), selected: selected.has(index) })) }
}

export function toggleFlexSelection(active, index, context = {}) {
  if (active.start || active.flex?.phase !== 'review') return active.flex
  const group = supersetUnits(active.entries).find(unit => unit.includes(index))
  if (!group) return active.flex
  const selecting = !active.flex.outline[index]?.selected
  const outline = active.flex.outline.map((item, position) => group.includes(position) ? { ...item, selected: selecting } : item)
  if (!outline.some(item => item.selected)) return active.flex
  return { ...active.flex, outline, estimatedMinutes: Math.ceil(estimateWorkoutDuration(active.entries.filter((_, position) => outline[position].selected), context) / 60) }
}

export function confirmFlexSelection(active) {
  if (active.start || !active.flex) return active
  const entries = active.entries.filter((_, index) => active.flex.outline[index]?.selected)
  if (!entries.length && active.entries.length) throw new Error('empty-flex-selection')
  return { ...active, entries, cur: 0, flex: { ...active.flex, phase: 'confirmed' } }
}
