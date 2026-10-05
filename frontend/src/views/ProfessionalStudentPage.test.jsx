// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: 'pro-1' } }, repo: { clientSummaries: vi.fn().mockResolvedValue([{ studentUserId: 's1', displayName: 'Ana', programTitle: 'Força', versionNumber: 1 }]), clientDetail: vi.fn().mockResolvedValue({ studentUserId: 's1', displayName: 'Ana', assignments: [{ id: 'a1', program_title: 'Força', version_number: 1 }], executions: [{ id: 'e1', day_key: 'monday', status: 'completed' }] }), relationships: vi.fn().mockResolvedValue([{ id: 'r1', student_user_id: 's1', status: 'active' }]), programs: vi.fn().mockResolvedValue([]), versions: vi.fn().mockResolvedValue([]), revokeRelationship: vi.fn(), assignProgramVersion: vi.fn().mockResolvedValue({}), revokeAssignment: vi.fn().mockResolvedValue({}), version: vi.fn().mockResolvedValue(null) } }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
vi.mock('../components/AppHeader.jsx', () => ({ default: ({ title, action }) => <header><h1>{title}</h1>{action}</header> }))
import ProfessionalStudentPage from './ProfessionalStudentPage.jsx'

let dom, root, container
beforeEach(() => { vi.clearAllMocks(); mocks.auth.user = { id: 'pro-1' }; dom = new Window({ url: 'https://app.example/#/professional/students/s1' }); globalThis.window = dom; globalThis.document = dom.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('professional student detail', () => {
  it('opens a handoff in training, fetches only that program and assigns the selected version', async () => {
    mocks.repo.programs.mockResolvedValueOnce([{ id: 'p1', title: 'Força' }, { id: 'p2', title: 'Corrida' }])
    mocks.repo.versions.mockResolvedValueOnce([{ id: 'v1', program_id: 'p1', version_number: 1, weekly_plan: {} }])
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/students/s1?program=p1&version=v1']}><Routes><Route path="/professional/students/:studentId" element={<ProfessionalStudentPage />} /></Routes></MemoryRouter>))
    expect(container.textContent).toContain('Gerenciar treino')
    expect(mocks.repo.versions.mock.calls).toEqual([['p1']])
    expect(container.querySelector('select[aria-label="Versão do programa"]').value).toBe('v1')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Enviar versão').click())
    expect(mocks.repo.assignProgramVersion).toHaveBeenCalledWith({ programId: 'p1', versionId: 'v1', studentUserId: 's1' })
  })
  it('uses summary for an invalid section and does not fetch program versions', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/students/s1?section=invalid&program=p1&version=v1']}><Routes><Route path="/professional/students/:studentId" element={<ProfessionalStudentPage />} /></Routes></MemoryRouter>))
    expect(container.querySelector('nav[aria-label="Detalhe do aluno"] a[aria-current="page"]').textContent).toBe('Resumo')
    expect(mocks.repo.programs).not.toHaveBeenCalled()
    expect(mocks.repo.versions).not.toHaveBeenCalled()
  })
  it('does not show a late student response after switching account', async () => {
    let finishOld
    mocks.repo.clientDetail.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    const view = () => <MemoryRouter initialEntries={['/professional/students/s1']}><Routes><Route path="/professional/students/:studentId" element={<ProfessionalStudentPage />} /></Routes></MemoryRouter>
    await act(async () => root.render(view()))
    mocks.auth.user = { id: 'pro-2' }
    mocks.repo.clientSummaries.mockResolvedValueOnce([{ studentUserId: 's1', displayName: 'Nova pessoa' }])
    await act(async () => root.render(view()))
    await act(async () => finishOld({ displayName: 'Pessoa antiga', assignments: [], executions: [{ id: 'old', status: 'abandoned' }] }))
    expect(container.textContent).toContain('Nova pessoa')
    expect(container.textContent).not.toContain('Abandonado')
  })
  it('restores a history deep link and preserves handoff parameters in section links', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/students/s1?section=history&program=p1&version=v1']}><Routes><Route path="/professional/students/:studentId" element={<ProfessionalStudentPage />} /></Routes></MemoryRouter>))
    expect(container.textContent).toContain('Histórico de treinos')
    expect(container.querySelector('a[aria-current="page"][href*="section=history"]')).toBeTruthy()
    expect(container.querySelector('a[href*="section=training"]')?.getAttribute('href')).toContain('version=v1')
    expect(mocks.repo.versions).not.toHaveBeenCalled()
  })

  it('shows prescribed and actual loads, completed sets and unit for an execution', async () => {
    mocks.repo.clientDetail.mockResolvedValueOnce({ assignments: [], executions: [{ id: 'e', day_key: 'monday', status: 'completed', payload: { unit: 'kg', prescription: [{ id: 'bench', sets: 3, reps: 8, weight: 40, rest: 90 }], entries: [{ id: 'bench', target: { weight: 40 }, sets: [{ done: true, w: 35, r: 7 }, { done: false, w: 40, r: 8 }] }] } }] })
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/students/s1']}><Routes><Route path="/professional/students/:studentId" element={<ProfessionalStudentPage />} /></Routes></MemoryRouter>))
    await act(async () => [...container.querySelectorAll('a')].find(button => button.textContent === 'Histórico').click())
    expect(container.textContent).toContain('Prescrito')
    expect(container.textContent).toContain('Realizado')
    expect(container.textContent).toContain('35 kg')
    expect(container.textContent).toContain('40 kg')
    expect(container.textContent).toContain('1/2')
  })
  it('separates summary, training, history and relationship actions', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/students/s1']}><Routes><Route path="/professional/students/:studentId" element={<ProfessionalStudentPage />} /></Routes></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Ana')
    expect(container.textContent).toContain('Resumo')
    expect(container.textContent).toContain('Treino')
    expect(container.textContent).toContain('Histórico')
    expect(container.textContent).toContain('Vínculo')
  })
})
