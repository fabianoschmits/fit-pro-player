// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from './useStore.js'
import { createTrainingRepository } from '../lib/training-repository.js'
import { readSessionRecoveryDraft } from '../lib/session-recovery.js'

const accountId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const session = revision => ({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', user_id: accountId,
  routine_id: null, assignment_id: null, status: 'active', revision,
  writer_token: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', mass_unit: 'kg',
  prescription_snapshot: { exercises: [] }, started_at: '2026-10-21T12:00:00Z',
  completed_at: null, updated_at: '2026-10-21T12:00:00Z',
})

beforeEach(async () => {
  vi.useFakeTimers()
  localStorage.clear()
  await useStore.getState().activateLocalScope(accountId)
})
afterEach(async () => {
  await useStore.getState().activateLocalScope(null)
  localStorage.clear()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('account session recovery lifecycle', () => {
  it('automatically replays an authenticated queue when its own token is refreshed', async () => {
    let authChanged
    let allowed = false
    const client = {
      rpc: async name => name === 'start_workout_session'
        ? { data: session(1) }
        : allowed ? { data: session(2) } : { error: { code: 'PGRST301', message: 'JWT expired' }, status: 401 },
      auth: { onAuthStateChange: callback => {
        authChanged = callback
        return { data: { subscription: { unsubscribe() {} } } }
      } },
    }
    const recovery = useStore.getState().configureSessionRecovery(createTrainingRepository({ client, accountId }), accountId)
    await recovery.start({ sessionId: session(1).id, prescriptionSnapshot: { exercises: [] } })
    await useStore.getState().queueSessionOperation({ payload: { setIndex: 0 } })
    expect(useStore.getState().sessionRecovery.state).toBe('auth-required')
    allowed = true
    authChanged('TOKEN_REFRESHED', { user: { id: accountId } })
    await vi.advanceTimersByTimeAsync(0)

    expect(useStore.getState().sessionRecovery).toMatchObject({ state: 'saved', pending: 0 })
    expect(readSessionRecoveryDraft({ accountId })).toMatchObject({ session: { revision: 2 }, pendingOperations: [] })
  })

  it('stops retries and keeps the original account journal when switching accounts', async () => {
    let attempts = 0
    const client = { rpc: async name => {
      if (name === 'start_workout_session') return { data: session(1) }
      attempts++
      return { error: { message: 'Failed to fetch' } }
    } }
    const recovery = useStore.getState().configureSessionRecovery(createTrainingRepository({ client, accountId }), accountId)
    await recovery.start({ sessionId: session(1).id, prescriptionSnapshot: { exercises: [] } })
    await useStore.getState().queueSessionOperation({ payload: { setIndex: 0 } })
    await useStore.getState().activateLocalScope(otherId)
    await vi.advanceTimersByTimeAsync(120000)

    expect(attempts).toBe(1)
    expect(readSessionRecoveryDraft({ accountId }).pendingOperations).toHaveLength(1)
    expect(readSessionRecoveryDraft({ accountId: otherId })).toBeNull()
    expect(useStore.getState().sessionRecovery).toMatchObject({ state: 'idle', pending: 0 })
  })
})
