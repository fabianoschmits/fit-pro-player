import { describe, expect, it } from 'vitest'
import { buildWorkoutShareSummary, selectShareExerciseFrame } from './WorkoutShareLayouts.jsx'

describe('workout share summary', () => {
  it('selects frame four or the last frame without showing the starting pose', () => {
    expect(selectShareExerciseFrame(['a', 'b', 'c', 'd', 'e'])).toBe('d')
    expect(selectShareExerciseFrame(['a', 'b', 'c'])).toBe('c')
    expect(selectShareExerciseFrame(['a'])).toBeNull()
  })

  it('highlights the correct mapped exercise using only completed sets', () => {
    const summary = buildWorkoutShareSummary({ entries: [
      { id: 'unknown', sets: [{ done: true, w: 300 }] },
      { id: '0025', sets: [{ done: true, w: 40, r: 8 }, { done: false, w: 200, r: 10 }] },
      { id: '0047', sets: [{ done: true, w: 60, r: 10 }, { done: true, w: 60, r: 8 }] },
    ] }, {})
    expect(summary.highlight).toMatchObject({ id: '0047', maxWeight: 60, completedSets: 2, reps: 18 })
  })

  it('keeps the important metrics and reports all exercises', () => {
    const summary = buildWorkoutShareSummary({
      name: 'Push day', d: '2026-10-14', start: 0, end: 3_600_000, vol: 1250,
      entries: [
        { id: 'custom-1', sets: [{ done: true }, { done: true }] },
        { id: 'custom-2', sets: [{ done: true }] },
      ],
    }, { unit: 'kg' })
    expect(summary).toMatchObject({ name: 'Push day', duration: '1h 0m', exercises: 2, sets: 3 })
    expect(summary.exerciseRows).toHaveLength(2)
    expect(summary.exerciseRows[0].sets).toBe(2)
    expect(summary.topLoad.weight).toBe(0)
  })

  it('finds the highest completed load and its equipment', () => {
    const summary = buildWorkoutShareSummary({ entries: [{ id: 'custom-1', sets: [{ done: true, w: 42 }, { done: true, w: 55 }] }] }, { unit: 'kg' })
    expect(summary.topLoad).toMatchObject({ weight: 55, exercise: 'custom-1' })
  })

  it('uses the active duration when the person paused before sharing', () => {
    const summary = buildWorkoutShareSummary({ start: 0, end: 3_600_000, durationMs: 45_000, entries: [] }, { unit: 'kg' })

    expect(summary.duration).toBe('0 min')
  })

  it('does not expose a blank title when historical data has no name', () => {
    const summary = buildWorkoutShareSummary({ start: 0, end: 60_000, entries: [] }, { unit: 'kg' })
    expect(summary.name).toBe('Treino')
    expect(summary.exerciseRows).toEqual([])
  })
})
