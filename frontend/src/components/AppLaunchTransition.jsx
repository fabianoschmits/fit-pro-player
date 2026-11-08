import { useLayoutEffect, useRef } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { useStore } from '../store/useStore.js'
import { detectInstallTarget } from '../lib/pwa-install.js'
import { MOBILE } from '../lib/mobile.js'
import '../fpp-launch.css'

const owners = new WeakMap()
const MINIMUM = 900, LOADING_VARIATION = 900, SETTLE = 120, REVEAL = 1400, FINISH = 100
const ROUTE_LIMIT = 4000, SAFETY_LIMIT = 30000
const RESUME_MINIMUM = 250, RESUME_DEDUP = 600

const LOGO_START_SCALE = 180 / 1140
// (650,235) lies inside the first P's solid lower bowl, with a radius-10
// clearance. Expand this disc beyond the diagonal: counters/gaps cannot leave
// black remnants at the viewport center or corners, even on tall iPhones.
export const tunnelEndScale = (width, height, x = width / 2, y = height / 2) => Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) / 9
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
  const shield = layer.querySelector('[data-launch-shield]')
  const svgNS = 'http://www.w3.org/2000/svg'
  const trail = document.createElementNS(svgNS, 'g')
  trail.setAttribute('data-launch-trail', '')
  trail.setAttribute('opacity', '0')
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
  let openedAt = 0, readyAt = null, wake = null, recovery = null, presentationMinimum = 0
  let dimensionsDirty = false
  let generation = 0, hiddenAt = null, lastResume = -Infinity, armed = false
  const now = () => performance.now()
  const lifecycleNow = () => Date.now() // continues across OS suspension on iOS
  const installed = () => !native
    && detectInstallTarget().platform !== 'desktop'
    && (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true)
  const frame = fn => {
    const cycle = generation
    const id = window.requestAnimationFrame(time => { frames.delete(id); if (!disposed && cycle === generation) fn(time) })
    frames.add(id); return id
  }
  const later = (fn, duration) => {
    const cycle = generation
    const id = window.setTimeout(() => { timers.delete(id); if (!disposed && cycle === generation) fn() }, duration)
    timers.add(id); return id
  }
  const clearWork = () => {
    frames.forEach(id => window.cancelAnimationFrame(id)); frames.clear()
    timers.forEach(id => window.clearTimeout(id)); timers.clear()
    pending = false; wake = null; recovery = null
    trail.replaceChildren()
  }
  const setPhase = next => { phase = next; layer.dataset.state = next }
  const complete = () => {
    if (disposed && owners.get(layer) !== owner) return
    layer.setAttribute('data-launch-restoring', '')
    layer.hidden = true; clearWork(); active = false; armed = false; setPhase('completed')
    layer.setAttribute('aria-hidden', 'true')
    symbol.style.transform = ''; layer.style.opacity = ''
    // Restore the page's theme without its unrelated background transition
    // cross-fading from the black safety backdrop after the curtain is gone.
    if (!disposed) frame(() => frame(() => layer.removeAttribute('data-launch-restoring')))
    else layer.removeAttribute('data-launch-restoring')
  }
  const protect = () => {
    // Reset the persistent curtain while still hidden. Its mask starts fully
    // white; root stays invisible until the curtain's FPP mask is ready.
    hole.setAttribute('opacity', '0'); trail.setAttribute('opacity', '0'); outline.setAttribute('opacity', '0')
    shield.setAttribute('mask', 'url(#fpp-launch-mask)')
    layer.removeAttribute('data-mask-ready'); layer.removeAttribute('data-launch-fallback')
    layer.removeAttribute('data-launch-finishing'); layer.removeAttribute('data-curtain-ready')
    layer.removeAttribute('data-reduced-motion'); layer.removeAttribute('data-paused')
    layer.removeAttribute('data-launch-restoring')
    layer.style.opacity = ''; setPhase('loading')
    layer.hidden = false; layer.removeAttribute('aria-hidden')
  }
  const animate = (duration, update, done) => {
    let elapsed = 0, previous = null
    const tick = time => {
      if (!active) return
      if (document.visibilityState === 'hidden') { previous = null; frame(tick); return }
      // Start on the first displayed frame. A stalled main thread must not
      // consume the whole tunnel before the browser has shown any of it.
      // Normal frame timing retains the 1400ms/easing contract. Limit a stall
      // to 100ms (at least 14 reveal updates), without turning slow devices
      // into a multi-second slow-motion opening through a 32ms frame cap.
      if (previous !== null) elapsed += Math.min(100, Math.max(0, time - previous))
      previous = time
      const progress = Math.min(1, elapsed / duration)
      update(progress)
      if (progress < 1) frame(tick)
      else done()
    }
    frame(tick)
  }
  const reveal = () => {
    if (!active) return
    if (document.visibilityState === 'hidden') { frame(reveal); return }
    if (!isReady() || !surface.childElementCount) {
      setPhase('loading'); readyAt = null
      recovery = later(() => { surface.setAttribute('data-launch-timeout', ''); complete() }, SAFETY_LIMIT)
      check(); return
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    layer.dataset.reducedMotion = String(!!reduced)
    const fade = () => {
      // The same SVG rect becomes an unmasked, opaque shield on unsupported
      // engines/preparation failure. No surface swap or unprotected frame.
      shield.removeAttribute('mask')
      hole.setAttribute('opacity', '0'); trail.setAttribute('opacity', '0'); outline.setAttribute('opacity', '0')
      layer.removeAttribute('data-mask-ready'); layer.setAttribute('data-launch-fallback', '')
      setPhase('revealing')
      animate(FINISH, progress => { layer.style.opacity = String(1 - progress) }, complete)
    }
    const mask = layer.querySelector('#fpp-launch-mask')
    // Validate the SVG resource itself; CSS mask support alone does not prove
    // that an SVG mask attribute has a valid resource/geometry to render.
    const supported = mask?.namespaceURI === svgNS && mask.getAttribute('maskUnits') === 'userSpaceOnUse'
      && mask.querySelector('rect[fill="white"]') && hole.parentElement === mask
      && shield.namespaceURI === svgNS && curtain.contains(shield)
      && shield.getAttribute('mask') === 'url(#fpp-launch-mask)' && opening.getAttribute('d')
      && window.CSS?.supports?.('mask', 'url(#fpp-launch-mask)') !== false
    if (reduced || !supported) { fade(); return }
    let width, height, endScale, startScale, originX, originY, lastStep = -1
    const measure = () => {
      const box = layer.getBoundingClientRect()
      width = box.width || window.innerWidth; height = box.height || window.innerHeight
      // Read the actual SVG mapping, including its viewBox/letterboxing and
      // responsive width. The first hole is the same geometry in the same place.
      const matrix = symbol.getScreenCTM?.()
      startScale = matrix?.a || LOGO_START_SCALE
      originX = matrix ? matrix.a * 650 + matrix.c * 235 + matrix.e - box.left : width / 2
      originY = matrix ? matrix.b * 650 + matrix.d * 235 + matrix.f - box.top : height / 2 - 24
      endScale = tunnelEndScale(width, height, originX, originY)
      curtain.setAttribute('viewBox', `0 0 ${width} ${height}`); dimensionsDirty = false
      const curtainBox = curtain.getBoundingClientRect()
      if (!curtain.isConnected || !shield.isConnected || (box.width > 0 && (curtainBox.width + 1 < width || curtainBox.height + 1 < height))) throw new Error('Launch curtain does not cover the viewport')
    }
    const paint = progress => {
      // Keep the retained SVG trail bounded to 60 updates/second, even on
      // high-refresh displays. No React renders or per-frame layout reads.
      const step = Math.floor(progress * REVEAL / (1000 / 60))
      if (step === lastStep && !dimensionsDirty) return
      lastStep = step
      if (dimensionsDirty) measure()
      // Ease depth rather than raw magnification. Perspective interpolation
      // keeps the complete FPP lettering legible for most of the approach.
      const depth = 1 - tunnelEase(progress) * (1 - (startScale / Math.max(startScale, endScale)) ** 2)
      const scale = progress === 0 ? startScale : progress === 1 ? endScale : startScale / Math.sqrt(depth)
      const transform = `translate(${originX} ${originY}) scale(${scale})`
      hole.setAttribute('transform', transform)
      outline.setAttribute('transform', transform)
      // Scaling disconnected letters is not a nested opening: gaps and P
      // counters otherwise cover pixels that were visible in the prior frame.
      // Retain each painted opening until completion so reveal only advances.
      trail.setAttribute('transform', `translate(${originX} ${originY})`)
      const stamp = hole.cloneNode(true)
      stamp.removeAttribute('data-launch-hole')
      stamp.removeAttribute('opacity')
      stamp.setAttribute('transform', `scale(${scale})`)
      trail.append(stamp)
      // Compensate the parent scale: all letter edges retain a subtle 2px
      // contour instead of swelling into thick borders during the tunnel.
      outline.setAttribute('stroke-width', String(2 / scale))
    }
    try { measure(); paint(0) } catch { fade(); return }
    layer.setAttribute('data-curtain-ready', '')
    layer.setAttribute('data-mask-ready', '')
    frame(() => frame(() => {
      hole.setAttribute('opacity', '1'); trail.setAttribute('opacity', '1'); outline.setAttribute('opacity', '1')
      setPhase('revealing')
      animate(REVEAL, paint, () => frame(() => { layer.setAttribute('data-launch-finishing', ''); later(complete, FINISH) }))
    }))
  }
  const settle = () => {
    // This timeout protects boot only; it must never cut a healthy reveal short.
    if (recovery !== null) { window.clearTimeout(recovery); timers.delete(recovery); recovery = null }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setPhase('settling')
    if (reduced) { reveal(); return }
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
    generation++; clearWork(); active = true; armed = false; openedAt = now(); readyAt = null
    // Presentation only: requests/boot keep running. Sample once, never on
    // renders or readiness checks, and never shorten a genuinely slow boot.
    presentationMinimum = installed() || (!native && login) ? MINIMUM + Math.floor(Math.random() * LOADING_VARIATION) : 0
    protect()
    symbol.style.transform = ''; hole.removeAttribute('transform'); outline.removeAttribute('transform')
    surface.removeAttribute('data-launch-timeout')
    if (!adopt) layer.dataset.launchCycle = String(Number(layer.dataset.launchCycle || 0) + 1)
    setPhase('loading')
    recovery = later(() => { surface.setAttribute('data-launch-timeout', ''); complete() }, SAFETY_LIMIT)
    check()
  }
  const visibility = () => {
    if (document.visibilityState === 'hidden') {
      if (hiddenAt === null) hiddenAt = lifecycleNow()
      // Arm the closed curtain before the OS can show a restored document.
      // A brief visibility blip can roll back this arm without a new cycle.
      if (installed() && !active && !armed) { generation++; clearWork(); protect(); armed = true }
      if (active) layer.setAttribute('data-paused', '')
    } else resume()
  }
  const resume = () => {
    if (document.visibilityState === 'hidden') return
    const away = hiddenAt === null ? null : Math.max(0, lifecycleNow() - hiddenAt)
    hiddenAt = null; layer.removeAttribute('data-paused')
    const separate = lifecycleNow() - lastResume >= RESUME_DEDUP
    if (away !== null) lastResume = lifecycleNow()
    if (installed() && away !== null && away >= RESUME_MINIMUM && separate) {
      // An unfinished cycle continues safely; a completed one starts exactly once.
      if (armed || !active) start()
    } else if (armed) complete()
    check()
  }
  const pagehide = () => {
    if (hiddenAt === null) hiddenAt = lifecycleNow()
    if (installed() && !active && !armed) { generation++; clearWork(); protect(); armed = true }
  }
  const pageshow = event => {
    if (event.persisted && installed() && hiddenAt === null && !active && !armed && lifecycleNow() - lastResume >= RESUME_DEDUP) {
      lastResume = lifecycleNow(); start()
    } else resume()
  }
  const resize = () => { if (active) dimensionsDirty = true }
  const observer = new MutationObserver(check)
  observer.observe(surface, { childList: true, subtree: true })
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('pagehide', pagehide)
  window.addEventListener('pageshow', pageshow)
  window.addEventListener('resize', resize)
  window.addEventListener('orientationchange', resize)
  start(layer.dataset.state === 'loading')
  return { check, enter() {
    if (disposed) return
    if (active) check()
    else start(false, true)
  }, destroy() {
    disposed = true; generation++; clearWork(); observer.disconnect()
    document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pageshow', pageshow); window.removeEventListener('pagehide', pagehide)
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
