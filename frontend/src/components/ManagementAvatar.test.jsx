// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { ManagementAvatar } from './ManagementUI.jsx'

let root, host
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); root = createRoot(host) })
afterEach(() => act(() => root.unmount()))
it('shows the selected user avatar and removes the previous identity when the person changes', async () => {
  await act(async () => root.render(<ManagementAvatar name="Ana Silva" avatarRef="avatar-42" />))
  expect(host.querySelector('img')?.getAttribute('src')).toContain('avatar-42')
  await act(async () => root.render(<ManagementAvatar name="Bruno Lima" />))
  expect(host.querySelector('img')).toBeNull()
  expect(host.textContent).toBe('BL')
})
