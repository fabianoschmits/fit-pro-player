import { describe, expect, it } from 'vitest'
import { effectiveRoutineId, isWorkoutDay } from './history.js'

const routine = { id: 'routine-1', name: 'Chest', ex: [] }
const base = { routines: [routine], week: { 1: routine.id }, dayPlan: {} }

describe('daily and weekly plan resolution', () => {
  it('uses the recurring week only in weekly mode', () => {
    expect(effectiveRoutineId({ ...base, planMode: 'weekly' }, '2026-09-07')).toBe(routine.id)
    expect(effectiveRoutineId({ ...base, planMode: 'daily' }, '2026-09-07')).toBeNull()
  })

  it('uses an explicit daily choice in either mode and respects rest', () => {
    const selected = { ...base, planMode: 'daily', dayPlan: { '2026-09-08': routine.id } }
    expect(effectiveRoutineId(selected, '2026-09-08')).toBe(routine.id)
    expect(isWorkoutDay(selected, '2026-09-08')).toBe(true)

    const rest = { ...base, planMode: 'daily', dayPlan: { '2026-09-08': 'rest' } }
    expect(effectiveRoutineId(rest, '2026-09-08')).toBeNull()
    expect(isWorkoutDay(rest, '2026-09-08')).toBe(false)
  })
})
