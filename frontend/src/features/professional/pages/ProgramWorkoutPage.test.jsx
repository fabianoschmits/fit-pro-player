// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { useStore } from '../../../store/useStore.js'
import ProgramWorkoutPage from './ProgramWorkoutPage.jsx'
import ProgramWeekPage from './ProgramWeekPage.jsx'

const account = '11111111-1111-4111-8111-111111111111'
const repo = vi.hoisted(() => ({
  program: vi.fn(), versions: vi.fn(), version: vi.fn(),
  updateProgramMetadata: vi.fn(), publishProgramDraft: vi.fn(),
}))
const authState = vi.hoisted(() => ({
  user: { id: '11111111-1111-4111-8111-111111111111' }, status: 'authenticated',
}))
vi.mock('../../../auth/AuthProvider.jsx', () => ({ useAuth: () => authState }))
vi.mock('../../../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => repo }))
let node, root

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  authState.user = { id: account }
  authState.status = 'authenticated'
  vi.clearAllMocks()
  localStorage.clear()
  await useStore.getState().activateLocalScope(account)
  repo.program.mockResolvedValue({ id: 'p', title: 'Base', professional_user_id: account })
  repo.versions.mockResolvedValue([{
    id: 'v', program_id: 'p', version_number: 3,
    weekly_plan: { monday: [{ exerciseId: '9997', sets: 3, reps: 8, rest: 75, notes: 'Controle' }] },
    workout_titles: { monday: 'Força A' },
  }])
  repo.publishProgramDraft.mockReset()
  repo.updateProgramMetadata.mockResolvedValue({})
  node = document.createElement('div')
  document.body.append(node)
  root = createRoot(node)
})
afterEach(async () => {
  await act(async () => root.unmount())
  node.remove()
  vi.useRealTimers()
})
const render = async path => act(async () => root.render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/professional/programs/:programId/edit" element={<ProgramWeekPage />} />
      <Route path="/professional/programs/:programId/edit/:day" element={<ProgramWorkoutPage />} />
    </Routes>
  </MemoryRouter>,
))

it('day is compact with sheets and publication only on the seven-day summary', async () => {
  await render('/professional/programs/p/edit/monday')
  expect(node.querySelectorAll('.professional-prescription-row')).toHaveLength(1)
  expect(node.querySelector('input[type="number"]')).toBeNull()
  expect(node.textContent).not.toContain('Publicar nova versão')
  await act(async () => node.querySelector('.professional-prescription-edit').click())
  expect(document.querySelector('[role="dialog"]').textContent).toContain('Editar prescrição')
  await act(async () => document.querySelector('[role="dialog"] button[aria-label="Fechar"]').click())
  await act(async () => [...node.querySelectorAll('a')].find(a => a.textContent === 'Concluir treino').click())
  expect(node.querySelectorAll('.professional-workout-day')).toHaveLength(7)
  expect(node.querySelector('.professional-workout-day').textContent).toBe('Segunda-feira')
  expect(node.textContent).toContain('Força A')
})

it('failed_publish_keeps_entire_week', async () => {
  repo.publishProgramDraft.mockRejectedValue(new Error('offline'))
  await render('/professional/programs/p/edit')
  await act(async () => [...node.querySelectorAll('button')].find(b => b.textContent === 'Publicar nova versão').click())
  expect(document.querySelector('[role="dialog"]')).toBeTruthy()
  await act(async () => [...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent === 'Publicar semana').click())
  await act(async () => {})
  expect(node.textContent).toContain('rascunho')
  expect(useStore.getState().S.professionalProgramDrafts[`${account}:p`].weeklyPlan.monday[0].notes).toBe('Controle')
  expect(repo.publishProgramDraft).toHaveBeenCalledWith(expect.objectContaining({
    programId: 'p', workoutTitles: { monday: 'Força A' },
  }))
})

it('invalid day has safe back and never creates a draft', async () => {
  await render('/professional/programs/p/edit/noday')
  expect(node.textContent).toContain('Treino não encontrado')
  expect(node.querySelector('button')?.textContent).not.toBe('Adicionar exercício')
  expect(useStore.getState().S.professionalProgramDrafts).toEqual({})
})

it('explicit historical version cannot silently seed latest editor', async () => {
  repo.version.mockResolvedValue(null)
  await render('/professional/programs/p/edit?version=missing')
  expect(node.textContent).toContain('Versão não encontrada')
  expect(repo.version).toHaveBeenCalledWith('missing')
  expect(useStore.getState().S.professionalProgramDrafts).toEqual({})
})

it('initial dynamic read shows skeleton and auth initialization stops after 12s', async () => {
  vi.useFakeTimers()
  authState.status = 'initializing'
  await render('/professional/programs/p/edit')
  expect(node.querySelector('.professional-skeleton')).toBeTruthy()
  expect(repo.program).not.toHaveBeenCalled()
  await act(async () => vi.advanceTimersByTime(12000))
  expect(node.textContent).toContain('Não foi possível confirmar sua sessão')
  expect(node.querySelector('.professional-skeleton')).toBeNull()
})

it('account switch during metadata request prevents subsequent publish and local clearing', async () => {
  let resolve
  repo.updateProgramMetadata.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  await render('/professional/programs/p/edit')
  await act(async () => [...node.querySelectorAll('button')].find(b => b.textContent === 'Publicar nova versão').click())
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Publicar semana').click())
  const next = '22222222-2222-4222-8222-222222222222'
  authState.user = { id: next }
  await act(async () => useStore.getState().activateLocalScope(next))
  await render('/professional/programs/p/edit')
  await act(async () => resolve({}))
  expect(repo.publishProgramDraft).not.toHaveBeenCalled()
  expect(useStore.getState().S.professionalProgramDrafts).toEqual({})
  await act(async () => useStore.getState().activateLocalScope(account))
  expect(useStore.getState().S.professionalProgramDrafts[`${account}:p`].weeklyPlan.monday[0].notes).toBe('Controle')
})

it('publication timeout invalidates metadata continuation and keeps draft', async () => {
  vi.useFakeTimers()
  let resolve
  repo.updateProgramMetadata.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  await render('/professional/programs/p/edit')
  await act(async () => [...node.querySelectorAll('button')].find(b => b.textContent === 'Publicar nova versão').click())
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Publicar semana').click())
  await act(async () => vi.advanceTimersByTime(10000))
  expect(node.textContent).toContain('rascunho')
  await act(async () => resolve({}))
  expect(repo.publishProgramDraft).not.toHaveBeenCalled()
  expect(useStore.getState().S.professionalProgramDrafts[`${account}:p`]).toBeTruthy()
})

it('fresh historical week keeps exact version and provenance through day and return', async () => {
  const search = '?version=old&material=x%20y&student=student&section=training&code=A%2BB'
  repo.version.mockResolvedValue({
    id: 'old', program_id: 'p', version_number: 1,
    weekly_plan: { monday: [{ exerciseId: '9998', sets: 2, reps: 12, notes: 'Histórico exato' }] },
    workout_titles: { monday: 'Treino histórico' },
  })
  await render(`/professional/programs/p/edit${search}`)
  expect(useStore.getState().S.professionalProgramDrafts).toEqual({})
  const link = node.querySelector('.professional-compact-list a')
  expect(link.getAttribute('href')).toBe(`/professional/programs/p/edit/monday${search}`)
  await act(async () => link.click())
  expect(node.textContent).toContain('Histórico exato')
  expect(node.textContent).not.toContain('Controle')
  const done = [...node.querySelectorAll('a')].find(a => a.textContent === 'Concluir treino')
  expect(done.getAttribute('href')).toBe(`/professional/programs/p/edit${search}`)
  await act(async () => done.click())
  expect(node.textContent).toContain('Treino histórico')
  expect(repo.versions).not.toHaveBeenCalled()
  expect(repo.version.mock.calls.every(([id]) => id === 'old')).toBe(true)
  expect(useStore.getState().S.professionalProgramDrafts).toEqual({})
})

it.each(['timeout', 'account', 'auth_initializing'])('staged loader stops after canceled first read: %s', async cause => {
  vi.useFakeTimers()
  let resolve
  repo.program.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  await render('/professional/programs/p/edit?version=old')
  if (cause === 'timeout') await act(async () => vi.advanceTimersByTime(10000))
  else {
    if (cause === 'account') {
      const next = '22222222-2222-4222-8222-222222222222'
      authState.user = { id: next }
      await act(async () => useStore.getState().activateLocalScope(next))
    } else authState.status = 'initializing'
    await render('/professional/programs/p/edit?version=old')
  }
  await act(async () => resolve({ id: 'p', title: 'Base', professional_user_id: account }))
  expect(repo.version).not.toHaveBeenCalled()
  expect(repo.versions).not.toHaveBeenCalled()
})
