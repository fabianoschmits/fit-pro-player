import { describe, expect, it } from 'vitest'
import { parse } from 'posecode-parser'
import { EXDB } from './exercises-data.js'
import { EXERCISE_MOTIONS, exerciseMotion } from './exercise-motion.js'

describe('biblioteca de movimentos dos exercícios', () => {
  it('mantém todos os documentos Posecode válidos e incorporados ao bundle', () => {
    expect(Object.keys(EXERCISE_MOTIONS).length).toBeGreaterThanOrEqual(70)
    for (const [key, source] of Object.entries(EXERCISE_MOTIONS)) {
      const result = parse(source)
      expect(result.errors, key).toEqual([])
      expect(result.ir, key).not.toBeNull()
    }
  })

  it('fornece um movimento local para os 1.324 exercícios', () => {
    for (const exercise of EXDB) {
      const motion = exerciseMotion(exercise)
      expect(motion.source, `${exercise.id} ${exercise.n}`).toBeTruthy()
    }
  })

  it('identifica especificamente pelo menos 90% do catálogo', () => {
    const identified = EXDB.filter(exercise => exerciseMotion(exercise).matched)
    expect(identified.length / EXDB.length).toBeGreaterThan(0.9)
  })

  it.each([
    ['3/4 sit-up', 'crunch'],
    ['band squat', 'squat'],
    ['dumbbell incline bench press', 'chest-press'],
    ['barbell bent over row', 'bent-over-row'],
    ['barbell alternate biceps curl', 'biceps-curl'],
    ['barbell clean and press', 'olympic-lift'],
    ['cable decline fly', 'chest-fly'],
    ['mountain climber', 'mountain-climber'],
    ['archer pull up', 'archer-pull-up'],
  ])('mapeia %s para %s', (name, expected) => {
    const exercise = EXDB.find(item => item.n === name)
    expect(exerciseMotion(exercise).key).toBe(expected)
  })
})
