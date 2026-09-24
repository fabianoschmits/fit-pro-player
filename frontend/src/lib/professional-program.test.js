import { describe, expect, it } from 'vitest'
import { nextScheduledWorkouts, normalizeWeeklyPlan, summarizeWeeklyPlan, validateWeeklyPlan } from './professional-program.js'

describe('professional program contracts', () => {
  it('normalizes a weekly plan and drops invalid exercises', () => {
    const plan = normalizeWeeklyPlan({ monday: [{ exerciseId: '1254', sets: 3, reps: 8, load: 40, rest: 90 }, { exerciseId: '' }], FUNDAY: [{ exerciseId: '1' }] })
    expect(plan).toEqual({ monday: [{ exerciseId: '1254', sets: 3, reps: 8, load: 40, rest: 90 }] })
  })

  it('rejects malformed plans without throwing', () => {
    expect(validateWeeklyPlan({ monday: [{ exerciseId: '', sets: 0 }] })).toMatchObject({ ok: false })
    expect(validateWeeklyPlan({ monday: [{ exerciseId: '1254', sets: 3, reps: 8 }] })).toMatchObject({ ok: true })
  })

  it('summarizes exercises and returns upcoming scheduled days', () => {
    const plan = { monday: [{ exerciseId: '1254' }, { exerciseId: '2' }], wednesday: [{ exerciseId: '3' }] }
    expect(summarizeWeeklyPlan(plan)).toMatchObject({ days: 2, exercises: 3 })
    expect(nextScheduledWorkouts(plan, new Date('2026-09-27T12:00:00Z'), 2).map(item => item.day)).toEqual(['monday', 'wednesday'])
  })
})
