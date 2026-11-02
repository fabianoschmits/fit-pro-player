// @vitest-environment happy-dom
import  { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ ticketDetail: vi.fn(), addUserMessage: vi.fn(), client: null }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => mocks.client }))
vi.mock('../lib/support.js', () => ({ createSupportRepository: () => mocks }))
import SupportTicket from './SupportTicket.jsx'
let root, host
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); mocks.ticketDetail.mockReset().mockResolvedValue({ ticketId: 'ticket-1', subject: 'Ajuda', status: 'pending', priority: 'normal', messages: [] }); mocks.addUserMessage.mockReset() })
afterEach(async () => { await act(async () => root.unmount()); host.remove();mocks.client=null;vi.restoreAllMocks() })

it('loads report previews through authenticated private storage and releases the image URL', async () => {
 const download=vi.fn().mockResolvedValue({data:new Blob(['private-preview']),error:null})
 const getPublicUrl=vi.fn(),createSignedUrl=vi.fn()
 mocks.client={storage:{from:vi.fn().mockReturnValue({download,getPublicUrl,createSignedUrl})}}
 vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:report-preview')
 const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{})
 mocks.ticketDetail.mockResolvedValue({ticketId:'ticket-1',subject:'Denúncia',status:'pending',messages:[],reportContext:{postId:'post-1',reportedUserId:'reported',imagePath:'reported/photo.jpg'}})
 await act(async()=>root.render(<MemoryRouter initialEntries={['/support/tickets/ticket-1']}><Routes><Route path="/support/tickets/:ticketId" element={<SupportTicket/>}/></Routes></MemoryRouter>))
 expect(download).toHaveBeenCalledWith('reported/photo.jpg')
 expect(host.querySelector('.chat-report-preview img').src).toBe('blob:report-preview')
 expect(getPublicUrl).not.toHaveBeenCalled();expect(createSignedUrl).not.toHaveBeenCalled()
 await act(async()=>root.render(null))
 expect(revoke).toHaveBeenCalledWith('blob:report-preview')
})

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
