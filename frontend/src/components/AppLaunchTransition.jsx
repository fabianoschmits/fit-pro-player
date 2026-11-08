import { useLayoutEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useStore } from '../store/useStore.js'
import { detectInstallTarget } from '../lib/pwa-install.js'
import { MOBILE } from '../lib/mobile.js'
import '../fpp-launch.css'

const owners = new WeakMap()
const MINIMUM = 900, LOADING_VARIATION = 900, SETTLE = 120, REVEAL = 1400, FINISH = 100
const ROUTE_LIMIT = 4000, SAFETY_LIMIT = 30000

const LOGO_START_SCALE = 180 / 1140
// (650,235) lies inside the first P's solid lower bowl, with a radius-10
// clearance. Expand this disc beyond the diagonal: counters/gaps cannot leave
// black remnants at the viewport center or corners, even on tall iPhones.
export const tunnelEndScale = (width, height) => Math.hypot(width, height) / 18
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
  if (!layer || !surface) return { check() {}, enter() {}, destroy() {} }
  const owner = {}; owners.set(layer, owner)
  const symbol = /** @type {SVGSVGElement} */ (layer.querySelector('.fpp-launch-symbol svg'))
  const curtain = layer.querySelector('.fpp-launch-curtain')
  const hole = layer.querySelector('[data-launch-hole]')
  const outline = layer.querySelector('[data-launch-outline]')
  const svgNS = 'http://www.w3.org/2000/svg'
  const trail = document.createElementNS(svgNS, 'g')
  trail.setAttribute('data-launch-trail', '')
  hole.before(trail)
  // Transparent counters must belong to each stamp, rather than painting white
  // over earlier openings. One even-odd path gives the union a true FPP shape.
  let opening = layer.querySelector('#fpp-logo-opening')
  if (!opening) {
    opening = document.createElementNS(svgNS, 'path')
    opening.id = 'fpp-logo-opening'
    opening.setAttribute('fill-rule', 'evenodd')
    opening.setAttribute('d', [...layer.querySelectorAll('#fpp-logo-shape path, #fpp-logo-counters path')].map(path => path.getAttribute('d')).join(' '))
    layer.querySelector('.fpp-launch-defs defs').append(opening)
  }
  const openingUse = document.createElementNS(svgNS, 'use')
  openingUse.setAttribute('href', '#fpp-logo-opening')
  openingUse.setAttribute('fill', 'black')
  openingUse.setAttribute('transform', 'translate(-650 -235)')
  hole.replaceChildren(openingUse)
  const frames = new Set(), timers = new Set()
  let disposed = false, active = false, pending = false, phase = 'completed'
  let openedAt = 0, readyAt = null, wake = null, settleAnimation = null, presentationMinimum = 0
  let dimensionsDirty = false
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
    trail.replaceChildren()
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
    let width, height, endScale, lastStep = -1
    const measure = () => {
      const box = layer.getBoundingClientRect()
      width = box.width || window.innerWidth; height = box.height || window.innerHeight
      endScale = tunnelEndScale(width, height)
      curtain.setAttribute('viewBox', `0 0 ${width} ${height}`); dimensionsDirty = false
    }
    measure()
    const paint = progress => {
      // Keep the retained SVG trail bounded to 60 updates/second, even on
      // high-refresh displays. No React renders or per-frame layout reads.
      const step = Math.floor(progress * REVEAL / (1000 / 60))
      if (step === lastStep && !dimensionsDirty) return
      lastStep = step
      if (dimensionsDirty) measure()
      // Ease depth rather than raw magnification. Perspective interpolation
      // keeps the complete FPP lettering legible for most of the approach.
      const depth = 1 - tunnelEase(progress) * (1 - (LOGO_START_SCALE / Math.max(LOGO_START_SCALE, endScale)) ** 2)
      const scale = progress === 1 ? endScale : LOGO_START_SCALE / Math.sqrt(depth)
      const transform = `translate(${width / 2} ${height / 2}) scale(${scale})`
      hole.setAttribute('transform', transform)
      outline.setAttribute('transform', transform)
      // Scaling disconnected letters is not a nested opening: gaps and P
      // counters otherwise cover pixels that were visible in the prior frame.
      // Retain each painted opening until completion so reveal only advances.
      trail.setAttribute('transform', `translate(${width / 2} ${height / 2})`)
      const stamp = hole.cloneNode(true)
      stamp.removeAttribute('data-launch-hole')
      stamp.setAttribute('transform', `scale(${scale})`)
      trail.append(stamp)
      // Compensate the parent scale: all letter edges retain a subtle 2px
      // contour instead of swelling into thick borders during the tunnel.
      outline.setAttribute('stroke-width', String(2 / scale))
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
      const remainingMinimum = presentationMinimum - (now() - openedAt)
      const waiting = surface.querySelector('[data-route-loading],[data-app-booting]')
      const delay = waiting && remainingRoute > 0 ? remainingRoute : Math.max(0, remainingMinimum)
      if (delay > 0) {
        if (wake !== null) { window.clearTimeout(wake); timers.delete(wake) }
        wake = later(check, delay); return
      }
      settle()
    }))
  }
  const start = (adopt = false, login = false) => {
    clearWork(); active = true; openedAt = now(); readyAt = null
    // Presentation only: requests/boot keep running. Sample once, never on
    // renders or readiness checks, and never shorten a genuinely slow boot.
    presentationMinimum = installed() || (!native && login) ? MINIMUM + Math.floor(Math.random() * LOADING_VARIATION) : 0
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
      // Leaving the window cancels an opening already in progress. Returning
      // to the same live app must not start a second presentation.
      if (active) complete()
    } else check()
  }
  const resize = () => { if (active) dimensionsDirty = true }
  const observer = new MutationObserver(check)
  observer.observe(surface, { childList: true, subtree: true })
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('pageshow', check)
  window.addEventListener('resize', resize)
  window.addEventListener('orientationchange', resize)
  start(layer.dataset.state === 'loading')
  return { check, enter() {
    if (disposed) return
    if (active) check()
    else start(false, true)
  }, destroy() {
    disposed = true; clearWork(); observer.disconnect()
    document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pageshow', check)
    window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize)
    trail.remove()
    // StrictMode's replacement owns the same element before this microtask.
    queueMicrotask(() => { if (owners.get(layer) === owner) { complete(); owners.delete(layer) } })
  } }
}

export default function AppLaunchTransition() {
  const ready = useStore(state => state.ready), { status } = useAuth()
  const entered = useStore(state => state.isAppEntered?.() ?? true)
  const snapshot = useRef({ ready, status, entered }), controller = useRef(null)
  const previousStatus = useRef(status), pendingLogin = useRef(false)
  useLayoutEffect(() => {
    snapshot.current = { ready, status, entered }
    if (previousStatus.current === 'anonymous' && status === 'authenticated') pendingLogin.current = true
    if (status === 'anonymous') pendingLogin.current = false
    previousStatus.current = status
    if (pendingLogin.current && entered && ready) {
      pendingLogin.current = false
      if (!MOBILE && detectInstallTarget().platform === 'desktop') controller.current?.enter()
      else controller.current?.check()
    } else controller.current?.check()
  }, [ready, status, entered])
  useLayoutEffect(() => {
    controller.current = createLaunchController({ isReady: () => snapshot.current.ready
      && snapshot.current.status !== 'initializing'
      && (snapshot.current.status !== 'authenticated' || snapshot.current.entered) })
    return () => { controller.current?.destroy(); controller.current = null }
  }, [])
  return null
}
