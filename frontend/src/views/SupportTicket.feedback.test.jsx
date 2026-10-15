// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ ticketDetail: vi.fn(), addUserMessage: vi.fn() }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/support.js', () => ({ createSupportRepository: () => mocks }))
import SupportTicket from './SupportTicket.jsx'
let root, host
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); mocks.ticketDetail.mockReset().mockResolvedValue({ ticketId: 'ticket-1', subject: 'Ajuda', status: 'pending', priority: 'normal', messages: [] }); mocks.addUserMessage.mockReset() })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })

it('locks duplicate replies and retains their text after a failure until a successful retry', async () => {
  let reject
  mocks.addUserMessage.mockImplementationOnce(() => new Promise((_, no) => { reject = no })).mockResolvedValueOnce(true)
  await act(async () => root.render(<MemoryRouter initialEntries={['/support/tickets/ticket-1']}><Routes><Route path="/support/tickets/:ticketId" element={<SupportTicket />} /></Routes></MemoryRouter>))
  await act(async () => { const input = host.querySelector('textarea'); Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(input, 'Meu acompanhamento'); input.dispatchEvent(new Event('input', { bubbles: true })) })
  const submit = () => host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  act(() => { submit(); submit() })
  expect(mocks.addUserMessage).toHaveBeenCalledTimes(1)
  expect(host.querySelector('[type="submit"]').getAttribute('aria-busy')).toBe('true')
  await act(async () => reject(new Error('Sem conexão')))
  expect(host.querySelector('textarea').value).toBe('Meu acompanhamento')
  expect(host.querySelector('[type="submit"]').getAttribute('data-state')).toBe('error')
  await act(async () => submit())
  expect(mocks.addUserMessage).toHaveBeenCalledTimes(2)
  expect(host.querySelector('textarea').value).toBe('')
})
