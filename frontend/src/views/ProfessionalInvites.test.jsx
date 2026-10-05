// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: 'pro-1' } }, repo: { invites: vi.fn().mockResolvedValue([{ id: 'i1', code: 'AB12CD34', kind: 'code', status: 'pending', created_at: '2026-09-24T10:00:00Z' }]), createInvite: vi.fn().mockResolvedValue({ id: 'i2', code: 'ZX98YU76' }), revokeInvite: vi.fn().mockResolvedValue({}), revokeRelationship: vi.fn(), }, client: null }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => mocks.client }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
vi.mock('../components/AppHeader.jsx', () => ({ default: ({ title, action }) => <header><h1>{title}</h1>{action}</header> }))

import ProfessionalInvites from './ProfessionalInvites.jsx'

let dom, root, container
beforeEach(() => { vi.clearAllMocks(); mocks.auth.user = { id: 'pro-1' }; dom = new Window({ url: 'https://app.example/#/professional/invites' }); globalThis.window = dom; globalThis.document = dom.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('professional invites page', () => {
  it('generates once, restores the result by URL and confirms revocation', async () => {
    const view = path => <MemoryRouter initialEntries={[path]}><ProfessionalInvites /></MemoryRouter>
    await act(async () => root.render(view('/professional/invites?section=create')))
    expect(container.textContent).not.toContain('AB12CD34')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Gerar convite').click())
    expect(mocks.repo.createInvite).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('ZX98YU76')
    expect(container.textContent).not.toContain('AB12CD34')
    await act(async () => root.unmount()); root = createRoot(container)
    await act(async () => root.render(view('/professional/invites?section=result&code=AB12CD34')))
    expect(container.textContent).toContain('AB12CD34')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Revogar').click())
    expect(mocks.repo.revokeInvite).not.toHaveBeenCalled()
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Confirmar').click())
    expect(mocks.repo.revokeInvite).toHaveBeenCalledWith('i1')
  })
  it('ignores an invite created by the old account while a new account is open', async () => {
    let finishOld
    mocks.repo.createInvite.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    const view = () => <MemoryRouter initialEntries={['/professional/invites?section=create']}><ProfessionalInvites /></MemoryRouter>
    await act(async () => root.render(view()))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Gerar convite').click())
    mocks.auth.user = { id: 'pro-2' }
    await act(async () => root.render(view()))
    await act(async () => finishOld({ id: 'old', code: 'OLD1234567' }))
    expect(container.textContent).not.toContain('OLD1234567')
    expect(container.textContent).toContain('Gerar convite')
  })
  it('keeps pending invites separate and presents one creation flow', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/invites']}><ProfessionalInvites /></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.querySelector('a[href="/professional/invites?section=create"]')).toBeTruthy()
    expect(container.textContent).not.toContain('Crie um único convite')
    expect(container.textContent).toContain('AB12CD34')
    expect(container.textContent).toContain('Pendente')
    expect(container.textContent).not.toContain('Alunos ativos')
  })
})
