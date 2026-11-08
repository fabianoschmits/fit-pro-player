export const PRIVACY_CONSENT_STORAGE_KEY = 'fpp_privacy_consent_v1'
export const PRIVACY_CONSENT_VERSION = '2026-10-13'
let analyticsConsentAccount = null
let analyticsGrantedForAccount = false
export function setAnalyticsConsentAccount(userId) {
  const granted=Boolean(userId && readPrivacyConsent()?.analytics===true)
  if (analyticsConsentAccount === userId && analyticsGrantedForAccount===granted) return
  analyticsConsentAccount=userId
  analyticsGrantedForAccount=granted
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('fitproplayer:consent-changed'))
}
export function hasAccountAnalyticsConsent(userId) {
  return Boolean(userId && userId===analyticsConsentAccount && analyticsGrantedForAccount && !hasPendingAnalyticsRevocation(userId) && readPrivacyConsent()?.analytics===true)
}
export function setPendingAnalyticsRevocation(userId, pending, storage = globalThis.localStorage) {
  if (!userId) return
  const key=`fpp_analytics_revocation:${userId}`
  try { if(pending) storage.setItem(key,'1'); else storage.removeItem(key) } catch { /* local consent still blocks collection */ }
}
export function hasPendingAnalyticsRevocation(userId, storage = globalThis.localStorage) {
  try { return storage.getItem(`fpp_analytics_revocation:${userId}`)==='1' } catch { return false }
}

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
  if (typeof window !== 'undefined' && storage === globalThis.localStorage) window.dispatchEvent(new Event('fitproplayer:consent-changed'))
  return consent
}
