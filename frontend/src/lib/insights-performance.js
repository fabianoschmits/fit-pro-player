import { readPrivacyConsent } from './privacy-consent.js'
import { trackInsight } from './insights-client.js'
let measured = false
// Observe the existing curtain's completed state. Never drive its clock, styles or React state.
export function observeInsightsOpening() {
  try { if (!readPrivacyConsent()?.analytics || measured) return () => {} } catch { return () => {} }
  const layer = document.getElementById('fpp-launch')
  if (!layer) return () => {}
  const observer = new MutationObserver(() => {
    if (measured || !layer.hidden || layer.dataset.state !== 'completed' || layer.hasAttribute('data-launch-restoring')) return
    measured = true
    trackInsight('interface_usable', { duration_ms: performance.now(), outcome:'curtain_completed' })
    observer.disconnect()
  })
  observer.observe(layer,{attributes:true,attributeFilter:['hidden','data-state','data-launch-restoring']})
  return () => observer.disconnect()
}
