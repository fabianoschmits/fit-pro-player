import { describe, expect, it } from 'vitest'
import { DEFAULT_PRIVACY_CONSENT, PRIVACY_CONSENT_VERSION, readPrivacyConsent, savePrivacyConsent } from './privacy-consent.js'

describe('privacy consent storage', () => {
  it('keeps necessary storage enabled and round-trips choices', () => {
    const storage = { value: null, getItem() { return this.value }, setItem(_, value) { this.value = value } }
    const saved = savePrivacyConsent({ preferences: true, analytics: true }, storage)
    expect(saved).toMatchObject({ version: PRIVACY_CONSENT_VERSION, necessary: true, preferences: true, analytics: true })
    expect(readPrivacyConsent(storage)).toMatchObject(saved)
  })

  it('ignores consent from another document version', () => {
    const storage = { getItem: () => JSON.stringify({ ...DEFAULT_PRIVACY_CONSENT, version: 'old' }) }
    expect(readPrivacyConsent(storage)).toBeNull()
  })
})
