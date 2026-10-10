// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => ({ storage: { from: () => ({ getPublicUrl: path => ({ data: { publicUrl: `https://project.test/storage/v1/object/public/professional-photos/${path}` } }) }) } }) }))
import { ManagementAvatar } from './ManagementUI.jsx'
it('shows the stored photo and restores initials after an image loading failure', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div'); const root = createRoot(container)
  const path = '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg'
  await act(async () => root.render(<ManagementAvatar name="Ana Silva" photoPath={path} />))
  expect(container.querySelector('img')?.getAttribute('src')).toContain(path)
  await act(async () => container.querySelector('img').dispatchEvent(new Event('error')))
  expect(container.querySelector('img')).toBeNull(); expect(container.textContent).toBe('AS')
  await act(async () => root.unmount())
})
