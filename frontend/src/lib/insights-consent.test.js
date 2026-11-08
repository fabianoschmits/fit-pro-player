import { afterEach, expect, it } from 'vitest'
import { hasAccountAnalyticsConsent, setAnalyticsConsentAccount, hasPendingAnalyticsRevocation, setPendingAnalyticsRevocation, PRIVACY_CONSENT_VERSION } from './privacy-consent.js'
const values=new Map()
const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}
afterEach(()=>{values.clear();setAnalyticsConsentAccount(null);delete globalThis.localStorage})
it('requires account-specific confirmation rather than inheriting device consent',()=>{
 globalThis.localStorage=storage
 storage.setItem('fpp_privacy_consent_v1',JSON.stringify({version:PRIVACY_CONSENT_VERSION,analytics:true}))
 expect(hasAccountAnalyticsConsent('a')).toBe(false)
 setAnalyticsConsentAccount('a')
 expect(hasAccountAnalyticsConsent('a')).toBe(true)
 expect(hasAccountAnalyticsConsent('b')).toBe(false)
 setAnalyticsConsentAccount(null)
 expect(hasAccountAnalyticsConsent('a')).toBe(false)
})
it('retains an unsynchronized revocation only for its own account',()=>{
 setPendingAnalyticsRevocation('a',true,storage)
 expect(hasPendingAnalyticsRevocation('a',storage)).toBe(true)
 expect(hasPendingAnalyticsRevocation('b',storage)).toBe(false)
 setPendingAnalyticsRevocation('a',false,storage)
 expect(hasPendingAnalyticsRevocation('a',storage)).toBe(false)
})
