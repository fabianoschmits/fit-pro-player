// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ createTicket: vi.fn().mockRejectedValue(new Error('Teste de conexão')) }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/support.js', () => ({ createSupportRepository: () => mocks }))
import { SupportComposer } from './Support.jsx'
let root, container
beforeEach(() => { mocks.createTicket.mockReset().mockRejectedValue(new Error('Teste de conexão')) })
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

function Location() { return <output>{useLocation().pathname}</output> }
it('guards native duplicate submissions, preserves an errored draft and navigates immediately after retry', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  let reject, resolve
  mocks.createTicket.mockImplementationOnce(() => new Promise((_, no) => { reject = no })).mockImplementationOnce(() => new Promise(yes => { resolve = yes }))
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<MemoryRouter><SupportComposer /><Location /></MemoryRouter>))
  await act(async () => { const field = container.querySelector('select'); field.value = 'question'; field.dispatchEvent(new Event('change', { bubbles: true })) })
  for (const [tag, value] of [['input', 'Preciso de ajuda'], ['textarea', 'Meu texto não pode ser perdido.']]) await act(async () => {
    const field = container.querySelector(tag), prototype = tag === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const submit = () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  act(() => { submit(); submit() })
  expect(mocks.createTicket).toHaveBeenCalledTimes(1)
  expect(container.querySelector('[type="submit"]').getAttribute('aria-busy')).toBe('true')
  await act(async () => reject(new Error('Sem conexão')))
  expect(container.querySelector('textarea').value).toBe('Meu texto não pode ser perdido.')
  expect(container.querySelector('[type="submit"]').getAttribute('data-state')).toBe('error')
  expect(container.querySelector('[type="submit"]').disabled).toBe(false)
  act(submit)
  await act(async () => resolve('ticket-2'))
  expect(mocks.createTicket).toHaveBeenCalledTimes(2)
  expect(container.querySelector('output').textContent).toBe('/support/tickets/ticket-2')
})
