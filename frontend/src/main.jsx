import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { MOBILE } from './lib/mobile.js'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
)

// Not in the mobile build: the native shell already serves everything from disk.
if (!MOBILE && 'serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller
  let reloadedForUpdate = false
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

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          activateWaiting()
        }
      })
    })

    activateWaiting()
    registration.update().catch(() => {})
  }).catch(() => {})
}
