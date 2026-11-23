import { describe, expect, it } from 'vitest'
import { MUSCLES } from './muscles.js'
import {
  compareTraining, confirmTrainingComparison, createTrainingComparison,
  normalizeTrainingComparison, snapshotTrainingEntries,
} from './training-comparison.js'

const rows = (count, done = false) => Array.from({ length: count }, () => ({ done }))
const entry = (id, count, done = false, extra = {}) => ({ id, sets: rows(count, done), ...extra })
const snap = (exerciseId, workSets, muscleWeights) => ({ exerciseId, workSets, muscleWeights })
const metadata = (planned, adjusted = planned, extra = {}) => ({
  version: 1, origin: 'personal', planned, adjusted, flexApplied: false, ...extra,
})
const workout = (entries, planned, adjusted = planned, extra = {}) => ({
  entries, comparison: metadata(planned, adjusted, extra),
})
const muscle = (result, id) => result.muscles.find(item => item.id === id)

describe('training prescription snapshots', () => {
  it('freezes original work sets and catalogue weights before Flex changes entries', () => {
    const original = [entry('0025', 3), entry('0043', 4)]
    original[0].sets.unshift({ phase: 'warmup' })
    const comparison = createTrainingComparison(original)
    expect(comparison).toEqual({
      version: 1, origin: 'personal', adjusted: null, flexApplied: false,
      planned: [
        snap('0025', 3, { chest: 1, triceps: 0.4, deltoids: 0.4 }),
        snap('0043', 4, { gluteal: 1, quadriceps: 0.4, hamstring: 0.4, calves: 0.4, abs: 0.4 }),
      ],
    })
    original[0].sets.pop()
    expect(comparison.planned[0].workSets).toBe(3)
  })

  it('captures an unchanged adjusted prescription on start without claiming Flex', () => {
    const entries = [entry('0025', 3)]
    const comparison = createTrainingComparison(entries)
    const confirmed = confirmTrainingComparison({ entries, comparison, flex: { mode: 'full' } })
    expect(confirmed.adjusted).toEqual(comparison.planned)
    expect(confirmed.adjusted).not.toBe(comparison.planned)
    expect(confirmed.flexApplied).toBe(false)
    expect(comparison.adjusted).toBeNull()
  })

  it('retains omitted planned exercises after Flex and only snapshots adjusted once', () => {
    const planned = [entry('0025', 3), entry('0043', 4)]
    const active = {
      entries: planned.slice(0, 1), comparison: createTrainingComparison(planned, 'professional'),
      flex: { mode: 'adapted', phase: 'confirmed' },
    }
    const confirmed = confirmTrainingComparison(active)
    expect(confirmed.origin).toBe('professional')
    expect(confirmed.planned).toHaveLength(2)
    expect(confirmed.adjusted).toHaveLength(1)
    expect(confirmed.flexApplied).toBe(true)
    const restarted = confirmTrainingComparison({ ...active, comparison: confirmed, entries: [] })
    expect(restarted).toEqual(confirmed)
    expect(restarted).not.toBe(confirmed)
  })

  it('keeps freestyle free of a fabricated reference at creation and start', () => {
    const entries = [entry('0025', 3)]
    const comparison = createTrainingComparison(entries, 'freestyle')
    expect(comparison.planned).toEqual([])
    const confirmed = confirmTrainingComparison({ entries, comparison, flex: { mode: 'adapted' } })
    expect(confirmed.adjusted).toEqual([])
    expect(confirmed.flexApplied).toBe(false)
    const result = compareTraining({ entries: [entry('0025', 2, true)], comparison: confirmed })
    expect(result.loads.planned).toBeNull()
    expect(result.loads.adjusted).toBeNull()
    expect(result.reference).toBeNull()
    expect(result.summary.percent).toBeNull()
  })

  it('resolves custom prescriptions and preserves repeated exercise positions', () => {
    const custom = { id: 'custom', bp: 'upper legs' }
    const snapshots = snapshotTrainingEntries([
      { id: 'custom', sets: 2 }, { id: 'custom', sets: 3 },
    ], id => id === 'custom' ? custom : null)
    expect(snapshots).toEqual([
      snap('custom', 2, { quadriceps: 0.4, hamstring: 0.35, gluteal: 0.25 }),
      snap('custom', 3, { quadriceps: 0.4, hamstring: 0.35, gluteal: 0.25 }),
    ])
    custom.bp = 'chest'
    expect(snapshots[0].muscleWeights.quadriceps).toBe(0.4)
  })

  it('preserves explicit zero sets and ignores malformed or negative prescriptions', () => {
    expect(snapshotTrainingEntries([
      null, 2, {}, { id: '' }, { id: 'negative', sets: -2 },
      { id: 'infinite', sets: Infinity }, { id: 'zero', sets: 0 },
      { id: 'mixed', sets: [null, false, {}, { warmup: true }, { phase: 'work', warmup: true }] },
    ])).toEqual([snap('zero', 0, {}), snap('mixed', 2, {})])
  })
})

describe('performed weighted sets', () => {
  it('compares a full session without Flex against the adjusted prescription', () => {
    const planned = [snap('0025', 3, { chest: 1, triceps: 0.4 })]
    const result = compareTraining(workout([entry('0025', 3, true)], planned))
    expect(result.reference).toBe('adjusted')
    expect(result.summary).toMatchObject({ plannedSets: 3, adjustedSets: 3, actualSets: 3, referenceSets: 3, percent: 100 })
    expect(muscle(result, 'chest')).toMatchObject({ planned: 3, adjusted: 3, actual: 3, percent: 100, delta: 0, state: 'matched' })
    expect(result.loads.actual.triceps).toBeCloseTo(1.2)
  })

  it('uses the Flex adjustment as the denominator while displaying omitted planned load', () => {
    const planned = [snap('0025', 4, { chest: 1 }), snap('0043', 4, { gluteal: 1 })]
    const adjusted = [snap('0025', 2, { chest: 1 })]
    const result = compareTraining(workout([entry('0025', 2, true)], planned, adjusted, { flexApplied: true }))
    expect(result.summary).toMatchObject({ plannedSets: 8, adjustedSets: 2, actualSets: 2, percent: 100 })
    expect(muscle(result, 'gluteal')).toMatchObject({ planned: 4, adjusted: 0, actual: 0, percent: null })
    expect(result.flexApplied).toBe(true)
  })

  it('counts a partially completed exercise from done work rows only', () => {
    const entries = [{ id: '0025', sets: [{ done: true }, { done: false }, {}, { done: 'true' }] }]
    const result = compareTraining(workout(entries, [snap('0025', 4, { chest: 1 })]))
    expect(result.summary.actualSets).toBe(1)
    expect(result.summary.percent).toBe(25)
    expect(muscle(result, 'chest')).toMatchObject({ actual: 1, percent: 25, state: 'below' })
  })

  it('ignores all warmup aliases while an explicit work phase wins over the legacy flag', () => {
    const sets = [
      { done: true, phase: 'warmup' }, { done: true, phase: 'warm-up' },
      { done: true, warmup: true }, { done: true, phase: 'work', warmup: true },
      { done: false, phase: 'work' }, null, false,
    ]
    const result = compareTraining({ entries: [{ id: '0025', sets }] })
    expect(result.summary.actualSets).toBe(1)
    expect(result.loads.actual.chest).toBe(1)
  })

  it('counts each superset member independently without collapsing the group', () => {
    const result = compareTraining({ entries: [entry('0025', 3, true, { sg: 'a' }), entry('0043', 3, true, { sg: 'a' })] })
    expect(result.summary.actualSets).toBe(6)
    expect(result.summary.actualExercises).toBe(2)
    expect(result.loads.actual.chest).toBe(3)
    expect(result.loads.actual.gluteal).toBe(3)
  })

  it('does not double unilateral rows and sums repeated exercise entries', () => {
    const result = compareTraining({ entries: [
      entry('0025', 2, true, { target: { side: true } }), entry('0025', 3, true),
    ] })
    expect(result.loads.actual.chest).toBe(5)
    expect(result.summary.actualSets).toBe(5)
    expect(result.summary.actualExercises).toBe(2)
  })

  it('shows a substituted movement in actual load while retaining both original snapshots', () => {
    const planned = [snap('0025', 3, { chest: 1 })]
    const actual = entry('custom-row', 3, true, { replacedFrom: '0025', muscleSnapshot: { muscleWeights: { 'upper-back': 1 } } })
    const result = compareTraining(workout([actual], planned))
    expect(muscle(result, 'chest')).toMatchObject({ planned: 3, adjusted: 3, actual: 0, state: 'below' })
    expect(muscle(result, 'upper-back')).toMatchObject({ planned: 0, adjusted: 0, actual: 3, percent: null, state: 'above' })
    expect(result.summary.actualSets).toBe(3)
  })

  it('includes an exercise added during the session and leaves percentages above 100', () => {
    const planned = [snap('0025', 2, { chest: 1 })]
    const result = compareTraining(workout([entry('0025', 2, true), entry('0025', 1, true)], planned))
    expect(result.summary.percent).toBe(150)
    expect(muscle(result, 'chest')).toMatchObject({ actual: 3, percent: 150, delta: 1, state: 'above' })
  })

  it('uses a saved custom snapshot after deletion from the catalogue', () => {
    const result = compareTraining({ entries: [entry('deleted-custom', 2, true, { muscleSnapshot: { muscleWeights: { abs: 0.7, obliques: 0.3 } } })] })
    expect(result.loads.actual.abs).toBeCloseTo(1.4)
    expect(result.loads.actual.obliques).toBeCloseTo(0.6)
  })

  it('always prefers a recorded snapshot over changed catalogue and direct entry metadata', () => {
    const changed = entry('0025', 2, true, { tg: 'chest', muscleSnapshot: { muscleWeights: { biceps: 0.5 } } })
    const result = compareTraining({ entries: [changed] })
    expect(result.loads.actual.biceps).toBe(1)
    expect(result.loads.actual.chest).toBe(0)
    const emptySnapshot = compareTraining({ entries: [entry('0025', 2, true, { muscleSnapshot: {} })] })
    expect(emptySnapshot.loads.actual.chest).toBe(0)
  })

  it('counts cardio work without inventing drawable muscles', () => {
    const cardio = entry('cardio-only', 1, true, { muscleSnapshot: { bp: 'cardio' }, target: { mode: 'cardio' } })
    const result = compareTraining(workout([cardio], [snap('cardio-only', 1, {})]))
    expect(result.summary.actualSets).toBe(1)
    expect(result.summary.percent).toBe(100)
    expect(Object.values(result.loads.actual).every(value => value === 0)).toBe(true)
    expect(result.summary.matchedMuscles).toBe(0)
  })

  it('keeps legacy history actual-only without reconstructing a plan', () => {
    const result = compareTraining({ entries: [entry('0025', 2, true)], prescribedEntries: [{ id: '0025', sets: 4 }] })
    expect(result.hasComparison).toBe(false)
    expect(result.loads.planned).toBeNull()
    expect(result.loads.adjusted).toBeNull()
    expect(result.loads.actual.chest).toBe(2)
    expect(result.summary.percent).toBeNull()
    expect(result.summary.plannedSets).toBeNull()
    expect(muscle(result, 'chest').state).toBe('unreferenced')
  })

  it('does not use an original plan as a denominator before adjusted is captured', () => {
    const result = compareTraining(workout([entry('0025', 1, true)], [snap('0025', 3, { chest: 1 })], null))
    expect(result.hasPlanned).toBe(true)
    expect(result.hasAdjusted).toBe(false)
    expect(result.loads.planned.chest).toBe(3)
    expect(result.reference).toBeNull()
    expect(result.summary.percent).toBeNull()
  })

  it('handles an empty workout and a zero reference without NaN or infinity', () => {
    const result = compareTraining(workout([], [snap('zero', 0, { chest: 1 })], []))
    expect(result.hasAdjusted).toBe(true)
    expect(result.reference).toBeNull()
    expect(result.summary).toMatchObject({ plannedSets: 0, adjustedSets: 0, actualSets: 0, referenceSets: null, percent: null })
    expect(result.muscles).toHaveLength(18)
    expect(Object.values(result.levels.actual).every(level => level === 0)).toBe(true)
    expect(() => compareTraining(null)).not.toThrow()
  })

  it('keeps fractional muscle loads and ignores invalid weights without NaN', () => {
    const weights = { chest: 0.35, triceps: -1, abs: Infinity, biceps: NaN, invented: 1 }
    const planned = [snap('custom', 3, weights)]
    const result = compareTraining(workout([entry('custom', 2, true, { muscleSnapshot: { muscleWeights: weights } })], planned))
    expect(result.loads.planned.chest).toBeCloseTo(1.05)
    expect(result.loads.actual.chest).toBeCloseTo(0.7)
    expect(muscle(result, 'chest').percent).toBeCloseTo(200 / 3)
    expect(result.loads.actual.triceps).toBe(0)
    expect(Object.keys(result.loads.actual)).toEqual(MUSCLES)
    expect(Object.values(result.loads.actual).every(Number.isFinite)).toBe(true)
  })

  it('shares one shade scale across planned, adjusted and actual loads for the session', () => {
    const planned = [snap('custom', 8, { chest: 1, abs: 0.25 })]
    const adjusted = [snap('custom', 4, { chest: 1, abs: 0.25 })]
    const result = compareTraining(workout([entry('custom', 2, true, { muscleSnapshot: { muscleWeights: { chest: 1, abs: 0.25 } } })], planned, adjusted))
    expect(result.levels.planned.chest).toBe(4)
    expect(result.levels.adjusted.chest).toBe(3)
    expect(result.levels.actual.chest).toBe(2)
    expect(result.levels.planned.abs).toBe(result.levels.actual.chest)
    expect(result.levels.actual.abs).toBe(1)
  })

  it('reports missing work even when a valid reference has a very small fractional weight', () => {
    const result = compareTraining(workout([], [snap('tiny', 1, { chest: 1e-12 })]))
    expect(muscle(result, 'chest')).toMatchObject({ actual: 0, reference: 1e-12, percent: 0, state: 'below' })
    expect(result.summary.belowMuscles).toBe(1)
  })
})

describe('comparison metadata boundaries', () => {
  it('normalizes a detached JSON-safe snapshot and drops invalid inner data', () => {
    const source = metadata([
      snap('custom', 2, { chest: 0.4, unknown: 2, abs: -2, biceps: NaN }),
      snap('bad', -1, { chest: 1 }), null,
    ], null)
    const normalized = normalizeTrainingComparison(source)
    expect(normalized).toEqual(metadata([snap('custom', 2, { chest: 0.4 })], null))
    expect(normalizeTrainingComparison(JSON.parse(JSON.stringify(normalized)))).toEqual(normalized)
    normalized.planned[0].muscleWeights.chest = 9
    expect(source.planned[0].muscleWeights.chest).toBe(0.4)
  })

  it('drops malformed work counts and weights while keeping explicit zero and finite fractions', () => {
    const source = metadata([
      ...[-1, NaN, Infinity, -Infinity, '3', true, null, undefined].map(count => snap('bad', count, { chest: 1 })),
      snap('zero', 0, { chest: 1 }),
      snap('fraction', 0.5, { chest: 0.25, abs: '1', biceps: true, triceps: null, 'upper arms': 1 }),
      snap('bad-weights', 1, ['chest']),
    ], [])
    expect(normalizeTrainingComparison(source).planned).toEqual([
      snap('zero', 0, { chest: 1 }), snap('fraction', 0.5, { chest: 0.25 }), snap('bad-weights', 1, {}),
    ])
    const result = compareTraining({ comparison: source, entries: [] })
    expect(result.summary.plannedSets).toBe(1.5)
    expect(result.loads.planned.chest).toBe(0.125)
  })

  it('separates original, adjusted, and source maps even if the input arrays were aliased', () => {
    const shared = [snap('custom', 2, { chest: 0.4 })]
    const source = metadata(shared, shared, { origin: 'repeat' })
    const normalized = normalizeTrainingComparison(source)
    normalized.adjusted[0].muscleWeights.chest = 0.8
    expect(normalized.origin).toBe('repeat')
    expect(normalized.planned[0].muscleWeights.chest).toBe(0.4)
    expect(shared[0].muscleWeights.chest).toBe(0.4)
  })

  it('keeps arithmetic finite when corrupt finite magnitudes overflow on multiplication or summation', () => {
    const huge = Number.MAX_VALUE
    const reference = [snap('huge', huge, { chest: huge }), snap('huge-again', huge, { abs: 1 })]
    const result = compareTraining(workout([], reference))
    expect(Number.isFinite(result.summary.adjustedSets)).toBe(true)
    expect(Object.values(result.loads.adjusted).every(Number.isFinite)).toBe(true)
    expect(Object.values(result.levels.adjusted).every(Number.isFinite)).toBe(true)
    expect(result.loads.adjusted.chest).toBe(0)
    expect(result.loads.adjusted.abs).toBe(huge)
  })

  it.each([undefined, null, [], 'bad', {}, { version: 2 }, metadata(null), metadata([], 'bad'), metadata([], [], { origin: 'unknown' })])('rejects invalid metadata without losing performed work (%j)', value => {
    expect(normalizeTrainingComparison(value)).toBeNull()
    const result = compareTraining({ comparison: value, entries: [entry('0025', 1, true)] })
    expect(result.hasComparison).toBe(false)
    expect(result.loads.actual.chest).toBe(1)
  })

  it('does not synthesize comparison metadata for an already active legacy workout', () => {
    expect(confirmTrainingComparison({ entries: [entry('0025', 3)] })).toBeNull()
  })

  it('does not mutate input entries, snapshots, or frozen comparison metadata', () => {
    const source = workout([entry('0025', 2, true)], [snap('0025', 3, { chest: 1 })])
    const before = JSON.stringify(source)
    const freeze = value => {
      if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
      return value
    }
    freeze(source)
    const result = compareTraining(source)
    result.loads.actual.chest = 99
    normalizeTrainingComparison(source.comparison)
    confirmTrainingComparison(source)
    expect(JSON.stringify(source)).toBe(before)
  })
})
