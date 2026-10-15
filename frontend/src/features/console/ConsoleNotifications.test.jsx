// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ list: vi.fn(), markRead: vi.fn(), auth: { status: 'authenticated', user: { id: 'admin-1' } } }))
vi.mock('../../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('./notifications.js', () => ({ createConsoleNotificationRepository: () => ({ list: mocks.list, markRead: mocks.markRead }) }))
import ConsoleNotifications from './ConsoleNotifications.jsx'
let root, container
function Location() { return <output>{useLocation().pathname}</output> }
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; mocks.list.mockReset().mockResolvedValue({ items: [{ id: 'support:m1', title: 'Nova mensagem', body: 'Dúvida sobre treino', targetPath: '/console/support/t1', createdAt: '2026-10-15T10:00:00Z', readAt: null, kind: 'support' }], unreadCount: 1, hasMore: false }); mocks.markRead.mockReset().mockResolvedValue(); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
const render = allowed => act(async () => root.render(<MemoryRouter initialEntries={['/console']}><ConsoleNotifications allowed={allowed} userId="admin-1" /><Location /></MemoryRouter>))

it('opens the notification dialog and follows a notification to the correct page', async () => {
  await render(true)
  await act(async () => container.querySelector('button[aria-haspopup="dialog"]').click())
  expect(document.querySelector('[role="dialog"]').textContent).toContain('Dúvida sobre treino')
  await act(async () => document.querySelector('a[href="/console/support/t1"]').click())
  expect(container.querySelector('output').textContent).toBe('/console/support/t1')
  expect(mocks.markRead).toHaveBeenCalledWith('support:m1')
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('closes with Escape and marks the visible notification feed as read', async () => {
  await render(true)
  await act(async () => container.querySelector('button').click())
  await act(async () => [...document.querySelectorAll('[role="dialog"] button')].find(el => el.textContent === 'Marcar todas como lidas').click())
  expect(mocks.markRead).toHaveBeenCalledWith(null)
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('does not load project notifications before admin access is confirmed', async () => {
  await render(false)
  expect(mocks.list).not.toHaveBeenCalled()
  expect(container.querySelector('button')).toBeNull()
})

it('guards duplicate mark-all writes and permits retry after failure', async () => {
  let reject
  mocks.markRead.mockImplementationOnce(() => new Promise((_, no) => { reject = no })).mockResolvedValueOnce(true)
  await render(true)
  await act(async () => container.querySelector('button').click())
  const action = () => [...document.querySelectorAll('[role="dialog"] button')].find(el => el.textContent === 'Marcar todas como lidas' || el.dataset.state === 'error')
  act(() => { action().click(); action().click() })
  expect(mocks.markRead).toHaveBeenCalledTimes(1)
  expect(action().getAttribute('aria-busy')).toBe('true')
  await act(async () => reject(new Error('offline')))
  expect(action().disabled).toBe(false)
  expect(action().getAttribute('data-state')).toBe('error')
  await act(async () => action().click())
  expect(mocks.markRead).toHaveBeenCalledTimes(2)
})
