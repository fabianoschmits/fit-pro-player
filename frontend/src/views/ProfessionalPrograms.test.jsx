// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import ProfessionalPrograms from './ProfessionalPrograms.jsx'
import ProgramWeekPage from '../features/professional/pages/ProgramWeekPage.jsx'
import ProgramWorkoutPage from '../features/professional/pages/ProgramWorkoutPage.jsx'
import ProgramVersionsPage from '../features/professional/pages/ProgramVersionsPage.jsx'
const account = '11111111-1111-4111-8111-111111111111'
const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: '11111111-1111-4111-8111-111111111111' } }, repo: {
  programPage: vi.fn(), program: vi.fn(), versions: vi.fn(), version: vi.fn(), createProgram: vi.fn(), updateProgramMetadata: vi.fn(), updateProgram: vi.fn(), duplicateProgram: vi.fn(), assignProgramVersion: vi.fn(), publishProgramDraft: vi.fn(),
} }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
let root, node
const render = async (path = '/professional/programs') => act(async () => root.render(<MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/professional/programs" element={<ProfessionalPrograms />} /><Route path="/professional/programs/new" element={<ProfessionalPrograms />} /><Route path="/professional/programs/:programId" element={<ProfessionalPrograms />} />
  <Route path="/professional/programs/:programId/versions" element={<ProgramVersionsPage />} /><Route path="/professional/programs/:programId/versions/:versionId" element={<ProfessionalPrograms />} />
  <Route path="/professional/programs/:programId/edit" element={<ProgramWeekPage />} /><Route path="/professional/programs/:programId/edit/:day" element={<ProgramWorkoutPage />} /><Route path="/professional/programs/:programId/workouts/:day" element={<ProgramWorkoutPage readOnly />} />
</Routes></MemoryRouter>))
const click = async label => act(async () => [...document.querySelectorAll('button,a')].find(button => button.textContent === label).click())
const finishMenu = async () => act(async () => { if (!document.querySelector('[role="dialog"]')) window.dispatchEvent(new PopStateEvent('popstate')) })
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); localStorage.clear()
  mocks.auth.status = 'authenticated'; mocks.auth.user = { id: account }; await useStore.getState().activateLocalScope(account)
  mocks.repo.programPage.mockImplementation(async ({ archived = false, offset = 0 }) => ({ items: [{ id: archived ? 'archived' : 'p', title: archived ? 'Antigo' : 'Força', objective: 'Ganhar força', workoutCount: 4, studentCount: 603, lastChangedAt: '2026-10-08', archived }], total: 603, offset, hasMore: offset === 0 }))
  mocks.repo.program.mockImplementation(async id => ({ id, title: id === 'copy' ? 'Cópia' : 'Força', professional_user_id: account, archived: id === 'archived' }))
  mocks.repo.versions.mockResolvedValue([{ id: 'v', program_id: 'p', version_number: 2, workout_titles: { monday: 'Força A' }, weekly_plan: { monday: [{ exerciseId: '9997', sets: 3, reps: 8, notes: 'Original' }] } }])
  mocks.repo.updateProgram.mockResolvedValue({}); mocks.repo.updateProgramMetadata.mockResolvedValue({})
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
})
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.useRealTimers() })
it('filters_and_return_preserve_search', async () => {
  await render('/professional/programs?q=For%C3%A7a')
  expect(node.querySelector('input[type="search"]').value).toBe('Força'); expect(node.textContent).toContain('603'); expect(node.textContent).toContain('4 treinos'); expect(node.textContent).toContain('Ganhar força'); expect(node.textContent).toContain('Última alteração')
  await act(async () => node.querySelector('a[href^="/professional/programs/p"]').click())
  await act(async () => node.querySelector('.app-header-back').click())
  expect(node.querySelector('input[type="search"]').value).toBe('Força'); await click('Arquivados')
  expect(node.textContent).toContain('Antigo'); expect(mocks.repo.programPage).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Força', archived: true, offset: 0 }))
})
it('pagination_keeps_global_total_and_fetches_next_offset', async () => {
  await render(); await click('Carregar mais'); expect(mocks.repo.programPage).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1 })); expect(node.querySelectorAll('.professional-compact-list li')).toHaveLength(1); expect(node.textContent).toContain('603')
})
it('creates metadata then opens actual local draft without publishing or assigning', async () => {
  mocks.repo.createProgram.mockResolvedValue({ id: 'p' }); await render('/professional/programs/new')
  const set = async (label, value) => act(async () => { const input = node.querySelector(`[aria-label="${label}"]`); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })) })
  await set('Nome do programa', 'Força'); await set('Objetivo', 'Ganhar força')
  await act(async () => node.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  expect(mocks.repo.updateProgramMetadata).toHaveBeenCalledWith({ programId: 'p', title: 'Força', description: '', objective: 'Ganhar força' }); expect(node.textContent).toContain('Montar semana'); expect(mocks.repo.publishProgramDraft).not.toHaveBeenCalled(); expect(mocks.repo.assignProgramVersion).not.toHaveBeenCalled()
})
it('published_week_is_read_only', async () => {
  await render('/professional/programs/p?material=original'); expect(node.querySelectorAll('.professional-workout-day')).toHaveLength(7)
  await act(async () => node.querySelector('a[href="/professional/programs/p/workouts/monday?material=original"]').click())
  expect(node.textContent).toContain('Original'); expect(node.textContent).not.toContain('Adicionar exercício'); expect(node.textContent).not.toContain('Publicar nova versão'); expect(useStore.getState().S.professionalProgramDrafts).toEqual({}); expect(mocks.repo.assignProgramVersion).not.toHaveBeenCalled()
})
it('legacy program and version query resolves exact identity without capped library or mutation', async () => {
  mocks.repo.version.mockResolvedValue({ id: 'old', program_id: 'beyond-500', version_number: 1, weekly_plan: {}, workout_titles: { monday: 'Antigo exato' } })
  await render('/professional/programs?program=beyond-500&version=old&material=source')
  expect(node.textContent).toContain('Antigo exato')
  expect(mocks.repo.program).toHaveBeenCalledWith('beyond-500')
  expect(mocks.repo.version).toHaveBeenCalledWith('old')
  expect(mocks.repo.programPage).not.toHaveBeenCalled()
  expect(mocks.repo.versions).not.toHaveBeenCalled()
  expect(useStore.getState().S.professionalProgramDrafts).toEqual({})
})
it('legacy alias back reaches the canonical library without redirecting again', async () => {
  mocks.repo.version.mockResolvedValue({ id: 'old', program_id: 'beyond-500', version_number: 1, weekly_plan: {}, workout_titles: { monday: 'Antigo exato' } })
  await render('/professional/programs?program=beyond-500&version=old&material=source')
  await act(async () => node.querySelector('.app-header-back').click())
  expect(node.textContent).toContain('Versões publicadas')
  await act(async () => node.querySelector('.app-header-back').click())
  expect(node.textContent).toContain('Antigo exato')
  await act(async () => node.querySelector('.app-header-back').click())
  expect(node.querySelector('input[type="search"]')).toBeTruthy()
  expect(mocks.repo.programPage).toHaveBeenCalled()
})
it('actual editor cancels back to published week and preserves exact source', async () => {
  await render('/professional/programs/p/edit?material=source')
  expect(node.textContent).toContain('Montar semana')
  await click('Cancelar')
  expect(node.querySelectorAll('.professional-workout-day')).toHaveLength(7)
  expect(node.querySelector('a[href="/professional/programs/p/workouts/monday?material=source"]')).toBeTruthy()
  expect(node.textContent).toContain('Versão 2')
  expect(node.textContent).not.toContain('Publicar nova versão')
})
it('duplicate_selected_version_is_independent', async () => {
  mocks.repo.version.mockResolvedValue({ id: 'old', program_id: 'p', version_number: 1, weekly_plan: {} }); mocks.repo.duplicateProgram.mockResolvedValue({ program: { id: 'copy' }, version: { id: 'copy-v' } })
  await render('/professional/programs/p?version=old'); await act(async () => node.querySelector('[aria-label="Ações do programa"]').click()); await click('Duplicar'); await finishMenu(); expect(mocks.repo.duplicateProgram).not.toHaveBeenCalled()
  await click('Duplicar programa'); expect(mocks.repo.duplicateProgram).toHaveBeenCalledWith({ programId: 'p', versionId: 'old', title: 'Força — cópia' }); await finishMenu(); expect(node.textContent).toContain('Cópia'); expect(mocks.repo.assignProgramVersion).not.toHaveBeenCalled()
})
it('archive_confirms_and_restore_does_not_reactivate', async () => {
  await render('/professional/programs/p'); await act(async () => node.querySelector('[aria-label="Ações do programa"]').click()); await click('Arquivar'); await finishMenu()
  expect(mocks.repo.updateProgram).not.toHaveBeenCalled(); expect(document.body.textContent).toContain('encerra as atribuições ativas')
  mocks.repo.program.mockResolvedValue({ id: 'p', title: 'Força', professional_user_id: account, archived: true }); await click('Confirmar arquivo'); await finishMenu()
  expect(mocks.repo.updateProgram).toHaveBeenCalledWith('p', { title: 'Força', description: '', archived: true })
  await act(async () => node.querySelector('[aria-label="Ações do programa"]').click()); await click('Restaurar'); await finishMenu()
  expect(mocks.repo.updateProgram).toHaveBeenLastCalledWith('p', { title: 'Força', description: '', archived: false }); expect(mocks.repo.assignProgramVersion).not.toHaveBeenCalled()
})
it('no account is idle and initializing auth stops after 12s', async () => {
  mocks.auth.user = null; await render(); expect(node.textContent).toContain('Entre na sua conta'); expect(node.querySelector('.professional-skeleton')).toBeNull()
  mocks.auth.status = 'initializing'; vi.useFakeTimers(); await act(async () => root.render(<MemoryRouter><ProfessionalPrograms /></MemoryRouter>)); await act(async () => vi.advanceTimersByTimeAsync(12000)); expect(node.textContent).toContain('Não foi possível confirmar sua sessão'); expect(mocks.repo.programPage).not.toHaveBeenCalled()
})
