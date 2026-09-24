import { describe, expect, it } from 'vitest'
import { assignedPlanToState, hasAssignedProgram } from './assigned-program.js'

describe('assigned program priority', () => {
  it('replaces the active calendar while preserving personal routines and history', () => {
    const state = { routines: [{ id: 'personal', name: 'Meu treino', ex: [] }], week: { 1: 'personal' }, dayPlan: { '2026-09-24': 'personal' }, workouts: [{ id: 'old' }] }
    const next = assignedPlanToState(state, { id: 'v1', version_number: 1, weekly_plan: { monday: [{ exerciseId: '1254', sets: 3, reps: 8, load: 40 }] } }, { id: 'assignment-1', program_id: 'program-1' })
    expect(next.week[1]).toMatch(/^assigned:v1:1:/)
    expect(next.dayPlan).toEqual({})
    expect(next.routines.find(routine => routine.id === 'personal')).toBeTruthy()
    expect(next.routines.find(routine => routine.assigned).ex[0]).toMatchObject({ id: '1254', sets: 3, reps: 8, weight: 40 })
    expect(next.workouts).toEqual([{ id: 'old' }])
    expect(hasAssignedProgram(next)).toBe(true)
  })

  it('accepts professional plans stored as day objects with exercises', () => {
    const next = assignedPlanToState({ routines: [], week: {}, dayPlan: {}, workouts: [] }, { id: 'v2', version_number: 2, weekly_plan: { friday: { title: 'Força', exercises: [{ exerciseId: '1254', sets: 4, reps: 6 }] } } }, { id: 'assignment-2', program_id: 'program-2' })
    expect(next.week[5]).toContain('assigned:v2:5')
    expect(next.routines.find(item => item.assigned).name).toBe('Força')
  })
})
