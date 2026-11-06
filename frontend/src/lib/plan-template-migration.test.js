import { describe, expect, it, vi } from 'vitest'
import fixtures from './legacy-training-prescriptions.json'

vi.mock('./personalized-plan.js', () => {
  const signature = exercises => JSON.stringify(exercises, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value)
  return {
    prescriptionSignature: signature,
    isManagedPersonalizedRoutine: routine => !routine.assigned && !routine.starterCustomName && routine.planGenerated === true && routine.planSignature === signature(routine.ex),
    personalizedRoutineSpecs: vi.fn((profile, _count, options) => [{ personalizedKey: options.keys[0], starterKey: 'New template',
      planGenerated: true, planTemplateVersion: 2, planTargetMinutes: profile.preferredWorkoutMinutes,
      ex: [{ id: '0025', sets: 3, reps: 10, weight: 5 }, { id: '0025', sets: 3, reps: 10, weight: 5 }] }]),
  }
})

import { automaticTemplateKey, upgradeAutomaticPlans } from './plan-template-migration.js'
import { personalizedRoutineSpecs, prescriptionSignature } from './personalized-plan.js'

const old = () => {
  const fixture = fixtures.find(entry => entry.kind === 'personalized' && entry.key === 'chest')
  return { id: 'r', name: 'Old', planGenerated: true, personalizedKey: fixture.key, starterKey: fixture.starterKey,
    ex: structuredClone(fixture.ex).map(entry => ({ ...entry, weight: 25 })) }
}

describe('automatic template provenance and upgrade', () => {
  it('accepts historical full prescriptions with positive markers, ignoring weight only', () => {
    const routine = old()
    expect(automaticTemplateKey(routine)).toBe('chest')
    routine.ex[0].weight = 77
    expect(automaticTemplateKey(routine)).toBe('chest')
    routine.ex[0].sets += 1
    expect(automaticTemplateKey(routine)).toBeNull()
  })

  it.each(['notes', 'sg', 'rest', 'mode'])('preserves user edits in %s', field => {
    const routine = old()
    routine.ex[0][field] = field === 'notes' ? 'custom' : 99
    expect(automaticTemplateKey(routine)).toBeNull()
  })

  it('requires provenance beyond matching names or exercise identifiers', () => {
    const routine = old()
    delete routine.planGenerated
    delete routine.starterKey
    expect(automaticTemplateKey(routine)).toBeNull()
    routine.planGenerated = true
    routine.ex.reverse()
    expect(automaticTemplateKey(routine)).toBeNull()
  })

  it('recognizes exact historical starter prescriptions with an explicit starter marker', () => {
    const fixture = fixtures.find(entry => entry.kind === 'starter')
    const routine = { starterKey: fixture.starterKey, ex: structuredClone(fixture.ex) }
    expect(automaticTemplateKey(routine)).toBeTruthy()
    delete routine.starterKey
    expect(automaticTemplateKey(routine)).toBeNull()
  })

  it('keeps manual, professional and in-progress routines intact', () => {
    const routines = [old(), { ...old(), id: 'assigned', assigned: {} }, { ...old(), id: 'manual', starterCustomName: true }]
    const state = { profile: {}, routines, active: { routineId: 'r' }, week: { 1: 'r' }, workouts: [{ id: 'history' }] }
    const before = structuredClone(state)
    upgradeAutomaticPlans(state)
    expect(state).toEqual(before)
  })

  it('retains scheduled frequency when regenerating a specific historical key', () => {
    const state = { profile: {}, routines: [old()], week: { 1: 'r', 2: 'other', 3: 'third', 4: 'fourth', 5: 'fifth' } }
    upgradeAutomaticPlans(state)
    expect(personalizedRoutineSpecs).toHaveBeenLastCalledWith(expect.anything(), 5, expect.objectContaining({ keys: ['chest'] }))
    state.routines = [old()]
    state.planMode = 'daily'
    upgradeAutomaticPlans(state)
    expect(personalizedRoutineSpecs).toHaveBeenLastCalledWith(expect.anything(), 7, expect.objectContaining({ daily: true }))
  })

  it('preserves identifiers, schedules, history and occurrence weights and is idempotent', () => {
    const routine = { id: 'r', planGenerated: true, personalizedKey: 'chest', ex: [{ id: '0025', sets: 3, weight: 23 }, { id: '0025', sets: 3, weight: 31 }] }
    routine.planSignature = prescriptionSignature(routine.ex)
    const state = { profile: { preferredWorkoutMinutes: 40 }, routines: [routine], week: { 1: 'r' }, dayPlan: {}, workouts: [{ id: 'h' }] }
    upgradeAutomaticPlans(state)
    expect(state.routines[0].ex.map(entry => entry.weight)).toEqual([23, 31])
    expect(state.routines[0]).toMatchObject({ id: 'r', planTemplateVersion: 2, planTargetMinutes: 40 })
    expect(state.week).toEqual({ 1: 'r' })
    expect(state.workouts).toEqual([{ id: 'h' }])
    const upgraded = structuredClone(state)
    upgradeAutomaticPlans(state)
    expect(state).toEqual(upgraded)
  })
})
