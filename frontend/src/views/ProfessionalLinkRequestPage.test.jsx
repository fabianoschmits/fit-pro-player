// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ repo: { linkRequestDetail: vi.fn(), acceptLinkRequest: vi.fn(), rejectLinkRequest: vi.fn() } }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => ({ user: { id: 'pro' } }) }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
import ProfessionalLinkRequestPage from './ProfessionalLinkRequestPage.jsx'
let root, container
beforeEach(() => {
 globalThis.IS_REACT_ACT_ENVIRONMENT = true
 vi.clearAllMocks()
 mocks.repo.linkRequestDetail.mockResolvedValue({ id: 'request', status: 'pending', studentUserId: 's', displayName: 'João Silva', createdAt: '2026-11-03' })
 mocks.repo.acceptLinkRequest.mockResolvedValue({ id: 'new-cycle' })
 mocks.repo.rejectLinkRequest.mockResolvedValue({ status: 'rejected' })
 container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
const render = () => act(async () => root.render(<MemoryRouter initialEntries={['/professional/requests/request']}><Routes><Route path="/professional/requests/:requestId" element={<ProfessionalLinkRequestPage />} /><Route path="/professional" element={<p>Dashboard atualizado</p>} /></Routes></MemoryRouter>))
it.each(['Aceitar', 'Recusar'])('shows the request profile and protects %s from double clicks and opposing actions', async label => {
 let resolve
 const operation = label === 'Aceitar' ? mocks.repo.acceptLinkRequest : mocks.repo.rejectLinkRequest
 operation.mockImplementationOnce(() => new Promise(done => { resolve = done }))
 await render()
 expect(container.textContent).toContain('João Silva')
 expect(container.textContent).toContain('Aguardando resposta')
 expect(container.textContent).not.toContain('Plano atual')
 const buttons = [...container.querySelectorAll('button')]
 await act(async () => { buttons.find(button => button.textContent === label).click(); buttons.find(button => button.textContent === label).click(); buttons.find(button => button.textContent === (label === 'Aceitar' ? 'Recusar' : 'Aceitar')).click() })
 expect(operation).toHaveBeenCalledExactlyOnceWith('request')
 expect((label === 'Aceitar' ? mocks.repo.rejectLinkRequest : mocks.repo.acceptLinkRequest)).not.toHaveBeenCalled()
 expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
 await act(async () => resolve({}))
 expect(container.textContent).toContain('Dashboard atualizado')
})
it('keeps a failed decision visible and allows retry', async () => {
 mocks.repo.acceptLinkRequest.mockRejectedValueOnce(new Error('offline'))
 await render()
 await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Aceitar').click())
 expect(container.querySelector('[role="alert"]')).not.toBeNull()
 expect(container.textContent).toContain('João Silva')
 expect(container.querySelector('[data-state="error"]')).not.toBeNull()
})
