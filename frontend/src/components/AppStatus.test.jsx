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

it('shows that account changes are still syncing until the database confirms them', async () => {
  mocks.state.accountSync = { state: 'saving', pending: 1, error: null }
  await act(async () => root.render(<AppStatus />))
  expect(container.textContent).toContain('Sincronizando')
  expect(container.textContent).not.toContain('Salvo')
})

it('shows failed account sync and offers a retry without claiming the change is saved', async () => {
  mocks.state.accountSync = { state: 'error', pending: 1, error: 'request-failed' }
  mocks.retryAccount.mockResolvedValue()
  await act(async () => root.render(<AppStatus />))
  expect(container.textContent).toContain('Não foi possível sincronizar')
  await act(async () => container.querySelector('.app-status-action').click())
  expect(mocks.retryAccount).toHaveBeenCalledOnce()
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('AppStatus session recovery', () => {
  it('shows a queued workout and retries it from the global status', async () => {
    mocks.state = { ...mocks.state, sessionRecovery: { state: 'waiting', pending: 1 } }
    mocks.flush.mockResolvedValue({ state: 'saved' })
    await act(async () => root.render(<AppStatus />))
    expect(container.textContent).toContain('Treino aguardando envio')
    await act(async () => container.querySelector('.app-status-action').click())
    expect(mocks.flush).toHaveBeenCalledOnce()
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
})
