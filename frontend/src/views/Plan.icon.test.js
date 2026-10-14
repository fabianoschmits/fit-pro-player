// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { routineFppIcon } from './Plan.jsx'

describe('routineFppIcon', () => {
  it.each([
    [{ name: 'Push pesado' }, 'workout-push'],
    [{ name: 'Pull pesado' }, 'workout-pull'],
    [{ name: 'Dia de Pernas' }, 'workout-legs'],
    [{ starterKey: 'Chest Day' }, 'workout-push'],
    [{ starterKey: 'Back Day' }, 'workout-pull'],
    [{ starterKey: 'Leg Day' }, 'workout-legs'],
  ])('maps %j to %s', (routine, expected) => expect(routineFppIcon(routine)).toBe(expected))

  it('returns null for an unclassified custom routine so the legacy fallback remains available', () => {
    expect(routineFppIcon({ name: 'Mobilidade' })).toBeNull()
  })
})
