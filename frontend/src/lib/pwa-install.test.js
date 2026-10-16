// @vitest-environment happy-dom
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPwaInstaller, detectInstallTarget } from './pwa-install.js'

let scope, installer, stop
beforeEach(() => {
  scope = new Window({ url: 'https://fitproplayer.example/' })
  installer = createPwaInstaller(scope)
  stop = installer.start()
})
afterEach(() => { stop(); scope.close() })

function offer(outcome = 'accepted') {
  const event = new scope.Event('beforeinstallprompt', { cancelable: true })
  event.prompt = vi.fn(async () => ({ outcome, platform: 'web' }))
  event.userChoice = Promise.resolve({ outcome, platform: 'web' })
  scope.dispatchEvent(event)
  return event
}

describe('browser installation', () => {
  it('retains an offer received before settings opens and invokes it only on request', async () => {
    const event = offer()
    expect(event.defaultPrevented).toBe(true)
    expect(installer.getSnapshot().canInstall).toBe(true)
    expect(event.prompt).not.toHaveBeenCalled()
    const result = installer.install()
    // prompt must run during the click, before yielding the browser user gesture.
    expect(event.prompt).toHaveBeenCalledTimes(1)
    await result
    expect(installer.getSnapshot()).toMatchObject({ canInstall: false, installed: false, status: 'accepted' })
  })

  it('consumes a declined offer once and lets a future browser offer enable installation again', async () => {
    const event = offer('dismissed')
    await Promise.all([installer.install(), installer.install()])
    await installer.install()
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(installer.getSnapshot()).toMatchObject({ canInstall: false, installed: false, status: 'dismissed' })
    offer()
    expect(installer.getSnapshot().canInstall).toBe(true)
  })

  it('reports a blocked prompt without claiming installation', async () => {
    const event = offer()
    event.prompt.mockRejectedValue(new Error('gesture expired'))
    await installer.install()
    expect(installer.getSnapshot()).toMatchObject({ canInstall: false, installed: false, status: 'error' })
  })

  it('updates subscribers when installation finishes and removes the consumed offer', () => {
    const snapshots = []
    const unsubscribe = installer.subscribe(() => snapshots.push(installer.getSnapshot()))
    offer()
    scope.dispatchEvent(new scope.Event('appinstalled'))
    expect(snapshots.at(-1)).toMatchObject({ canInstall: false, installed: true, status: 'installed' })
    unsubscribe()
    expect(installer.getSnapshot()).toBe(snapshots.at(-1))
  })

  it('does not replace a completed installation with a late accepted result', async () => {
    const event = offer()
    let choose
    event.userChoice = new Promise(resolve => { choose = resolve })
    const installing = installer.install()
    scope.dispatchEvent(new scope.Event('appinstalled'))
    choose({ outcome: 'accepted', platform: 'web' })
    await installing
    expect(installer.getSnapshot()).toMatchObject({ installed: true, status: 'installed', canInstall: false })
  })

  it('recognizes the iOS installed shell without offering a second installation', () => {
    stop()
    Object.defineProperty(scope.navigator, 'standalone', { value: true, configurable: true })
    installer = createPwaInstaller(scope)
    stop = installer.start()
    offer()
    expect(installer.getSnapshot()).toMatchObject({ canInstall: false, installed: true, status: 'installed' })
  })

  it('does not mistake an ordinary fullscreen browser for an installed app', () => {
    stop()
    vi.spyOn(scope, 'matchMedia').mockImplementation(query => ({ matches: query === '(display-mode: fullscreen)' }))
    installer = createPwaInstaller(scope)
    stop = installer.start()
    expect(installer.getSnapshot()).toMatchObject({ installed: false, status: 'idle' })
  })

  it('leaves unsupported browsers in manual mode and can be started repeatedly safely', async () => {
    installer.start()
    await installer.install()
    expect(installer.getSnapshot()).toMatchObject({ canInstall: false, installed: false, status: 'idle' })
    const event = offer()
    await installer.install()
    expect(event.prompt).toHaveBeenCalledTimes(1)
  })
})

describe('recommended installation instructions', () => {
  it.each([
    ['iPhone Chrome', { userAgent: 'iPhone CriOS/140 Mobile Safari/604' }, 'ios', 'chrome'],
    ['iPad desktop UA', { userAgent: 'Macintosh Version/26 Safari/605', platform: 'MacIntel', maxTouchPoints: 5 }, 'ios', 'safari'],
    ['Samsung Internet', { userAgent: 'Android Chrome/140 SamsungBrowser/28' }, 'android', 'samsung'],
    ['Android Edge', { userAgent: 'Android Chrome/140 EdgA/140' }, 'android', 'edge'],
    ['Android Firefox', { userAgent: 'Android Firefox/143' }, 'android', 'firefox'],
    ['Android Opera', { userAgent: 'Android Chrome/140 OPR/90' }, 'android', 'opera'],
    ['Windows Edge', { userAgent: 'Windows Chrome/140 Safari/537 Edg/140' }, 'desktop', 'edge'],
    ['Mac Safari', { userAgent: 'Macintosh Version/26 Safari/605' }, 'desktop', 'safari'],
    ['unknown browser', { userAgent: 'SomeBrowser' }, 'desktop', 'other'],
  ])('selects the right guide for %s', (_, nav, platform, browser) => {
    expect(detectInstallTarget(nav)).toEqual({ platform, browser })
  })
})
