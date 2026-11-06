// @vitest-environment happy-dom
import  { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import PlanWizard from './PlanWizard.jsx'

const auth = vi.hoisted(() => ({ user: null }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => auth }))
vi.mock('framer-motion', () => ({ motion: { div: 'div' }, AnimatePresence: ({ children }) => children, useReducedMotion: () => true }))
let root, container
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  auth.user = { displayName: 'joÃO da SILVA' }
  useStore.getState().update(s => { s.profile.name = '' })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})
it('prefills the first-access name from the account', async () => {
  await act(async () => root.render(<PlanWizard />))
  expect(container.querySelector('#wizard-name').value).toBe('João da Silva')
})
it('preserves an existing profile name', async () => {
  useStore.getState().update(s => { s.profile.name = 'Ana Souza' })
  await act(async () => root.render(<PlanWizard />))
  expect(container.querySelector('#wizard-name').value).toBe('Ana Souza')
})
it('does not regenerate an edited legacy routine when only duration changes', async () => {
  const legacy = { id: 'legacy', name: 'Chest Day', starterKey: 'Chest Day', ex: [{ id: '0025', sets: 5, reps: 12, weight: 80 }] }
  const week = { 1: 'legacy', 3: 'legacy', 5: 'legacy' }
  useStore.getState().update(s => {
    s.profile = { ...s.profile, name: 'Ana Souza', heightCm: 175, startWeight: 75, goal: 'build_muscle', experience: 'intermediate', preferredWorkoutMinutes: 60 }
    s.bodyweight = []
    s.routines = [structuredClone(legacy)]
    s.week = { ...week }
    s.planMode = 'weekly'
    s.onboardingDone = true
  })
  await act(async () => root.render(<PlanWizard editing />))
  for (let step = 0; step < 6; step++) {
    if (step === 5) await act(async () => [...container.querySelectorAll('.workout-minutes-options button')].find(button => button.textContent === '45 min').click())
    await act(async () => container.querySelector('.wizard-actions button:last-child').click())
  }
  await act(async () => container.querySelector('.wizard-actions button:last-child').click())
  expect(useStore.getState().S.profile.preferredWorkoutMinutes).toBe(45)
  expect(useStore.getState().S.routines).toEqual([legacy])
  expect(useStore.getState().S.week).toEqual(week)
})
