// @vitest-environment happy-dom
import { StrictMode, act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ ready: true, auth: 'anonymous', entered: true, isAppEntered() { return this.entered } }))
vi.mock('../store/useStore.js', () => ({ useStore: select => select(state) }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => ({ status: state.auth }) }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false }))
import AppLaunchTransition, { createLaunchController, tunnelEndScale } from './AppLaunchTransition.jsx'

let controller, layer, root, installed, reduced, visible
const advance = ms => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const visibility = value => { visible = value; document.dispatchEvent(new Event('visibilitychange')) }
const restore = () => { const event = new Event('pageshow'); Object.defineProperty(event, 'persisted', { value: true }); window.dispatchEvent(event) }
beforeEach(() => {
  vi.useFakeTimers(); installed = true; reduced = false; visible = 'visible'
  vi.spyOn(Math, 'random').mockReturnValue(0)
  const css = window.CSS
  vi.spyOn(window, 'CSS', 'get').mockReturnValue(css)
  vi.spyOn(css, 'supports').mockReturnValue(true)
  state.ready = true; state.auth = 'anonymous'; state.entered = true
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: query.includes('reduced-motion') ? reduced : installed }))
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visible)
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone)')
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(fn => window.setTimeout(() => fn(performance.now()), 16))
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => window.clearTimeout(id))
  const html = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html')
  document.body.innerHTML = html.getElementById('fpp-launch').outerHTML + '<div id="root"><input value="untouched"><div id="controller"></div></div>'
  layer = document.getElementById('fpp-launch')
})
afterEach(async () => {
  if (root) await act(async () => root.unmount())
  root = null; controller?.destroy(); controller = null
  await Promise.resolve(); vi.clearAllTimers(); vi.restoreAllMocks(); vi.useRealTimers(); document.body.innerHTML = ''
})

it('chooses a bounded loading presentation once per opening and still waits for actual readiness', async () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(.9)
  let ready = true
  controller = createLaunchController({ isReady: () => ready })
  await advance(900); expect(layer.dataset.state).toBe('loading')
  random.mockClear().mockReturnValue(0)
  controller.check(); controller.check()
  expect(random).not.toHaveBeenCalled()
  await advance(900); expect(layer.dataset.state).toBe('settling')
  await advance(1800); expect(layer.hidden).toBe(true)
  ready = false; controller.enter()
  await advance(2200); expect(layer.dataset.state).toBe('loading')
  ready = true; controller.check()
  await advance(70); expect(layer.dataset.state).toBe('settling')
})

it('keeps the identity on an instant installed launch and waits for the real route', async () => {
  let ready = false
  controller = createLaunchController({ isReady: () => ready })
  await advance(1500); expect(layer.dataset.state).toBe('loading')
  ready = true; document.getElementById('root').insertAdjacentHTML('beforeend', '<div data-route-loading></div>')
  controller.check(); await advance(100); expect(layer.dataset.state).toBe('loading')
  document.querySelector('[data-route-loading]').remove(); controller.check()
  await advance(70); expect(layer.dataset.state).toBe('settling')
  await advance(150); expect(layer.dataset.state).toBe('revealing')
  expect(document.querySelector('[data-launch-hole]').getAttribute('transform')).toContain('scale(')
  await advance(800); expect(layer.hidden).toBe(false); await advance(850); expect(layer.hidden).toBe(true); expect(layer.dataset.state).toBe('completed')
})

it('does not skip the tunnel when its first animation frame arrives late', async () => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(fn => window.setTimeout(() => fn(performance.now() + 2500), 16))
  controller = createLaunchController({ isReady: () => true })
  await advance(1200)
  expect(layer.dataset.state).toBe('revealing'); expect(layer.hidden).toBe(false)
  await advance(600); expect(layer.dataset.state).toBe('revealing')
  await advance(1400); expect(layer.hidden).toBe(true)
})

it('preserves a bounded presentation under slow frames instead of stretching the tunnel indefinitely', async () => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(fn => window.setTimeout(() => fn(performance.now()), 200))
  controller = createLaunchController({ isReady: () => true })
  await advance(2500); expect(layer.dataset.state).toBe('revealing')
  await advance(3500); expect(layer.hidden).toBe(true)
})

it('finishes the whole tunnel even when boot approaches the recovery timeout', async () => {
  let ready = false
  controller = createLaunchController({ isReady: () => ready })
  await advance(29500)
  ready = true; controller.check()
  await advance(900)
  expect(layer.dataset.state).toBe('revealing'); expect(layer.hidden).toBe(false)
  await advance(1400); expect(layer.hidden).toBe(true)
})

it('resumes an unfinished tunnel after a visibility interruption without skipping it or starting another cycle', async () => {
  controller = createLaunchController({ isReady: () => true })
  await advance(1200); expect(layer.dataset.state).toBe('revealing')
  visibility('hidden'); await advance(2000)
  expect(layer.hidden).toBe(false); expect(layer.dataset.state).toBe('revealing')
  visibility('visible'); await advance(400)
  expect(layer.dataset.state).toBe('revealing')
  await advance(1800); expect(layer.hidden).toBe(true)
  expect(layer.dataset.launchCycle).toBe('1')
})

it('enforces the installed minimum without delaying browser or native boot', async () => {
  controller = createLaunchController({ isReady: () => true })
  await advance(300); expect(layer.dataset.state).toBe('loading')
  await advance(650); expect(layer.dataset.state).toBe('settling')
  controller.destroy(); installed = false
  controller = createLaunchController({ isReady: () => true })
  await advance(40); expect(layer.dataset.state).toBe('settling')
})

it('uses the traced FPP paths in both the metallic identity and the synchronized reveal', async () => {
  controller = createLaunchController({ isReady: () => true })
  await advance(1100)
  const outline = document.querySelector('[data-launch-outline]')
  expect(outline).not.toBeNull()
  expect(outline.getAttribute('stroke')).toBe('var(--acc, #0F8B8D)')
  await advance(800)
  expect(layer.dataset.state).toBe('revealing'); expect(layer.hidden).toBe(false)
  expect(outline.getAttribute('transform')).toBe(document.querySelector('[data-launch-hole]').getAttribute('transform'))
  expect(outline.querySelector('use').getAttribute('href')).toBe('#fpp-logo-shape')
  expect(document.querySelector('[data-launch-hole] use').getAttribute('href')).toBe('#fpp-logo-opening')
  expect(document.querySelector('[data-launch-trail]').childElementCount).toBeGreaterThan(1)
  expect(document.querySelector('.fpp-launch-symbol svg').getAttribute('viewBox')).toBe('80 80 1140 310')
  expect(document.querySelector('.fpp-launch-symbol [data-logo-metal]').getAttribute('href')).toBe('#fpp-logo-shape')
  expect(document.querySelector('.fpp-launch-caption > span').textContent).toBe('Carregando…')
  expect(layer.querySelectorAll('image,text')).toHaveLength(0)
  await advance(1000); expect(layer.hidden).toBe(true)
  expect(document.querySelector('[data-launch-trail]').childElementCount).toBe(0)
})

it('shows the live root only during reveal, without any second clip on the application', async () => {
  const html = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html')
  const styles = document.createElement('style')
  styles.textContent = html.querySelector('body > style').textContent + readFileSync('src/fpp-launch.css', 'utf8')
  document.body.append(styles)
  controller = createLaunchController({ isReady: () => true })
  const surface = document.getElementById('root')
  // happy-dom caches sibling-selector styles after dataset updates. Invalidate
  // the test element before reading each phase; browsers are checked separately.
  const rootStyle = () => { surface.style.setProperty('--test-phase', layer.dataset.state); return getComputedStyle(surface) }
  expect(rootStyle().visibility).toBe('hidden')
  expect(document.getElementById('fpp-launch-clip')).toBeNull()
  await advance(950)
  expect(layer.dataset.state).toBe('settling')
  expect(rootStyle().visibility).toBe('hidden')
  await advance(160)
  expect(layer.dataset.state).toBe('revealing')
  expect(rootStyle().visibility).toBe('visible')
  expect(rootStyle().clipPath).toBe('none')
  expect(document.querySelector('[data-launch-shield]').getAttribute('mask')).toBe('url(#fpp-launch-mask)')
  expect(document.querySelector('[data-launch-hole]').getAttribute('opacity')).toBe('1')
  await advance(2000)
  expect(layer.hidden).toBe(true)
  expect(rootStyle().visibility).not.toBe('hidden')
})

it('rejects an incomplete SVG mask even when CSS reports mask support', async () => {
  document.querySelector('#fpp-launch-mask > rect').remove()
  controller = createLaunchController({ isReady: () => true })
  await advance(1100)
  expect(layer.hasAttribute('data-launch-fallback')).toBe(true)
  expect(document.querySelector('[data-launch-shield]').hasAttribute('mask')).toBe(false)
  await advance(300); expect(layer.hidden).toBe(true)
})

it('stops work and observers on disposal without leaving an invisible touch blocker', async () => {
  controller = createLaunchController({ isReady: () => false })
  controller.destroy(); await Promise.resolve()
  expect(layer.hidden).toBe(true)
  const cycle = layer.dataset.launchCycle
  visibility('hidden'); visibility('visible'); restore(); await advance(40000)
  expect(layer.dataset.launchCycle).toBe(cycle); expect(vi.getTimerCount()).toBe(0)
})

it('covers a real PWA return before presenting one new cycle and preserves the live edit', async () => {
  controller = createLaunchController({ isReady: () => true })
  await advance(4000)
  const input = document.querySelector('input'); input.value = 'Treino em andamento'; input.focus()
  const cycle = Number(layer.dataset.launchCycle)
  visibility('hidden'); expect(layer.hidden).toBe(false)
  await advance(600); visibility('visible'); restore(); window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('resize'))
  expect(Number(layer.dataset.launchCycle)).toBe(cycle + 1)
  expect(layer.hidden).toBe(false)
  expect(document.querySelector('input')).toBe(input); expect(input.value).toBe('Treino em andamento')
  expect(document.activeElement).toBe(input)
  await advance(4000); expect(layer.hidden).toBe(true)
  window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('resize'))
  expect(Number(layer.dataset.launchCycle)).toBe(cycle + 1)
})

it('deduplicates transient visibility and BFCache events without replaying a PWA cycle', async () => {
  controller = createLaunchController({ isReady: () => true })
  await advance(4000)
  visibility('hidden'); await advance(50); visibility('visible'); restore()
  expect(layer.hidden).toBe(true); expect(layer.dataset.launchCycle).toBe('1')
  await advance(1000); restore(); restore()
  expect(layer.hidden).toBe(false); expect(layer.dataset.launchCycle).toBe('2')
})

it('keeps a closed persistent curtain and falls back to its unmasked rect when masking is unsupported', async () => {
  vi.spyOn(window.CSS, 'supports').mockReturnValue(false)
  controller = createLaunchController({ isReady: () => true })
  expect(document.querySelector('[data-launch-hole]').getAttribute('opacity')).toBe('0')
  await advance(1060)
  expect(layer.hasAttribute('data-launch-fallback')).toBe(true)
  expect(document.querySelector('[data-launch-shield]').hasAttribute('mask')).toBe(false)
  await advance(200); expect(layer.hidden).toBe(true)
})

it('invalidates retained callbacks from a completed generation before reopening the PWA', async () => {
  const callbacks = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(fn => {
    callbacks.push(fn)
    return window.setTimeout(() => fn(performance.now()), 16)
  })
  controller = createLaunchController({ isReady: () => true })
  await advance(4000)
  const stale = [...callbacks]
  visibility('hidden'); await advance(600); visibility('visible')
  for (const callback of stale) callback(performance.now() + 100000)
  expect(layer.hidden).toBe(false); expect(layer.dataset.state).toBe('loading')
  expect(layer.dataset.launchCycle).toBe('2')
})

it('plays once for desktop login entry, not auth restoration or subsequent ready/render updates', async () => {
  installed = false
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
  state.auth = 'initializing'
  root = createRoot(document.getElementById('controller'))
  const render = () => act(async () => root.render(<StrictMode><AppLaunchTransition /></StrictMode>))
  await render(); state.auth = 'authenticated'; await render(); await advance(4000)
  expect(layer.dataset.launchCycle).toBe('1'); expect(layer.hidden).toBe(true)
  state.auth = 'anonymous'; state.entered = false; await render()
  state.auth = 'authenticated'; state.ready = false; await render()
  expect(layer.hidden).toBe(true)
  state.ready = true; state.entered = true; await render()
  expect(layer.hidden).toBe(false); expect(layer.dataset.launchCycle).toBe('2')
  await advance(4000); expect(layer.hidden).toBe(true)
  state.ready = false; await render(); state.ready = true; await render()
  visibility('hidden'); visibility('visible'); restore(); await render(); await advance(2500)
  expect(layer.dataset.launchCycle).toBe('2'); expect(layer.hidden).toBe(true)
})

it('does not add a second opening for a login inside an already open mobile app', async () => {
  root = createRoot(document.getElementById('controller'))
  const render = () => act(async () => root.render(<AppLaunchTransition />))
  await render(); await advance(4000)
  state.auth = 'authenticated'; await render(); await advance(4000)
  expect(layer.dataset.launchCycle).toBe('1'); expect(layer.hidden).toBe(true)
})

it.each([false, true])('does not replay on browser/native resume (native=%s)', async native => {
  installed = native
  controller = createLaunchController({ isReady: () => true, native })
  await advance(4000); const cycle = layer.dataset.launchCycle
  visibility('hidden'); visibility('visible'); restore()
  expect(layer.dataset.launchCycle).toBe(cycle); expect(layer.hidden).toBe(true)
})

it('uses opacity for reduced motion and removes all interception afterward', async () => {
  reduced = true; controller = createLaunchController({ isReady: () => true })
  await advance(950); expect(layer.dataset.reducedMotion).toBe('true')
  expect(document.querySelector('[data-launch-hole]').getAttribute('transform')).toBeNull()
  await advance(200); expect(layer.hidden).toBe(true); expect(layer.getAttribute('aria-hidden')).toBe('true')
})

it('bounds route fallback waiting and provides recovery if boot never finishes', async () => {
  document.getElementById('root').insertAdjacentHTML('beforeend', '<div data-route-loading></div>')
  controller = createLaunchController({ isReady: () => true }); await advance(6200)
  expect(layer.hidden).toBe(true)
  controller.destroy(); controller = createLaunchController({ isReady: () => false })
  await advance(30100); expect(layer.hidden).toBe(true)
  expect(document.getElementById('root').hasAttribute('data-launch-timeout')).toBe(true)
})

it('covers all corners of tall and landscape viewports through the solid letter geometry', () => {
  for (const [width, height] of [[390, 844], [430, 932], [844, 390], [1024, 1366]]) {
    for (const y of [height / 2, height / 2 - 24]) {
      const scale = tunnelEndScale(width, height, width / 2, y)
      // The fixed logo sits above the viewport center. Include that offset
      // when expanding the first P's solid radius-10 region past every corner.
      expect(scale * 10).toBeGreaterThan(Math.hypot(width / 2, Math.max(y, height - y)))
    }
  }
})

it('coordinates ready/auth and survives StrictMode without a duplicate cold opening', async () => {
  state.auth = 'initializing'; root = createRoot(document.getElementById('controller'))
  await act(async () => root.render(<StrictMode><AppLaunchTransition /></StrictMode>))
  await advance(500); expect(layer.dataset.state).toBe('loading')
  state.auth = 'anonymous'
  await act(async () => root.render(<StrictMode><AppLaunchTransition /></StrictMode>))
  await advance(3000); expect(layer.hidden).toBe(true); expect(layer.dataset.launchCycle).toBe('1')
})
