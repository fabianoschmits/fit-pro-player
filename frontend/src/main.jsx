import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App, { preloadCoreRoutes } from './App.jsx'
import { MOBILE } from './lib/mobile.js'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
)

// Not in the mobile build: the native shell already serves everything from disk.
if (!MOBILE && 'serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller
  let reloadedForUpdate = false
  const assetSignatureOf = doc => [...doc.querySelectorAll('script[type="module"][src],link[rel="stylesheet"][href]')]
    .map(el => el.getAttribute('src') || el.getAttribute('href'))
    .filter(Boolean)
    .join('|')
  const currentAssetSignature = assetSignatureOf(document)

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return
    if (reloadedForUpdate) return
    reloadedForUpdate = true
    window.location.reload()
  })

  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(registration => {
    const activateWaiting = () => {
      registration.waiting?.postMessage({ type: 'CLEAR_RUNTIME_CACHE' })
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
    }
    const checkAppShell = async () => {
      const res = await fetch(location.href, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
      if (!res.ok) return
      const html = await res.text()
      const nextDoc = new DOMParser().parseFromString(html, 'text/html')
      const nextAssetSignature = assetSignatureOf(nextDoc)
      if (!reloadedForUpdate && currentAssetSignature && nextAssetSignature && nextAssetSignature !== currentAssetSignature) {
        reloadedForUpdate = true
        navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_RUNTIME_CACHE' })
        window.location.reload()
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
    const updateInterval = window.setInterval(checkForUpdate, 60000)
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
