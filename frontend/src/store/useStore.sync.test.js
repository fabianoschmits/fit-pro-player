// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', async () => ({
  ...(await vi.importActual('../lib/api.js')),
  api: vi.fn(),
}))

import { api, linkSupabaseIdentity } from '../lib/api.js'
import { DEF, normalizeState, useStore } from './useStore.js'

const personalState = () => normalizeState({
  ...DEF,
  _ts: 10,
  onboardingDone: true,
  profile: {
    name: 'Ana', birthDate: '1990-01-01', heightCm: 170, startWeight: 70,
    goal: 'strength', experience: 'intermediate',
  },
  workouts: [{ id: 'w1', d: '2026-09-20', entries: [] }],
})

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useStore.setState({ S: personalState(), user: { id: 'u1', name: 'Ana' }, syncConflict: false })
})

afterEach(() => vi.restoreAllMocks())

describe('account sync safety', () => {
  it('suppresses legacy bootstrap without touching the serialized training state', async () => {
    const active = { id: 'active', entries: [] }
    const before = { ...personalState(), active }
    const serialized = JSON.stringify(before)
    localStorage.setItem('gym_user', JSON.stringify({ id: 'legacy', name: 'Ana' }))
    localStorage.setItem('gym_state_v1', serialized)
    localStorage.setItem('gym_dirty', '1')

    await useStore.getState().boot({ legacySessionEnabled: false })

    expect(api).not.toHaveBeenCalled()
    expect(useStore.getState().user).toBeNull()
    expect(useStore.getState().ready).toBe(true)
    expect(localStorage.getItem('gym_user')).toBeNull()
    expect(localStorage.getItem('gym_state_v1')).toBe(serialized)
    expect(localStorage.getItem('gym_dirty')).toBeNull()
  })

  it('refuses to clear local data when a sync conflict is unresolved', async () => {
    localStorage.setItem('gym_dirty', '1')
    localStorage.setItem('gym_sync_conflict', '1')
    useStore.setState({ syncConflict: true })

    await expect(useStore.getState().signOut()).rejects.toThrow('Could not sync your data')

    expect(useStore.getState().user).toEqual({ id: 'u1', name: 'Ana' })
    expect(useStore.getState().S.workouts).toHaveLength(1)
    expect(localStorage.getItem('gym_dirty')).toBe('1')
    expect(api).not.toHaveBeenCalled()
  })

  it('syncs before logout and clears only the legacy session context', async () => {
    api.mockResolvedValue({ ok: true })
    localStorage.setItem('gym_user', JSON.stringify({ id: 'u1', name: 'Ana' }))
    const before = JSON.stringify({ ...personalState(), active: { id: 'active', entries: [] } })
    useStore.setState({ S: JSON.parse(before) })
    localStorage.setItem('gym_state_v1', before)

    await expect(useStore.getState().signOut()).resolves.toBeUndefined()

    expect(api.mock.calls.map(call => call[0])).toEqual(['/api/data', '/api/logout'])
    expect(useStore.getState().user).toBeNull()
    expect(JSON.stringify(useStore.getState().S)).toBe(before)
    expect(localStorage.getItem('gym_state_v1')).toBe(before)
    expect(localStorage.getItem('gym_user')).toBeNull()
    expect(localStorage.getItem('gym_dirty')).toBeNull()
  })

  it('preserves workouts after sign out everywhere', async () => {
    api.mockResolvedValue({ ok: true })
    const before = JSON.stringify({ ...personalState(), active: { id: 'active', entries: [] } })
    useStore.setState({ S: JSON.parse(before) })
    localStorage.setItem('gym_state_v1', before)

    await expect(useStore.getState().signOutAll()).resolves.toBeUndefined()

    expect(useStore.getState().user).toBeNull()
    expect(JSON.stringify(useStore.getState().S)).toBe(before)
    expect(localStorage.getItem('gym_state_v1')).toBe(before)
  })

  it('keeps local state intact while the account-link request runs', async () => {
    const active = { id: 'active', entries: [{ exerciseId: 'squat', sets: [{ done: true }] }] }
    const local = { ...personalState(), active, _ts: 20 }
    useStore.setState({ S: local, user: { id: 'u1', name: 'Ana' }, syncConflict: false })
    localStorage.setItem('gym_state_v1', JSON.stringify(local))
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ account: { id: 'supabase-user' } }), { status: 200 }))

    await expect(linkSupabaseIdentity('supabase-access-token')).resolves.toEqual({ account: { id: 'supabase-user' } })

    expect(useStore.getState().S).toEqual(local)
    expect(useStore.getState().S.active).toEqual(active)
    expect(JSON.parse(localStorage.getItem('gym_state_v1'))).toEqual(local)
    expect(localStorage.getItem('gym_dirty')).toBeNull()
  })

  it('resumes a dirty upload when connectivity returns', async () => {
    localStorage.setItem('gym_dirty', '1')
    api.mockResolvedValue({ ok: true })

    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(api).toHaveBeenCalledWith('/api/data', expect.objectContaining({ method: 'PUT' })))

    expect(localStorage.getItem('gym_dirty')).toBeNull()
  })

  it('keeps the active workout while choosing the cloud copy', async () => {
    const active = { id: 'active', entries: [] }
    useStore.setState({
      S: { ...personalState(), active, _ts: 20 },
      syncConflict: true,
    })
    localStorage.setItem('gym_dirty', '1')
    localStorage.setItem('gym_sync_conflict', '1')
    api.mockResolvedValue({ state: { ...personalState(), _ts: 30, workouts: [{ id: 'cloud', d: '2026-09-19', entries: [] }] } })

    await expect(useStore.getState().resolveSyncConflict('cloud')).resolves.toBe(true)

    expect(useStore.getState().S.workouts[0].id).toBe('cloud')
    expect(useStore.getState().S.active).toEqual(active)
    expect(useStore.getState().syncConflict).toBe(false)
    expect(localStorage.getItem('gym_dirty')).toBeNull()
  })

  it('does not replace dirty local data with a newer cloud snapshot after reload', async () => {
    const local = { ...personalState(), _ts: 20, workouts: [{ id: 'local', d: '2026-09-20', entries: [] }] }
    useStore.setState({ S: local, syncConflict: false })
    localStorage.setItem('gym_dirty', '1')
    const conflict = Object.assign(new Error('conflict'), { status: 409, data: { serverTs: 30 } })
    api
      .mockResolvedValueOnce({ state: { ...personalState(), _ts: 30, workouts: [{ id: 'cloud', d: '2026-09-19', entries: [] }] } })
      .mockRejectedValueOnce(conflict)

    await expect(useStore.getState().pullState()).resolves.toBeUndefined()

    expect(useStore.getState().S.workouts[0].id).toBe('local')
    expect(useStore.getState().syncConflict).toBe(true)
    expect(localStorage.getItem('gym_dirty')).toBe('1')
    expect(api.mock.calls.map(call => call[0])).toEqual(['/api/data', '/api/data'])
  })

  it('re-stamps above the cloud version before keeping the local copy', async () => {
    const local = { ...personalState(), _ts: 20, workouts: [{ id: 'local', d: '2026-09-20', entries: [] }] }
    useStore.setState({ S: local, syncConflict: true })
    localStorage.setItem('gym_dirty', '1')
    localStorage.setItem('gym_sync_conflict', '1')
    api
      .mockResolvedValueOnce({ state: { ...personalState(), _ts: 30, workouts: [{ id: 'cloud', d: '2026-09-19', entries: [] }] } })
      .mockResolvedValueOnce({ ok: true })

    await expect(useStore.getState().resolveSyncConflict('local')).resolves.toBe(true)

    const uploaded = JSON.parse(api.mock.calls[1][1].body).state
    expect(uploaded._ts).toBeGreaterThan(30)
    expect(uploaded.workouts[0].id).toBe('local')
    expect(useStore.getState().syncConflict).toBe(false)
    expect(localStorage.getItem('gym_dirty')).toBeNull()
  })
})
