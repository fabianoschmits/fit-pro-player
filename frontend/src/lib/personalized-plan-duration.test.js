import { describe, expect, it } from 'vitest'
import { personalizedRoutineSpecs } from './personalized-plan.js'
import { estimateWorkoutDuration } from './workout-duration.js'

describe('duration-specific ready-made plans', () => {
  it('plans approximately one hour rather than leaving the default session half empty', () => {
    for (const goal of ['lose_weight', 'build_muscle', 'improve_fitness', 'maintain_weight']) {
      for (const experience of ['beginner', 'intermediate', 'advanced']) {
        for (const routine of personalizedRoutineSpecs({ goal, experience, preferredWorkoutMinutes: 60 }, 3)) {
          const minutes = estimateWorkoutDuration(routine.ex) / 60
          expect(minutes, `${goal}/${experience}/${routine.personalizedKey}`).toBeGreaterThanOrEqual(50)
          expect(minutes).toBeLessThanOrEqual(61)
        }
      }
    }
  })
  it('offers focused and mixed templates and bounds resistance volume at long durations', () => {
    const routines = personalizedRoutineSpecs({ goal: 'build_muscle', experience: 'beginner', preferredWorkoutMinutes: 90 }, 3, { daily: true })
    expect(routines.length).toBeGreaterThanOrEqual(28)
    for (const key of ['biceps', 'triceps', 'forearms', 'calves', 'full_a', 'legs_core']) {
      const routine = routines.find(item => item.personalizedKey === key)
      expect(routine).toBeTruthy()
      expect(routine.ex.filter(ex => ex.mode !== 'cardio').reduce((sum, ex) => sum + ex.sets, 0)).toBeLessThanOrEqual(20)
    }
  })
  it('uses more aerobic work for weight loss and keeps short sessions within the target', () => {
    const profile = { experience: 'intermediate', preferredWorkoutMinutes: 60 }
    const cardio = routine => routine.ex.filter(ex => ex.mode === 'cardio').reduce((sum, ex) => sum + ex.min, 0)
    const loss = personalizedRoutineSpecs({ ...profile, goal: 'lose_weight' }, 3)[0]
    const muscle = personalizedRoutineSpecs({ ...profile, goal: 'build_muscle' }, 3)[0]
    expect(cardio(loss)).toBeGreaterThan(cardio(muscle))
    for (const minutes of [15, 20, 30, 40, 45, 75, 90]) {
      const routines = personalizedRoutineSpecs({ ...profile, preferredWorkoutMinutes: minutes }, 3)
      expect(routines.every(routine => estimateWorkoutDuration(routine.ex) <= minutes * 60)).toBe(true)
    }
  })
})
