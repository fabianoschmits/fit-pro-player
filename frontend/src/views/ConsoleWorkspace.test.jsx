// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Link, MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: 'admin-1' } }, console: {}, support: {} }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/console.js', async importOriginal => ({ ...(await importOriginal()), createConsoleRepository: () => mocks.console }))
vi.mock('../lib/support.js', () => ({ createSupportRepository: () => mocks.support }))
import ConsoleHome, { ConsoleSupport, ConsoleSupportTicket, ConsoleFaq, ConsoleFaqEditor, ConsoleLaboratory } from './Console.jsx'

let root, container
const ticket = () => ({ ticketId: 'ticket-1', userId: 'user-1', subject: 'Dúvida sobre o plano', status: 'pending', priority: 'normal', assignedAdminId: 'admin-1', categoryLabel: 'Dúvida', messages: [{ id: 'm1', author_kind: 'user', body: 'Como começar meu treino?', created_at: '2026-10-15T12:00:00Z' }], events: [] })
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mocks.auth = { status: 'authenticated', user: { id: 'admin-1' } }
  mocks.console = { adminRole: vi.fn().mockResolvedValue(true), overview: vi.fn().mockResolvedValue({ userCount: 26, professionalCount: 8 }), userDetail: vi.fn().mockResolvedValue({ displayName: 'Ana', email: 'ana@example.com' }) }
  mocks.support = {
    overview: vi.fn().mockResolvedValue({ unreadCount: 4, pendingCount: 100, answeredCount: 2, resolvedCount: 1 }),
    listTickets: vi.fn().mockResolvedValue([ticket()]), adminTicketDetail: vi.fn().mockResolvedValue(ticket()), markRead: vi.fn().mockResolvedValue(),
    updateTicket: vi.fn().mockResolvedValue(), reply: vi.fn().mockResolvedValue(),
    deleteTicket: vi.fn().mockResolvedValue(),
    listCategories: vi.fn().mockResolvedValue([{ slug: 'question', label: 'Dúvida' }]),
    listFaqAdmin: vi.fn().mockResolvedValue([{ articleId: 'faq-1', question: 'Como começar?', answer: 'Abra o Plano.', categorySlug: 'question', categoryLabel: 'Dúvida', sortOrder: 10, isPublished: true }]),
    saveFaqArticle: vi.fn().mockResolvedValue('faq-1'),
  }
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
const render = path => act(async () => root.render(<MemoryRouter initialEntries={[path]}><Link data-test-notification to="/console/support/ticket-1">Notificação desta conversa</Link><Routes>
  <Route path="/console" element={<ConsoleHome />} />
  <Route path="/console/laboratory" element={<ConsoleLaboratory />} />
  <Route path="/console/support" element={<ConsoleSupport />} />
  <Route path="/console/support/:ticketId" element={<ConsoleSupportTicket />} />
  <Route path="/console/faq" element={<ConsoleFaq />} />
  <Route path="/console/faq/:articleId" element={<ConsoleFaqEditor />} />
</Routes></MemoryRouter>))
const input = async (element, value) => act(async () => { const setter = Object.getOwnPropertyDescriptor(element.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype, 'value').set; setter.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })) })

it('makes messages and FAQ directly accessible from the platform overview', async () => {
  await render('/console')
  expect(container.querySelector('h1').textContent).toContain('Central da plataforma')
  expect(container.querySelector('a[href="/console/support"]')).not.toBeNull()
  expect(container.querySelector('a[href="/console/faq"]')).not.toBeNull()
  const testsGroup = [...container.querySelectorAll('.console-navigation-group')].find(group => group.querySelector('p')?.textContent === 'Testes')
  expect(testsGroup?.querySelectorAll('a').length).toBe(1)
  expect(testsGroup?.querySelector('a[href="/console/laboratory"]')?.textContent).toContain('Laboratório de testes')
  expect(container.querySelector('main a[href="/console/laboratory"]')?.textContent).toContain('Laboratório de testes')
  expect(container.querySelector('nav a[href="/motion-feedback"]')).toBeNull()
  expect(container.querySelector('nav a[href="/tests/home-glass"]')).toBeNull()
  expect(container.textContent).toContain('100')
})

it('groups the experimental pages in the test laboratory and marks its navigation active', async () => {
  await render('/console/laboratory')
  expect(container.querySelector('h1').textContent).toBe('Laboratório de testes')
  const pages = container.querySelector('section[aria-label="Páginas de testes"]')
  expect(pages.querySelectorAll('a').length).toBe(3)
  expect(pages.querySelector('a[href="/motion-feedback"]')?.textContent).toContain('Laboratório de interações')
  expect(pages.querySelector('a[href="/tests/home-glass"]')?.textContent).toContain('Home Glass')
  expect(pages.querySelector('a[href="/console/laboratory/menus"]')?.textContent).toContain('Menus alternativos')
  expect(container.querySelector('nav [aria-current="page"]')?.getAttribute('href')).toBe('/console/laboratory')
  expect(container.querySelector('a.console-back')?.getAttribute('href')).toBe('/console')
  expect(mocks.console.overview).not.toHaveBeenCalled()
  expect(mocks.support.overview).not.toHaveBeenCalled()
})

it('keeps the test catalogue unavailable to accounts without admin access', async () => {
  mocks.console.adminRole.mockResolvedValue(false)
  await render('/console/laboratory')
  expect(container.textContent).toContain('Sem acesso')
  expect(container.querySelector('section[aria-label="Páginas de testes"]')).toBeNull()
  expect(container.querySelector('a[href="/motion-feedback"]')).toBeNull()
  expect(container.querySelector('a[href="/tests/home-glass"]')).toBeNull()
  expect(container.querySelector('a[href="/console/laboratory/menus"]')).toBeNull()
})

it('lists messages with dedicated conversation links and status filters', async () => {
  await render('/console/support?status=pending')
  expect(container.querySelector('a[href^="/console/support/ticket-1"]')).not.toBeNull()
  expect(container.textContent).toContain('Dúvida sobre o plano')
  expect(mocks.support.listTickets).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', limit: 25, offset: 0 }))
})

it('allows selecting tickets and triggering bulk actions', async () => {
  await render('/console/support')
  const selectModeBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Selecionar'))
  expect(selectModeBtn).not.toBeNull()
  await act(async () => selectModeBtn.click())

  const checkbox = container.querySelector('input[type="checkbox"][aria-label="Selecionar chamado Dúvida sobre o plano"]')
  expect(checkbox).not.toBeNull()
  await act(async () => checkbox.click())
  expect(checkbox.checked).toBe(true)

  const archiveBtn = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Arquivar'))
  expect(archiveBtn).not.toBeNull()
  await act(async () => archiveBtn.click())
  expect(mocks.support.updateTicket).toHaveBeenCalledWith('ticket-1', expect.objectContaining({ status: 'archived' }))
})

it('opens normalized ticket data and submits replies using its real ID', async () => {
  await render('/console/support/ticket-1')
  expect(container.querySelector('h1').textContent).toBe('Dúvida sobre o plano')
  expect(container.textContent).toContain('Como começar meu treino?')
  expect(container.textContent).toContain('ana@example.com')
  expect(container.querySelector('nav [aria-current="page"]').textContent).toContain('Mensagens')
  await input(container.querySelector('textarea'), 'Abra a página Plano.')
  await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(mocks.support.reply).toHaveBeenCalledWith('ticket-1', 'Abra a página Plano.')
})

it('preserves a reply draft and shows a useful error when sending fails', async () => {
  mocks.support.reply.mockRejectedValue(new Error('connection failed'))
  await render('/console/support/ticket-1')
  await input(container.querySelector('textarea'), 'Minha resposta')
  await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(container.querySelector('textarea').value).toBe('Minha resposta')
  expect(container.querySelector('[role="alert"]').textContent).toContain('Não foi possível enviar')
})

it('refreshes a conversation when its notification leads to the currently open route', async () => {
  await render('/console/support/ticket-1')
  mocks.support.adminTicketDetail.mockResolvedValue({ ...ticket(), messages: [...ticket().messages, { id: 'm2', author_kind: 'user', body: 'Uma nova mensagem chegou agora.', created_at: '2026-10-15T14:00:00Z' }] })
  await act(async () => container.querySelector('[data-test-notification]').click())
  expect(container.textContent).toContain('Uma nova mensagem chegou agora.')
})

it('offers reopening for archived tickets and preserves assignment', async () => {
  mocks.support.adminTicketDetail.mockResolvedValue({ ...ticket(), status: 'archived' })
  await render('/console/support/ticket-1')
  expect(container.querySelector('textarea')).toBeNull()
  const reopen = [...container.querySelectorAll('button')].find(el => el.textContent === 'Reabrir chamado')
  await act(async () => reopen.click())
  expect(mocks.support.updateTicket).toHaveBeenCalledWith('ticket-1', expect.objectContaining({ status: 'pending', assignedAdminId: 'admin-1' }))
})

it('denies non-admin accounts before fetching messages', async () => {
  mocks.console.adminRole.mockResolvedValue(false)
  await render('/console/support')
  expect(container.textContent).toContain('Sem acesso')
  expect(mocks.support.listTickets).not.toHaveBeenCalled()
})

it('lists FAQ articles separately and links to the dedicated editor', async () => {
  await render('/console/faq')
  expect(container.querySelector('a[href="/console/faq/faq-1"]')).not.toBeNull()
  expect(container.textContent).toContain('Como começar?')
  expect(container.querySelector('a[href="/console/faq/new"]')).not.toBeNull()
})

it('edits an FAQ article while preserving publication and category', async () => {
  await render('/console/faq/faq-1')
  expect(container.querySelector('textarea').value).toBe('Abra o Plano.')
  await input(container.querySelector('textarea'), 'Abra o Plano e escolha uma rotina.')
  await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(mocks.support.saveFaqArticle).toHaveBeenCalledWith(expect.objectContaining({ articleId: 'faq-1', answer: 'Abra o Plano e escolha uma rotina.', categorySlug: 'question', isPublished: true }))
})

it('blocks duplicate console replies and retries a preserved draft after failure', async () => {
  let reject
  mocks.support.reply.mockImplementationOnce(() => new Promise((_, no) => { reject = no })).mockResolvedValueOnce(true)
  await render('/console/support/ticket-1')
  await input(container.querySelector('textarea'), 'Resposta preservada')
  const submit = () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  act(() => { submit(); submit() })
  expect(mocks.support.reply).toHaveBeenCalledTimes(1)
  expect(container.querySelector('[type="submit"]').getAttribute('aria-busy')).toBe('true')
  await act(async () => reject(new Error('offline')))
  expect(container.querySelector('textarea').value).toBe('Resposta preservada')
  expect(container.querySelector('[type="submit"]').getAttribute('data-state')).toBe('error')
  await act(async () => submit())
  expect(mocks.support.reply).toHaveBeenCalledTimes(2)
  expect(container.querySelector('textarea').value).toBe('')
})

it('blocks duplicate FAQ saves and retains the editor for retry on failure', async () => {
  let reject
  mocks.support.saveFaqArticle.mockImplementationOnce(() => new Promise((_, no) => { reject = no }))
  await render('/console/faq/faq-1')
  await input(container.querySelector('textarea'), 'Resposta revisada')
  const submit = () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  act(() => { submit(); submit() })
  expect(mocks.support.saveFaqArticle).toHaveBeenCalledTimes(1)
  expect(container.querySelector('[type="submit"]').getAttribute('aria-busy')).toBe('true')
  await act(async () => reject(new Error('offline')))
  expect(container.querySelector('textarea').value).toBe('Resposta revisada')
  expect(container.querySelector('[type="submit"]').disabled).toBe(false)
  expect(container.querySelector('[type="submit"]').getAttribute('data-state')).toBe('error')
})

it('keeps archive feedback idle when only assignment changes', async () => {
  let resolve
  mocks.support.updateTicket.mockImplementationOnce(() => new Promise(yes => { resolve = yes }))
  await render('/console/support/ticket-1')
  const find = label => [...container.querySelectorAll('button')].find(item => item.textContent === label)
  act(() => find('Remover atribuição').click())
  expect(find('Arquivar chamado').getAttribute('aria-busy')).toBeNull()
  await act(async () => resolve(true))
  expect(find('Arquivar chamado').getAttribute('data-state')).toBe('idle')
  expect(find('Arquivar chamado').disabled).toBe(false)
})
