// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const peer = '22222222-2222-4222-8222-222222222222'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), profile: vi.fn() }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => ({ user: { id: '11111111-1111-4111-8111-111111111111' } }) }))
vi.mock('../lib/supabase-client.js', () => { const client = { rpc: (...args) => mocks.rpc(...args), from: () => ({ select() { return this }, eq() { return this }, maybeSingle: () => mocks.profile() }) }; return { getBrowserSupabaseClient: () => client } })
import CommunityMessages from './CommunityMessages.jsx'
let host, root
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; mocks.rpc.mockReset().mockResolvedValue({ data: [] }); mocks.profile.mockReset().mockResolvedValue({ data: { display_name: 'Bruno' } }); host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const mount = async (path = `/community/messages/${peer}`) => act(async () => root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/community/messages/:peerId?" element={<CommunityMessages />} /></Routes></MemoryRouter>))
it('retains failed drafts, prevents double submits, and reuses nonce on retry', async () => {
  let reject
  mocks.rpc.mockImplementation(name => name === 'community_send_message' ? new Promise((_, no) => { reject = no }) : Promise.resolve({ data: [] }))
  await mount()
  await act(async () => { const input = host.querySelector('textarea'); Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(input, 'Olá Bruno'); input.dispatchEvent(new Event('input', { bubbles: true })) })
  const submit = () => host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  act(() => { submit(); submit() })
  const sends = () => mocks.rpc.mock.calls.filter(([name]) => name === 'community_send_message')
  expect(sends()).toHaveLength(1)
  await act(async () => reject(Error('Sem conexão')))
  expect(host.querySelector('textarea').value).toBe('Olá Bruno')
  mocks.rpc.mockResolvedValue({ data: [] })
  await act(async () => submit())
  expect(sends()).toHaveLength(2)
  expect(sends()[0][1].p_nonce).toBe(sends()[1][1].p_nonce)
  expect(host.querySelector('textarea').value).toBe('')
})
it('shows inbox unread counts and preview', async () => {
  mocks.rpc.mockResolvedValue({ data: [{ peer_id: peer, display_name: 'Bruno', body: 'Bora treinar?', created_at: '2026-10-25T12:00:00Z', unread_count: 2 }] })
  await mount('/community/messages')
  expect(host.textContent).toContain('Bora treinar?')
  expect(host.querySelector('[aria-label="2 mensagens não lidas"]')).not.toBeNull()
})
it('rejects own conversation without querying message history', async () => {
  await mount('/community/messages/11111111-1111-4111-8111-111111111111')
  expect(host.textContent).toContain('Este destinatário não está disponível')
  expect(mocks.rpc).not.toHaveBeenCalled()
})
it('retries a failed profile request and enables the composer', async () => {
  mocks.profile.mockRejectedValueOnce(Error('offline'))
  await mount()
  expect(host.querySelector('textarea').disabled).toBe(true)
  expect(host.textContent).toContain('Não foi possível carregar o perfil')
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === 'Tentar novamente').click())
  expect(host.querySelector('textarea').disabled).toBe(false)
  expect(host.textContent).not.toContain('Não foi possível carregar o perfil')
})
it('fills history gaps on refresh and updates receipts on older loaded messages', async () => {
  const row = id => ({ id: String(id), sender_id: '11111111-1111-4111-8111-111111111111', body: `Mensagem ${id}`, created_at: '2026-10-25T12:00:00Z', read_at: null })
  mocks.rpc.mockImplementation(async name => ({ data: name === 'community_message_history' ? [row(1)] : null }))
  await mount()
  mocks.rpc.mockImplementation(async (name, args) => ({ data: name !== 'community_message_history' ? null : args.p_before === null ? Array.from({ length: 50 }, (_, index) => row(index + 3)) : [{ ...row(1), read_at: '2026-10-25T13:00:00Z' }, row(2)] }))
  await act(async () => window.dispatchEvent(new Event('online')))
  expect(host.querySelectorAll('.chat-bubble')).toHaveLength(52)
  expect(host.querySelector('[aria-label="Lida"]')).not.toBeNull()
})
