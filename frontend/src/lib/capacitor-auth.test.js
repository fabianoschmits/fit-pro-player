import { describe, expect, it } from 'vitest'
import { callbackUrlFromCapacitorLink, parseCapacitorAuthUrl } from './capacitor-auth.js'

describe('Capacitor auth deep-link contract', () => {
  it('accepts only confirmation/recovery code links and never parses token fragments', () => {
    expect(parseCapacitorAuthUrl('fitproplayer://auth/callback?auth_flow=confirm&code=abc')).toEqual({ flow: 'confirm', code: 'abc' })
    expect(parseCapacitorAuthUrl('fitproplayer://auth/callback?auth_flow=recovery&code=abc#access_token=secret')).toBeNull()
    expect(parseCapacitorAuthUrl('https://example.test/?auth_flow=confirm&code=abc')).toBeNull()
  })

  it('converts a native link into the existing PKCE callback contract', () => {
    expect(callbackUrlFromCapacitorLink('fitproplayer://auth/callback?auth_flow=recovery&code=abc', 'https://fpp.test'))
      .toBe('https://fpp.test/?auth_flow=recovery&code=abc')
  })
})
