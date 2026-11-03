// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEF, normalizeState, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import Plan from './Plan.jsx'
const mocks = vi.hoisted(() => ({ search: '', navigate: vi.fn(), repo: { planLibrary: vi.fn(), savePersonalPlan: vi.fn(), applyLibraryPlan: vi.fn() } }))
const userId = '11111111-1111-4111-8111-111111111111'
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useLocation: () => ({ search: mocks.search }) }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => ({ status: 'authenticated', user: { id: '11111111-1111-4111-8111-111111111111' } }) }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
const profile = { name: 'Aluno', birthDate: '1990-01-01', sex: 'male', heightCm: 180, startWeight: 80, goal: 'build_muscle', experience: 'beginner', completedAt: '2026-11-01' }
const self = { id: 'self', source_type: 'self', title: 'Meu plano', personal_plan: { mode: 'weekly', schedule: { week: { 2: 'personal' }, dayPlan: {} }, routines: [{ id: 'deleted', title: 'Deleted snapshot', prescription: { ex: [] } }] } }
const pro = { id: 'pro', source_type: 'professional', available: true, professional_name: 'Ana', version: { id: 'v1', weekly_plan: { monday: [{ exerciseId: '0043', sets: 3, reps: 10 }] }, workout_titles: { monday: 'Professional Monday' } } }
const personal = { id: 'personal', name: 'Live personal Tuesday', ex: [] }
const assigned = { id: 'assigned', name: 'Professional Monday', assigned: true, programVersionId: 'v1', ex: [{ id: '0043', sets: 3, reps: 10 }] }
function Sheets() { return useUI(s => s.sheets).map(sheet => <div key={sheet.id} data-modal>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>) }
let root, container
const button = label => [...container.querySelectorAll('button')].find(item => item.textContent === label)
const click = async label => { expect(button(label), label).toBeDefined(); await act(async () => button(label).click()) }
const render = async () => act(async () => root.render(<><Plan /><Sheets /></>))
const activeCalendar = () => container.querySelector('.training-plan-workspace')
const response = (professional, revision) => ({ routines: (professional ? [assigned, personal] : [personal]).map((r, position) => ({ id: r.id, user_id: userId, title: r.name, position, revision, created_at: '2026-11-02', updated_at: '2026-11-02', prescription: Object.fromEntries(Object.entries(r).filter(([key]) => !['id', 'name'].includes(key))) })), schedule: { user_id: userId, revision, updated_at: '2026-11-02', mode: 'weekly', schedule: { week: professional ? { 1: 'assigned' } : { 2: 'personal' }, dayPlan: {}, libraryId: professional ? 'pro' : 'self', libraryTitle: professional ? 'Força profissional' : 'Meu plano', ...(professional ? { assignedProgram: { versionId: 'v1', programId: 'program' } } : {}) } } })
beforeEach(async () => {
 globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); localStorage.clear(); mocks.search = ''
 await useStore.getState().activateLocalScope(userId)
 useStore.setState({ S: normalizeState({ ...structuredClone(DEF), profile, onboardingDone: true, planServerRevision: 2, activeLibraryId: 'pro', activeLibraryTitle: 'Força profissional', assignedProgram: { versionId: 'v1', programId: 'program' }, routines: [assigned, personal], week: { 1: 'assigned' } }) })
 useUI.setState({ sheets: [] }); mocks.repo.planLibrary.mockImplementation(async () => ({ items: structuredClone([self, pro]), total: 2 })); mocks.repo.savePersonalPlan.mockResolvedValue('self')
 mocks.repo.applyLibraryPlan.mockImplementation(async id => response(id === 'pro', useStore.getState().S.planServerRevision + 1))
 container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); useStore.getState().releaseAccountSync() })
it('confirms removal from the calendar by applying the entire personal week, not deleting a single day', async () => {
 mocks.repo.planLibrary.mockResolvedValue({items:[self,{...pro,workout_updates:{monday:'v1'},plan_update:{next_version:pro.version}}],total:2})
 await render(); const before = useStore.getState().S
 await act(async () => activeCalendar().querySelector('.plan-day.on').click())
 expect(container.textContent).toContain('Retirar plano profissional?')
 expect(useStore.getState().S).toBe(before); expect(mocks.repo.applyLibraryPlan).not.toHaveBeenCalled()
 await click('Cancelar'); expect(useStore.getState().S).toBe(before)
 await act(async () => activeCalendar().querySelector('.plan-day.on').click())
 await click('Aplicar meus treinos')
 expect(mocks.repo.applyLibraryPlan.mock.calls).toEqual([['self', 2]])
 expect(useStore.getState().S).toMatchObject({ week: { 2: 'personal' }, assignedProgram: null, activeLibraryId: 'self' })
 expect(useUI.getState().sheets).toHaveLength(0)
 expect(button('Meus treinos').getAttribute('aria-pressed')).toBe('true')
 expect(activeCalendar().textContent).not.toContain('Professional Monday')
 await click('Treino do profissional'); await click('Usar este plano'); await click('Aplicar plano')
 expect(activeCalendar().textContent).toContain('Professional Monday')
})
it('opens the personal preview after returning from editing while keeping the professional active', async () => {
 mocks.search = '?library=self'
 await render()
 expect(button('Meus treinos').getAttribute('aria-pressed')).toBe('true')
 expect(container.querySelector('.created-workouts')).not.toBeNull()
 expect(activeCalendar().textContent).toContain('Professional Monday')
 expect(mocks.repo.applyLibraryPlan).not.toHaveBeenCalled()
})
it('changes chooser preview without changing active header, calendar, revision or application', async () => {
 await render(); const before = useStore.getState().S
 await click('Meus treinos')
 expect(container.querySelector('.personal-plan-preview').textContent).toContain('Live personal Tuesday')
 expect(container.querySelector('.personal-plan-preview').textContent).not.toContain('Professional Monday')
 expect(container.querySelector('.personal-plan-preview').textContent).not.toContain('Deleted snapshot')
 expect(activeCalendar().textContent).toContain('Professional Monday')
 expect(container.textContent).toContain('Força profissional')
 await click('Treino do profissional')
 expect(useStore.getState().S).toBe(before); expect(mocks.repo.applyLibraryPlan).not.toHaveBeenCalled(); expect(mocks.repo.savePersonalPlan).not.toHaveBeenCalled()
})
it('confirms both directions, immediately updates active calendar/header, preserves chooser and survives remount', async () => {
 await render(); await click('Meus treinos'); await click('Usar meus treinos'); await click('Aplicar meus treinos')
 expect(useUI.getState().sheets).toHaveLength(0)
 expect(useStore.getState().S).toMatchObject({ activeLibraryId: 'self', assignedProgram: null, planServerRevision: 3 })
 expect(activeCalendar().textContent).toContain('Live personal Tuesday'); expect(activeCalendar().textContent).not.toContain('Professional Monday')
 expect(container.textContent).toContain('Seu plano semanal'); expect(button('Meus treinos').getAttribute('aria-pressed')).toBe('true')
 await act(async () => root.unmount()); root = createRoot(container); await render()
 expect(activeCalendar().textContent).toContain('Live personal Tuesday'); expect(container.textContent).toContain('Seu plano semanal')
 expect(button('Meus treinos').getAttribute('aria-pressed')).toBe('true')
 await click('Treino do profissional'); await click('Usar este plano'); await click('Aplicar plano')
 expect(useUI.getState().sheets).toHaveLength(0)
 expect(activeCalendar().textContent).toContain('Professional Monday'); expect(container.textContent).toContain('Força profissional')
 expect(button('Treino do profissional').getAttribute('aria-pressed')).toBe('true')
 expect(mocks.repo.applyLibraryPlan.mock.calls).toEqual([['self', 2], ['pro', 3]])
 await act(async () => root.unmount()); root = createRoot(container); await render()
 expect(activeCalendar().textContent).toContain('Professional Monday'); expect(button('Em uso')).toBeDefined()
})
it.each([{ historical: [] }, { historical: [{ ...pro, available: false }] }])('shows normal personal workspace with no available professional: %j', async ({ historical }) => {
 useStore.setState({ S: normalizeState({ ...useStore.getState().S, assignedProgram: null, activeLibraryId: 'self', routines: [personal], week: { 2: 'personal' } }) })
 mocks.repo.planLibrary.mockResolvedValue({ items: [self, ...historical], total: 1 + historical.length })
 await render()
 expect(button('Meus treinos')).toBeUndefined(); expect(container.querySelector('.created-workouts')).not.toBeNull()
 expect(container.querySelectorAll('.plan-mode-options button')).toHaveLength(2)
 expect(activeCalendar().textContent).toContain('Live personal Tuesday')
 const modeButtons = [...container.querySelectorAll('.plan-mode-options button')]
 await act(async () => modeButtons[1].click())
 expect(useStore.getState().S.planMode).toBe('daily')
 await act(async () => modeButtons[0].click())
 expect(useStore.getState().S.planMode).toBe('weekly')
 await act(async () => container.querySelector('.created-workouts .item').click())
 expect(mocks.navigate).toHaveBeenCalledWith('/plan/r/personal')
 await act(async () => container.querySelector('.created-workouts button').click())
 expect(useStore.getState().S.routines).toHaveLength(2)
})
it('never shows deleted snapshot routines when current personal routines are empty', async () => {
 useStore.setState({ S: { ...useStore.getState().S, routines: [assigned] } })
 await render(); await click('Meus treinos')
 expect(container.querySelector('.personal-plan-preview').textContent).not.toContain('Deleted snapshot')
 expect(container.querySelector('.personal-plan-preview').textContent).not.toContain('Live personal Tuesday')
})
