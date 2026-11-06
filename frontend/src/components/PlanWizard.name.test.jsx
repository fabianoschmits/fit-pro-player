// @vitest-environment happy-dom
import  { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { applyPersonalizedPlan } from '../lib/personalized-plan.js'
import { todayISO } from '../lib/format.js'
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
  useUI.getState().closeAll()
})

it.each(['finish', 'progress', 'changed goal', 'confirm changed goal', 'confirm daily', 'confirm four days'])('asks before refitting managed routines from editing via %s', async flow => {
  const state = structuredClone(DEF)
  state.profile = { ...state.profile, name: 'Ana Souza', heightCm: 175, startWeight: 75, goal: 'build_muscle', experience: 'advanced', preferredWorkoutMinutes: 90 }
  const routines = applyPersonalizedPlan(state, state.profile, 3)
  state.week = { 1: routines[0].id, 3: routines[1].id, 5: routines[2].id }
  state.onboardingDone = true
  useStore.setState({ S: state, persistence: { state: 'saved' } })
  const before = structuredClone(state.routines)
  const onDone = vi.fn()
  await act(async () => root.render(<PlanWizard editing onDone={onDone} />))
  for (let step = 0; step < 5; step++) {
    if (step === 4 && flow.includes('changed goal')) await act(async () => container.querySelector('.wizard-choice-grid button').click())
    await act(async () => container.querySelector('.wizard-actions button:last-child').click())
  }
  if (flow === 'confirm daily') await act(async () => container.querySelector('.wizard-choice-grid button:last-child').click())
  await act(async () => [...container.querySelectorAll('.workout-minutes-options button')].find(button => button.textContent === '40 min').click())
  if (flow !== 'progress') await act(async () => container.querySelector('.wizard-actions button:last-child').click())
  if (flow === 'confirm daily') await act(async () => container.querySelector('.wizard-routine-grid button').click())
  if (flow === 'confirm four days') await act(async () => container.querySelectorAll('.wizard-week button')[1].click())
  await act(async () => container.querySelector(flow === 'progress' ? '.wizard-actions button:first-child' : '.wizard-actions button:last-child').click())
  expect(useStore.getState().S.profile.preferredWorkoutMinutes).toBe(40)
  expect(useStore.getState().S.routines).toEqual(before)
  if (flow !== 'confirm four days') expect(useStore.getState().S.week).toEqual(state.week)
  expect(onDone).toHaveBeenCalledOnce()
  expect(useUI.getState().sheets).toHaveLength(1)
  const dialog = useUI.getState().sheets[0].render(() => useUI.getState().closeAll()).props
  expect(dialog.title).toBe('Readequar seus treinos?')
  if (flow === 'finish' || flow.startsWith('confirm')) {
    await act(async () => dialog.onConfirm())
    if (flow === 'finish') expect(useStore.getState().S.routines[0].ex.length).toBeLessThan(before[0].ex.length)
    else if (flow === 'confirm changed goal') expect(useStore.getState().S.routines.every(routine => routine.planGoal === 'lose_weight')).toBe(true)
    else if (flow === 'confirm daily') expect(useStore.getState().S.dayPlan[todayISO()]).toBe(useStore.getState().S.routines.find(routine => routine.personalizedKey === 'chest').id)
    else expect(new Set(Object.values(useStore.getState().S.week)).size).toBe(4)
  } else {
    dialog.close()
    expect(useStore.getState().S.routines).toEqual(before)
  }
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
