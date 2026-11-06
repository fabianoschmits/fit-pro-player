// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { confirmWorkoutDurationRefit } from './sheets.jsx'
import { applyPersonalizedPlan } from './lib/personalized-plan.js'
vi.mock('./lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))

beforeEach(() => {
  const state = structuredClone(DEF)
  state.profile = { ...state.profile, goal: 'build_muscle', experience: 'advanced', preferredWorkoutMinutes: 90 }
  applyPersonalizedPlan(state, state.profile, 3)
  state.routines.push({ id: 'manual', ex: [{ id: '0025', sets: 9 }] }, { id: 'professional', assigned: true, ex: [{ id: '0043', sets: 5 }] })
  state.active = { routineId: state.routines[0].id, entries: [{ id: '0025', sets: [{ done: false, w: 40 }] }] }
  state.workouts = [{ id: 'history', entries: [] }]
  state.profile.preferredWorkoutMinutes = 15
  useStore.setState({ S: state, persistence: { state: 'saved' } })
  useUI.getState().closeAll()
})
afterEach(() => { useUI.getState().closeAll(); vi.restoreAllMocks() })
const dialog = () => useUI.getState().sheets[0].render(() => useUI.getState().closeAll()).props

it('saves the choice to keep or dismiss without changing routines', () => {
  const before = structuredClone(useStore.getState().S)
  confirmWorkoutDurationRefit(90)
  expect(dialog()).toMatchObject({ title: 'Readequar seus treinos?', cancelText: 'Manter meus treinos', confirmText: 'Readequar treinos' })
  expect(dialog().message).toContain('15 minutos')
  dialog().close()
  expect(useStore.getState().S).toEqual(before)
  expect(useStore.getState().S.profile.preferredWorkoutMinutes).toBe(15)
})
it('refits only proven managed routines after confirmation and keeps active/history/schedule intact', () => {
  const before = structuredClone(useStore.getState().S)
  confirmWorkoutDurationRefit(90)
  expect(useStore.getState().S.routines).toEqual(before.routines)
  dialog().onConfirm()
  const after = useStore.getState().S
  expect(after.routines.map(r => r.id)).toEqual(before.routines.map(r => r.id))
  expect(after.routines[1].ex.length).toBeLessThan(before.routines[1].ex.length)
  for (const index of [0, 3, 4]) expect(after.routines[index]).toEqual(before.routines[index])
  expect(after.active).toEqual(before.active)
  expect(after.workouts).toEqual(before.workouts)
  expect(after.week).toEqual(before.week)
  expect(after.dayPlan).toEqual(before.dayPlan)
  expect(after.planMode).toBe(before.planMode)
})
it('skips confirmation for unchanged duration, no eligible routines or an unsuccessful save', () => {
  confirmWorkoutDurationRefit(15)
  expect(useUI.getState().sheets).toHaveLength(0)
  useStore.setState({ persistence: { state: 'error' } })
  confirmWorkoutDurationRefit(90)
  expect(useUI.getState().sheets).toHaveLength(0)
  useStore.setState({ persistence: { state: 'saved' } })
  useStore.getState().update(s => { s.routines = s.routines.filter(r => r.id === s.active.routineId || !r.planGenerated) })
  confirmWorkoutDurationRefit(90)
  expect(useUI.getState().sheets).toHaveLength(0)
})
