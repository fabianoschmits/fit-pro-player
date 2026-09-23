// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { resolveLocalScope } from './local-state-scope.js'
import { writeScopedState } from './account-cache.js'

const USER_A = '72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2'
const state = (id, active = null) => ({ ...DEF, workouts: [{ id, d: '2026-09-23', entries: [] }], active })

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ S: { ...DEF }, user: null, ready: false, syncConflict: false })
})

describe('local cache compatibility', () => {
  it('preserves anonymous data before and after an account session', async () => {
    localStorage.setItem('gym_state_v1', JSON.stringify(state('anonymous')))
    await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: USER_A })
    await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: null })
    expect(useStore.getState().S.workouts[0].id).toBe('anonymous')
    expect(JSON.parse(localStorage.getItem('gym_state_v1')).workouts[0].id).toBe('anonymous')
  })

  it('reads an existing account cache offline without a network dependency', async () => {
    writeScopedState(resolveLocalScope(USER_A), state('A'), localStorage)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: USER_A })
    expect(useStore.getState().S.workouts[0].id).toBe('A')
  })

  it('preserves an active workout while switching away from the account', async () => {
    writeScopedState(resolveLocalScope(USER_A), state('A', { id: 'active-A', entries: [] }), localStorage)
    await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: USER_A })
    await useStore.getState().boot({ legacySessionEnabled: false, supabaseUserId: null })
    const saved = JSON.parse(localStorage.getItem(`fpp_account_cache_v1:${USER_A}`))
    expect(saved.state.active.id).toBe('active-A')
    expect(useStore.getState().S.workouts).toEqual([])
  })
})
