// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import ProfessionalPlanApplyButton from './ProfessionalPlanApplyButton.jsx'
import StudentProfessionalDetail from '../../views/StudentProfessionalDetail.jsx'
import StudentProfessionalMaterials from '../../views/StudentProfessionalMaterials.jsx'
const mocks = vi.hoisted(() => ({ repo: { applyLibraryPlan: vi.fn(), studentProfessionalDetail: vi.fn(), studentProfessionals: vi.fn() } }))
const userId = '11111111-1111-4111-8111-111111111111'
vi.mock('../../auth/AuthProvider.jsx', () => ({ useAuth: () => ({ status: 'authenticated', user: { id: '11111111-1111-4111-8111-111111111111' } }) }))
vi.mock('../../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
const response = (versionId = 'v2', libraryId = 'library') => ({ routines: [{ id: 'routine', user_id: userId, title: 'Treino A', position: 0, revision: 3, created_at: '2026-11-02', updated_at: '2026-11-02', prescription: { assigned: true, programVersionId: versionId, ex: [{ id: '0043', sets: 3, reps: 10 }] } }], schedule: { user_id: userId, revision: 3, mode: 'weekly', updated_at: '2026-11-02', schedule: { week: { 1: 'routine' }, libraryId, libraryTitle: 'Força', assignedProgram: { programId: 'program', versionId } } } })
function Sheets() {
  const sheets = useUI(s => s.sheets)
  return sheets.map(sheet => <div key={sheet.id} data-modal>{sheet.render(() => useUI.getState().closeSheet(sheet.id))}</div>)
}
let root, container, log
const button = label => [...container.querySelectorAll('button')].find(item => item.textContent === label)
const render = async (page = 'button') => act(async () => root.render(<MemoryRouter initialEntries={[page === 'detail' ? '/student/professionals/pro?section=training' : '/student/professionals/materials']}><Routes><Route path={page === 'detail' ? '/student/professionals/:professionalId' : '*'} element={page === 'detail' ? <StudentProfessionalDetail /> : page === 'materials' ? <StudentProfessionalMaterials /> : <ProfessionalPlanApplyButton libraryPlanId="library" versionId="v2" repo={mocks.repo} />} /></Routes><Sheets /></MemoryRouter>))
const click = async label => act(async () => button(label).click())
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  localStorage.clear()
  await useStore.getState().activateLocalScope(userId)
  useStore.setState({ S: { ...structuredClone(DEF), profile: { name: 'Aluno', birthDate: '1990-01-01', sex: 'male', heightCm: 180, startWeight: 80, goal: 'build_muscle', experience: 'beginner', completedAt: '2026-11-01' }, activeLibraryId: 'library', assignedProgram: { programId: 'program', versionId: 'v1' } } })
  useUI.setState({ sheets: [] })
  mocks.repo.applyLibraryPlan.mockResolvedValue(response())
  mocks.repo.studentProfessionals.mockResolvedValue([{ professionalId: 'pro', professionalName: 'Ana' }])
  mocks.repo.studentProfessionalDetail.mockResolvedValue({ professional: { professionalId: 'pro', professionalName: 'Ana' }, relationship: { id: 'link', status: 'active' }, materials: [{ assignmentId: 'assignment', programId: 'program', versionId: 'v2', libraryPlanId: 'library', status: 'active', title: 'Força', weeklyPlan: {} }] })
  log = vi.spyOn(console, 'error').mockImplementation(() => {})
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); log.mockRestore(); vi.restoreAllMocks(); useStore.getState().releaseAccountSync() })
it('opens confirmation without applying; cancel preserves the previous version', async () => {
  const before = useStore.getState().S
  await render(); await click('Aceitar')
  expect(container.textContent).toContain('Aplicar plano profissional?')
  expect(mocks.repo.applyLibraryPlan).not.toHaveBeenCalled()
  await click('Cancelar')
  expect(useUI.getState().sheets).toHaveLength(0)
  expect(mocks.repo.applyLibraryPlan).not.toHaveBeenCalled()
  expect(useStore.getState().S).toBe(before)
})
it('waits for the complete response, prevents duplicate submissions and closes on success', async () => {
  let resolve
  mocks.repo.applyLibraryPlan.mockImplementation(() => new Promise(done => { resolve = done }))
  await render(); await click('Aceitar')
  const confirm = button('Aplicar plano')
  await act(async () => { confirm.click(); confirm.click() })
  expect(mocks.repo.applyLibraryPlan).toHaveBeenCalledExactlyOnceWith('library')
  expect(button('Aplicando…')).toBeDefined()
  expect(useUI.getState().sheets[0].locked).toBe(true)
  expect(useStore.getState().S.assignedProgram.versionId).toBe('v1')
  await act(async () => resolve(response()))
  expect(useUI.getState().sheets).toHaveLength(0)
  expect(button('Aplicado').disabled).toBe(true)
  expect(useStore.getState().S).toMatchObject({ activeLibraryId: 'library', assignedProgram: { versionId: 'v2' }, onboardingDone: true, _pendingSync: { plan: false } })
})
it.each([new Error('offline'), { code: '42501' }, { code: '40001' }])('keeps errors in the modal and allows retry without changing the previous plan: %j', async cause => {
  const before = useStore.getState().S
  mocks.repo.applyLibraryPlan.mockRejectedValueOnce(cause)
  await render(); await click('Aceitar'); await click('Aplicar plano')
  expect(useStore.getState().S).toBe(before)
  expect(useUI.getState().sheets).toHaveLength(1)
  expect(container.querySelector('[role="alert"]')).not.toBeNull()
  expect(button('Aplicado')).toBeUndefined()
  await click('Aplicar plano')
  expect(useUI.getState().sheets).toHaveLength(0)
  expect(button('Aplicado')).toBeDefined()
})
it.each([{}, response('v1'), response('v2', 'other'), { ...response(), schedule: { ...response().schedule, user_id: 'other' } }])('rejects malformed, wrong account or unexpected selection responses before replacing state: %j', async result => {
  mocks.repo.applyLibraryPlan.mockResolvedValue(result)
  const before = useStore.getState().S
  await render(); await click('Aceitar'); await click('Aplicar plano')
  expect(useStore.getState().S).toBe(before)
  expect(useUI.getState().sheets).toHaveLength(1)
  expect(container.querySelector('[role="alert"]')).not.toBeNull()
})
it('retries sync but blocks application while personal changes are pending', async () => {
  useStore.setState({ S: { ...useStore.getState().S, _pendingSync: { plan: true } } })
  const sync = vi.spyOn(useStore.getState(), 'retryAccountSync').mockResolvedValue()
  await render(); await click('Aceitar'); await click('Aplicar plano')
  expect(sync).toHaveBeenCalledTimes(1)
  expect(mocks.repo.applyLibraryPlan).not.toHaveBeenCalled()
  expect(container.querySelector('[role="alert"]').textContent).toContain('sincronização')
})
it('ignores a response after account scope changes', async () => {
  let resolve
  mocks.repo.applyLibraryPlan.mockImplementation(() => new Promise(done => { resolve = done }))
  await render(); await click('Aceitar'); await click('Aplicar plano')
  await act(async () => useStore.getState().activateLocalScope('22222222-2222-4222-8222-222222222222'))
  const before = useStore.getState().S
  await act(async () => resolve(response()))
  expect(useStore.getState().S).toBe(before)
  expect(container.querySelector('[role="alert"]').textContent).toContain('conta mudou')
})
it('preserves a newer local edit made while the response was outstanding', async () => {
  let resolve
  mocks.repo.applyLibraryPlan.mockImplementation(() => new Promise(done => { resolve = done }))
  await render(); await click('Aceitar'); await click('Aplicar plano')
  await act(async () => useStore.setState({ S: { ...useStore.getState().S, week: { 1: 'personal' }, _pendingSync: { plan: true } } }))
  const before = useStore.getState().S
  await act(async () => resolve(response()))
  expect(useStore.getState().S).toBe(before)
  expect(container.querySelector('[role="alert"]')).not.toBeNull()
})
it.each(['detail', 'materials'])('accepts a new version directly on %s and immediately shows applied', async page => {
  const before = useStore.getState().S
  await render(page)
  expect(useStore.getState().S).toBe(before)
  expect(button('Aceitar')).toBeDefined()
  expect(container.querySelector('a[href="/plan"]')).toBeNull()
  await click('Aceitar'); await click('Aplicar plano')
  expect(mocks.repo.applyLibraryPlan).toHaveBeenCalledExactlyOnceWith('library')
  expect(useUI.getState().sheets).toHaveLength(0)
  expect(button('Aplicado')).toBeDefined()
  expect(useStore.getState().S.assignedProgram.versionId).toBe('v2')
})

it('accepts unrelated profile updates during application without reporting a false conflict', async () => {
  let resolve
  mocks.repo.applyLibraryPlan.mockImplementation(() => new Promise(done => { resolve = done }))
  await render(); await click('Aceitar'); await click('Aplicar plano')
  await act(async () => useStore.getState().update(state => { state.profile.name = 'Novo Nome' }))
  await act(async () => resolve(response()))
  expect(useUI.getState().sheets).toHaveLength(0)
  expect(useStore.getState().S.profile.name).toBe('Novo Nome')
  expect(button('Aplicado')).toBeDefined()
})
it('rejects a matching selection whose week references a missing routine', async () => {
  const result = response(); result.schedule.schedule.week = { 1: 'missing' }
  mocks.repo.applyLibraryPlan.mockResolvedValue(result)
  const before = useStore.getState().S
  await render(); await click('Aceitar'); await click('Aplicar plano')
  expect(useStore.getState().S).toBe(before)
  expect(useUI.getState().sheets).toHaveLength(1)
})

it.each(['missing-personal', 'empty-plan', 'missing-exercises', 'stale-revision'])('keeps the current plan for incomplete or stale responses: %s', async kind => {
  const personal = { id: 'personal', name: 'Meu treino', ex: [{ id: '0043', sets: 2 }] }
  if (kind === 'missing-personal') useStore.setState({ S: { ...useStore.getState().S, routines: [personal] } })
  const result = response()
  if (kind === 'empty-plan') { result.routines = []; result.schedule.schedule.week = {} }
  if (kind === 'missing-exercises') delete result.routines[0].prescription.ex
  if (kind === 'stale-revision') useStore.setState({ S: { ...useStore.getState().S, planServerRevision: 4 } })
  mocks.repo.applyLibraryPlan.mockResolvedValue(result)
  const before = useStore.getState().S
  await render(); await click('Aceitar'); await click('Aplicar plano')
  expect(useStore.getState().S).toBe(before)
  expect(useUI.getState().sheets).toHaveLength(1)
})
it('preserves personal routines, history, weights and measurements after successful application', async () => {
  const result = response()
  const personal = { id: 'personal', name: 'Meu treino', ex: [{ id: '0043', sets: 2 }] }
  const history = [{ id: 'history', d: '2026-11-01', entries: [] }]
  const weights = { '0043': { w: 40 } }
  const measurements = [{ id: '33333333-3333-4333-8333-333333333333', date: '2026-11-01', values: { waist: 80 } }]
  const bodyweight = [{ id: '44444444-4444-4444-8444-444444444444', d: '2026-11-01', w: 80 }]
  useStore.setState({ S: { ...useStore.getState().S, routines: [personal], workouts: history, exWeights: weights, bodyMeasurements: measurements, bodyweight } })
  result.routines.push({ ...result.routines[0], id: 'personal', title: 'Meu treino', position: 1, prescription: { ex: personal.ex } })
  mocks.repo.applyLibraryPlan.mockResolvedValue(result)
  await render(); await click('Aceitar'); await click('Aplicar plano')
  expect(useStore.getState().S).toMatchObject({ routines: [expect.objectContaining({ assigned: true }), personal], workouts: history, exWeights: weights, bodyMeasurements: measurements, bodyweight, onboardingDone: true })
  expect(button('Aplicado')).toBeDefined()
})

it.each(['detail', 'materials'])('keeps Applied visible on %s without waiting for another material read', async page => {
  await render(page)
  let finishRefresh
  const detail = await mocks.repo.studentProfessionalDetail.mock.results[0].value
  mocks.repo.studentProfessionalDetail.mockImplementation(() => new Promise(resolve => { finishRefresh = resolve }))
  await click('Aceitar'); await click('Aplicar plano')
  try {
    expect(button('Aplicado')).toBeDefined()
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(mocks.repo.studentProfessionalDetail).toHaveBeenCalledTimes(1)
  } finally {
    if (finishRefresh) await act(async () => finishRefresh(detail))
  }
})

it('exposes acceptance on the professional detail before expanding plan details', async () => {
  await render('detail')
  expect(button('Aceitar').closest('details:not([open])')).toBeNull()
})
