// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ createTicket: vi.fn().mockRejectedValue(new Error('Teste de conexão')) }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/support.js', () => ({ createSupportRepository: () => mocks }))
import { SupportComposer } from './Support.jsx'
let root, container
afterEach(async () => { await act(async () => root?.unmount()); container?.remove() })
it('sends the chosen category to the support repository and preserves drafts on error', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<MemoryRouter><SupportComposer /></MemoryRouter>))
  await act(async () => {
    const select = container.querySelector('select'); select.value = 'question'; select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  for (const [tag, value] of [['input', 'Minha dúvida'], ['textarea', 'Como começo meu treino?']]) await act(async () => {
    const field = container.querySelector(tag), prototype = tag === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(mocks.createTicket).toHaveBeenCalledWith({ categorySlug: 'question', subject: 'Minha dúvida', body: 'Como começo meu treino?' })
  expect(container.querySelector('textarea').value).toBe('Como começo meu treino?')
})
