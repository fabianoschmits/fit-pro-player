// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: {}, client: {}, repo: {
  professionalRole: vi.fn(), assignedPrograms: vi.fn(), version: vi.fn(),
  studentProfessionals: vi.fn(), studentOverview: vi.fn(), studentProfessionalDetail: vi.fn(),
  revokeRelationship: vi.fn(), previewInvite: vi.fn(), acceptInvite: vi.fn(),
} }))
vi.mock('./auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('./lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => mocks.client }))
vi.mock('./lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
// Presentation animation is irrelevant to ownership and keeps deferred reads deterministic.
vi.mock('./components/PageTransition.jsx', () => ({ default: ({ children }) => <div id="app">{children}</div> }))
// This suite verifies account synchronization; rendering Motion's browser
// animations in happy-dom can reject when the fixture unmounts mid-transition.
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }) => children,
  motion: {
    span: ({ initial, animate, exit, transition, ...props }) => <span {...props} />,
    section: ({ initial, animate, exit, transition, ...props }) => <section {...props} />,
  },
  useReducedMotion: () => true,
}))
vi.mock('./lib/notification-client.js', async importOriginal => ({
  ...await importOriginal(), startNotificationCoordinator: () => () => {},
  syncNotificationPreferences: () => {}, syncNotificationVisibility: () => {},
  reconnectNotifications: () => {}, refreshNotificationReadiness: () => {},
}))
import App from './App.jsx'
import { useStore, DEF } from './store/useStore.js'
import { assignedPlanToState } from './lib/assigned-program.js'
import { nav } from './lib/nav.js'

const oldAssignment = { id: 'old-active', version_id: 'old-version', program_id: 'old-program', professional_user_id: 'p1', student_user_id: '11111111-1111-4111-8111-111111111111', status: 'active' }
const replacement = { ...oldAssignment, id: 'replacement', version_id: 'replacement-version', professional_user_id: 'p2' }
const version = id => ({ id, weekly_plan: { monday: [{ exerciseId: 'squat', sets: 3, reps: 10 }] }, version_number: 1 })
const person = id => ({ professionalId: id, professionalName: id === 'p1' ? 'Ana Silva' : 'Bruno Reis' })
const overview = (assignment, title) => ({ assignment: { id: assignment.id }, program: { title }, professional: { id: assignment.professional_user_id, name: person(assignment.professional_user_id).professionalName }, version: { id: assignment.version_id, weeklyPlan: version(assignment.version_id).weekly_plan } })
const detail = { professional: person('p1'), relationship: { id: 'relationship-p1', status: 'active', linkedAt: '2026-10-01' }, materials: [{ assignmentId: 'old-active', status: 'active', title: 'Old program', weeklyPlan: {} }], executions: [] }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
let root, container, linked
const render = async () => { await act(async () => root.render(<App />)); await act(async () => { await vi.dynamicImportSettled() }) }
const go = async path => { await act(async () => nav(path)); await act(async () => { await vi.dynamicImportSettled() }) }
const click = async label => { const button = [...container.querySelectorAll('button')].find(item => item.textContent === label); expect(button, `${label}: ${window.location.hash}: ${container.textContent}`).toBeDefined(); await act(async () => button.click()) }
const seedAccount = async (id, assigned = true, onboardingDone = true) => {
  await useStore.getState().activateLocalScope(id)
  let state = structuredClone(DEF)
  state.profile = { ...state.profile, name: 'Student fixture', birthDate: '1990-01-01', heightCm: 175, startWeight: 75, goal: 'build_muscle', experience: 'beginner' }
  state.routines = [{ id: 'personal-r', name: 'Personal', ex: [] }]
  if (assigned) state = assignedPlanToState(state, version('old-version'), oldAssignment)
  state.week[2] = 'personal-r'
  state.onboardingDone = onboardingDone
  useStore.getState().replaceState(state)
  useStore.getState().enterApp()
}
beforeEach(async () => {
  Object.values(mocks.repo).forEach(method => method.mockReset())
  localStorage.clear(); sessionStorage.clear()
  mocks.client = {}
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  linked = true
  mocks.auth = { status: 'authenticated', user: { id: '11111111-1111-4111-8111-111111111111' } }
  mocks.repo.professionalRole.mockResolvedValue(false)
  mocks.repo.assignedPrograms.mockImplementation(async () => linked ? [oldAssignment] : [])
  mocks.repo.version.mockImplementation(async id => version(id))
  mocks.repo.studentProfessionals.mockImplementation(async () => linked ? [person('p1')] : [])
  mocks.repo.studentOverview.mockResolvedValue({})
  mocks.repo.studentProfessionalDetail.mockImplementation(async () => linked ? detail : null)
  mocks.repo.previewInvite.mockResolvedValue([{ professional_name: 'Ana Silva', verification_status: 'unverified' }])
  mocks.repo.acceptInvite.mockResolvedValue({})
  mocks.repo.revokeRelationship.mockImplementation(async () => { linked = false })
  await seedAccount('11111111-1111-4111-8111-111111111111')
  useStore.setState({ ready: false })
  window.location.hash = '#/student/professionals/p1?section=relationship'
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })

it('automatically sends a pending body change after its own account token is restored', async () => {
  const authListeners = new Set()
  let authenticated = false
  mocks.client = {
    auth: { onAuthStateChange: callback => {
      authListeners.add(callback)
      return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } }
    } },
    rpc: async name => {
      if (!authenticated) return { error: { code: 'PGRST301', message: 'JWT expired' }, status: 401 }
      if (name === 'save_athlete_body') return { data: { weights: [{
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', user_id: oldAssignment.student_user_id,
        measured_on: '2026-10-21', weight_kg: 76, created_at: 'created', updated_at: 'updated',
      }], measurements: [] } }
      throw new Error(`unexpected write: ${name}`)
    },
  }
  useStore.getState().replaceState({ ...useStore.getState().S, _pendingSync: {} }, false)
  useStore.getState().update(state => { state.bodyweight = [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', d: '2026-10-21', w: 76 }] })
  await render()
  expect(useStore.getState().S._pendingSync.body).toBe(true)
  authenticated = true
  await act(async () => {
    authListeners.forEach(callback => callback('TOKEN_REFRESHED', { user: { id: '22222222-2222-4222-8222-222222222222' } }))
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  expect(useStore.getState().S._pendingSync.body).toBe(true)
  await act(async () => {
    authListeners.forEach(callback => callback('TOKEN_REFRESHED', { user: { id: oldAssignment.student_user_id } }))
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  expect(useStore.getState().S._pendingSync.body).toBe(false)
  expect(useStore.getState().S.bodyweight[0].w).toBe(76)
})

it.each(['section', '/student/professionals/materials', '/home'])('keeps unlink cleared when the actual Shell version arrives after %s navigation', async destination => {
  const pendingVersion = deferred(); const unlink = deferred()
  mocks.repo.version.mockReturnValue(pendingVersion.promise)
  mocks.repo.revokeRelationship.mockImplementation(async () => { await unlink.promise; linked = false })
  await render(); expect(mocks.repo.version).not.toHaveBeenCalled()
  await click('Desvincular'); await click('Confirmar')
  await go(destination === 'section' ? '/student/professionals/p1?section=history' : destination)
  await act(async () => unlink.resolve({}))
  expect(useStore.getState().S.assignedProgram).toBeNull()
  await act(async () => pendingVersion.resolve(version('old-version')))
  expect(useStore.getState().S.assignedProgram).toBeNull()
  expect(useStore.getState().S.routines.map(item => item.id)).toEqual(['personal-r'])
  expect(useStore.getState().S.week).toEqual({ 2: 'personal-r' })
})

it('invalidates a Shell snapshot on successful unlink even when no plan has yet been cached', async () => {
  await seedAccount('11111111-1111-4111-8111-111111111111', false)
  const pending = deferred(); mocks.repo.version.mockReturnValue(pending.promise)
  await render(); await click('Desvincular'); await click('Confirmar')
  expect(useStore.getState().S.assignedProgram).toBeNull()
  await act(async () => pending.resolve(version('old-version')))
  expect(useStore.getState().S.assignedProgram).toBeNull()
  expect(useStore.getState().S.routines.map(item => item.id)).toEqual(['personal-r'])
})

it('preserves a legitimate overview replacement across unlink completion and the older Shell version', async () => {
  const pendingVersion = deferred(); const unlink = deferred()
  mocks.repo.version.mockImplementation(id => id === 'old-version' ? pendingVersion.promise : Promise.resolve(version(id)))
  mocks.repo.revokeRelationship.mockImplementation(async () => { await unlink.promise; linked = false })
  await render(); await click('Desvincular'); await click('Confirmar')
  mocks.repo.assignedPrograms.mockResolvedValue([replacement]); mocks.repo.studentProfessionals.mockResolvedValue([person('p2')])
  await go('/student/professionals')
  await act(async () => useStore.getState().replaceState(assignedPlanToState({ ...useStore.getState().S }, version('replacement-version'), replacement)))
  expect(useStore.getState().S.assignedProgram?.assignmentId).toBe('replacement')
  await act(async () => unlink.resolve({}))
  await act(async () => pendingVersion.resolve(version('old-version')))
  expect(useStore.getState().S.assignedProgram?.assignmentId).toBe('replacement')
  expect(useStore.getState().S.routines.filter(item => item.assigned).map(item => item.assignmentId)).toEqual(['replacement'])
})

it('rejects Shell and unlink completions after switching the actual store account', async () => {
  const pendingVersion = deferred(); const unlink = deferred()
  mocks.repo.version.mockReturnValue(pendingVersion.promise)
  mocks.repo.revokeRelationship.mockImplementation(() => unlink.promise)
  await render(); await click('Desvincular'); await click('Confirmar')
  await act(async () => { await seedAccount('22222222-2222-4222-8222-222222222222', false); mocks.auth = { status: 'authenticated', user: { id: '22222222-2222-4222-8222-222222222222' } }; mocks.repo.assignedPrograms.mockResolvedValue([]) })
  await render(); await act(async () => unlink.resolve({})); await act(async () => pendingVersion.resolve(version('old-version')))
  expect(useStore.getState().getActiveLocalScope().userId).toBe('22222222-2222-4222-8222-222222222222')
  expect(useStore.getState().S.assignedProgram).toBeNull()
  expect(useStore.getState().S.routines.map(item => item.id)).toEqual(['personal-r'])
})

it('never adopts a new delivery while opening professional pages', async () => {
  mocks.repo.assignedPrograms.mockResolvedValue([replacement])
  await render(); await go('/student/professionals')
  expect(useStore.getState().S.assignedProgram?.assignmentId).toBe('old-active')
  expect(mocks.repo.assignedPrograms).not.toHaveBeenCalled()
  expect(mocks.repo.version).not.toHaveBeenCalled()
})
it('keeps a personal plan unchanged when a professional has delivered a plan', async () => {
  await seedAccount('11111111-1111-4111-8111-111111111111', false)
  await render(); await go('/student/professionals')
  expect(useStore.getState().S.assignedProgram).toBeNull()
  expect(useStore.getState().S.routines.map(r => r.id)).toEqual(['personal-r'])
  expect(container.querySelector('a[href="#/plan"]')).not.toBeNull()
})

it('continuously preserves a code from anonymous sign-in through explicit accept and then resumes personal onboarding', async () => {
  await seedAccount('11111111-1111-4111-8111-111111111111', false, false)
  mocks.auth = { status: 'anonymous', user: null }
  mocks.repo.assignedPrograms.mockResolvedValue([]); mocks.repo.studentProfessionals.mockResolvedValue([])
  window.location.hash = '#/connect?code=A1B2C3D4E5'
  await render()
  expect(sessionStorage.getItem('fpp-pending-invite')).toBe('A1B2C3D4E5')
  expect(mocks.repo.previewInvite).not.toHaveBeenCalled()
  mocks.auth = { status: 'authenticated', user: { id: '11111111-1111-4111-8111-111111111111' } }; await render()
  expect(window.location.hash).toBe('#/student/professionals/add?code=A1B2C3D4E5')
  expect(container.querySelector('#student-invite-code').value).toBe('A1B2C3D4E5')
  expect(container.textContent).toContain('Ana Silva')
  expect(mocks.repo.acceptInvite).not.toHaveBeenCalled()
  expect(useStore.getState().S.onboardingDone).toBe(false)
  await click('Vincular a este profissional')
  expect(sessionStorage.getItem('fpp-pending-invite')).toBeNull()
  expect(window.location.hash).toBe('#/student/professionals?invite=accepted')
  expect(container.querySelector('.student-professionals-page')).not.toBeNull()
  expect(useStore.getState().S.onboardingDone).toBe(false)
  await go('/home')
  expect(window.location.hash).toBe('#/plan')
  expect(sessionStorage.getItem('fpp-pending-invite')).toBeNull()
})

it('does not preview an authenticated invitation entry without a code', async () => {
  await seedAccount('11111111-1111-4111-8111-111111111111', false, false); window.location.hash = '#/connect'
  await render()
  expect(window.location.hash).toBe('#/student/professionals/add')
  expect(container.querySelector('#student-invite-code').value).toBe('')
  expect(mocks.repo.previewInvite).not.toHaveBeenCalled()
})
