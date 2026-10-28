// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: {}, repo: { studentProfessionals: vi.fn(), assignments: vi.fn(), assignedPrograms: vi.fn(), studentOverview: vi.fn(), version: vi.fn() }, replace: vi.fn(), start: vi.fn(), state: {} }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
vi.mock('../store/useStore.js', () => ({ useStore: Object.assign(selector => selector({ ready: true }), { getState: () => ({ S: mocks.state, replaceState: mocks.replace, invalidateAssignedProgramReads: () => {}, getAssignedProgramReadToken: () => ({ scope: { kind: 'account', userId: mocks.auth.user?.id } }), isAssignedProgramReadCurrent: () => true }) }) }))
vi.mock('../sheets.jsx', () => ({ startFlow: (...args) => mocks.start(...args) }))
import StudentProfessionals from './StudentProfessionals.jsx'
let root, container
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); mocks.auth = { status: 'authenticated', user: { id: 's1' } }; mocks.state = { routines: [] }; mocks.repo.studentProfessionals.mockResolvedValue([]); mocks.repo.assignments.mockResolvedValue([]); mocks.repo.assignedPrograms.mockResolvedValue([]); mocks.repo.studentOverview.mockResolvedValue({}); container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
const render = async (path = '/student/professionals') => act(async () => root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/student/professionals" element={<StudentProfessionals />} /><Route path="/student/professionals/add" element={<p>Add destination</p>} /></Routes></MemoryRouter>))
it('names each linked professional and gives separate add and materials links', async () => { mocks.repo.studentProfessionals.mockResolvedValue([{ professionalId: 'p1', professionalName: 'Ana Silva', activeProgramTitle: 'Força' }, { professionalId: 'p2', professionalName: 'João Reis', activeProgramTitle: 'Corrida' }]); await render(); expect(container.textContent).toContain('Ana Silva'); expect(container.textContent).toContain('João Reis'); expect(container.querySelector('a[href="/student/professionals/p2"]').textContent).toContain('João Reis'); expect(container.querySelector('input')).toBeNull() })
it('shows an actionable empty state', async () => { await render(); expect(container.textContent).toContain('Você ainda não possui profissionais vinculados.'); expect(container.querySelector('a[href="/student/professionals/add"]')).not.toBeNull() })
it('preserves a code-bearing entry in the add destination', async () => { await render('/student/professionals?code=AB12'); expect(container.textContent).toContain('Add destination'); expect(mocks.repo.studentProfessionals).not.toHaveBeenCalled() })
it('shows an error and retries the summary request', async () => { mocks.repo.studentProfessionals.mockRejectedValueOnce(new Error('offline')); await render(); expect(container.querySelector('[role="alert"]').textContent).toContain('Não foi possível carregar seus profissionais.'); await act(async () => [...container.querySelectorAll('button')].find(x => x.textContent === 'Tentar novamente').click()); expect(mocks.repo.studentProfessionals).toHaveBeenCalledTimes(2) })
it('renders loading and discards an earlier account response and synchronization', async () => { let resolve; mocks.repo.studentProfessionals.mockReturnValueOnce(new Promise(r => { resolve = r })); await render(); expect(container.querySelector('[role="status"][aria-busy="true"]')?.getAttribute('aria-label')).toBe('Carregando…'); mocks.auth = { status: 'authenticated', user: { id: 's2' } }; await render(); await act(async () => resolve([{ professionalId: 'p1', professionalName: 'Wrong account' }])); expect(container.textContent).not.toContain('Wrong account'); expect(mocks.replace).not.toHaveBeenCalled() })
it('does not leave anonymous or stalled authentication loading', async () => { mocks.auth = { status: 'anonymous', user: null }; await render(); expect(container.textContent).toContain('Entre na sua conta para acessar seus profissionais.'); expect(mocks.repo.studentProfessionals).not.toHaveBeenCalled(); mocks.auth = { status: 'initializing', user: null }; const timer = vi.spyOn(window, 'setTimeout').mockImplementation(fn => { fn(); return 1 }); await render(); expect(container.textContent).toContain('Não foi possível confirmar sua sessão. Tente novamente.'); timer.mockRestore() })
it('does not change the selected plan or load prescriptions when listing professionals', async () => {
 mocks.repo.studentProfessionals.mockResolvedValue([{ professionalId:'p1', professionalName:'Ana Silva' }])
 mocks.state = { assignedProgram: { assignmentId:'selected' }, routines:[{id:'personal'}] }
 await render()
 expect(mocks.replace).not.toHaveBeenCalled()
 expect(mocks.repo.assignedPrograms).not.toHaveBeenCalled()
 expect(mocks.repo.version).not.toHaveBeenCalled()
 expect(container.querySelector('a[href="/plan"]')).not.toBeNull()
})
