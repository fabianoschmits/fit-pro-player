import { useLayoutEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useStore } from '../store/useStore.js'
import { detectInstallTarget } from '../lib/pwa-install.js'
import { MOBILE } from '../lib/mobile.js'
import '../fpp-launch.css'

const owners = new WeakMap()
const MINIMUM = 350, SETTLE = 120, REVEAL = 1400, FINISH = 100
const ROUTE_LIMIT = 4000, SAFETY_LIMIT = 30000

// The shaft contains a radius-.8 circle: exceeding the diagonal covers every
// corner, including tall iPhones, independently of the plate proportions.
export const tunnelEndScale = (width, height) => Math.hypot(width, height) / 1.5
function tunnelEase(progress) {
  const curve = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3
  let low = 0, high = 1
  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2
    if (curve(mid, .20, .12) < progress) low = mid
    else high = mid
  }
  return curve((low + high) / 2, .82, 1)
}

/** One imperative overlay; no route, store, clock or auth mutations. */
export function createLaunchController({ isReady, native = MOBILE }) {
  const layer = document.getElementById('fpp-launch'), surface = document.getElementById('root')
  if (!layer || !surface) return { check() {}, destroy() {} }
  const owner = {}; owners.set(layer, owner)
  const symbol = /** @type {SVGSVGElement} */ (layer.querySelector('.fpp-launch-symbol svg'))
  const curtain = layer.querySelector('.fpp-launch-curtain')
  const hole = layer.querySelector('[data-launch-hole]')
  const outline = layer.querySelector('[data-launch-outline]')
  const frames = new Set(), timers = new Set()
  let disposed = false, active = false, pending = false, phase = 'completed'
  let openedAt = 0, readyAt = null, wake = null, settleAnimation = null
  let wasHidden = document.visibilityState === 'hidden', interrupted = false, dimensionsDirty = false
  const now = () => performance.now()
  const installed = () => !native
    && detectInstallTarget().platform !== 'desktop'
    && (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true)
  const frame = fn => {
    const id = window.requestAnimationFrame(time => { frames.delete(id); if (!disposed) fn(time) })
    frames.add(id); return id
  }
  const later = (fn, duration) => {
    const id = window.setTimeout(() => { timers.delete(id); if (!disposed) fn() }, duration)
    timers.add(id); return id
  }
  const clearWork = () => {
    frames.forEach(id => window.cancelAnimationFrame(id)); frames.clear()
    timers.forEach(id => window.clearTimeout(id)); timers.clear()
    settleAnimation?.cancel(); settleAnimation = null; pending = false; wake = null
  }
  const setPhase = next => { phase = next; layer.dataset.state = next }
  const complete = () => {
    clearWork(); active = false; setPhase('completed'); layer.hidden = true
    layer.setAttribute('aria-hidden', 'true')
    symbol.style.transform = ''; layer.style.opacity = ''
  }
  const animate = (duration, update, done) => {
    const start = now()
    const tick = time => {
      if (!active) return
      const progress = Math.min(1, Math.max(0, (time - start) / duration))
      update(progress)
      if (progress < 1) frame(tick)
      else done()
    }
    frame(tick)
  }
  const reveal = () => {
    if (!active) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    layer.dataset.reducedMotion = String(!!reduced)
    if (reduced) {
      setPhase('revealing')
      animate(FINISH, progress => { layer.style.opacity = String(1 - progress) }, complete)
      return
    }
    let width, height, endScale
    const measure = () => {
      const box = layer.getBoundingClientRect()
      width = box.width || window.innerWidth; height = box.height || window.innerHeight
      endScale = tunnelEndScale(width, height)
      curtain.setAttribute('viewBox', `0 0 ${width} ${height}`); dimensionsDirty = false
    }
    measure()
    const paint = progress => {
      if (dimensionsDirty) measure()
      // Ease depth rather than raw magnification. Perspective interpolation
      // keeps the complete dumbbell legible for most of the approach.
      const depth = 1 - tunnelEase(progress) * (1 - (4 / Math.max(4, endScale)) ** 2)
      const scale = progress === 1 ? endScale : 4 / Math.sqrt(depth)
      const transform = `translate(${width / 2} ${height / 2}) scale(${scale})`
      hole.setAttribute('transform', transform)
      outline.setAttribute('transform', transform)
    }
    paint(0); setPhase('revealing')
    animate(REVEAL, paint, () => { layer.setAttribute('data-launch-finishing', ''); later(complete, FINISH) })
  }
  const settle = () => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const transform = getComputedStyle(symbol).transform
    setPhase('settling')
    if (reduced) { reveal(); return }
    settleAnimation = symbol.animate?.([{ transform }, { transform: 'none' }], { duration: SETTLE, easing: 'ease-out', fill: 'forwards' })
    settleAnimation?.finished?.catch(() => {})
    later(reveal, SETTLE)
  }
  const check = () => {
    if (disposed || !active || phase !== 'loading' || pending || document.visibilityState === 'hidden' || !isReady() || !surface.childElementCount) return
    pending = true
    // A ready store is not proof that React's destination has committed/painted.
    frame(() => frame(() => {
      pending = false
      if (!active || phase !== 'loading' || !isReady()) return
      if (readyAt === null) readyAt = now()
      const remainingRoute = ROUTE_LIMIT - (now() - readyAt)
      const remainingMinimum = (installed() ? MINIMUM : 0) - (now() - openedAt)
      const waiting = surface.querySelector('[data-route-loading],[data-app-booting]')
      const delay = waiting && remainingRoute > 0 ? remainingRoute : Math.max(0, remainingMinimum)
      if (delay > 0) {
        if (wake !== null) { window.clearTimeout(wake); timers.delete(wake) }
        wake = later(check, delay); return
      }
      settle()
    }))
  }
  const start = (adopt = false) => {
    clearWork(); active = true; openedAt = now(); readyAt = null
    layer.hidden = false; layer.removeAttribute('aria-hidden'); layer.removeAttribute('data-launch-finishing')
    layer.removeAttribute('data-reduced-motion'); layer.removeAttribute('data-paused')
    layer.style.opacity = ''; symbol.style.transform = ''; hole.removeAttribute('transform'); outline.removeAttribute('transform')
    surface.removeAttribute('data-launch-timeout')
    if (!adopt) layer.dataset.launchCycle = String(Number(layer.dataset.launchCycle || 0) + 1)
    setPhase('loading')
    later(() => { surface.setAttribute('data-launch-timeout', ''); complete() }, SAFETY_LIMIT)
    check()
  }
  const visibility = () => {
    if (document.visibilityState === 'hidden') {
      wasHidden = true; interrupted = active
      if (active) complete()
    } else if (wasHidden) {
      wasHidden = false
      if (installed() || interrupted) start()
      interrupted = false
    }
  }
  const pageshow = event => {
    if (!event.persisted || !installed() || document.visibilityState === 'hidden' || active) return
    // BFCache may emit both events for one opening, in either order.
    if (!wasHidden && now() - openedAt < MINIMUM + SETTLE + REVEAL + FINISH + 250) return
    wasHidden = false; start()
  }
  const resize = () => { if (active) dimensionsDirty = true }
  const observer = new MutationObserver(check)
  observer.observe(surface, { childList: true, subtree: true })
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('pageshow', pageshow)
  window.addEventListener('resize', resize)
  window.addEventListener('orientationchange', resize)
  start(layer.dataset.state === 'loading')
  return { check, destroy() {
    disposed = true; clearWork(); observer.disconnect()
    document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pageshow', pageshow)
    window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize)
    // StrictMode's replacement owns the same element before this microtask.
    queueMicrotask(() => { if (owners.get(layer) === owner) { complete(); owners.delete(layer) } })
  } }
}

export default function AppLaunchTransition() {
  const ready = useStore(state => state.ready), { status } = useAuth()
  const snapshot = useRef({ ready, status }), controller = useRef(null)
  useLayoutEffect(() => {
    snapshot.current = { ready, status }; controller.current?.check()
  }, [ready, status])
  useLayoutEffect(() => {
    controller.current = createLaunchController({ isReady: () => snapshot.current.ready && snapshot.current.status !== 'initializing' })
    return () => { controller.current?.destroy(); controller.current = null }
  }, [])
  return null
}
