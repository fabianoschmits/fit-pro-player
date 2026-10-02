import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App, { preloadCoreRoutes } from './App.jsx'
import { AuthProvider } from './auth/AuthProvider.jsx'
import { MOBILE } from './lib/mobile.js'
import { useStore } from './store/useStore.js'
import { canReloadForUpdate } from './lib/reload-safety.js'
import AppStatus from './components/AppStatus.jsx'
import { installDiagnostics } from './lib/diagnostics.js'
import './index.css'
import './professional.css'

installDiagnostics()

createRoot(document.getElementById('root')).render(
  <StrictMode><AuthProvider><App /><AppStatus /></AuthProvider></StrictMode>
)

// Not in the mobile build: the native shell already serves everything from disk.
if (!MOBILE && 'serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  const hadController = !!navigator.serviceWorker.controller
  let reloadedForUpdate = false
  let updatePending = false
  let waitingRegistration = null
  const requestSafeReload = () => {
    if (reloadedForUpdate) return
    if (!canReloadForUpdate(useStore.getState().S)) {
      updatePending = true
      window.dispatchEvent(new Event('fitproplayer:update-available'))
      return
    }
    if (waitingRegistration?.waiting) {
      waitingRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
      waitingRegistration = null
      return // controllerchange reloads after the new worker has taken control.
    }
    reloadedForUpdate = true
    window.location.reload()
  }
  useStore.subscribe(() => { if (updatePending && canReloadForUpdate(useStore.getState().S)) requestSafeReload() })
  const assetSignatureOf = doc => [...doc.querySelectorAll('script[type="module"][src],link[rel="stylesheet"][href]')]
    .map(el => el.getAttribute('src') || el.getAttribute('href'))
    .filter(Boolean)
    .join('|')
  const currentAssetSignature = assetSignatureOf(document)

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return
    if (reloadedForUpdate) return
    requestSafeReload()
  })

  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(registration => {
    const activateWaiting = () => {
      if (canReloadForUpdate(useStore.getState().S)) registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
      else if (registration.waiting) { waitingRegistration = registration; updatePending = true; window.dispatchEvent(new Event('fitproplayer:update-available')) }
    }
    const checkAppShell = async () => {
      const res = await fetch(location.href, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
      if (!res.ok) return
      const html = await res.text()
      const nextDoc = new DOMParser().parseFromString(html, 'text/html')
      const nextAssetSignature = assetSignatureOf(nextDoc)
      if (!reloadedForUpdate && currentAssetSignature && nextAssetSignature && nextAssetSignature !== currentAssetSignature) {
        requestSafeReload()
      }
    }
    const checkForUpdate = () => {
      if (document.visibilityState === 'hidden') return
      registration.update().then(activateWaiting).catch(() => {})
      checkAppShell().catch(() => {})
    }

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          activateWaiting()
        }
      })
    })

    activateWaiting()
    checkForUpdate()
    const updateInterval = window.setInterval(checkForUpdate, 300000)
    window.addEventListener('focus', checkForUpdate)
    window.addEventListener('online', checkForUpdate)
    document.addEventListener('visibilitychange', checkForUpdate)
    navigator.serviceWorker.ready.then(() => {
      checkForUpdate()
      const preload = () => preloadCoreRoutes().catch(() => {})
      if ('requestIdleCallback' in window) window.requestIdleCallback(preload, { timeout: 5000 })
      else window.setTimeout(preload, 1500)
    }).catch(() => {})
    window.addEventListener('beforeunload', () => {
      window.clearInterval(updateInterval)
      window.removeEventListener('focus', checkForUpdate)
      window.removeEventListener('online', checkForUpdate)
      document.removeEventListener('visibilitychange', checkForUpdate)
    }, { once: true })
  }).catch(() => {})
}
