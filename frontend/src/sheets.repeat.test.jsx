// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { repeatWorkout } from './sheets.jsx'

const mocks = vi.hoisted(() => ({ nav: vi.fn() }))
vi.mock('./lib/nav.js', () => ({ nav: mocks.nav }))
vi.mock('./lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn() }))

const clone = value => JSON.parse(JSON.stringify(value))

describe('repeat historical workout', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.nav.mockClear()
    useUI.getState().stopRest()
    useUI.setState({ sheets: [], toastMsg: '', timer: null, work: null })
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
})
