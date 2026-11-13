// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const fixtures = vi.hoisted(() => ({ user: null, repository: null, professional: null, client: { rpc: () => {} } }))
vi.mock('./auth/AuthProvider.jsx', () => ({ useAuth: () => ({ status: 'authenticated', user: fixtures.user }) }))
vi.mock('./lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => fixtures.client }))
vi.mock('./lib/training-repository.js', () => ({ createTrainingRepository: () => fixtures.repository }))
vi.mock('./lib/professional-profile.js', () => ({ createProfessionalProfileRepository: () => ({ role: async () => Boolean(fixtures.professional), own: async () => fixtures.professional }) }))
vi.mock('./lib/professional-events.js', () => ({ flushProfessionalEvents: async () => {} }))
vi.mock('./lib/exercise-preloader.js', () => ({ getPlanExerciseIds: () => [], preloadExerciseSpritesByIds: async () => {} }))
vi.mock('./lib/page-scenery-cache.js', () => ({ preloadPageScenery: async () => {} }))
vi.mock('./components/PageTransition.jsx', () => ({ default: ({ children }) => <div>{children}</div> }))
vi.mock('./components/TabBar.jsx', () => ({ default: () => null }))
vi.mock('./components/PrivacyConsentModal.jsx', () => ({ default: () => null }))
vi.mock('./views/Landing.jsx', () => ({ default: () => <main>Entrar</main> }))
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }) => children,
  motion: { span: ({ initial, animate, exit, transition, ...props }) => <span {...props} /> },
  useReducedMotion: () => true,
}))
vi.mock('./community-access/CommunityAccess.jsx', () => ({ CommunityAccessProvider: ({ children }) => children, CommunityAccessGate: ({ children }) => children }))
vi.mock('./views/Home.jsx', () => ({ default: () => <main>Treinos salvos</main> }))
vi.mock('./views/Plan.jsx', () => ({ default: () => <main>Plano salvo</main> }))
vi.mock('./views/ProfessionalDashboard.jsx', () => ({ default: () => <main>Painel profissional</main> }))
vi.mock('./components/onboarding/TrainingOnboarding.jsx', () => ({ default: () => <main>Configurar treino</main> }))
vi.mock('./components/onboarding/ProfessionalOnboarding.jsx', () => ({ default: () => <main>Configurar acompanhamento</main> }))
vi.mock('./lib/notification-client.js', async importOriginal => ({
  ...await importOriginal(), startNotificationCoordinator: () => () => {},
  syncNotificationPreferences: () => {}, syncNotificationVisibility: () => {},
  reconnectNotifications: () => {}, refreshNotificationReadiness: () => {},
}))

import App from './App.jsx'
import { DEF, useStore } from './store/useStore.js'

const ACCOUNT = '11111111-1111-4111-8111-111111111111'
let root, container, preferenceRead
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const render = async () => { await act(async () => root.render(<App />)); await act(async () => { await vi.dynamicImportSettled() }) }
const settle = async values => { await act(async () => preferenceRead.resolve({ revision: 3, displayUnit: 'kg', massUnit: 'kg', values })); await act(async () => { await vi.dynamicImportSettled() }) }

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear(); sessionStorage.clear()
  fixtures.user = { id: ACCOUNT, accountType: 'student', displayName: 'Ana' }
  fixtures.professional = null
  preferenceRead = deferred()
  fixtures.repository = {
    loadPreferences: () => preferenceRead.promise,
    loadPlan: async () => ({ routines: [], schedule: { revision: 0, mode: 'weekly', values: {} } }),
    loadBody: async () => ({ revision: 0, weights: [], measurements: [] }),
    loadHistory: async () => [],
    onAuthRestored: () => () => {},
  }
  window.location.hash = '#/home'
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })

it.each([
  ['student', '/home'],
  ['professional', '/professional'],
])('waits for saved %s account data before deciding to open setup', async (accountType, path) => {
  fixtures.user.accountType = accountType
  window.location.hash = '#' + path
  await render()
  expect(window.location.hash).toBe('#' + path)
  await settle({ onboardingDone: true, profile: { name: 'Ana' } })
  expect(useStore.getState().S.onboardingDone).toBe(true)
  expect(window.location.hash).toBe('#' + path)
})

it.each([
  ['student', '/plan'],
  ['professional', '/professional'],
])('returns a completed %s account from a bookmarked setup URL', async (accountType, destination) => {
  fixtures.user.accountType = accountType
  window.location.hash = '#/onboarding'
  await render()
  await settle({ onboardingDone: true, profile: { name: 'Ana' } })
  expect(window.location.hash).toBe('#' + destination)
})

it('still opens setup for a new account after the server confirms it is unfinished', async () => {
  await render()
  expect(window.location.hash).toBe('#/home')
  await settle({ onboardingDone: false, profile: DEF.profile })
  expect(window.location.hash).toBe('#/onboarding')
})

it('does not interpret a failed account read as an unfinished signup', async () => {
  await render()
  await act(async () => preferenceRead.reject(new Error('offline')))
  expect(window.location.hash).toBe('#/home')
  expect(container.querySelector('[role="alert"]')).toBeTruthy()
})

it('recognizes an already saved professional profile when the old preferences flag is absent', async () => {
  fixtures.user.accountType = 'professional'
  fixtures.professional = { professionalName: 'Ana Coach', updatedAt: '2026-11-13T10:00:00.000Z' }
  window.location.hash = '#/professional'
  await render()
  await settle({})
  expect(window.location.hash).toBe('#/professional')
  expect(useStore.getState().S.onboardingDone).toBe(true)
  expect(useStore.getState().S.profile.name).toBe('Ana Coach')
})

it('still configures a new professional account without an existing professional profile', async () => {
  fixtures.user.accountType = 'professional'
  window.location.hash = '#/professional'
  await render()
  await settle({})
  expect(window.location.hash).toBe('#/onboarding')
})

it('retries a failed read without sending the existing account to setup', async () => {
  await render()
  await act(async () => preferenceRead.reject(new Error('offline')))
  preferenceRead = deferred()
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Tentar novamente').click())
  await settle({ onboardingDone: true, profile: { name: 'Ana' } })
  expect(window.location.hash).toBe('#/home')
  expect(container.querySelector('[role="alert"]')).toBeNull()
})

it('ignores the previous account completion when its read finishes after an account switch', async () => {
  await render()
  const previousRead = preferenceRead
  preferenceRead = deferred()
  fixtures.user = { id: '22222222-2222-4222-8222-222222222222', accountType: 'student', displayName: 'Bruna' }
  await render()
  await act(async () => previousRead.resolve({ revision: 3, displayUnit: 'kg', massUnit: 'kg', values: { onboardingDone: true, profile: { name: 'Ana' } } }))
  expect(useStore.getState().S.onboardingDone).toBe(false)
  expect(useStore.getState().S.profile.name).toBe('')
  await settle({ onboardingDone: false })
  expect(window.location.hash).toBe('#/onboarding')
})

it('keeps an already completed local account usable when its cloud read fails', async () => {
  await useStore.getState().activateLocalScope(ACCOUNT)
  useStore.getState().replaceState({ ...structuredClone(DEF), onboardingDone: true, profile: { name: 'Ana' } }, false)
  await render()
  await act(async () => preferenceRead.reject(new Error('offline')))
  expect(window.location.hash).toBe('#/home')
  expect(useStore.getState().S.onboardingDone).toBe(true)
  expect(container.querySelector('[role="alert"]')).toBeNull()
})
