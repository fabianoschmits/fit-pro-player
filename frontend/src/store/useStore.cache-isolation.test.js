// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../lib/api.js', () => ({ api: vi.fn() }))
import { DEF, useStore } from './useStore.js'
import { resolveLocalScope } from '../lib/local-state-scope.js'
import { writeScopedState } from '../lib/account-cache.js'

const USER_A = '72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2'
const USER_B = '11111111-1111-4111-8111-111111111111'
const stateWithWorkout = id => ({ ...DEF, workouts: [{ id, d: '2026-09-23', entries: [] }] })

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ S: { ...DEF }, user: null, ready: false, syncConflict: false })
})
afterEach(() => localStorage.clear())

describe('local account cache isolation', () => {
  it('anonymous boot reads gym_state_v1', async () => {
    localStorage.setItem('gym_state_v1', JSON.stringify(stateWithWorkout('anonymous')))
    await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: null })
    expect(useStore.getState().S.workouts[0].id).toBe('anonymous')
  })

  it('authenticated boot does not consume anonymous state when account cache is missing', async () => {
    localStorage.setItem('gym_state_v1', JSON.stringify(stateWithWorkout('anonymous')))
    await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: USER_A })
    expect(useStore.getState().S.workouts).toEqual([])
    expect(localStorage.getItem('gym_state_v1')).toContain('anonymous')
  })

  it('loads only the active account cache and isolates A, B, and A again', async () => {
    writeScopedState(resolveLocalScope(USER_A), stateWithWorkout('A'), localStorage)
    writeScopedState(resolveLocalScope(USER_B), stateWithWorkout('B'), localStorage)
    await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: USER_A })
    expect(useStore.getState().S.workouts[0].id).toBe('A')
    await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: USER_B })
    expect(useStore.getState().S.workouts[0].id).toBe('B')
    await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: USER_A })
    expect(useStore.getState().S.workouts[0].id).toBe('A')
  })

  it('stops an obsolete boot after its scope activation is rejected', async () => {
    const activate = vi.fn().mockResolvedValue(false)
    useStore.setState({ activateLocalScope: activate })
    await useStore.getState().boot({ legacySessionEnabled: true, supabaseUserId: USER_A })
    expect(activate).toHaveBeenCalledWith(USER_A)
    expect(useStore.getState().ready).toBe(false)
  })
})
