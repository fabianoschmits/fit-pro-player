import { describe, expect, it } from 'vitest'
import { professionalExecutionDurationMs, professionalExecutionExercises } from './professional-execution-display.js'

describe('professional execution display data', () => {
  it('uses actual payload times before execution timestamp fallback', () => {
    expect(professionalExecutionDurationMs({ payload: { start: 1000, end: 91_000 }, startedAt: '2026-10-28T10:00:00Z', completedAt: '2026-10-28T10:30:00Z' })).toBe(90_000)
  })
  it('falls back to execution timestamps when the payload interval is missing or invalid', () => {
    expect(professionalExecutionDurationMs({ payload: {}, startedAt: '2026-10-28T10:00:00Z', completedAt: '2026-10-28T10:30:00Z' })).toBe(1_800_000)
    expect(professionalExecutionDurationMs({ payload: { start: 'bad', end: 0 }, startedAt: '2026-10-28T10:00:00Z', completedAt: '2026-10-28T10:05:00Z' })).toBe(300_000)
  })
  it('omits duration for missing or reversed timestamps', () => {
    expect(professionalExecutionDurationMs({ payload: {}, startedAt: '2026-10-28T10:30:00Z', completedAt: '2026-10-28T10:00:00Z' })).toBeNull()
    expect(professionalExecutionDurationMs({ payload: { start: 'invalid', end: 0 }, startedAt: null, completedAt: null })).toBeNull()
  })
  it('summarizes distinct actual exercise names without inventing missing items', () => {
    expect(professionalExecutionExercises({ payload: { entries: [{ id: '0025' }, { id: '0025' }, { id: null }] } })).toEqual(['Supino com barra'])
    expect(professionalExecutionExercises({ payload: {} })).toEqual([])
  })
})
