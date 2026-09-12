import { describe, expect, it } from 'vitest'
import { applyPreviousSetValues, replaceSessionExercise, resetHistoricalSets } from './workout-session.js'

describe('applyPreviousSetValues', () => {
  it('copies previous work values while preserving completed rows', () => {
    const current = [
      { w: 40, r: 10, done: true },
      { w: 40, r: 10, done: false },
      { w: 40, r: 10, done: false },
    ]
    const previous = [
      { w: 62.5, r: 9, done: true },
      { w: 60, r: 8, done: true },
      { w: 57.5, r: 8, done: true },
    ]

    expect(applyPreviousSetValues(current, previous, 'reps')).toEqual([
      { w: 40, r: 10, done: true },
      { w: 60, r: 8, done: false },
      { w: 57.5, r: 8, done: false },
    ])
  })

  it('matches warm-up and work rows independently and repeats the final known row', () => {
    const current = [
      { phase: 'warmup', w: 10, r: 12, done: false },
      { w: 20, r: 10, done: false },
      { w: 20, r: 10, done: false },
      { w: 20, r: 10, done: false },
    ]
    const previous = [
      { phase: 'warmup', w: 25, r: 8, done: true },
      { w: 70, r: 6, rir: 2, done: true },
      { w: 67.5, r: 7, rir: 1, done: true },
    ]

    expect(applyPreviousSetValues(current, previous, 'reps')).toEqual([
      { phase: 'warmup', w: 25, r: 8, done: false },
      { w: 70, r: 6, rir: 2, done: false },
      { w: 67.5, r: 7, rir: 1, done: false },
      { w: 67.5, r: 7, rir: 1, done: false },
    ])
  })

  it('copies the fields used by timed and cardio sessions', () => {
    expect(applyPreviousSetValues(
      [{ sec: 30, w: 0, done: false }],
      [{ sec: 45, w: 12.5, done: true }],
      'time',
    )).toEqual([{ sec: 45, w: 12.5, done: false }])

    expect(applyPreviousSetValues(
      [{ min: 10, speed: 6, done: false }],
      [{ min: 22, speed: 8.5, done: true }],
      'cardio',
    )).toEqual([{ min: 22, speed: 8.5, done: false }])
  })
})

describe('replaceSessionExercise', () => {
  const replacement = () => ({
    id: 'cable-fly',
    target: { sets: 2, reps: 12 },
    sets: [{ w: 20, r: 12, done: false }, { w: 20, r: 12, done: false }],
  })

  it('replaces an untouched entry in place and preserves its superset', () => {
    const entries = [{ id: 'bench', sg: 'chest', sets: [{ w: 60, r: 8, done: false }] }]
    const result = replaceSessionExercise(entries, 0, replacement())

    expect(result.replacementIndex).toBe(0)
    expect(result.preservedIndex).toBeNull()
    expect(result.entries[0]).toMatchObject({ id: 'cable-fly', sg: 'chest', replacedFrom: 'bench' })
    expect(entries[0]).toEqual({ id: 'bench', sg: 'chest', sets: [{ w: 60, r: 8, done: false }] })
  })

  it('keeps completed sets on the original exercise and inserts the replacement', () => {
    const entries = [
      { id: 'bench', sets: [{ w: 60, r: 8, done: true }, { w: 60, r: 8, done: false }] },
      { id: 'row', sets: [{ w: 40, r: 10, done: false }] },
    ]
    const result = replaceSessionExercise(entries, 0, replacement())

    expect(result.replacementIndex).toBe(1)
    expect(result.entries.map(entry => entry.id)).toEqual(['bench', 'cable-fly', 'row'])
    expect(result.entries[0]).toMatchObject({ replacedBy: 'cable-fly', sets: [{ w: 60, r: 8, done: true }] })
    expect(result.entries[1]).toMatchObject({ replacedFrom: 'bench' })
    expect(entries).toHaveLength(2)
  })

  it('keeps a replacement beside the remaining member of a superset', () => {
    const entries = [
      { id: 'row', sg: 'pair', sets: [{ w: 40, r: 10, done: false }] },
      { id: 'bench', sg: 'pair', sets: [{ w: 60, r: 8, done: true }, { w: 60, r: 8, done: false }] },
    ]
    const result = replaceSessionExercise(entries, 1, replacement())

    expect(result.entries.map(entry => entry.id)).toEqual(['row', 'cable-fly', 'bench'])
    expect(result.entries[0].sg).toBe('pair')
    expect(result.entries[1].sg).toBe('pair')
    expect(result.entries[2].sg).toBeUndefined()
    expect(result.replacementIndex).toBe(1)
  })
})

describe('resetHistoricalSets', () => {
  it('keeps every logged value but creates independent unchecked rows', () => {
    const historical = [
      { phase: 'warmup', w: 20, r: 12, done: true },
      { w: 60, r: 8, rir: 2, done: true },
      { w: 60, r: 7, done: false },
    ]
    const fresh = resetHistoricalSets(historical)

    expect(fresh).toEqual([
      { phase: 'warmup', w: 20, r: 12, done: false },
      { w: 60, r: 8, rir: 2, done: false },
      { w: 60, r: 7, done: false },
    ])
    fresh[1].w = 70
    expect(historical[1].w).toBe(60)
  })
})
