// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { beginWorkout, repeatWorkout } from './sheets.jsx'
import { registerCustom } from './lib/exercises.js'

vi.mock('./lib/nav.js', () => ({ nav: vi.fn() }))
vi.mock('./lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))

beforeEach(async () => {
  vi.useFakeTimers()
  localStorage.clear()
  await useStore.getState().activateLocalScope(null)
  const state = structuredClone(DEF)
  state.weighBeforeWorkout = false
  state.onboardingDone = true
  state.routines = [{ id: 'personal', name: 'Push', ex: [{ id: '0025', sets: 3, reps: 8, weight: 40 }] }]
  useStore.setState({ S: state })
  useUI.getState().closeAll()
})
afterEach(() => {
  registerCustom([])
  useUI.getState().stopRest(false)
  useUI.getState().stopWork()
  useUI.getState().stopManualSet()
  useUI.getState().closeAll()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('comparison captured at session preparation', () => {
  it('captures original work before Flex and never aliases the editable routine', () => {
    beginWorkout('personal', null)
    const active = useStore.getState().S.active
    expect(active.comparison).toMatchObject({ version: 1, origin: 'personal', adjusted: null, flexApplied: false,
      planned: [{ exerciseId: '0025', workSets: 3, muscleWeights: { chest: 1 } }] })
    expect(active.entries[0].muscleSnapshot.muscleWeights.chest).toBe(1)
    useStore.getState().update(state => { state.routines[0].ex[0].sets = 9; state.active.entries.pop() })
    expect(useStore.getState().S.active.comparison.planned[0].workSets).toBe(3)
  })
  it('records freestyle without inventing a plan', () => {
    beginWorkout(null, null)
    expect(useStore.getState().S.active.comparison).toMatchObject({ origin: 'freestyle', planned: [], adjusted: null })
  })
  it('keeps professional assignment and version while capturing its original prescription', () => {
    useStore.getState().update(state => {
      state.routines[0] = { ...state.routines[0], assigned: true, assignmentId: 'assignment', programVersionId: 'version', assignedDayKey: 'monday' }
    })
    beginWorkout('personal', null, 'execution')
    expect(useStore.getState().S.active).toMatchObject({ assignmentId: 'assignment', programVersionId: 'version', professionalExecutionId: 'execution',
      comparison: { origin: 'professional', planned: [{ exerciseId: '0025', workSets: 3 }] } })
  })
  it('repeats the frozen historical metadata of a deleted custom exercise and excludes warm-up', () => {
    const workout = { id: 'old', name: 'Custom', entries: [{ id: 'custom-deleted', muscleSnapshot: { n: 'Meu exercício', muscleWeights: { chest: .7, triceps: .3 } },
      sets: [{ done: true, warmup: true }, { done: true }, { done: true }] }] }
    repeatWorkout(workout)
    const active = useStore.getState().S.active
    expect(active.comparison).toMatchObject({ origin: 'repeat', planned: [{ exerciseId: 'custom-deleted', workSets: 2, muscleWeights: { chest: .7, triceps: .3 } }] })
    active.entries[0].muscleSnapshot.muscleWeights.chest = 1
    expect(workout.entries[0].muscleSnapshot.muscleWeights.chest).toBe(.7)
    expect(active.comparison.planned[0].muscleWeights.chest).toBe(.7)
  })
  it('freezes custom muscle weights before catalogue edits or removal', () => {
    const custom = { id: 'custom-1', n: 'Meu supino', bp: 'chest', custom: true }
    registerCustom([custom])
    useStore.getState().update(state => { state.customEx = [custom]; state.routines[0].ex[0].id = custom.id })
    beginWorkout('personal', null)
    useStore.getState().update(state => { state.customEx = [] })
    registerCustom([])
    expect(useStore.getState().S.active.entries[0].muscleSnapshot.muscleWeights).toEqual({ chest: 1 })
    expect(useStore.getState().S.active.comparison.planned[0].muscleWeights).toEqual({ chest: 1 })
  })
})
