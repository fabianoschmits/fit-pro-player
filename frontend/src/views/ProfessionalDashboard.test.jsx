// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: { status: 'authenticated', user: { id: 'professional-1' } },
  repo: {
    dashboardSummary: vi.fn().mockResolvedValue({ activeStudents: 1, attentionStudents: 0, todayWorkouts: 0, activePrograms: 0, pendingInvites: 0, today: [], recentActivity: [] }),
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
    mocks.repo.dashboardSummary.mockResolvedValueOnce({ activeStudents: 1, attentionStudents: 0, todayWorkouts: 0, activePrograms: 0, pendingInvites: 0, today: [], recentActivity: [{ id: 'e1', dayKey: 'monday', status: 'completed', startedAt: '2026-10-09' }] })
    await act(async () => root.render(<MemoryRouter><ProfessionalDashboard /></MemoryRouter>))
    expect(container.textContent).toContain('monday')
    expect(container.textContent).not.toContain('Ana')
  })
  it('ignores a pending role lookup after switching accounts', async () => {
    let finishOld
    mocks.repo.dashboardSummary.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    const view = () => <MemoryRouter><ProfessionalDashboard /></MemoryRouter>
    await act(async () => root.render(view()))
    mocks.auth.user = { id: 'professional-2' }; mocks.repo.dashboardSummary.mockResolvedValueOnce({ activeStudents: 0, attentionStudents: 0, todayWorkouts: 0, activePrograms: 0, pendingInvites: 0, today: [], recentActivity: [] })
    await act(async () => root.render(view()))
    await act(async () => finishOld({ activeStudents: 99, attentionStudents: 99, todayWorkouts: 0, activePrograms: 0, pendingInvites: 0, today: [], recentActivity: [] }))
    expect(container.textContent).not.toContain('99')
  })
  it('shows a focused overview and links to the dedicated client workspace', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional']}><ProfessionalDashboard /></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Alunos')
    expect(container.querySelector('.professional-metrics dd').textContent).toBe('1')
    expect(container.textContent).toContain('Convites')
    expect(container.querySelector('a[href="/professional/students"]')).toBeTruthy()
  })
  it('shows reasons for attention and excludes a recently completed student', async () => {
    mocks.repo.dashboardSummary.mockResolvedValueOnce({ activeStudents: 2, attentionStudents: 1, todayWorkouts: 1, activePrograms: 1, pendingInvites: 0, today: [{ studentUserId: 'missing', displayName: 'Sem plano', attentionReasons: ['without_program'] }], recentActivity: [] })
    await act(async () => root.render(<MemoryRouter><ProfessionalDashboard /></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Sem plano')
    expect(container.textContent).not.toContain('Recente')
  })
})
