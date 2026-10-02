const KEY = 'fpp_diagnostics_v1'
const TYPES = new Set(['runtime-error','asset-error','unhandled-rejection','navigation','long-task','storage-error','sync-error'])
export function readDiagnostics(storage = globalThis.localStorage) {
  try { const values=JSON.parse(storage.getItem(KEY)||'[]'); return Array.isArray(values)?values.slice(-50):[] } catch { return [] }
}
export function recordDiagnostic(type, data = {}, storage = globalThis.localStorage) {
  if (!TYPES.has(type)) return
  const safe={type,at:new Date().toISOString()}
  for(const field of ['duration','transferSize','count']) if(Number.isFinite(data[field]) && data[field]>=0) safe[field]=Math.round(data[field])
  try { storage.setItem(KEY,JSON.stringify([...readDiagnostics(storage),safe].slice(-50))) } catch { /* diagnostic failure never breaks training */ }
}
export function clearDiagnostics(storage = globalThis.localStorage) { try { storage.removeItem(KEY) } catch { /* optional */ } }
export function installDiagnostics() {
  const error=event=>recordDiagnostic(event.target===window?'runtime-error':'asset-error')
  const rejection=()=>recordDiagnostic('unhandled-rejection')
  window.addEventListener('error',error,true);window.addEventListener('unhandledrejection',rejection)
  const nav=performance.getEntriesByType?.('navigation')?.[0]
  if(nav)recordDiagnostic('navigation',{duration:nav.duration,transferSize:nav.transferSize})
  let observer
  try { observer=new PerformanceObserver(list=>list.getEntries().forEach(entry=>recordDiagnostic('long-task',{duration:entry.duration})));observer.observe({type:'longtask',buffered:true}) } catch { /* unsupported on some WebViews */ }
  return ()=>{window.removeEventListener('error',error,true);window.removeEventListener('unhandledrejection',rejection);observer?.disconnect()}
}
