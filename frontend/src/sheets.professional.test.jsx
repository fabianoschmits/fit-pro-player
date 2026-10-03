// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { beginWorkout, startFlow } from './sheets.jsx'
const mocks = vi.hoisted(() => ({ nav: vi.fn() }))
vi.mock('./lib/nav.js', () => ({ nav: mocks.nav }))
vi.mock('./lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
const account = '12345678-1234-4234-8234-123456789012'
beforeEach(async () => {
  vi.useFakeTimers()
  useUI.getState().stopRest(false)
  useUI.getState().stopWork()
  useUI.getState().stopManualSet()
  useUI.setState({ sheets: [], toastMsg: '' })
  localStorage.clear(); await useStore.getState().activateLocalScope(account)
  const state = structuredClone(DEF); state.weighBeforeWorkout = false; state.onboardingDone = true
  state.routines = [{ id: 'assigned', assigned: true, assignmentId: 'a', programVersionId: 'v', assignedDayKey: 'monday', ex: [{ id: '0025', sets: 2, reps: 8, weight: 40, rest: 20, sg: 'pair' }] }]
  state.exWeights = { '0025': { w: 90 } }; state.workouts = [{ entries: [{ id: '0025', sets: [{ w: 85, r: 12, done: true }] }] }]
  useStore.setState({ S: state })
})

afterEach(() => {
  useUI.getState().stopRest(false)
  useUI.getState().stopWork()
  useUI.getState().stopManualSet()
  vi.clearAllTimers()
  vi.useRealTimers()
})
describe('central assigned routine start', () => {
  for (const launch of [() => startFlow('assigned'), () => beginWorkout('assigned', null)]) {
    it('registers an assigned execution from every central entry while preserving the prescription', () => {
      launch()
      const { active, pendingProfessionalEvents } = useStore.getState().S
      expect(active.professionalExecutionId).toMatch(/^[0-9a-f-]{36}$/)
      expect(active.entries[0].sets).toEqual([{ w: 40, r: 8, done: false }, { w: 40, r: 8, done: false }])
      expect(active.entries[0].plan).toBeNull()
      expect(active.prescribedEntries[0].rest).toBe(20)
      expect(pendingProfessionalEvents[0]).toMatchObject({ accountId: account, type: 'start', assignmentId: 'a', dayKey: 'monday' })
    })
  }

  it.each(['manual', 'rest', 'timed'])('clears prior %s execution before starting an assigned routine', activity => {
    const state = useStore.getState().S
    state.sound = false
    state.active = {
      id: 'previous-session', start: 1, cur: 0,
      entries: [{ id: '0025', sets: [{ w: 60, r: 8, done: false }] }],
    }
    if (activity === 'manual') {
      expect(useUI.getState().startManualSet('previous-session:1', 0, 0)).toBe(true)
    } else {
      const staleCompletion = () => useStore.getState().update(s => { s.active.entries[0].sets[0].done = true })
      if (activity === 'rest') useUI.getState().startRest(3, staleCompletion)
      else useUI.getState().startWork(3, 'Previous hold', staleCompletion, { entryIdx: 0, setIdx: 0 })
    }

    beginWorkout('assigned', null)

    expect(useUI.getState().manualSet).toBeNull()
    expect(useUI.getState().timer).toBeNull()
    expect(useUI.getState().work).toBeNull()
    const active = useStore.getState().S.active
    expect(active.id).not.toBe('previous-session')
    expect(active.start).toBeNull()
    expect(active.entries[0].sets).toEqual([{ w: 40, r: 8, done: false }, { w: 40, r: 8, done: false }])
    vi.advanceTimersByTime(10_000)
    expect(useStore.getState().S.active.entries[0].sets).toEqual([{ w: 40, r: 8, done: false }, { w: 40, r: 8, done: false }])
    expect(useUI.getState().manualSet).toBeNull()
    expect(useUI.getState().work).toBeNull()
  })
})
