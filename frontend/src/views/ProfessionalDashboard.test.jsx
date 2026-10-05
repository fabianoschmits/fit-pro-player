// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { status: 'authenticated', user: { id: 'professional-1' } },
  repo: {
    professionalRole: vi.fn().mockResolvedValue(true),
    clientSummaries: vi.fn().mockResolvedValue([{ studentUserId: 'student-1', displayName: 'Ana', programTitle: 'Força' }]),
    clientDetail: vi.fn().mockResolvedValue({ assignments: [], executions: [] }),
    invites: vi.fn().mockResolvedValue([]), programs: vi.fn().mockResolvedValue([]), assignments: vi.fn().mockResolvedValue([]), executions: vi.fn().mockResolvedValue([]),
  },
  navigate: vi.fn(),
}))

vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
vi.mock('../components/AppHeader.jsx', () => ({ default: ({ title, action }) => <header><h1>{title}</h1>{action}</header> }))

import ProfessionalDashboard from './ProfessionalDashboard.jsx'

let dom
let root
let container

beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.user = { id: 'professional-1' }
  dom = new Window({ url: 'https://app.example/#/professional' })
  globalThis.window = dom; globalThis.document = dom.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('professional dashboard', () => {
  it('does not attribute unidentified activity to an arbitrary student', async () => {
    mocks.repo.executions.mockResolvedValueOnce([{ id: 'e1', day_key: 'monday', status: 'completed' }])
    await act(async () => root.render(<MemoryRouter><ProfessionalDashboard /></MemoryRouter>))
    expect(container.querySelector('.management-activity-list').textContent).toContain('Segunda')
    expect(container.querySelector('.management-activity-list').textContent).not.toContain('Ana')
    expect(container.querySelector('.management-activity-list a')).toBeNull()
  })
  it('ignores a pending role lookup after switching accounts', async () => {
    let finishOld
    mocks.repo.professionalRole.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    const view = () => <MemoryRouter><ProfessionalDashboard /></MemoryRouter>
    await act(async () => root.render(view()))
    mocks.auth.user = { id: 'professional-2' }; mocks.repo.professionalRole.mockResolvedValueOnce(false)
    await act(async () => root.render(view()))
    await act(async () => finishOld(true))
    expect(container.textContent).toContain('apenas para contas profissionais')
    expect(mocks.repo.clientSummaries).not.toHaveBeenCalled()
  })
  it('shows a focused overview and links to the dedicated client workspace', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional']}><ProfessionalDashboard /></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Alunos')
    expect(container.textContent).toContain('Nenhuma pendência identificada')
    expect(container.textContent).toContain('Convites')
    expect(container.querySelector('a[href="/professional/students"]')).toBeTruthy()
  })
  it('shows reasons for attention and excludes a recently completed student', async () => {
    mocks.repo.clientSummaries.mockResolvedValueOnce([{ studentUserId: 'recent', displayName: 'Recente', programTitle: 'Força', lastExecutionStatus: 'completed', lastExecutionAt: new Date().toISOString() }, { studentUserId: 'missing', displayName: 'Sem plano' }])
    await act(async () => root.render(<MemoryRouter><ProfessionalDashboard /></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Sem programa ativo')
    expect(container.textContent).not.toContain('Recente')
  })
})
