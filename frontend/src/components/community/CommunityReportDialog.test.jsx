// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ report: vi.fn() }))
vi.mock('../../lib/support.js', () => ({ createSupportRepository: () => ({ reportCommunityContent: mocks.report }) }))
vi.mock('framer-motion', () => ({ motion: { form: ({ initial, animate, exit, ...props }) => <form {...props} /> } }))
import CommunityReportDialog from './CommunityReportDialog.jsx'

let root, container
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; mocks.report.mockReset(); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root?.unmount()); container?.remove(); vi.restoreAllMocks() })

async function mount(onClose = vi.fn()) {
  await act(async () => root.render(<CommunityReportDialog client={{}} target={{ targetKind: 'comment', postId: 'post-1', commentId: 'comment-1', authorId: 'author-1', authorName: 'Bruno' }} onClose={onClose} />))
  return onClose
}
const choose = async value => { await act(async () => container.querySelector(`input[value="${value}"]`).click()) }
const submit = async () => { await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))) }
async function type(value) {
  const field = container.querySelector('textarea')
  await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })) })
}

it('requires an explanation when reporting for another reason', async () => {
  await mount(); await choose('other'); await submit()
  expect(container.querySelector('[role="alert"]').textContent).toContain('Explique o motivo')
  expect(mocks.report).not.toHaveBeenCalled()
})

it('sends the selected community target and preserves a failed description', async () => {
  mocks.report.mockRejectedValueOnce(Error('Sem conexão'))
  await mount(); await choose('other'); await type('Conteúdo fora do contexto'); await submit()
  expect(mocks.report).toHaveBeenCalledWith({ targetKind: 'comment', postId: 'post-1', commentId: 'comment-1', reason: 'other', description: 'Conteúdo fora do contexto' })
  expect(container.querySelector('textarea').value).toBe('Conteúdo fora do contexto')
  expect(container.querySelector('[role="alert"]').textContent).toContain('Sem conexão')
})

it('closes after successfully creating the support report', async () => {
  mocks.report.mockResolvedValueOnce('ticket-1')
  const close = await mount(); await choose('spam'); await submit()
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1200)) })
  expect(close).toHaveBeenCalledTimes(1)
})

it.each(['spam', 'harassment', 'inappropriate', 'misinformation'])('accepts the %s predefined reason', async reason => {
  mocks.report.mockResolvedValueOnce('ticket-1')
  await mount(); await choose(reason); await submit()
  expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({ reason }))
})

it('restores focus to the report trigger on Escape', async () => {
  const trigger = document.createElement('button'); trigger.textContent = 'Denunciar'; document.body.append(trigger); trigger.focus()
  const close = await mount()
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(close).toHaveBeenCalledTimes(1)
  await act(async () => root.render(null))
  expect(document.activeElement).toBe(trigger)
  trigger.remove()
})
