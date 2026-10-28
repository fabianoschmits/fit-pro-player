import { describe, expect, it } from 'vitest'
import { compareProfessionalPlanVersions } from './professional-plan-diff.js'

const version = (id, weeklyPlan, workoutTitles = {}) => ({ id, weekly_plan: weeklyPlan, workout_titles: workoutTitles })

describe('compareProfessionalPlanVersions', () => {
  it('reports added, removed and changed exercises with prescription fields', () => {
    const result = compareProfessionalPlanVersions(
      version('v1', { monday: [{ exerciseId: 'bench', sets: 3, reps: 10, load: 60, rest: 60 }, { exerciseId: 'fly', sets: 3, reps: 12 }] }, { monday: 'Peito' }),
      version('v2', { monday: [{ exerciseId: 'bench', sets: 4, reps: 8, load: 60, rest: 90 }, { exerciseId: 'press', sets: 3, reps: 10 }] }, { monday: 'Peito' }),
    )

    expect(result.affectedDays).toEqual(['monday'])
    expect(result.days[0].exercises.added.map(item => item.exerciseId)).toEqual(['press'])
    expect(result.days[0].exercises.removed.map(item => item.exerciseId)).toEqual(['fly'])
    expect(result.days[0].exercises.changed).toEqual([{ exerciseId: 'bench', changes: [
      { field: 'sets', previous: 3, next: 4 },
      { field: 'reps', previous: 10, next: 8 },
      { field: 'rest', previous: 60, next: 90 },
    ] }])
  })

  it('reports weekly additions, removals, title changes, substitutions and reordering', () => {
    const result = compareProfessionalPlanVersions(
      version('v1', { monday: [{ exerciseId: 'a' }, { exerciseId: 'b' }], tuesday: [{ exerciseId: 'c' }] }, { monday: 'Treino A', tuesday: 'Treino B' }),
      version('v2', { monday: [{ exerciseId: 'b' }, { exerciseId: 'a' }], wednesday: [{ exerciseId: 'd' }] }, { monday: 'Treino A novo', wednesday: 'Treino C' }),
    )

    expect(result.days.find(day => day.day === 'monday')).toMatchObject({ titleChanged: true, exercises: { reordered: true } })
    expect(result.days.find(day => day.day === 'tuesday')).toMatchObject({ type: 'removed' })
    expect(result.days.find(day => day.day === 'wednesday')).toMatchObject({ type: 'added' })
  })
})
