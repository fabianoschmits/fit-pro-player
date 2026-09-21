// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { linkSupabaseIdentity, requestSupabaseProfessionalRole } from './api.js'

afterEach(() => vi.restoreAllMocks())

describe('Supabase account bridge', () => {
  it('sends only the Supabase access token as a bearer credential when linking identity', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ account: { id: 'supabase-user' } }), { status: 200 }))

    await linkSupabaseIdentity('supabase-access-token')

    expect(fetchMock).toHaveBeenCalledWith('/api/account/identity-link', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer supabase-access-token' },
      body: '{}',
    }))
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('service_role')
  })

  it('requests only the professional role through the additive backend route', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ role: { role: 'professional' } }), { status: 200 }))

    await requestSupabaseProfessionalRole('supabase-access-token')

    expect(fetchMock).toHaveBeenCalledWith('/api/account/roles/professional', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer supabase-access-token' },
      body: '{}',
    }))
  })

  it('rejects a missing access token without making a request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    await expect(linkSupabaseIdentity('')).rejects.toThrow('Supabase access token is required')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
