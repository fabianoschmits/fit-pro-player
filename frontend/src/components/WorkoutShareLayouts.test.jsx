import { describe, expect, it } from 'vitest'
import { buildWorkoutShareSummary } from './WorkoutShareLayouts.jsx'

describe('workout share summary', () => {
  it('keeps the important metrics and reports all exercises', () => {
    const summary = buildWorkoutShareSummary({
      name: 'Push day', d: '2026-10-14', start: 0, end: 3_600_000, vol: 1250,
      entries: [
        { id: 'custom-1', sets: [{ done: true }, { done: true }] },
        { id: 'custom-2', sets: [{ done: true }] },
      ],
    }, { unit: 'kg' })
    expect(summary).toMatchObject({ name: 'Push day', duration: '1h 0m', exercises: 2, sets: 3, volume: '1.250 kg' })
    expect(summary.exerciseRows).toHaveLength(2)
    expect(summary.exerciseRows[0].sets).toBe(2)
  })

  it('does not expose a blank title when historical data has no name', () => {
    const summary = buildWorkoutShareSummary({ start: 0, end: 60_000, entries: [] }, { unit: 'kg' })
    expect(summary.name).toBe('Treino')
    expect(summary.exerciseRows).toEqual([])
  })
})
