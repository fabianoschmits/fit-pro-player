import { describe, expect, it } from 'vitest'
import { EXERCISE_SPRITE_EXERCISE_IDS } from './exercise-guide-assets.js'
import {
  applyPersonalizedPlan, personalizedRestSeconds, personalizedRoutineSpecs, splitKeys,
} from './personalized-plan.js'

const goals = ['lose_weight', 'build_muscle', 'improve_fitness', 'maintain_weight']
const experiences = ['beginner', 'intermediate', 'advanced']
const activeIds = new Set(EXERCISE_SPRITE_EXERCISE_IDS)

const profile = (goal = 'maintain_weight', experience = 'beginner', startWeight = 72) => ({
  goal, experience, startWeight,
})

const state = () => ({
  routines: [], dayPlan: {}, workouts: [], bodyweight: [], targetW: 72,
})

const workSets = routines => routines.flatMap(routine => routine.ex)
  .reduce((total, exercise) => total + (exercise.sets || 0), 0)

describe('personalized training plans', () => {
  it('produces a complete sprite-backed plan for every supported combination', () => {
    for (const goal of goals) {
      for (const experience of experiences) {
        for (let days = 1; days <= 7; days++) {
          const routines = personalizedRoutineSpecs(profile(goal, experience), days)
          expect(routines, `${goal}/${experience}/${days}`).toHaveLength(days)
          expect(new Set(routines.map(routine => routine.personalizedKey)).size).toBe(days)
          for (const routine of routines) {
            expect(routine.ex.length).toBeGreaterThanOrEqual(4)
            for (const exercise of routine.ex) {
              expect(activeIds.has(exercise.id), exercise.id).toBe(true)
              expect(exercise.sets).toBeGreaterThan(0)
              if (exercise.mode === 'time') expect(exercise.sec).toBeGreaterThan(0)
              else if (exercise.mode === 'cardio') expect(exercise.min).toBeGreaterThan(0)
              else expect(exercise.repsMax || exercise.reps).toBeGreaterThan(0)
            }
          }
        }
      }
    }
  })

  it('changes the weekly split for each goal and training frequency', () => {
    expect(splitKeys('build_muscle', 3)).toEqual(['push', 'pull', 'legs_core'])
    expect(splitKeys('lose_weight', 3)).toEqual(['full_a', 'conditioning', 'full_b'])
    expect(splitKeys('improve_fitness', 4)).toEqual(['upper', 'conditioning', 'lower', 'cardio_core'])
    expect(splitKeys('maintain_weight', 2)).toEqual(['upper', 'lower'])
  })

  it('uses more volume and larger starting loads as experience and body weight increase', () => {
    const beginner = personalizedRoutineSpecs(profile('build_muscle', 'beginner', 60), 3)
    const advanced = personalizedRoutineSpecs(profile('build_muscle', 'advanced', 90), 3)
    expect(workSets(advanced)).toBeGreaterThan(workSets(beginner))
    const loaded = routines => routines.flatMap(routine => routine.ex).filter(exercise => exercise.weight > 0)
    expect(Math.max(...loaded(advanced).map(exercise => exercise.weight)))
      .toBeGreaterThan(Math.max(...loaded(beginner).map(exercise => exercise.weight)))
    expect(personalizedRestSeconds('build_muscle', 'advanced')).toBeGreaterThan(
      personalizedRestSeconds('lose_weight', 'beginner')
    )
  })

  it('adds conditioning work for weight loss and fitness goals', () => {
    for (const goal of ['lose_weight', 'improve_fitness']) {
      const routines = personalizedRoutineSpecs(profile(goal, 'intermediate'), 3)
      expect(routines.flatMap(routine => routine.ex).some(exercise => ['time', 'cardio'].includes(exercise.mode))).toBe(true)
    }
  })

  it('offers the seven focused workouts in daily mode', () => {
    const routines = personalizedRoutineSpecs(profile('build_muscle', 'intermediate'), 2, { daily: true })
    expect(routines.map(routine => routine.personalizedKey)).toEqual([
      'chest', 'back', 'legs', 'abs', 'arms', 'shoulders', 'glutes',
    ])
  })

  it('replaces only app-managed routines, preserves custom work and reuses routine ids', () => {
    const current = state()
    current.routines = [
      { id: 'managed-a', name: 'Chest Day', starterKey: 'Chest Day', ex: [] },
      { id: 'custom-a', name: 'Meu treino', ex: [{ id: '0025', sets: 2, reps: 8 }] },
    ]
    current.dayPlan['2026-09-08'] = 'managed-a'

    const first = applyPersonalizedPlan(current, profile('lose_weight', 'beginner'), 3)
    expect(first).toHaveLength(3)
    expect(first[0].id).toBe('managed-a')
    expect(current.routines.find(routine => routine.id === 'custom-a')).toBeTruthy()
    expect(current.dayPlan['2026-09-08']).toBe(first[0].id)
    expect(current.restSec).toBe(45)

    const ids = first.map(routine => routine.id)
    const second = applyPersonalizedPlan(current, profile('lose_weight', 'beginner'), 3)
    expect(second.map(routine => routine.id)).toEqual(ids)
    expect(current.routines.filter(routine => routine.id === 'custom-a')).toHaveLength(1)
  })
})
