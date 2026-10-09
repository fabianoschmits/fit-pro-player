// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { useStore } from '../../../store/useStore.js'
import ProgramAssignPage from './ProgramAssignPage.jsx'
const account = '11111111-1111-4111-8111-111111111111'
const auth = vi.hoisted(() => ({ user: { id: '11111111-1111-4111-8111-111111111111' }, status: 'authenticated' }))
const repo = vi.hoisted(() => ({ program: vi.fn(), version: vi.fn(), versions: vi.fn(), studentPage: vi.fn(), assignProgramVersion: vi.fn() }))
vi.mock('../../../auth/AuthProvider.jsx', () => ({ useAuth: () => auth }))
vi.mock('../../../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => repo }))
let root, node
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); localStorage.clear(); auth.user = { id: account }; auth.status = 'authenticated'; await useStore.getState().activateLocalScope(account)
  repo.program.mockResolvedValue({ id: 'p', professional_user_id: account, title: 'Força' })
  repo.version.mockResolvedValue({ id: 'old', program_id: 'p', version_number: 1, weekly_plan: { monday: [{ exerciseId: '9997', sets: 3, reps: 8 }] }, workout_titles: { monday: 'Força A' } })
  repo.studentPage.mockImplementation(async ({ offset }) => ({ items: offset === 0 ? [{ studentUserId: 'first', displayName: 'Ana' }] : [{ studentUserId: 'last', displayName: 'Último aluno', currentProgram: { title: 'Anterior', versionNumber: 8 } }], total: 601, offset, hasMore: offset === 0 }))
  repo.assignProgramVersion.mockResolvedValue({ id: 'assignment' }); node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.useRealTimers() })
const render = async () => act(async () => root.render(<MemoryRouter initialEntries={['/professional/programs/p/assign?version=old&material=source']}><Routes><Route path="/professional/programs/:programId/assign" element={<ProgramAssignPage />} /></Routes></MemoryRouter>))
const click = async label => act(async () => [...node.querySelectorAll('button')].find(button => button.textContent === label).click())
it('assign_requires_review_and_exact_version', async () => {
  await render(); await click('Carregar mais'); await click('Último alunoAnterior')
  expect(node.textContent).toContain('601'); expect(repo.assignProgramVersion).not.toHaveBeenCalled(); await click('Revisar envio')
  expect(node.textContent).toContain('Versão 1'); expect(node.textContent).toContain('qualquer profissional'); expect(node.textContent).toContain('Último aluno'); expect(node.textContent).toContain('Força A')
  await click('Enviar para aluno'); expect(repo.assignProgramVersion).toHaveBeenCalledWith({ programId: 'p', versionId: 'old', studentUserId: 'last' }); expect(node.textContent).toContain('Programa enviado'); expect(repo.versions).not.toHaveBeenCalled()
})
it('missing chosen version cannot assign', async () => {
  repo.version.mockResolvedValue(null); await render(); expect(node.textContent).toContain('Versão não encontrada'); expect(repo.studentPage).not.toHaveBeenCalled(); expect(node.textContent).not.toContain('Enviar para aluno')
})
it('account switch during send refuses local success', async () => {
  let finish; repo.assignProgramVersion.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await render(); await click('AnaSem programa ativo'); await click('Revisar envio'); await click('Enviar para aluno')
  auth.user = null; await act(async () => root.render(<MemoryRouter><ProgramAssignPage /></MemoryRouter>)); await act(async () => finish({ id: 'assignment' }))
  expect(node.textContent).not.toContain('Programa enviado'); expect(node.textContent).toContain('Entre na sua conta')
})
it('send timeout permits retry of the exact version and ignores late success', async () => {
  let finish
  repo.assignProgramVersion.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await render(); await click('AnaSem programa ativo'); await click('Revisar envio')
  vi.useFakeTimers(); await click('Enviar para aluno')
  await act(async () => vi.advanceTimersByTimeAsync(10000))
  expect(node.textContent).toContain('Não foi possível enviar esta versão')
  await act(async () => finish({ id: 'late' }))
  expect(node.textContent).not.toContain('Programa enviado')
  await click('Enviar para aluno')
  expect(repo.assignProgramVersion).toHaveBeenLastCalledWith({ programId: 'p', versionId: 'old', studentUserId: 'first' })
  expect(node.textContent).toContain('Programa enviado')
})
