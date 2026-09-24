// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: 'pro-1' } }, repo: { professionalRole: vi.fn().mockResolvedValue(true), clientSummaries: vi.fn().mockResolvedValue([{ studentUserId: 's1', displayName: 'Ana', programTitle: 'Força' }, { studentUserId: 's2', displayName: 'Bruno', programTitle: null }]) } }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
vi.mock('../components/AppHeader.jsx', () => ({ default: ({ title }) => <h1>{title}</h1> }))
import ProfessionalStudents from './ProfessionalStudents.jsx'

let dom, root, container
beforeEach(() => { dom = new Window({ url: 'https://app.example/#/professional/students' }); globalThis.window = dom; globalThis.document = dom.document; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('professional students page', () => {
  it('searches and filters real active students without mixing invites', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/students']}><ProfessionalStudents /></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Ana')
    expect(container.textContent).toContain('Bruno')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Sem programa').click())
    expect(container.textContent).toContain('Bruno')
    expect(container.textContent).not.toContain('Ana')
  })
})
