// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ prepare: vi.fn() }))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector({ S: {} }) }))
vi.mock('../lib/offline-plan.js', () => ({ prepareOfflinePlan: (...args) => mocks.prepare(...args) }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false }))
vi.mock('../lib/i18n.js', () => ({ t: value => value }))
import OfflineControls from './OfflineControls.jsx'

let container, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mocks.prepare.mockReset()
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

it('prevents duplicate downloads, exposes real progress and releases an incomplete download for retry', async () => {
  let resolve, onProgress
  mocks.prepare.mockImplementation((state, options) => {
    onProgress = options.onProgress
    return new Promise(done => { resolve = done })
  })
  await act(async () => root.render(<OfflineControls />))
  const button = container.querySelector('button')
  await act(async () => { button.click(); button.click() })
  expect(mocks.prepare).toHaveBeenCalledTimes(1)
  expect(button.getAttribute('aria-busy')).toBe('true')
  await act(async () => onProgress({ done: 2, total: 5 }))
  expect(container.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('2')
  expect(container.querySelector('[role="progressbar"]').getAttribute('aria-valuemax')).toBe('5')
  await act(async () => resolve({ ready: false }))
  expect(button.disabled).toBe(false)
  expect(button.getAttribute('data-state')).toBe('error')
  expect(container.textContent).toContain('Offline preparation incomplete. Connect and try again.')
  await act(async () => button.click())
  expect(mocks.prepare).toHaveBeenCalledTimes(2)
  await act(async () => resolve({ ready: true }))
  expect(button.getAttribute('data-state')).toBe('success')
})
