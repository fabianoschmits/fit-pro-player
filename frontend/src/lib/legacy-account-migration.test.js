import { describe, expect, it, vi } from 'vitest'
import { LEGACY_MIGRATION_STATE, legacyMigrationState, linkLegacyAccount } from './legacy-account-migration.js'

describe('legacy account migration', () => {
  it('requires both existing legacy session and Supabase session', () => {
    expect(legacyMigrationState({ legacyUser: { id: 'legacy' } })).toBe(LEGACY_MIGRATION_STATE.LEGACY_ONLY)
    expect(legacyMigrationState({ supabaseUser: { id: 'supabase' } })).toBe(LEGACY_MIGRATION_STATE.SUPABASE_ONLY)
    expect(legacyMigrationState({ legacyUser: { id: 'legacy' }, supabaseUser: { id: 'supabase' } })).toBe(LEGACY_MIGRATION_STATE.AVAILABLE)
    expect(legacyMigrationState({ legacyUser: { id: 'legacy' }, supabaseUser: { id: 'supabase' }, legacyLink: { status: 'active' } })).toBe(LEGACY_MIGRATION_STATE.ALREADY_LINKED)
  })

  it('uses the existing server bridge and never accepts an email as identity authority', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ account: {} }) })
    const result = await linkLegacyAccount({
      client: { auth: { getSession: async () => ({ data: { session: { access_token: 'short-lived' } } }) } },
      fetchImpl,
    })
    expect(result).toEqual({ account: {} })
    expect(fetchImpl).toHaveBeenCalledWith('/api/account/identity-link', expect.objectContaining({ method: 'POST', body: '{}' }))
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer short-lived')
    expect(fetchImpl.mock.calls[0][1].headers.email).toBeUndefined()
  })
})
