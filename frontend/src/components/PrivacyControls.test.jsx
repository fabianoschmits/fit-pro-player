// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), state: { S: { profile: { name: 'A' } } } }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector(mocks.state), getState: () => mocks.state }))
import PrivacyControls from './PrivacyControls.jsx'

let root, container
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; mocks.rpc.mockReset(); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

describe('PrivacyControls', () => {
  it('keeps a pointer submission in press feedback before creating the request', async () => {
    mocks.rpc.mockResolvedValue({ data: { protocol: 'LGPD-ABC123' }, error: null })
    await act(async () => root.render(<PrivacyControls />))
    const submit = container.querySelector('button[type="submit"]')
    await act(async () => submit.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })))
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(submit.getAttribute('data-visual-state')).toBe('pressed')
    await act(async () => new Promise(resolve => setTimeout(resolve, 340)))
    expect(mocks.rpc).toHaveBeenCalledOnce()
  })

  it('creates a rights request and shows its protocol', async () => {
    mocks.rpc.mockResolvedValue({ data: { protocol: 'LGPD-ABC123' }, error: null })
    await act(async () => root.render(<PrivacyControls />))
    await act(async () => container.querySelector('form').requestSubmit())
    expect(mocks.rpc).toHaveBeenCalledWith('create_privacy_request', expect.objectContaining({ p_request_type: 'access' }))
    expect(container.textContent).toContain('LGPD-ABC123')
  })
})
