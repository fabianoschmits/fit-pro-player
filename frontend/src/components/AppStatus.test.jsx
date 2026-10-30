// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ state: null, flush: vi.fn(), takeover: vi.fn(), replaceRemote: vi.fn(), retryAccount: vi.fn() }))
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector(mocks.state)
  useStore.getState = () => mocks.state
  return { useStore }
})

import AppStatus from './AppStatus.jsx'

let root, container
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  mocks.flush.mockReset()
  mocks.takeover.mockReset()
  mocks.replaceRemote.mockReset()
  mocks.retryAccount.mockReset()
  mocks.state = {
    persistence: { state: 'saved' },
    sessionRecovery: { state: 'idle', pending: 0, error: null },
    accountSync: { state: 'saved', pending: 0, error: null },
    S: { pendingProfessionalEvents: [] },
    flushSessionRecovery: mocks.flush,
    takeOverSessionRecovery: mocks.takeover,
    replaceRemoteActiveSession: mocks.replaceRemote,
    retryAccountSync: mocks.retryAccount,
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})

it('keeps account synchronization states internal', async () => {
  mocks.state.accountSync = { state: 'saving', pending: 1, error: null }
  await act(async () => root.render(<AppStatus />))
  expect(container.querySelector('.app-status')).toBeNull()
})

it('does not expose account retry controls after a sync failure', async () => {
  mocks.state.accountSync = { state: 'error', pending: 1, error: 'request-failed' }
  await act(async () => root.render(<AppStatus />))
  expect(container.querySelector('.app-status')).toBeNull()
  expect(mocks.retryAccount).not.toHaveBeenCalled()
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('AppStatus session recovery', () => {
  it.each(['saving', 'saved', 'waiting', 'failed', 'auth-required'])('keeps %s workout synchronization silent', async state => {
    mocks.state = { ...mocks.state, sessionRecovery: { state, pending: 1 } }
    await act(async () => root.render(<AppStatus />))
    expect(container.querySelector('.app-status')).toBeNull()
    expect(mocks.flush).not.toHaveBeenCalled()
  })

  it('keeps local write and professional synchronization notices internal', async () => {
    mocks.state = { ...mocks.state, persistence: { state: 'error' }, S: { pendingProfessionalEvents: [{ blocked: true }] } }
    await act(async () => root.render(<AppStatus />))
    expect(container.querySelector('.app-status')).toBeNull()
  })

  it('does not interrupt the app with persistence notices when the network disconnects', async () => {
    await act(async () => root.render(<AppStatus />))
    await act(async () => window.dispatchEvent(new Event('offline')))
    expect(container.querySelector('.app-status')).toBeNull()
  })

  it('offers takeover when another device owns the session writer', async () => {
    mocks.state = { ...mocks.state, sessionRecovery: { state: 'takeover-required', pending: 1 } }
    mocks.takeover.mockResolvedValue({ state: 'saved' })
    await act(async () => root.render(<AppStatus />))
    expect(container.textContent).toContain('outro dispositivo')
    await act(async () => container.querySelector('.app-status-action').click())
    expect(mocks.takeover).toHaveBeenCalledOnce()
  })

  it('offers an explicit way to replace an older server workout blocking a local one', async () => {
    mocks.state = { ...mocks.state, sessionRecovery: { state: 'remote-active', pending: 0 } }
    mocks.replaceRemote.mockResolvedValue({ state: 'saved' })
    await act(async () => root.render(<AppStatus />))
    expect(container.textContent).toContain('outro dispositivo')
    await act(async () => container.querySelector('.app-status-action').click())
    expect(mocks.replaceRemote).toHaveBeenCalledOnce()
  })

  it('renders update banner with Update and close buttons and triggers apply-update event', async () => {
    let applyTriggered = false
    const onApply = () => { applyTriggered = true }
    window.addEventListener('fitproplayer:apply-update', onApply)
    await act(async () => root.render(<AppStatus />))
    await act(async () => window.dispatchEvent(new Event('fitproplayer:update-available')))
    expect(container.textContent).toContain('Atualização do aplicativo pronta')
    const updateBtn = container.querySelector('.app-status-action')
    expect(updateBtn?.textContent).toContain('Atualizar')
    const closeBtn = container.querySelector('.app-status-dismiss')
    expect(closeBtn).toBeTruthy()
    await act(async () => updateBtn.click())
    expect(applyTriggered).toBe(true)
    window.removeEventListener('fitproplayer:apply-update', onApply)
  })
})
