// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: 'pro-1' } }, repo: { invites: vi.fn().mockResolvedValue([{ id: 'i1', code: 'AB12CD34', kind: 'code', status: 'pending', created_at: '2026-09-24T10:00:00Z' }]), createInvite: vi.fn().mockResolvedValue({ id: 'i2', code: 'ZX98YU76' }), revokeInvite: vi.fn().mockResolvedValue({}), savePersonalInviteCode: vi.fn().mockResolvedValue({ code: 'CODIGOATUALIZADO', is_personal: true, is_custom: true }), revokeRelationship: vi.fn(), }, client: null }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => mocks.client }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
vi.mock('../components/AppHeader.jsx', () => ({ default: ({ title, action }) => <header><h1>{title}</h1>{action}</header> }))

import ProfessionalInvites from './ProfessionalInvites.jsx'
function CurrentLocation() { return <output data-location>{useLocation().search}</output> }

let dom, root, container
beforeEach(() => { vi.clearAllMocks(); mocks.auth.user = { id: 'pro-1' }; dom = new Window({ url: 'https://app.example/#/professional/invites' }); globalThis.window = dom; globalThis.document = dom.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); dom.close() })

describe('professional invites page', () => {
  it('does not confirm a failed copy and clears the failure after a successful retry', async () => {
    vi.stubGlobal('navigator', { clipboard: null })
    document.execCommand = vi.fn().mockReturnValueOnce(false).mockReturnValue(true)
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/invites']}><ProfessionalInvites /></MemoryRouter>))
    const action = [...container.querySelectorAll('button')].find(button => button.textContent === 'Copiar código')
    await act(async () => action.click())
    expect(action.getAttribute('data-state')).toBe('error')
    expect(container.textContent).not.toContain('Código copiado.')
    expect(container.querySelector('[role="alert"]').textContent).toContain('Não foi possível compartilhar')
    expect(document.querySelector('textarea')).toBeNull()
    await act(async () => action.click())
    expect(action.getAttribute('data-state')).toBe('success')
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.textContent).toContain('Código copiado.')
  })

  it('locks creation immediately and offers local retry after a failed creation', async () => {
    let fail
    mocks.repo.createInvite.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject }))
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/invites?section=create']}><ProfessionalInvites /></MemoryRouter>))
    const action = container.querySelector('.row-actions button')
    await act(async () => { action.click(); action.click() })
    expect(mocks.repo.createInvite).toHaveBeenCalledTimes(1)
    expect(action.getAttribute('aria-busy')).toBe('true')
    await act(async () => fail(new Error('offline')))
    expect(action.getAttribute('data-state')).toBe('error')
    expect(action.disabled).toBe(false)
    expect(container.querySelector('[role="alert"]').textContent).toContain('Não foi possível criar o convite.')
    await act(async () => action.click())
    expect(mocks.repo.createInvite).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('ZX98YU76')
  })

  it('keeps the invitation list open when a pending creation finishes after Cancel', async () => {
    let finishCreation
    mocks.repo.createInvite.mockImplementationOnce(() => new Promise(resolve => { finishCreation = resolve }))
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/invites?section=create']}><ProfessionalInvites /><CurrentLocation /></MemoryRouter>))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Gerar convite').click())
    await act(async () => [...container.querySelectorAll('a')].find(link => link.textContent === 'Cancelar').click())
    expect(container.textContent).toContain('Pendentes (1)')
    await act(async () => finishCreation({ id: 'i2', code: 'ZX98YU76' }))
    expect(container.textContent).toContain('Pendentes (2)')
    expect(container.textContent).toContain('AB12CD34')
    expect(container.textContent).toContain('ZX98YU76')
    expect(container.textContent).not.toContain('Compartilhar convite')
    expect(container.querySelector('[data-location]').textContent).toBe('')
  })
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

  it('keeps the reusable personal code separate and supports edit, cancel and save', async () => {
    mocks.repo.invites.mockResolvedValueOnce([
      { id: 'personal', code: 'ANASOUZA', kind: 'code', status: 'pending', is_personal: true, is_custom: false, created_at: '2026-10-01T10:00:00Z' },
      { id: 'generated', code: 'INDIVIDUAL1', kind: 'code', status: 'pending', is_personal: false, is_custom: false, created_at: '2026-10-02T10:00:00Z' },
    ])
    const view = <MemoryRouter initialEntries={['/professional/invites']}><ProfessionalInvites /></MemoryRouter>
    await act(async () => root.render(view))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

    expect(container.textContent).toContain('Código pessoal')
    expect(container.textContent).toContain('ANASOUZA')
    expect(container.querySelector('.management-personal-invite-panel').textContent).not.toContain('Pendente')
    expect(container.textContent).toContain('INDIVIDUAL1')
    const edit = [...container.querySelectorAll('button')].find(button => button.textContent === 'Editar código')
    await act(async () => edit.click())
    const input = container.querySelector('input[aria-label="Código pessoal"]')
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set
    setter.call(input, '  Código Novo ')
    await act(async () => input.dispatchEvent(new dom.window.Event('input', { bubbles: true })))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Cancelar').click())
    expect(mocks.repo.savePersonalInviteCode).not.toHaveBeenCalled()

    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Editar código').click())
    const secondInput = container.querySelector('input[aria-label="Código pessoal"]')
    setter.call(secondInput, 'Codigo Atualizado')
    await act(async () => secondInput.dispatchEvent(new dom.window.Event('input', { bubbles: true })))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Salvar código').click())
    expect(mocks.repo.savePersonalInviteCode).toHaveBeenCalledExactlyOnceWith('Codigo Atualizado')
    expect(container.textContent).toContain('CODIGOATUALIZADO')
  })

  it('shows generated invite history by status and only lets pending generated invites be revoked', async () => {
    mocks.repo.invites.mockResolvedValueOnce([
      { id: 'personal', code: 'ANASOUZA', kind: 'code', status: 'pending', is_personal: true, is_custom: false },
      { id: 'pending', code: 'PENDING01', kind: 'code', status: 'pending', is_personal: false },
      { id: 'accepted', code: 'ACCEPTED1', kind: 'code', status: 'active', is_personal: false, accepted_at: '2026-10-03T10:00:00Z' },
      { id: 'revoked', code: 'REVOKED01', kind: 'code', status: 'revoked', is_personal: false },
    ])
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/invites']}><ProfessionalInvites /></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })

    expect(container.textContent).toContain('Pendentes (1)')
    expect(container.textContent).toContain('PENDING01')
    expect(container.textContent).toContain('ACCEPTED1')
    expect(container.textContent).toContain('Ativo')
    expect(container.textContent).toContain('REVOKED01')
    expect(container.textContent).toContain('Revogado')
    expect([...container.querySelectorAll('button')].filter(button => button.textContent === 'Revogar')).toHaveLength(1)
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Revogar').click())
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Confirmar').click())
    expect(mocks.repo.revokeInvite).toHaveBeenCalledExactlyOnceWith('pending')
  })

  it('keeps the current personal code when the requested code is already taken', async () => {
    mocks.repo.invites.mockResolvedValueOnce([{ id: 'personal', code: 'ANASOUZA', status: 'pending', is_personal: true, is_custom: false }])
    mocks.repo.savePersonalInviteCode.mockRejectedValueOnce(new Error('professional-invite-code-taken'))
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/invites']}><ProfessionalInvites /></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Editar código').click())
    const input = container.querySelector('input[aria-label="Código pessoal"]')
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set
    setter.call(input, 'ANASOUZA')
    await act(async () => input.dispatchEvent(new dom.window.Event('input', { bubbles: true })))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Salvar código').click())
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('já está em uso')
    expect(container.textContent).toContain('ANASOUZA')
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
