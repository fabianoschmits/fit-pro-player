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
  it('creates a rights request and shows its protocol', async () => {
    mocks.rpc.mockResolvedValue({ data: { protocol: 'LGPD-ABC123' }, error: null })
    await act(async () => root.render(<PrivacyControls />))
    await act(async () => container.querySelector('form').requestSubmit())
    expect(mocks.rpc).toHaveBeenCalledWith('create_privacy_request', expect.objectContaining({ p_request_type: 'access' }))
    expect(container.textContent).toContain('LGPD-ABC123')
  })
})
