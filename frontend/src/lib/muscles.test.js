import { describe, expect, it } from 'vitest'
import { EXDB as SOURCE_EXERCISES } from './exercises-data.js'
import { EXIDX, EXDB, smOf } from './exercises.js'
import { loadOfWorkouts, musclesOf } from './muscles.js'

// The catalogue keeps the source dataset's secondary-muscle spellings; musclesOf maps
// those aliases to the canonical body-map slugs and applies the 0.4 support weight.
describe('catalogue secondary muscles', () => {
  it('maps an incline bench press to chest, triceps and deltoids', () => {
    expect(musclesOf(EXIDX['0047'])).toMatchObject({
      chest: 1,
      triceps: 0.4,
      deltoids: 0.4,
    })
  })

  it('maps a front squat to glutes, quads and hamstrings', () => {
    expect(musclesOf(EXIDX['0042'])).toMatchObject({
      gluteal: 1,
      quadriceps: 0.4,
      hamstring: 0.4,
    })
  })

  it('maps common row variations to the upper back and biceps', () => {
    expect(musclesOf(EXIDX['3017'])).toMatchObject({
      'upper-back': 1,
      biceps: 0.4,
      forearm: 0.4,
    })
    expect(musclesOf(EXIDX['3165'])).toMatchObject({
      'upper-back': 1,
      biceps: 0.4,
      deltoids: 0.4,
    })
  })
})


describe('catalogue secondary additions', () => {
  it('enriches the muscle map without mutating the raw dataset', () => {
    const raw = SOURCE_EXERCISES.find(e => e.id === '0027')
    expect(raw.sm).not.toContain('rear deltoids')
    expect(smOf(raw)).toContain('rear deltoids')
    // the alias collapses onto the deltoids slug in the canonical muscle map
    expect(musclesOf(raw)).toHaveProperty('deltoids')
  })
})


describe('map load with warm-up phases', () => {
  it('excludes warm-up sets from the by-sets-worked map', () => {
    const w = {
      id: 'w1', d: '2026-08-01', start: Date.UTC(2026, 7, 1, 10), unit: 'kg',
      entries: [{
        id: '0047',
        sets: [
          { done: true, phase: 'warmup', w: 20, r: 8 },
          { done: true, phase: 'work', w: 60, r: 8 },
        ],
      }],
    }
    const load = loadOfWorkouts([w], null)
    expect(load.chest).toBe(1)
  })
})
