export const PRIVACY_CONSENT_STORAGE_KEY = 'fpp_privacy_consent_v1'
export const PRIVACY_CONSENT_VERSION = '2026-10-13'

export const DEFAULT_PRIVACY_CONSENT = Object.freeze({
  version: PRIVACY_CONSENT_VERSION,
  necessary: true,
  preferences: false,
  analytics: false,
  communications: false,
})

export function readPrivacyConsent(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(PRIVACY_CONSENT_STORAGE_KEY) || 'null')
    if (!value || value.version !== PRIVACY_CONSENT_VERSION) return null
    return { ...DEFAULT_PRIVACY_CONSENT, ...value, necessary: true }
  } catch { return null }
}

export function savePrivacyConsent(value, storage = globalThis.localStorage) {
  const consent = { ...DEFAULT_PRIVACY_CONSENT, ...value, version: PRIVACY_CONSENT_VERSION, necessary: true, acceptedAt: value.acceptedAt || new Date().toISOString() }
  storage.setItem(PRIVACY_CONSENT_STORAGE_KEY, JSON.stringify(consent))
  return consent
}
