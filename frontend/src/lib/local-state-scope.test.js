import { describe, expect, it } from 'vitest'
import { ANONYMOUS_SCOPE, resolveLocalScope, storageKeyForScope } from './local-state-scope.js'

describe('local state scope', () => {
  it('keeps anonymous storage on the legacy key', () => {
    expect(storageKeyForScope(ANONYMOUS_SCOPE)).toBe('gym_state_v1')
  })

  it('namespaces accounts by canonical UUID and schema version', () => {
    const scope = resolveLocalScope('72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2')
    expect(scope.kind).toBe('account')
    expect(storageKeyForScope(scope)).toBe('fpp_account_cache_v1:72d8d4df-efce-4ea3-9d6b-5d5c4651b9c2')
    expect(storageKeyForScope(scope)).not.toContain('@')
  })

  it('rejects email and display-name values as account identities', () => {
    expect(() => resolveLocalScope('ana@example.com')).toThrow()
    expect(() => resolveLocalScope('Ana')).toThrow()
  })
})
