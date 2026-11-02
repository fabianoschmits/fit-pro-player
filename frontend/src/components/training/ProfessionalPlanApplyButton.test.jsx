// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { DEF, useStore, normalizeState } from '../../store/useStore.js'
import { createAccountDomainSync } from '../../lib/account-domain-sync.js'
import { parsePlan } from '../../lib/training-dto.js'
import { useUI } from '../../store/useUI.js'
import ProfessionalPlanApplyButton from './ProfessionalPlanApplyButton.jsx'
import StudentProfessionalDetail from '../../views/StudentProfessionalDetail.jsx'
import StudentProfessionalMaterials from '../../views/StudentProfessionalMaterials.jsx'
const mocks = vi.hoisted(() => ({ repo: { savePersonalPlan: vi.fn(), applyLibraryPlan: vi.fn(), studentProfessionalDetail: vi.fn(), studentProfessionals: vi.fn() } }))
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
const render = async (page = 'button') => act(async () => root.render(<MemoryRouter initialEntries={[page === 'detail' ? '/student/professionals/pro?section=training' : '/student/professionals/materials']}><Routes><Route path={page === 'detail' ? '/student/professionals/:professionalId' : '*'} element={page === 'detail' ? <StudentProfessionalDetail /> : page === 'materials' ? <StudentProfessionalMaterials /> : <ProfessionalPlanApplyButton personal={page === 'personal'} libraryPlanId="library" versionId="v2" repo={mocks.repo} />} /></Routes><Sheets /></MemoryRouter>))
const click = async label => act(async () => button(label).click())
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.clearAllMocks()
  localStorage.clear()
  await useStore.getState().activateLocalScope(userId)
  useStore.setState({ S: { ...structuredClone(DEF), profile: { name: 'Aluno', birthDate: '1990-01-01', sex: 'male', heightCm: 180, startWeight: 80, goal: 'build_muscle', experience: 'beginner', completedAt: '2026-11-01' }, planServerRevision: 2, activeLibraryId: 'library', assignedProgram: { programId: 'program', versionId: 'v1' } } })
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
  await render(); await click('Usar este plano')
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
  await render(); await click('Usar este plano')
  const confirm = button('Aplicar plano')
  await act(async () => { confirm.click(); confirm.click() })
  expect(mocks.repo.applyLibraryPlan).toHaveBeenCalledExactlyOnceWith('library', 2)
  expect(button('Aplicando…')).toBeDefined()
  expect(useUI.getState().sheets[0].locked).toBe(true)
  expect(useStore.getState().S.assignedProgram.versionId).toBe('v1')
  await act(async () => resolve(response()))
  expect(useUI.getState().sheets).toHaveLength(0)
  expect(button('Em uso').disabled).toBe(true)
  expect(useStore.getState().S).toMatchObject({ activeLibraryId: 'library', assignedProgram: { versionId: 'v2' }, onboardingDone: true, _pendingSync: { plan: false } })
})
it.each([new Error('offline'), { code: '42501' }, { code: '40001' }])('keeps errors in the modal and allows retry without changing the previous plan: %j', async cause => {
  const before = useStore.getState().S
  mocks.repo.applyLibraryPlan.mockRejectedValueOnce(cause)
  await render(); await click('Usar este plano'); await click('Aplicar plano')
  expect(useStore.getState().S).toBe(before)
  expect(useUI.getState().sheets).toHaveLength(1)
  expect(container.querySelector('[role="alert"]')).not.toBeNull()
  expect(button('Em uso')).toBeUndefined()
  await click('Aplicar plano')
  expect(useUI.getState().sheets).toHaveLength(0)
  expect(button('Em uso')).toBeDefined()
})
it.each([{}, response('v1'), response('v2', 'other'), { ...response(), schedule: { ...response().schedule, user_id: 'other' } }])('rejects malformed, wrong account or unexpected selection responses before replacing state: %j', async result => {
  mocks.repo.applyLibraryPlan.mockResolvedValue(result)
  const before = useStore.getState().S
  await render(); await click('Usar este plano'); await click('Aplicar plano')
  expect(useStore.getState().S).toBe(before)
  expect(useUI.getState().sheets).toHaveLength(1)
  expect(container.querySelector('[role="alert"]')).not.toBeNull()
})
it('retries sync but blocks application while personal changes are pending', async () => {
  useStore.setState({ S: { ...useStore.getState().S, _pendingSync: { plan: true } } })
  const sync = vi.spyOn(useStore.getState(), 'retryAccountSync').mockResolvedValue()
  await render(); await click('Usar este plano'); await click('Aplicar plano')
  expect(sync).toHaveBeenCalledTimes(1)
  expect(mocks.repo.applyLibraryPlan).not.toHaveBeenCalled()
  expect(container.querySelector('[role="alert"]').textContent).toContain('sincronização')
})
it('ignores a response after account scope changes', async () => {
  let resolve
  mocks.repo.applyLibraryPlan.mockImplementation(() => new Promise(done => { resolve = done }))
  await render(); await click('Usar este plano'); await click('Aplicar plano')
  await act(async () => useStore.getState().activateLocalScope('22222222-2222-4222-8222-222222222222'))
  const before = useStore.getState().S
  await act(async () => resolve(response()))
  expect(useStore.getState().S).toBe(before)
  expect(container.querySelector('[role="alert"]').textContent).toContain('conta mudou')
})
it('preserves a newer local edit made while the response was outstanding', async () => {
  let resolve
  mocks.repo.applyLibraryPlan.mockImplementation(() => new Promise(done => { resolve = done }))
  await render(); await click('Usar este plano'); await click('Aplicar plano')
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
  expect(button('Usar este plano')).toBeDefined()
  expect(container.querySelector('a[href="/plan"]')).toBeNull()
  await click('Usar este plano'); await click('Aplicar plano')
  expect(mocks.repo.applyLibraryPlan).toHaveBeenCalledExactlyOnceWith('library', 2)
  expect(useUI.getState().sheets).toHaveLength(0)
  expect(button('Em uso')).toBeDefined()
  expect(useStore.getState().S.assignedProgram.versionId).toBe('v2')
})

it('accepts unrelated profile updates during application without reporting a false conflict', async () => {
  let resolve
  mocks.repo.applyLibraryPlan.mockImplementation(() => new Promise(done => { resolve = done }))
  await render(); await click('Usar este plano'); await click('Aplicar plano')
  await act(async () => useStore.getState().update(state => { state.profile.name = 'Novo Nome' }))
  await act(async () => resolve(response()))
  expect(useUI.getState().sheets).toHaveLength(0)
  expect(useStore.getState().S.profile.name).toBe('Novo Nome')
  expect(button('Em uso')).toBeDefined()
})
it('rejects a matching selection whose week references a missing routine', async () => {
  const result = response(); result.schedule.schedule.week = { 1: 'missing' }
  mocks.repo.applyLibraryPlan.mockResolvedValue(result)
  const before = useStore.getState().S
  await render(); await click('Usar este plano'); await click('Aplicar plano')
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
  await render(); await click('Usar este plano'); await click('Aplicar plano')
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
  await render(); await click('Usar este plano'); await click('Aplicar plano')
  expect(useStore.getState().S).toMatchObject({ routines: [expect.objectContaining({ assigned: true }), personal], workouts: history, exWeights: weights, bodyMeasurements: measurements, bodyweight, onboardingDone: true })
  expect(button('Em uso')).toBeDefined()
})

it.each(['detail', 'materials'])('keeps Applied visible on %s without waiting for another material read', async page => {
  await render(page)
  let finishRefresh
  const detail = await mocks.repo.studentProfessionalDetail.mock.results[0].value
  mocks.repo.studentProfessionalDetail.mockImplementation(() => new Promise(resolve => { finishRefresh = resolve }))
  await click('Usar este plano'); await click('Aplicar plano')
  try {
    expect(button('Em uso')).toBeDefined()
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(mocks.repo.studentProfessionalDetail).toHaveBeenCalledTimes(1)
  } finally {
    if (finishRefresh) await act(async () => finishRefresh(detail))
  }
})

it('exposes acceptance on the professional detail before expanding plan details', async () => {
  await render('detail')
  expect(button('Usar este plano').closest('details:not([open])')).toBeNull()
})

const personalRoutine = { id: 'personal', name: 'Meu treino atual', emoji: 'dumbbell', ex: [{ id: '0025', sets: 3, reps: 12, weight: 55 }] }
const personalResponse = () => ({ routines: [{ id: 'personal', user_id: userId, title: 'Meu treino atual', position: 0, revision: 4, created_at: '2026-11-02', updated_at: '2026-11-02', prescription: { emoji: 'dumbbell', ex: [{ id: '0025', sets: 3, reps: 12, weight: 55 }] } }], schedule: { user_id: userId, revision: 3, mode: 'daily', updated_at: '2026-11-02', schedule: { libraryId: 'self-library', libraryTitle: 'Meu plano', week: { 2: 'personal' }, dayPlan: { '2026-11-03': 'rest', '2026-11-04': null } } } })
it('completes professional to personal, persists the server result and closes the confirmation', async () => {
  useStore.setState({ S: { ...useStore.getState().S, routines: [personalRoutine] } })
  mocks.repo.savePersonalPlan.mockResolvedValue('self-library')
  mocks.repo.applyLibraryPlan.mockResolvedValue(personalResponse())
  await render('personal'); await click('Usar meus treinos')
  expect(mocks.repo.savePersonalPlan).not.toHaveBeenCalled()
  await click('Aplicar meus treinos')
  expect(mocks.repo.applyLibraryPlan).toHaveBeenCalledExactlyOnceWith('self-library', 2)
  expect(container.querySelector('[role="alert"]')?.textContent).toBeUndefined()
  expect(useStore.getState().S).toMatchObject({ activeLibraryId: 'self-library', assignedProgram: null, planServerRevision: 3, planMode: 'daily', routines: [personalRoutine], week: { 2: 'personal' }, dayPlan: { '2026-11-03': 'rest', '2026-11-04': null } })
  expect(useUI.getState().sheets).toHaveLength(0)
})

it('accepts unchanged server routines when local normalization has added starter metadata', async () => {
  const result = personalResponse()
  result.routines[0].prescription = { emoji: 'abs', ex: [
    { id: '0274', sets: 2, reps: 15, rest: 60, mode: 'reps', weight: 0 },
    { id: '0872', sets: 2, reps: 12, rest: 60, mode: 'reps', weight: 0 },
    { id: '0276', sets: 2, reps: 10, rest: 60, mode: 'reps', weight: 0 },
    { id: '0979', sets: 2, reps: 12, rest: 60, mode: 'reps', weight: 0 },
    { id: '0857', sets: 2, reps: 8, rest: 90, mode: 'reps', weight: 0 },
  ] }
  const local = normalizeState({ ...useStore.getState().S, routines: [{ ...result.routines[0].prescription, id: 'personal', name: 'Meu treino atual' }] })
  expect(local.routines[0].starterKey).toBe('Abs Day')
  expect(result.routines[0].prescription.starterKey).toBeUndefined()
  useStore.setState({ S: local })
  mocks.repo.savePersonalPlan.mockResolvedValue('self-library')
  mocks.repo.applyLibraryPlan.mockResolvedValue(result)
  await render('personal'); await click('Usar meus treinos'); await click('Aplicar meus treinos')
  expect(mocks.repo.applyLibraryPlan).toHaveBeenCalledExactlyOnceWith('self-library', 2)
  expect(container.querySelector('[role="alert"]')?.textContent).toBeUndefined()
  expect(useStore.getState().S).toMatchObject({ assignedProgram: null, activeLibraryId: 'self-library', planServerRevision: 3 })
  expect(useUI.getState().sheets).toHaveLength(0)
})

it.each(['load', 'reps', 'exercise', 'name', 'missing', 'duplicate', 'assigned', 'wrong-selection'])('rejects a real personal response mismatch and keeps the previous plan: %s', async kind => {
  useStore.setState({ S: { ...useStore.getState().S, routines: [personalRoutine] } })
  const result = personalResponse()
  if (kind === 'load') result.routines[0].prescription.ex[0].weight = 5
  if (kind === 'reps') result.routines[0].prescription.ex[0].reps = 1
  if (kind === 'exercise') result.routines[0].prescription.ex[0].id = '0043'
  if (kind === 'name') result.routines[0].title = 'Antigo'
  if (kind === 'missing') result.routines = []
  if (kind === 'duplicate') result.routines.push(result.routines[0])
  if (kind === 'assigned') result.routines[0].prescription.assigned = true
  if (kind === 'wrong-selection') result.schedule.schedule.libraryId = 'wrong'
  mocks.repo.savePersonalPlan.mockResolvedValue('self-library')
  mocks.repo.applyLibraryPlan.mockResolvedValue(result)
  const before = useStore.getState().S
  await render('personal'); await click('Usar meus treinos'); await click('Aplicar meus treinos')
  expect(useUI.getState().sheets).toHaveLength(1)
  expect(useStore.getState().S).toBe(before)
  expect(container.querySelector('[role="alert"]')).not.toBeNull()
})
it('keeps a confirmed application successful when refreshing the library fails', async () => {
  const refresh = vi.fn().mockRejectedValue(new Error('offline'))
  await act(async () => root.render(<><ProfessionalPlanApplyButton libraryPlanId="library" versionId="v2" repo={mocks.repo} onApplied={refresh} /><Sheets /></>))
  await click('Usar este plano'); await click('Aplicar plano')
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(useStore.getState().S.assignedProgram.versionId).toBe('v2')
  expect(useUI.getState().sheets).toHaveLength(0)
})
it('waits for personal backend confirmation, prevents duplicate applications and only then closes', async () => {
  let resolve
  useStore.setState({ S: { ...useStore.getState().S, routines: [personalRoutine] } })
  mocks.repo.savePersonalPlan.mockResolvedValue('self-library')
  mocks.repo.applyLibraryPlan.mockImplementation(() => new Promise(done => { resolve = done }))
  await render('personal'); await click('Usar meus treinos')
  const confirm = button('Aplicar meus treinos')
  await act(async () => { confirm.click(); confirm.click() })
  expect(mocks.repo.savePersonalPlan).toHaveBeenCalledTimes(1)
  expect(mocks.repo.applyLibraryPlan).toHaveBeenCalledExactlyOnceWith('self-library', 2)
  expect(button('Aplicando…').disabled).toBe(true)
  expect(useUI.getState().sheets).toHaveLength(1)
  expect(useStore.getState().S.assignedProgram.versionId).toBe('v1')
  await act(async () => resolve(personalResponse()))
  expect(useStore.getState().S.assignedProgram).toBeNull()
  expect(useUI.getState().sheets).toHaveLength(0)
})
it.each(['save', 'apply', 'revision', 'sync'])('keeps the personal modal and previous plan intact when %s fails', async stage => {
  useStore.setState({ S: { ...useStore.getState().S, routines: [personalRoutine] } })
  mocks.repo.savePersonalPlan.mockResolvedValue('self-library')
  mocks.repo.applyLibraryPlan.mockResolvedValue(personalResponse())
  if (stage === 'save') mocks.repo.savePersonalPlan.mockRejectedValue(new Error('offline'))
  if (stage === 'apply') mocks.repo.applyLibraryPlan.mockRejectedValue(new Error('offline'))
  if (stage === 'revision') mocks.repo.applyLibraryPlan.mockRejectedValue({ code: '40001' })
  if (stage === 'sync') vi.spyOn(useStore.getState(), 'retryAccountSync').mockRejectedValue(new Error('offline'))
  const before = useStore.getState().S
  await render('personal'); await click('Usar meus treinos'); await click('Aplicar meus treinos')
  expect(useStore.getState().S).toBe(before)
  expect(useUI.getState().sheets).toHaveLength(1)
  expect(container.querySelector('[role="alert"]')).not.toBeNull()
})
it('rejects an account change between saving the personal library ID and applying it', async () => {
  let resolve
  mocks.repo.savePersonalPlan.mockImplementation(() => new Promise(done => { resolve = done }))
  await render('personal'); await click('Usar meus treinos'); await click('Aplicar meus treinos')
  await act(async () => useStore.getState().activateLocalScope('22222222-2222-4222-8222-222222222222'))
  const before = useStore.getState().S
  await act(async () => resolve('self-library'))
  expect(mocks.repo.applyLibraryPlan).not.toHaveBeenCalled()
  expect(useStore.getState().S).toBe(before)
  expect(container.querySelector('[role="alert"]').textContent).toContain('conta mudou')
})

it('never applies over a pending personal edit when real synchronization discovers another selected plan', async () => {
  const edited = { ...personalRoutine, name: 'Minha edição pendente' }
  useStore.setState({ S: { ...useStore.getState().S, routines: [edited], _pendingSync: { plan: true } } })
  const remote = response('remote-version', 'remote-library')
  remote.routines.push({ ...personalResponse().routines[0], title: 'Versão antiga no banco', revision: 3, position: 1 })
  const syncRepo = {
    savePlan: vi.fn().mockRejectedValue({ kind: 'selection-conflict' }),
    loadPlan: vi.fn().mockResolvedValue(parsePlan(remote, userId)),
    saveDetachedPlan: vi.fn().mockResolvedValue('recovery'),
  }
  const token = useStore.getState().getScopeToken()
  const sync = createAccountDomainSync({ repository: syncRepo, getState: () => useStore.getState().S, replaceState: next => useStore.getState().replaceState(next, false), isCurrent: () => useStore.getState().isScopeCurrent(token), isOnline: () => true })
  useStore.getState().configureAccountSync(() => sync.start())
  mocks.repo.savePersonalPlan.mockResolvedValue('self-library')
  const applied = personalResponse(); applied.schedule.revision = 4; applied.routines[0].title = 'Versão antiga no banco'
  mocks.repo.applyLibraryPlan.mockResolvedValue(applied)
  try {
    await render('personal'); await click('Usar meus treinos'); await click('Aplicar meus treinos')
    expect(syncRepo.savePlan).toHaveBeenCalled()
    expect(useStore.getState().S.routines.find(item => item.id === 'personal').name).toBe('Minha edição pendente')
    expect(useStore.getState().S._pendingSync.plan).toBe(true)
    expect(useStore.getState().S._syncConflicts.plan.local.routines[0].title).toBe('Minha edição pendente')
    expect(mocks.repo.savePersonalPlan).not.toHaveBeenCalled()
    expect(mocks.repo.applyLibraryPlan).not.toHaveBeenCalled()
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(container.querySelector('[role="alert"]').textContent).toContain('sincronização')
  } finally { sync.dispose() }
})
