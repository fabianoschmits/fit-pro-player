import { describe, expect, it } from 'vitest'
import { buildWeeklyProgress, buildWeeklyPreview, buildMetricDelta } from './weekly-progress.js'

export const weeklyNow = new Date('2026-11-18T15:00:00Z')
export function weeklyWorkout(id, d, count = 3, minutes = 40, extra = {}) {
  return { id, d, name: `Workout ${id}`, durationMs: minutes == null ? undefined : minutes * 60000,
    entries: [{ id: '0025', sets: Array.from({ length: count }, () => ({ done: true, w: 20, r: 10 })), muscleSnapshot: { muscleWeights: { chest: 1, triceps: 0.4 } } }], ...extra }
}
export const referenceWeek = () => [weeklyWorkout('a', '2026-11-16', 10, 40), weeklyWorkout('b', '2026-11-18', 14, 50), weeklyWorkout('c', '2026-11-09', 8, 35), weeklyWorkout('d', '2026-11-10', 10, 45), weeklyWorkout('e', '2026-11-12', 20, 60)]
const build = (workouts, extra = {}) => buildWeeklyProgress({ workouts, weekStart: '2026-11-16', now: weeklyNow, timeZone: 'America/Sao_Paulo', ...extra })
describe('weekly aggregation', () => {
  it('matches the Wednesday fixture without counting the previous Thursday', () => {
    const result = build(referenceWeek())
    expect(result.metrics).toMatchObject({ workouts: 2, activeDays: 2, completedSets: 24, durationSeconds: 5400, exerciseOccurrences: 2, uniqueExercises: 1, completedReps: 240 })
    expect(result.previousMetrics).toMatchObject({ workouts: 2, activeDays: 2, completedSets: 18, durationSeconds: 4800 })
    expect(result.deltas.completedSets.absolute).toBe(6)
    expect(result.deltas.durationSeconds.absolute).toBe(600)
    expect(result.days.filter(day => day.isFuture)).toHaveLength(4)
    expect(result.muscles.actualLoad.chest).toBe(24)
    expect(result.muscles.actualLoad.triceps).toBeCloseTo(9.6)
    expect(result.muscles.directSets.chest).toBe(24)
    expect(result.muscles.directSets.triceps).toBe(0)
  })
  it('compares complete weeks and keeps the same metrics in the lightweight preview', () => {
    const args = { workouts: referenceWeek(), weekStart: '2026-11-09', now: weeklyNow, timeZone: 'America/Sao_Paulo' }
    const full = buildWeeklyProgress(args), preview = buildWeeklyPreview(args)
    expect(full.metrics.completedSets).toBe(38)
    expect(full.comparisonPeriod.comparableDays).toBe(7)
    expect(full.metrics).toMatchObject(preview.metrics)
    expect(preview.days).toEqual(full.days)
    expect(preview).not.toHaveProperty('performance')
  })
  it('handles empty and unknown-duration history without invented zeros', () => {
    expect(build([]).metrics.durationSeconds).toBeNull()
    const result = build([weeklyWorkout('a', '2026-11-16', 3, null), weeklyWorkout('b', '2026-11-16', 2, 10)])
    expect(result.metrics).toMatchObject({ workouts: 2, activeDays: 1, durationSeconds: 600, durationKnownWorkouts: 1 })
    expect(result.coverage.unknownDurationWorkouts).toBe(1)
    expect(result.deltas.durationSeconds.comparable).toBe(false)
  })
  it('deduplicates IDs by revision without combining legitimately identical names', () => {
    const a = weeklyWorkout('a', '2026-11-16', 2, 40, { revision: 1 })
    const updated = weeklyWorkout('a', '2026-11-16', 5, 40, { revision: 2 })
    const b = weeklyWorkout('b', '2026-11-16', 3, 40, { name: a.name })
    expect(build([updated, a, b]).metrics).toMatchObject({ workouts: 2, activeDays: 1, completedSets: 8 })
    expect(build([a, b, updated]).metrics).toEqual(build([updated, a, b]).metrics)
  })
  it.each(['active', 'draft', 'cancelled', 'canceled', 'abandoned', 'discarded'])('excludes %s sessions', status => {
    expect(build([weeklyWorkout('a', '2026-11-16', 3, 40, { status })]).metrics.workouts).toBe(0)
  })
  it('excludes invalid records, missing dates and future conclusions', () => {
    expect(build([null, {}, { id: 'bad', entries: [] }, weeklyWorkout('future', '2026-11-19'), weeklyWorkout('invalid', '2026-02-30')]).metrics.workouts).toBe(0)
    expect(build([weeklyWorkout('date', '2026-11-16', 1, 40, { end: Date.parse('2026-11-19T00:00:00Z') })]).metrics.workouts).toBe(0)
  })
  it('uses completion date before legacy start date', () => {
    expect(build([weeklyWorkout('midnight', '2026-11-15', 2, 40, { end: Date.parse('2026-11-16T03:05:00Z') })]).metrics.workouts).toBe(1)
  })
  it('counts supersets once and excludes incomplete and warmup rows', () => {
    const workout = weeklyWorkout('a', '2026-11-16', 1)
    workout.entries[0].sg = 'pair'
    workout.entries[0].sets.push({ done: false, w: 20, r: 10 }, { done: true, phase: 'warmup', w: 10, r: 10 })
    workout.entries.push({ ...workout.entries[0], id: 'custom', target: { side: true }, sets: [{ done: true, r: 16, w: 10 }] })
    expect(build([workout]).metrics).toMatchObject({ completedSets: 2, completedReps: 26, uniqueExercises: 2, exerciseOccurrences: 2 })
  })
  it('does not turn seconds/cardio into reps and includes unweighted sets', () => {
    const workout = weeklyWorkout('a', '2026-11-16', 0)
    workout.entries = [{ id: 'hold', target: { mode: 'time' }, sets: [{ done: true, sec: 30, r: 100 }] }, { id: 'cardio', target: { mode: 'cardio' }, sets: [{ done: true, min: 10 }] }, { id: 'pushup', sets: [{ done: true, r: 12 }] }]
    expect(build([workout]).metrics).toMatchObject({ completedSets: 3, completedReps: 12 })
  })
  it('keeps unknown muscle work in general metrics and respects custom snapshots', () => {
    const workout = weeklyWorkout('a', '2026-11-16', 2)
    workout.entries.push({ id: 'deleted', muscleSnapshot: { muscleWeights: {} }, sets: [{ done: true, r: 8 }] })
    const result = build([workout])
    expect(result.metrics.completedSets).toBe(3)
    expect(result.muscles.unknownMuscleSets).toBe(1)
    expect(result.muscles.actualLoad.chest).toBe(2)
  })
  it('uses matched snapshot coverage for both planning totals and permits extra sets', () => {
    const workout = weeklyWorkout('a', '2026-11-16', 3)
    workout.comparison = { version: 1, origin: 'personal', planned: [{ exerciseId: '0025', workSets: 4, muscleWeights: { chest: 1 } }], adjusted: [{ exerciseId: '0025', workSets: 2, muscleWeights: { chest: 1 } }], flexApplied: true }
    const result = build([workout, weeklyWorkout('legacy', '2026-11-17', 10)])
    expect(result.planning).toMatchObject({ eligibleWorkouts: 1, totalWorkouts: 2, originalSets: 4, adjustedSets: 2, actualSets: 3, originalCompletion: 75, adjustedCompletion: 150 })
    expect(result.coverage).toMatchObject({ snapshotWorkouts: 1, legacyWorkouts: 1 })
  })
  it('does not invent adjusted planning or zero bars for legacy and freestyle', () => {
    for (const comparison of [undefined, { version: 1, origin: 'freestyle', planned: [], adjusted: [] }, { version: 1, origin: 'personal', planned: [], adjusted: null }]) {
      expect(build([weeklyWorkout('a', '2026-11-16', 2, 40, { comparison })]).planning).toMatchObject({ eligibleWorkouts: 0, originalSets: null, adjustedSets: null, actualSets: null })
    }
  })
  it('does not mutate input or depend on input order', () => {
    const workouts = referenceWeek(), before = structuredClone(workouts)
    expect(build(workouts).metrics).toEqual(build([...workouts].reverse()).metrics)
    expect(workouts).toEqual(before)
  })
  it('resolves an old custom exercise from the provided catalogue while preserving saved weights', () => {
    const workout = weeklyWorkout('custom', '2026-11-16', 0)
    workout.entries = [{ id: 'custom-old', sets: [{ done: true, r: 10 }] }]
    expect(build([workout], { exerciseCatalog: { 'custom-old': { muscleWeights: { biceps: 1 } } } }).muscles.actualLoad.biceps).toBe(1)
    workout.entries[0].muscleSnapshot = { muscleWeights: { chest: 1 } }
    expect(build([workout], { exerciseCatalog: { 'custom-old': { muscleWeights: { biceps: 1 } } } }).muscles.actualLoad.chest).toBe(1)
  })
  it('handles thousands of sessions interactively without a brittle time gate', () => {
    const history = Array.from({ length: 5000 }, (_, index) => weeklyWorkout(`s${index}`, '2026-11-16', 3, 40))
    const started = performance.now(), result = build(history)
    console.info(`weekly aggregation 5000 sessions: ${Math.round(performance.now() - started)}ms`)
    expect(result.metrics).toMatchObject({ workouts: 5000, completedSets: 15000 })
  })
})

describe('metric deltas', () => {
  it.each([[4, 3, 1, 33.33, 'up'], [3, 4, -1, -25, 'down'], [3, 3, 0, 0, 'same'], [4, 0, 4, null, 'up'], [0, 0, 0, 0, 'same']])('compares %s to %s', (current, previous, absolute, percentage, direction) => {
    expect(buildMetricDelta(current, previous)).toEqual({ current, previous, absolute, percentage, direction, comparable: true })
  })
  it.each([null, undefined, NaN, Infinity, -1])('makes absent or invalid values unavailable', value => {
    expect(buildMetricDelta(value, 2).comparable).toBe(false)
  })
})

it('keeps legacy muscular estimates without inventing historical direct attribution', () => {
  const legacy = weeklyWorkout('legacy', '2026-11-16')
  delete legacy.entries[0].muscleSnapshot
  const result = build([legacy])
  expect(result.muscles.actualLoad.chest).toBeGreaterThan(0)
  expect(result.muscles.directSets.chest).toBeNull()
  expect(result.coverage.estimatedMuscleSets).toBe(3)
})

it('keeps the compact preview from reading series outside the comparable weeks', () => {
  const old = { id: 'old', d: '2020-01-01', entries: [{ id: '0025', get sets() { throw new Error('historical series must stay lazy in preview') } }] }
  const preview = buildWeeklyPreview({ workouts: [old, weeklyWorkout('current', '2026-11-16')], now: weeklyNow, timeZone: 'America/Sao_Paulo' })
  expect(preview.metrics.completedSets).toBe(3)
})

it('reconciles completedAt-only duplicates by their latest canonical completion', () => {
  const earlier = weeklyWorkout('same', '2026-11-16', 3, 30, { completedAt: '2026-11-16T12:00:00Z' })
  const later = weeklyWorkout('same', '2026-11-16', 5, 40, { completedAt: '2026-11-16T13:00:00Z' })
  expect(build([later, earlier]).metrics.completedSets).toBe(5)
  expect(build([earlier, later]).metrics.completedSets).toBe(5)
})
