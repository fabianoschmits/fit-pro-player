import { describe, it, expect } from 'vitest'
import { workspaceToWeeklyPlan, weeklyPlanToWorkspace } from './training-workspace.js'
describe('shared training workspace', () => {
  it('round trips prescription, schedule and titles without sharing objects', () => {
    const source = { monday: [{ exerciseId: '1', sets: 4, reps: 8, load: 80, rir: 2, notes: 'Controle', sg: 'a' }] }
    const state = weeklyPlanToWorkspace(source, { monday: 'Peito' })
    expect(state.routines[0].name).toBe('Peito')
    expect(state.routines[0].ex[0].weight).toBe(80)
    expect(workspaceToWeeklyPlan(state).weeklyPlan).toEqual(source)
    state.routines[0].ex[0].notes = 'Outro'
    expect(source.monday[0].notes).toBe('Controle')
  })
  it('keeps repeated days pointing to the same routine when editing', () => {
    const state = { routines: [{ id: 'r', name: 'A', ex: [{ id: '1', sets: 3, reps: 10, weight: 0 }] }], week: { 1: 'r', 3: 'r' } }
    const result = workspaceToWeeklyPlan(state)
    expect(result.weeklyPlan.monday).toEqual(result.weeklyPlan.wednesday)
    expect(result.workoutTitles).toEqual({ monday: 'A', wednesday: 'A' })
  })
})
