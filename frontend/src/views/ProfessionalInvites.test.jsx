// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: 'pro-1' } }, repo: { invites: vi.fn().mockResolvedValue([{ id: 'i1', code: 'AB12CD34', kind: 'code', status: 'pending', created_at: '2026-09-24T10:00:00Z' }]), createInvite: vi.fn().mockResolvedValue({ code: 'ZX98YU76' }), revokeRelationship: vi.fn(), }, client: null }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => mocks.client }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
vi.mock('../components/AppHeader.jsx', () => ({ default: ({ title }) => <h1>{title}</h1> }))

import ProfessionalInvites from './ProfessionalInvites.jsx'

let dom, root, container
beforeEach(() => { dom = new Window({ url: 'https://app.example/#/professional/invites' }); globalThis.window = dom; globalThis.document = dom.document; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('professional invites page', () => {
  it('keeps pending invites separate and presents one creation flow', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/invites']}><ProfessionalInvites /></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Convidar aluno')
    expect(container.textContent).toContain('AB12CD34')
    expect(container.textContent).toContain('Pendente')
    expect(container.textContent).not.toContain('Alunos ativos')
  })
})
