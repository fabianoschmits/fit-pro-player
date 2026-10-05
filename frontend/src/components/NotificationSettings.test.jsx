// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t, _setLangState } from '../lib/i18n-core.js'
import { normalizeNotificationPreferences } from '../lib/notification-preferences.js'
import { bindUI } from './ui.jsx'

const mocks = vi.hoisted(() => ({ auth: null, status: null, mobile: false, enable: vi.fn(), disable: vi.fn() }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/mobile.js', () => ({ get MOBILE() { return mocks.mobile } }))
vi.mock('../lib/notification-client.js', () => ({
  useNotificationStatus: () => mocks.status,
  enableBackgroundNotifications: (...args) => mocks.enable(...args),
  disableBackgroundNotifications: (...args) => mocks.disable(...args),
}))
import NotificationSettings from './NotificationSettings.jsx'

let root, container, state, sheet, toast
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  _setLangState('en', {}, null)
  mocks.auth = { status: 'authenticated', user: { id: 'u1' } }
  mocks.mobile = false
  mocks.status = { supported: true, enabled: false, permission: 'default', busy: false, error: null, ready: true }
  mocks.enable.mockReset(); mocks.enable.mockResolvedValue(true)
  mocks.disable.mockReset(); mocks.disable.mockResolvedValue(true)
  state = { notifications: normalizeNotificationPreferences(), sound: true }
  toast = vi.fn(); sheet = null
  bindUI({ getState: () => ({ openSheet: render => { sheet = render(() => { sheet = null }) } }) })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); _setLangState('pt', null, null); vi.restoreAllMocks() })
const render = async () => act(async () => root.render(<NotificationSettings S={state} update={mutate => { mutate(state); root.render(<NotificationSettings S={state} update={mutateAgain => mutateAgain(state)} toast={toast} />) }} toast={toast} />))
const button = text => [...container.querySelectorAll('button')].find(item => item.textContent.includes(t(text)))

describe('notification settings center', () => {
  it('separates local timer alerts from background reminders and explains delayed iPhone alerts', async () => {
    await render()
    const local = container.querySelector('[role="group"][aria-label="Local timer alerts"]')
    const background = container.querySelector('[role="group"][aria-label="Background reminders and updates"]')
    expect(local).toBeTruthy()
    expect(background).toBeTruthy()
    expect([...local.querySelectorAll('[role="switch"]')].map(control => control.getAttribute('aria-label'))).toEqual(['Rest completed', 'Timed set completed'])
    expect(background.querySelector('[aria-label="Rest completed"]')).toBeNull()
    expect(background.querySelector('[aria-label="Timed set completed"]')).toBeNull()
    expect(background.textContent).toContain('Enable on this device')
    expect(local.textContent).toContain('Timer alerts require the browser to keep running. On iPhone, they may wait until you return to the app.')
    expect(local.textContent).not.toContain('Enable on this device')
    await act(async () => button('Enable on this device').click())
    expect(state.notifications.rest).toBe(true)
    expect(state.notifications.timedSet).toBe(true)
  })

  it('offers the six useful categories with accessible local timer defaults', async () => {
    await render()
    const switches = [...container.querySelectorAll('[role="switch"]')]
    expect(switches).toHaveLength(7)
    expect(switches.every(item => !!item.getAttribute('aria-label'))).toBe(true)
    expect(container.querySelector('[aria-label="Rest completed"]').getAttribute('aria-checked')).toBe('true')
    expect(container.querySelector('[aria-label="Timed set completed"]').getAttribute('aria-checked')).toBe('true')
    expect(container.textContent).not.toContain('Sounds')
    await act(async () => container.querySelector('[aria-label="Rest completed"]').click())
    expect(state.notifications.rest).toBe(false)
  })

  it('explains Android native local delivery separately from pending background service setup', async () => {
    mocks.mobile = true
    mocks.status = { ...mocks.status, native: true, ready: false }
    await render()
    const local = container.querySelector('[role="group"][aria-label="Local timer alerts"]')
    expect(local.textContent).toContain('In the Android app, local timer alerts can arrive while minimized. Notification permission and system settings apply.')
    expect(local.textContent).not.toContain('Timer alerts require the browser to keep running.')
    expect(container.textContent).toContain('Background notifications will be available after the Android service is configured.')
    expect(button('Enable on this device').disabled).toBe(true)
    mocks.status.ready = true
    await render()
    expect(container.textContent).not.toContain('Background notifications will be available after the Android service is configured.')
  })

  it('requests background delivery only from the explicit enable action', async () => {
    await render()
    expect(mocks.enable).not.toHaveBeenCalled()
    await act(async () => button('Enable on this device').click())
    expect(mocks.enable).toHaveBeenCalledTimes(1)
  })

  it('keeps guest preferences available and explains the account requirement', async () => {
    mocks.auth = { status: 'anonymous', user: null }
    await render()
    expect(container.textContent).toContain('Sign in to receive notifications with the app closed.')
    expect(button('Enable on this device')).toBeUndefined()
    await act(async () => container.querySelector('[aria-label="Weight reminder"]').click())
    expect(state.notifications.weightReminder).toBe(true)
  })

  it('shows backend pause, denied permission and actionable registration errors', async () => {
    mocks.status = { ...mocks.status, ready: false }
    await render()
    expect(container.textContent).toContain('Background delivery is paused until the service is ready.')
    expect(button('Enable on this device').disabled).toBe(true)
    mocks.status = { ...mocks.status, ready: true, permission: 'denied', error: 'registration-failed' }
    await render()
    expect(container.textContent).toContain('Allow notifications in your device or browser settings, then try again.')
    expect(container.textContent).toContain('Could not change notification settings. Try again.')
  })

  it('helps unsupported iPhone browsers install the app on the Home Screen', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')
    mocks.status.supported = false
    await render()
    expect(container.textContent).toContain('On iPhone, add this app to the Home Screen in Safari and open it there to enable notifications.')
    expect(button('Enable on this device')).toBeUndefined()
  })

  it('edits the workout clock, weekly check-in and quiet hours without permission', async () => {
    await render()
    await act(async () => container.querySelector('[aria-label="Planned workout reminder"]').click())
    const trainingTime = container.querySelector('[aria-label="Training time"]')
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(trainingTime, '19:30')
      trainingTime.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(state.notifications.trainingTime).toBe('19:30')
    await act(async () => button('Notify before training').click())
    const leadContainer = document.createElement('div'); const leadRoot = createRoot(leadContainer)
    await act(async () => leadRoot.render(sheet))
    expect([...leadContainer.querySelectorAll('button')].map(item => item.textContent)).toHaveLength(7)
    await act(async () => [...leadContainer.querySelectorAll('button')].find(item => item.textContent.includes('At training time')).click())
    expect(state.notifications.leadMinutes).toBe(0)
    await act(async () => leadRoot.unmount())
    await render()
    await act(async () => container.querySelector('[aria-label="Quiet hours"]').click())
    expect(state.notifications.quietHours.enabled).toBe(true)
    expect(container.querySelector('[aria-label="Quiet hours start"]')).toBeTruthy()
    expect(container.textContent).toContain('Reminders and professional updates are silent during these hours.')
    expect(mocks.enable).not.toHaveBeenCalled()
  })

  it('disables delivery on the current device and renders busy actions disabled', async () => {
    mocks.status.enabled = true
    await render()
    await act(async () => button('Disable on this device').click())
    expect(mocks.disable).toHaveBeenCalledTimes(1)
    mocks.status.busy = true
    await render()
    expect(button('Updating…').disabled).toBe(true)
  })
})
