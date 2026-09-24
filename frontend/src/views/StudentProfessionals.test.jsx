// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: 'student-1' } }, repo: { relationships: vi.fn().mockResolvedValue([]), assignments: vi.fn().mockResolvedValue([]), studentOverview: vi.fn().mockResolvedValue({}) } }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
vi.mock('../lib/professional-execution.js', () => ({ createProfessionalExecutionRepository: () => ({ startAssignedExecution: vi.fn() }) }))
vi.mock('../sheets.jsx', () => ({ startFlow: vi.fn() }))
vi.mock('../components/AppHeader.jsx', () => ({ default: ({ title }) => <h1>{title}</h1> }))
import StudentProfessionals from './StudentProfessionals.jsx'

let dom, root, container
beforeEach(() => { dom = new Window({ url: 'https://app.example/#/student/professionals' }); globalThis.window = dom; globalThis.document = dom.document; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('student professionals page', () => {
  it('shows a focused add-professional empty state', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/student/professionals']}><StudentProfessionals /></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Adicionar profissional')
    expect(container.textContent).toContain('Você ainda não possui profissionais vinculados.')
  })
})
