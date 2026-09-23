import { describe, expect, it } from 'vitest'
import { readScopedState, writeScopedState } from './account-cache.js'
import { resolveLocalScope } from './local-state-scope.js'

const USER_A = '72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2'
const memoryStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial))
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key), data }
}
const empty = { workouts: [] }

describe('account cache envelope', () => {
  it('rejects a cache owned by another UUID', () => {
    const storage = memoryStorage({
      [`fpp_account_cache_v1:${USER_A}`]: JSON.stringify({ ownerId: '11111111-1111-4111-8111-111111111111', schemaVersion: 1, state: { workouts: [{ id: 'A' }] } }),
    })
    const result = readScopedState(resolveLocalScope(USER_A), storage, empty)
    expect(result.status).toBe('invalid')
    expect(result.state.workouts).toEqual([])
  })

  it('never serializes session material', () => {
    const storage = memoryStorage()
    writeScopedState(resolveLocalScope(USER_A), { workouts: [], access_token: 'forbidden', refresh_token: 'forbidden', session: { access_token: 'forbidden' } }, storage)
    expect([...storage.data.values()][0]).not.toMatch(/access_token|refresh_token|session/i)
  })

  it('returns an empty state for missing data', () => {
    const result = readScopedState(resolveLocalScope(USER_A), memoryStorage(), empty)
    expect(result).toEqual({ status: 'missing', state: empty })
  })
})
