import { describe, expect, it } from 'vitest'
import { mergeImport, parseWorkoutCSV } from './import-csv.js'

const CSV = [
  'Date,Exercise,Weight,Reps,Set Type',
  '2026-08-08,Bench Press,100,5,Warm-up',
  '2026-08-08,Bench Press,80,5,Working',
].join('\n')

describe('CSV warm-up provenance', () => {
  it('retains the imported warm-up phase and excludes it from topW', () => {
    const parsed = parseWorkoutCSV(CSV, { unit: 'kg' })
    const entry = parsed.workouts[0].entries[0]

    expect(parsed.warmups).toBe(1)
    expect(entry.sets).toEqual([
      { w: 100, r: 5, done: true, phase: 'warmup' },
      { w: 80, r: 5, done: true },
    ])
    expect(entry.topW).toBe(80)
  })

  it('syncs the profile current weight after importing bodyweight history', () => {
    const state = {
      body: 'male',
      profile: { startWeight: 80 },
      bodyweight: [{ d: '2026-09-08', w: 79.5, t: 1 }],
      workouts: [], customEx: [], exWeights: {},
    }

    const result = mergeImport(state, {
      kind: 'bodyweight',
      bodyweight: [{ d: '2026-09-09', w: 79.1, t: 2 }],
    })

    expect(result).toEqual({ added: 1, skipped: 0 })
    expect(state.profile.startWeight).toBe(79.1)
  })
})
