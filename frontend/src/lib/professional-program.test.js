import { describe, expect, it } from 'vitest'
import { nextScheduledWorkouts, normalizeWeeklyPlan, summarizeWeeklyPlan, validateWeeklyPlan, validateAvailableWeeklyPlan } from './professional-program.js'
import { EXDB } from './exercises-data.js'
import { EXERCISE_SPRITE_EXERCISE_IDS } from './exercise-guide-assets.js'

describe('professional program contracts', () => {
  it('rejects pending and unknown exercises for new prescriptions, while reading legacy records', () => {
    const pending = EXDB.find(ex => !EXERCISE_SPRITE_EXERCISE_IDS.includes(ex.id)).id
    for (const id of [pending, 'unknown']) {
      const plan = { monday: [{ exerciseId: id, sets: 3, reps: 10 }] }
      expect(validateAvailableWeeklyPlan(plan)).toMatchObject({ ok: false, error: 'weekly-plan-exercise-unavailable' })
      expect(normalizeWeeklyPlan(plan).monday[0].exerciseId).toBe(id)
    }
    expect(validateAvailableWeeklyPlan({ monday: [{ exerciseId: '0025', sets: 3, reps: 10 }] }).ok).toBe(true)
  })
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

  it('preserves timed, cardio, effort, units and grouping prescriptions', () => {
    const entry = { exerciseId: '1', sets: 2, reps: 8, mode: 'cardio', min: 25, speed: 6.5, unit: 'lb', rest: 0, notes: 'Leve', effort: 'rpe', rpe: 6, sg: 'a' }
    expect(normalizeWeeklyPlan({ monday: [entry] }).monday[0]).toMatchObject(entry)
  })

  it('rejects nonfinite and out-of-range values instead of silently normalizing them', () => {
    for (const patch of [{ sets: NaN }, { reps: Infinity }, { load: 'invalid' }, { rest: -1 }, { sec: Infinity }, { rpe: 11 }]) {
      expect(validateWeeklyPlan({ monday: [{ exerciseId: '1', sets: 3, reps: 8, ...patch }] }).ok).toBe(false)
    }
  })

  it('uses the local calendar near a UTC midnight', () => {
    const local = new Date(2026, 9, 2, 23, 30)
    const result = nextScheduledWorkouts({ friday: [{ exerciseId: '1' }] }, local, 1)
    expect(result[0]).toMatchObject({ day: 'friday', date: '2026-10-02' })
  })
})
