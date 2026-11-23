import { describe, expect, it } from 'vitest'
import { snapshotSessionExercise, startSessionExecution } from './workout-session.js'

const comparison = () => ({ version: 1, origin: 'personal', planned: [
  { exerciseId: '0025', workSets: 3, muscleWeights: { chest: 1, triceps: .4 } },
  { exerciseId: '0043', workSets: 2, muscleWeights: { quadriceps: 1 } },
], adjusted: null, flexApplied: false })

describe('session execution snapshot boundary', () => {
  it('freezes the confirmed Flex selection once without rewriting the original or source', () => {
    const active = { id: 'session', start: null, comparison: comparison(), flex: { mode: 'adapted', phase: 'confirmed' }, entries: [
      { id: '0025', muscleSnapshot: { muscleWeights: { chest: 1, triceps: .4 } }, sets: [{ warmup: true }, {}, {}, {}] },
    ] }
    const started = startSessionExecution(active, 1000)
    expect(started.start).toBe(1000)
    expect(started.comparison).toMatchObject({ flexApplied: true, planned: [{ exerciseId: '0025', workSets: 3 }, { exerciseId: '0043', workSets: 2 }],
      adjusted: [{ exerciseId: '0025', workSets: 3, muscleWeights: { chest: 1, triceps: .4 } }] })
    expect(active.comparison.adjusted).toBeNull()
    started.entries[0].sets.push({})
    expect(startSessionExecution(started, 2000).comparison.adjusted[0].workSets).toBe(3)
    expect(active.comparison.planned).toHaveLength(2)
  })
  it('does not reconstruct legacy preparation from a current routine', () => {
    expect(startSessionExecution({ id: 'old', start: null, entries: [] }, 1000)).not.toHaveProperty('comparison')
  })
  it('captures muscle metadata by independent copy and prefers an existing historical snapshot', () => {
    const source = { id: 'gone', muscleSnapshot: { n: 'Custom', muscleWeights: { chest: .6, triceps: .4 } }, sets: [] }
    const entry = snapshotSessionExercise(source, { muscleWeights: { quadriceps: 1 } })
    source.muscleSnapshot.muscleWeights.chest = 1
    expect(entry.muscleSnapshot.muscleWeights).toEqual({ chest: .6, triceps: .4 })
    expect(snapshotSessionExercise({ id: 'custom' }, { n: 'Supino', bp: 'chest', custom: true }).muscleSnapshot.muscleWeights).toEqual({ chest: 1 })
  })
})
