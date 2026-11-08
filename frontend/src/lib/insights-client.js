import { getBrowserSupabaseClient } from './supabase-client.js'
import { hasAccountAnalyticsConsent, PRIVACY_CONSENT_STORAGE_KEY, setAnalyticsConsentAccount } from './privacy-consent.js'
import { createInsightsCollector } from './insights-collector.js'
import { MOBILE } from './mobile.js'
import { createFrictionDetector } from './insights-detector.js'

const collector = createInsightsCollector({
  permitted: () => hasAccountAnalyticsConsent(activeAccount),
  send: async (events, owner) => {
    const client = getBrowserSupabaseClient()
    if (!client) throw Error('unavailable')
    const { error } = await client.rpc('insights_ingest', { p_events: events, p_expected_account: owner })
    if (error) throw error
  },
})
let activeAccount = null
export const getInsightsAccount = () => { try { return hasAccountAnalyticsConsent(activeAccount) ? activeAccount : null } catch { return null } }
export function trackInsight(name, properties = {}) {
  try {
  const ua = globalThis.navigator?.userAgent || ''
  const device = (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && globalThis.navigator?.maxTouchPoints > 1)) ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop'
  const platform = MOBILE ? 'native' : globalThis.matchMedia?.('(display-mode: standalone)').matches ? 'pwa' : 'web'
  collector.track(name, { app_version: import.meta.env.VITE_APP_VERSION || 'unknown', device, platform, ...properties })
  } catch { /* optional measurement must never change an operation's outcome */ }
}
export const detectInsightFailure = createFrictionDetector(trackInsight, getInsightsAccount)
export function activateInsights(accountId) { activeAccount = accountId; collector.setAccount(accountId) }
export function clearPendingInsights() { collector.clear() }
export function installInsightsTransport() {
  const flush = () => { if (document.visibilityState === 'visible') void collector.flush() }
  let hiddenAt = null
  const visibility = () => {
    if(document.visibilityState==='hidden') { hiddenAt=Date.now(); return }
    if(hiddenAt && Date.now()-hiddenAt>=30000 && getInsightsAccount()) {
      const route=location.hash.slice(1).split('?')[0]
      if(!route.startsWith('/console')) trackInsight('screen_viewed',{route,outcome:'foreground_return'})
    }
    hiddenAt=null
  }
  let previousPermission=Boolean(getInsightsAccount())
  const changed = event => {
    if (event.type==='storage') {
      if (event.key!==null && event.key!==PRIVACY_CONSENT_STORAGE_KEY && event.key!==`fpp_analytics_revocation:${activeAccount}`) return
      setAnalyticsConsentAccount(null)
    }
    const permission=Boolean(getInsightsAccount()), newlyAllowed=permission && !previousPermission
    previousPermission=permission
    if (!permission) { collector.clear(); return }
    if (!newlyAllowed || document.visibilityState!=='visible') return
    const route = location.hash.slice(1).split('?')[0]
    if (!route.startsWith('/console')) trackInsight('screen_viewed',{route})
  }
  const timer = setInterval(flush, 15000)
  window.addEventListener('online', flush)
  window.addEventListener('fitproplayer:consent-changed', changed)
  window.addEventListener('storage', changed)
  document.addEventListener('visibilitychange',visibility)
  return () => { clearInterval(timer); window.removeEventListener('online', flush); window.removeEventListener('storage', changed); window.removeEventListener('fitproplayer:consent-changed', changed); document.removeEventListener('visibilitychange',visibility) }
}
