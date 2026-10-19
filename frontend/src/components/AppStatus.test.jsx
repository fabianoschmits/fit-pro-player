// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ state: null, resolve: vi.fn(), flush: vi.fn(), takeover: vi.fn() }))
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector(mocks.state)
  useStore.getState = () => mocks.state
  return { useStore }
})
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => ({}) }))

import AppStatus from './AppStatus.jsx'

let root, container
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  mocks.resolve.mockReset()
  mocks.flush.mockReset()
  mocks.takeover.mockReset()
  mocks.state = {
    accountSync: { state: 'CONFLICT', conflict: { remote: { payload: {} } } },
    persistence: { state: 'saved' },
    sessionRecovery: { state: 'idle', pending: 0, error: null },
    S: { pendingProfessionalEvents: [] },
    resolveSyncConflict: mocks.resolve,
    flushSessionRecovery: mocks.flush,
    takeOverSessionRecovery: mocks.takeover,
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks() })

describe('AppStatus conflict recovery', () => {
  it('offers an update action for a sync conflict', async () => {
    await act(async () => root.render(<AppStatus />))
    expect([...container.querySelectorAll('button')].some(button => button.textContent.includes('Atualizar agora'))).toBe(true)
  })

  it('confirms a successful update and closes the notice', async () => {
    mocks.resolve.mockResolvedValue(true)
    await act(async () => root.render(<AppStatus />))
    await act(async () => container.querySelector('.app-status-action').click())
    expect(mocks.resolve).toHaveBeenCalledWith('cloud', expect.anything())
    expect(container.textContent).toContain('Sincronização atualizada')
    await act(async () => vi.advanceTimersByTime(1800))
  })

  it('keeps the notice and reports a failed update', async () => {
    mocks.resolve.mockResolvedValue(false)
    await act(async () => root.render(<AppStatus />))
    await act(async () => container.querySelector('.app-status-action').click())
    expect(container.textContent).toContain('Não foi possível concluir a sincronização')
    expect(container.querySelector('.app-status')).toBeTruthy()
  })

  it('shows a queued workout and retries it from the global status', async () => {
    mocks.state = { ...mocks.state, accountSync: { state: 'IDLE' }, sessionRecovery: { state: 'waiting', pending: 1 } }
    mocks.flush.mockResolvedValue({ state: 'saved' })
    await act(async () => root.render(<AppStatus />))
    expect(container.textContent).toContain('Treino aguardando envio')
    await act(async () => container.querySelector('.app-status-action').click())
    expect(mocks.flush).toHaveBeenCalledOnce()
  })

  it('offers takeover when another device owns the session writer', async () => {
    mocks.state = { ...mocks.state, accountSync: { state: 'IDLE' }, sessionRecovery: { state: 'takeover-required', pending: 1 } }
    mocks.takeover.mockResolvedValue({ state: 'saved' })
    await act(async () => root.render(<AppStatus />))
    expect(container.textContent).toContain('outro dispositivo')
    await act(async () => container.querySelector('.app-status-action').click())
    expect(mocks.takeover).toHaveBeenCalledOnce()
  })
})
