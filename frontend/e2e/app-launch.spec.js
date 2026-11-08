import { test, expect } from '@playwright/test'
import { seed, stateFixture, startWorkoutExecution, USER } from './fixtures.test.js'

async function installed(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
    Object.defineProperty(navigator, 'platform', { configurable: true, value: 'MacIntel' })
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 })
    window.__launchVisibility = 'visible'
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__launchVisibility })
    window.__launchHistory = []
    const observer = new MutationObserver(() => {
      const layer = document.getElementById('fpp-launch')
      if (layer && window.__launchHistory.at(-1)?.state !== layer.dataset.state) window.__launchHistory.push({ state: layer.dataset.state, time: performance.now() })
    })
    observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] })
  })
}
async function reopen(page) {
  await page.evaluate(() => {
    window.__launchVisibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange'))
    window.__launchVisibility = 'visible'; document.dispatchEvent(new Event('visibilitychange'))
    const show = new Event('pageshow'); Object.defineProperty(show, 'persisted', { value: true }); window.dispatchEvent(show)
  })
}

test('installed launch paints the vector FPP, reveals the actual interface through its letters and releases touches', async ({ page }, info) => {
  await seed(page); await installed(page); await page.emulateMedia({ reducedMotion: 'no-preference' })
  let releaseModule
  const firstPaint = new Promise(resolve => { releaseModule = resolve })
  await page.route('**/src/main.jsx*', async route => { await firstPaint; await route.continue() })
  // Hold one actual SVG frame for visual inspection; no simulated app image.
  await page.addInitScript(() => {
    window.__launchHeldFrames = []; window.__launchHold = true
    const raf = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = callback => raf(time => {
      const layer = document.getElementById('fpp-launch')
      const scale = Number(layer?.querySelector('[data-launch-hole]')?.getAttribute('transform')?.match(/scale\(([^)]+)/)?.[1] || 0)
      if (window.__launchHold && layer?.dataset.state === 'revealing' && scale >= .32) window.__launchHeldFrames.push(callback)
      else callback(time)
    })
  })
  await page.goto('/#/home', { waitUntil: 'commit' })
  const logo = page.locator('.fpp-launch-symbol svg')
  await expect(logo).toBeVisible()
  expect(await logo.evaluate(el => getComputedStyle(el).animationName)).toBe('none')
  await expect(page.locator('#root')).toBeEmpty()
  expect(await logo.evaluate(el => Math.round(el.getBoundingClientRect().width))).toBeGreaterThanOrEqual(180)
  // WebKit screenshots wait for document load, which this first-paint gate deliberately holds.
  if (info.project.name !== 'mobile-webkit') await page.screenshot({ path: info.outputPath('fpp-logo-first-paint.png') })
  if (info.project.name === 'desktop-chromium') {
    const vector = await page.evaluate(() => `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="426" viewBox="0 0 1280 426"><defs>${document.querySelector('.fpp-launch-defs defs').innerHTML}</defs>${document.querySelector('.fpp-launch-symbol svg').innerHTML}</svg>`)
    const preview = await page.context().newPage()
    await preview.setViewportSize({ width: 1280, height: 426 })
    await preview.setContent(`<body style="margin:0;background:white">${vector}</body>`)
    await preview.screenshot({ path: info.outputPath('fpp-vector-reference-check.png') })
    await preview.close()
  }
  releaseModule()
  const layer = page.locator('#fpp-launch')
  await expect(layer).toHaveAttribute('data-state', 'revealing')
  await expect(page.locator('#tabbar')).toBeHidden()
  await expect(page.locator('#root h1').first()).toBeVisible()
  await expect(page.locator('[data-launch-hole] use').first()).toHaveAttribute('href', '#fpp-logo-opening')
  await expect(page.locator('[data-launch-outline] use').first()).toHaveAttribute('href', '#fpp-logo-shape')
  await page.waitForFunction(() => window.__launchHeldFrames.length > 0, null, { polling: 25 })
  await page.screenshot({ path: info.outputPath('fpp-logo-tunnel.png') })
  await page.evaluate(() => { window.__launchHold = false; window.__launchHeldFrames.splice(0).forEach(callback => callback(performance.now())) })
  await expect(layer).toBeHidden()
  const history = await page.evaluate(() => window.__launchHistory)
  expect(history.map(item => item.state)).toEqual(['loading', 'settling', 'revealing', 'completed'])
  expect(history.find(item => item.state === 'settling').time - history[0].time).toBeGreaterThanOrEqual(890)
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('resize')); location.hash = '/plan' })
  await expect(layer).toHaveAttribute('data-launch-cycle', '1')
  await expect(page.getByRole('heading', { name: /plano/i }).first()).toBeVisible()
  expect(await layer.evaluate(el => getComputedStyle(el).display)).toBe('none')
})

test('the FPP opening never covers an already revealed part of the screen', async ({ page }) => {
  await seed(page); await installed(page); await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => {
    window.__revealProbe = new Promise(resolve => {
      const seen = new Set(); let regressions = 0, samples = 0
      const sample = () => {
        const layer = document.getElementById('fpp-launch')
        if (layer?.dataset.state === 'completed') { resolve({ regressions, samples, revealed: seen.size }); return }
        if (layer?.dataset.state === 'revealing') {
          samples++
          const outer = [...document.querySelectorAll('#fpp-logo-shape path')]
          const counters = [...document.querySelectorAll('#fpp-logo-counters path')]
          const svg = document.querySelector('.fpp-launch-curtain')
          const openings = [...document.querySelectorAll('[data-launch-trail] > g'), document.querySelector('[data-launch-hole]')]
          for (let y = 10; y < innerHeight; y += 32) for (let x = 10; x < innerWidth; x += 32) {
            const visible = openings.some(opening => {
              const point = svg.createSVGPoint(); point.x = x; point.y = y
              const local = point.matrixTransform(opening.getCTM().inverse()); local.x += 650; local.y += 235
              return outer.some(path => path.isPointInFill(local)) && !counters.some(path => path.isPointInFill(local))
            })
            const key = `${x},${y}`
            if (visible) seen.add(key)
            else if (seen.has(key)) regressions++
          }
        }
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
  })
  await page.goto('/#/home')
  const result = await page.evaluate(() => window.__revealProbe)
  expect(result.samples).toBeGreaterThan(5)
  expect(result.revealed).toBeGreaterThan(5)
  expect(result.regressions).toBe(0)
})

test('the first tunnel frame matches the fixed logo position and size exactly', async ({ page }) => {
  await seed(page); await installed(page); await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(() => {
    // Hold frame zero so this test measures the handoff, not a later growth frame.
    const raf = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = callback => raf(time => {
      if (document.getElementById('fpp-launch')?.dataset.state !== 'revealing') callback(time)
    })
    window.__launchAlignment = new Promise(resolve => {
      let loadingMatrix
      const matrix = element => {
        const { a, b, c, d, e, f } = element.getScreenCTM()
        return [a, b, c, d, e, f]
      }
      new MutationObserver(() => {
        const layer = document.getElementById('fpp-launch')
        const logo = document.querySelector('.fpp-launch-symbol svg')
        if (layer?.dataset.state === 'loading' && logo) loadingMatrix = matrix(logo)
        if (layer?.dataset.state === 'revealing') resolve({
          loading: loadingMatrix,
          settled: matrix(logo),
          opening: matrix(document.querySelector('[data-launch-hole] use')),
        })
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] })
    })
  })
  await page.goto('/#/home')
  const matrices = await page.evaluate(() => window.__launchAlignment)
  for (let i = 0; i < 6; i++) {
    expect(matrices.settled[i]).toBeCloseTo(matrices.loading[i], 3)
    expect(matrices.opening[i]).toBeCloseTo(matrices.loading[i], 3)
  }
})

test('returning to the PWA does not replay launch or disturb workout, rest and route', async ({ page }) => {
  const state = stateFixture(); state.routines[0].ex[0].sets = 2
  await seed(page, { state }); await installed(page)
  await page.goto('/?launch_probe=callback#/workout')
  await page.getByRole('button', { name: 'Começar Treino de teste', exact: true }).click()
  await startWorkoutExecution(page)
  await page.locator('.wp-main-action').click()
  await page.locator('.wp-main-action.is-executing').click()
  await expect(page.locator('#timer')).toBeVisible()
  const snapshot = () => page.evaluate(async () => {
    // eslint-disable-next-line import/no-unresolved -- resolved by Vite in the browser
    const { useStore } = await import('/src/store/useStore.js')
    return { active: useStore.getState().S.active, hash: location.hash }
  })
  const before = await snapshot()
  await page.evaluate(() => { window.__launchRoot = document.getElementById('root').firstElementChild })
  await reopen(page)
  await expect(page.locator('#fpp-launch')).toHaveAttribute('data-launch-cycle', '1')
  await expect(page.locator('#fpp-launch')).toBeHidden()
  expect(await snapshot()).toEqual(before)
  expect(await page.evaluate(() => window.__launchRoot === document.getElementById('root').firstElementChild)).toBe(true)
  await expect(page.locator('#timer')).toBeVisible()
})

test('reduced motion fades once without expanding the tunnel or replaying on resume', async ({ page }) => {
  await seed(page); await installed(page); await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/home'); await expect(page.locator('#fpp-launch')).toBeHidden()
  await reopen(page)
  await expect(page.locator('#fpp-launch')).toHaveAttribute('data-launch-cycle', '1')
  await expect(page.locator('#fpp-launch')).toHaveAttribute('data-reduced-motion', 'true')
  await expect(page.locator('#fpp-launch')).toBeHidden()
  expect(await page.locator('[data-launch-hole]').getAttribute('transform')).toBeNull()
})

test('desktop login plays one entry transition and subsequent window returns stay quiet', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop login entry')
  await seed(page)
  await page.addInitScript(() => {
    localStorage.removeItem('gym_guest'); localStorage.removeItem('fpp_app_entered:anonymous')
    window.__launchVisibility = 'visible'
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__launchVisibility })
  })
  await page.route('https://fitpp-test.supabase.co/auth/v1/token*', route => {
    const user = { id: USER, email: 'browser-test@example.invalid', email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {} }
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ sub: USER, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user, access_token: `${header}.${payload}.fixture`, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600 }) })
  })
  await page.goto('/')
  const layer = page.locator('#fpp-launch')
  await expect(layer).toBeHidden()
  await page.getByRole('button', { name: 'Entrar ou criar conta', exact: true }).click()
  await page.locator('.auth-entry').getByRole('button', { name: 'Entrar', exact: true }).click()
  const form = page.locator('form.auth-form')
  await form.locator('input[type="email"]').fill('browser-test@example.invalid')
  await form.locator('input[type="password"]').fill('FixturePassword123!')
  await form.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(layer).toHaveAttribute('data-launch-cycle', '2')
  await expect(layer).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Vamos montar seu plano', exact: true })).toBeVisible()
  await reopen(page)
  await expect(layer).toHaveAttribute('data-launch-cycle', '2')
  await expect(layer).toBeHidden()
})

test('HTML offers recovery even if the application module fails before React mounts', async ({ page }) => {
  await seed(page)
  await page.route('**/src/main.jsx*', route => route.abort('failed'))
  await page.goto('/?launch_probe=callback#/workout')
  const recovery = page.locator('.fpp-launch-rescue')
  expect(await recovery.evaluate(el => getComputedStyle(el).animationDelay)).toBe('30s')
  // Advance the CSS guard without waiting 30 seconds in each browser project.
  await recovery.evaluate(el => { el.style.animationDelay = '-31s' })
  await expect(recovery).toBeVisible()
  await expect(recovery.getByRole('button', { name: 'Recarregar Fit Pro Player' })).toBeVisible()
  await expect(page.locator('#root')).toBeEmpty()
  await page.unroute('**/src/main.jsx*')
  await Promise.all([
    page.waitForEvent('domcontentloaded'),
    recovery.getByRole('button', { name: 'Recarregar Fit Pro Player' }).click(),
  ])
  await expect(page.locator('#fpp-launch')).toBeHidden()
  await expect(page).toHaveURL(/\?launch_probe=callback#\/workout$/)
})
