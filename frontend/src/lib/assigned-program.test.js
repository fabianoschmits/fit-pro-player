import { describe, expect, it } from 'vitest'
import { assignedPlanToState, clearAssignedProgramFromState, hasAssignedProgram } from './assigned-program.js'

describe('assigned program priority', () => {
  it('removes revoked routines and calendar references while preserving personal history', () => {
    const state = { assignedProgram: { assignmentId: 'a' }, routines: [{ id: 'received', assigned: true }, { id: 'personal' }], week: { 1: 'received', 2: 'personal' }, dayPlan: { '2026-10-02': 'received' }, workouts: [{ id: 'old' }] }
    expect(clearAssignedProgramFromState(state)).toMatchObject({ assignedProgram: null, routines: [{ id: 'personal' }], week: { 2: 'personal' }, dayPlan: {}, workouts: [{ id: 'old' }] })
  })
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
  it('retains the professional temporal fields, group and units on the assigned routine', () => {
    const next = assignedPlanToState({ routines: [] }, { id: 'v', weekly_plan: { friday: [{ exerciseId: '1', mode: 'time', sec: 60, sets: 2, reps: 1, rest: 20, sg: 'pair', unit: 'lb', effort: 'rir', rir: 2 }] } }, { id: 'a' })
    expect(next.routines[0]).toMatchObject({ assignedDayKey: 'friday' })
    expect(next.routines[0].ex[0]).toMatchObject({ sec: 60, rest: 20, sg: 'pair', unit: 'lb', effort: 'rir', rir: 2 })
  })
})
