// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
const rpc=vi.hoisted(()=>vi.fn().mockResolvedValue({error:null,data:2}))
vi.mock('./supabase-client.js',()=>({getBrowserSupabaseClient:()=>({rpc})}))
import { activateInsights, getInsightsAccount, installInsightsTransport, trackInsight } from './insights-client.js'
import { savePrivacyConsent, setAnalyticsConsentAccount } from './privacy-consent.js'
let dispose=()=>{}
afterEach(()=>{dispose();activateInsights(null);setAnalyticsConsentAccount(null);localStorage.clear();rpc.mockClear();vi.useRealTimers()})
it('does not turn unrelated writes or unchanged permission into screen activity',async()=>{
 vi.useFakeTimers()
 savePrivacyConsent({analytics:true});setAnalyticsConsentAccount('account-a');activateInsights('account-a')
 dispose=installInsightsTransport()
 trackInsight('screen_viewed',{route:'/home'})
 window.dispatchEvent(new StorageEvent('storage',{key:'gym_state_v1',newValue:'updated'}))
 window.dispatchEvent(new Event('fitproplayer:consent-changed'))
 await vi.advanceTimersByTimeAsync(15000)
 expect(rpc).toHaveBeenCalledTimes(1)
 expect(rpc.mock.calls[0][1].p_events.filter(e=>e.name==='screen_viewed')).toHaveLength(1)
})
it('discards queued events immediately after revocation',async()=>{
 vi.useFakeTimers()
 savePrivacyConsent({analytics:true});setAnalyticsConsentAccount('account-a');activateInsights('account-a')
 dispose=installInsightsTransport();trackInsight('action_failed')
 savePrivacyConsent({analytics:false})
 await vi.advanceTimersByTimeAsync(15000)
 expect(rpc).not.toHaveBeenCalled()
})
it('silently disables telemetry when storage access is unavailable',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage')
 try {
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('storage blocked')}})
  expect(getInsightsAccount()).toBeNull()
  expect(()=>trackInsight('action_failed')).not.toThrow()
 } finally { Object.defineProperty(globalThis,'localStorage',descriptor) }
})
