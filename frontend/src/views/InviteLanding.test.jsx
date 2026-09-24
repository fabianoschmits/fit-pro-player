// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: 'student-1' } }, repo: { previewInvite: vi.fn().mockResolvedValue([{ professional_name: 'Ana', bio: 'Força', verification_status: 'unverified' }]), acceptInvite: vi.fn().mockResolvedValue({ id: 'r1' }) } }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
vi.mock('../components/AppHeader.jsx', () => ({ default: ({ title }) => <h1>{title}</h1> }))
import InviteLanding from './InviteLanding.jsx'

let dom, root, container
beforeEach(() => { dom = new Window({ url: 'https://app.example/#/invite/AB12CD34' }); globalThis.window = dom; globalThis.document = dom.document; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('invite landing', () => {
  it('previews the professional before creating a relationship', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/invite/AB12CD34']}><Routes><Route path="/invite/:code" element={<InviteLanding />} /></Routes></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Ana')
    expect(container.textContent).toContain('Vincular a este profissional')
    expect(mocks.repo.acceptInvite).not.toHaveBeenCalled()
  })
})
