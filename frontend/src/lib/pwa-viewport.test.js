// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installPwaViewport } from './pwa-viewport.js'

const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'
const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'
const navigatorKeys = ['userAgent', 'platform', 'maxTouchPoints', 'standalone']
let originalNavigator, cleanup

beforeEach(() => {
  originalNavigator = navigatorKeys.map(key => [key, Object.getOwnPropertyDescriptor(navigator, key)])
  delete document.documentElement.dataset.pwaViewport
})

afterEach(() => {
  cleanup?.()
  cleanup = undefined
  vi.restoreAllMocks()
  for (const [key, descriptor] of originalNavigator) {
    if (descriptor) Object.defineProperty(navigator, key, descriptor)
    else delete navigator[key]
  }
  delete document.documentElement.dataset.pwaViewport
})

function browser({ ua = iphone, platform = 'iPhone', touchPoints = 5, standalone = false, displayMode = false } = {}) {
  for (const [key, value] of Object.entries({ userAgent: ua, platform, maxTouchPoints: touchPoints, standalone })) {
    Object.defineProperty(navigator, key, { configurable: true, value })
  }
  const media = new EventTarget()
  Object.assign(media, { matches: displayMode, media: '(display-mode: standalone)', onchange: null })
  media.addListener = listener => media.addEventListener('change', listener)
  media.removeListener = listener => media.removeEventListener('change', listener)
  vi.spyOn(window, 'matchMedia').mockImplementation(query => {
    if (query !== media.media) throw new Error(`Unexpected media query: ${query}`)
    return media
  })
  return matches => {
    media.matches = matches
    const event = new Event('change')
    Object.assign(event, { matches, media: media.media })
    media.dispatchEvent(event)
  }
}

describe('installPwaViewport', () => {
  it.each([
    ['iPhone Chrome', { ua: `${iphone} CriOS/130.0.0.0 Safari/604.1`, standalone: true }, 'ios'],
    ['iPhone Safari', { ua: `${iphone} Version/18.0 Safari/604.1`, standalone: true }, 'ios'],
    ['installed iOS without a browser token', { standalone: true }, 'ios'],
    ['iPad in desktop mode', { ua: mac, platform: 'MacIntel', touchPoints: 5, displayMode: true }, 'ios'],
    ['Android Chrome', { ua: android, platform: 'Linux armv8l', displayMode: true }, 'chrome'],
  ])('marks %s when installed', (_, options, expected) => {
    browser(options)
    cleanup = installPwaViewport()
    expect(document.documentElement.dataset.pwaViewport).toBe(expected)
  })

  it.each([
    ['an iPhone tab', {}],
    ['an Android tab', { ua: android, platform: 'Linux armv8l' }],
    ['desktop Chrome', { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36', platform: 'Win32', displayMode: true }],
    ['a Mac without touch', { ua: mac, platform: 'MacIntel', touchPoints: 0, displayMode: true }],
    ['Android Firefox', { ua: 'Mozilla/5.0 (Android 15; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0', platform: 'Linux armv8l', displayMode: true }],
    ['Android Edge', { ua: `${android} EdgA/130.0.0.0`, displayMode: true }],
    ['Samsung Internet', { ua: `${android} SamsungBrowser/27.0`, displayMode: true }],
    ['Android Opera', { ua: `${android} OPR/85.0`, displayMode: true }],
  ])('does not mark %s', (_, options) => {
    browser(options)
    cleanup = installPwaViewport()
    expect(document.documentElement.hasAttribute('data-pwa-viewport')).toBe(false)
  })

  it('does not apply browser viewport rules inside the native app', () => {
    browser({ standalone: true })
    cleanup = installPwaViewport({ native: true })
    expect(document.documentElement.hasAttribute('data-pwa-viewport')).toBe(false)
  })

  it('updates the marker as standalone display mode changes', () => {
    const setDisplayMode = browser({ ua: android, platform: 'Linux armv8l' })
    cleanup = installPwaViewport()
    setDisplayMode(true)
    expect(document.documentElement.dataset.pwaViewport).toBe('chrome')
    setDisplayMode(false)
    expect(document.documentElement.hasAttribute('data-pwa-viewport')).toBe(false)
  })

  it('stops reacting to display-mode changes after cleanup', () => {
    const setDisplayMode = browser({ ua: android, platform: 'Linux armv8l' })
    cleanup = installPwaViewport()
    cleanup()
    cleanup = undefined
    setDisplayMode(true)
    expect(document.documentElement.hasAttribute('data-pwa-viewport')).toBe(false)
  })

  it('recognizes an installed app when local storage is unavailable', () => {
    browser({ standalone: true })
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('Storage blocked') })
    cleanup = installPwaViewport()
    expect(document.documentElement.dataset.pwaViewport).toBe('ios')
  })
})
