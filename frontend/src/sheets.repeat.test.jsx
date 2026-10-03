// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { repeatWorkout } from './sheets.jsx'

const mocks = vi.hoisted(() => ({ nav: vi.fn() }))
vi.mock('./lib/nav.js', () => ({ nav: mocks.nav }))
vi.mock('./lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn() }))

const clone = value => JSON.parse(JSON.stringify(value))
let root
let container

describe('repeat historical workout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    localStorage.clear()
    mocks.nav.mockClear()
    useUI.getState().stopRest(false)
    useUI.getState().stopWork()
    useUI.getState().stopManualSet()
    useUI.setState({ sheets: [], toastMsg: '' })
  })

  afterEach(() => {
    if (root) act(() => root.unmount())
    container?.remove()
    root = null
    container = null
    useUI.getState().stopRest(false)
    useUI.getState().stopWork()
    useUI.getState().stopManualSet()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('starts an independent copy of the selected session, not the current routine', () => {
    const historical = {
      id: 'old-session', d: '2026-08-02', start: 1000, end: 2000,
      routineId: 'push', name: 'Push antigo',
      entries: [
        {
          id: 'bench', sg: 'pair', target: { sets: 2, reps: 8, weight: 60, mode: 'reps' },
          sets: [{ w: 60, r: 8, done: true }, { w: 60, r: 7, done: true }],
        },
        {
          id: 'row', sg: 'pair', target: { sets: 1, reps: 10, weight: 45, mode: 'reps' },
          sets: [{ w: 45, r: 10, done: true }],
        },
      ],
    }
    const state = clone(DEF)
    state.onboardingDone = true
    state.weighBeforeWorkout = false
    state.routines = [{ id: 'push', name: 'Push atual', ex: [{ id: 'different-exercise', sets: 4, reps: 12 }] }]
    state.workouts = [historical]
    useStore.setState({ S: state, user: null })
    const original = clone(historical)

    expect(repeatWorkout(historical)).toBe(true)

    const active = useStore.getState().S.active
    expect(active.routineId).toBeNull()
    expect(active.name).toBe('Push antigo')
    expect(active.entries.map(entry => entry.id)).toEqual(['bench', 'row'])
    expect(active.entries.map(entry => entry.sg)).toEqual(['pair', 'pair'])
    expect(active.entries[0].sets).toEqual([{ w: 60, r: 8, done: false }, { w: 60, r: 7, done: false }])
    active.entries[0].sets[0].w = 70
    expect(historical).toEqual(original)
    expect(mocks.nav).toHaveBeenCalledWith('/workout')
  })

  it('does not overwrite an active session without confirmation', () => {
    const state = clone(DEF)
    state.onboardingDone = true
    state.weighBeforeWorkout = false
    state.active = { id: 'in-progress', start: Date.now(), cur: 0, entries: [] }
    const historical = { id: 'old', name: 'Treino antigo', entries: [] }
    state.workouts = [historical]
    useStore.setState({ S: state, user: null })

    repeatWorkout(historical)

    expect(useStore.getState().S.active.id).toBe('in-progress')
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(mocks.nav).not.toHaveBeenCalled()
  })

  it.each(['manual', 'rest', 'timed'])('clears prior %s execution only after confirming a historical repeat', activity => {
    const historical = {
      id: 'old-session', name: 'Treino antigo',
      entries: [{ id: '0025', sets: [{ w: 60, r: 8, done: true }, { w: 60, r: 7, done: true }] }],
    }
    const state = clone(DEF)
    state.onboardingDone = true
    state.weighBeforeWorkout = false
    state.sound = false
    state.workouts = [historical]
    state.active = {
      id: 'in-progress', start: 1, cur: 0,
      entries: [{ id: '0025', sets: [{ w: 40, r: 8, done: false }] }],
    }
    useStore.setState({ S: state, user: null })
    if (activity === 'manual') {
      expect(useUI.getState().startManualSet('in-progress:1', 0, 0)).toBe(true)
    } else {
      const staleCompletion = () => useStore.getState().update(s => { s.active.entries[0].sets[0].done = true })
      if (activity === 'rest') useUI.getState().startRest(3, staleCompletion)
      else useUI.getState().startWork(3, 'Previous hold', staleCompletion, { entryIdx: 0, setIdx: 0 })
    }
    const { manualSet, timer, work } = useUI.getState()

    expect(repeatWorkout(historical)).toBe(true)

    expect(useStore.getState().S.active.id).toBe('in-progress')
    expect(useUI.getState().manualSet).toEqual(manualSet)
    expect(useUI.getState().timer).toEqual(timer)
    expect(useUI.getState().work).toEqual(work)
    expect(mocks.nav).not.toHaveBeenCalled()
    const sheet = useUI.getState().sheets[0]
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
    const confirm = container.querySelector('button.danger')
    expect(confirm).toBeTruthy()
    act(() => confirm.click())

    expect(useUI.getState().manualSet).toBeNull()
    expect(useUI.getState().timer).toBeNull()
    expect(useUI.getState().work).toBeNull()
    expect(useStore.getState().S.active.id).not.toBe('in-progress')
    expect(useStore.getState().S.active.start).toBeNull()
    expect(useStore.getState().S.active.entries[0].sets).toEqual([{ w: 60, r: 8, done: false }, { w: 60, r: 7, done: false }])
    vi.advanceTimersByTime(10_000)
    expect(useStore.getState().S.active.entries[0].sets).toEqual([{ w: 60, r: 8, done: false }, { w: 60, r: 7, done: false }])
    expect(useUI.getState().manualSet).toBeNull()
    expect(useUI.getState().work).toBeNull()
    expect(historical.entries[0].sets).toEqual([{ w: 60, r: 8, done: true }, { w: 60, r: 7, done: true }])
    expect(mocks.nav).toHaveBeenCalledWith('/workout')
  })
})
