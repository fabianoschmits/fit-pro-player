// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase-config.js', () => ({
  getPublicSupabaseConfig: () => ({ enabled: true, url: 'https://project.supabase.co', publishableKey: 'public-publishable-key' }),
}))

import { clearSupabaseAccessToken, getSupabaseAccessToken } from '../lib/api.js'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import Settings from './Settings.jsx'

const accessTokenFor = serial => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1_000) + 300 })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `header.${payload}.token-${serial}`
}

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  clearSupabaseAccessToken()
  localStorage.clear()
  useStore.setState({ S: JSON.parse(JSON.stringify(DEF)), user: { id: 'u1', name: 'Ana' }, syncConflict: false })
  useUI.setState({ sheets: [], toastMsg: '' })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  clearSupabaseAccessToken()
  vi.restoreAllMocks()
})

it('invalidates the broker after a successful manual Supabase identity link', async () => {
  let bootstrapPosts = 0
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (path, options = {}) => {
    if (path === '/api/account/supabase-token') {
      bootstrapPosts += 1
      return new Response(JSON.stringify({ access_token: accessTokenFor(bootstrapPosts) }), { status: 200 })
    }
    if (path === '/api/account/identity-link') {
      expect(options.headers.Authorization).toBe('Bearer manually-pasted-supabase-token')
      return new Response(JSON.stringify({ account: { id: 'supabase-user' } }), { status: 200 })
    }
    throw new Error(`Unexpected request: ${path}`)
  })

  await expect(getSupabaseAccessToken()).resolves.toBe(accessTokenFor(1))

  await act(async () => {
    root.render(<MemoryRouter><Settings /></MemoryRouter>)
    await Promise.resolve()
  })

  const linkRow = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Supabase'))
  expect(linkRow).toBeTruthy()

  await act(async () => {
    linkRow.click()
    await Promise.resolve()
  })

  const sheet = useUI.getState().sheets[0]
  const sheetContainer = document.createElement('div')
  const sheetRoot = createRoot(sheetContainer)
  document.body.appendChild(sheetContainer)
  try {
    await act(async () => {
      sheetRoot.render(sheet.render(() => {}))
      await Promise.resolve()
    })
    const input = sheetContainer.querySelector('input[type="password"]')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'manually-pasted-supabase-token')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await Promise.resolve()
    })
    const submit = sheetContainer.querySelector('button')
    expect(submit.disabled).toBe(false)

    await act(async () => {
      submit.click()
      await Promise.resolve()
      await Promise.resolve()
    })
  } finally {
    act(() => sheetRoot.unmount())
    sheetContainer.remove()
  }

  await expect(getSupabaseAccessToken()).resolves.toBe(accessTokenFor(2))
  expect(bootstrapPosts).toBe(2)
  expect(fetchMock).toHaveBeenCalledWith('/api/account/identity-link', expect.objectContaining({
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer manually-pasted-supabase-token' },
  }))
})
