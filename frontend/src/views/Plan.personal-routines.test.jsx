// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import Plan from './Plan.jsx'

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useLocation: () => ({ search: '' }) }))
vi.mock('../components/training/PlanLibrary.jsx', () => ({ default: () => <section className="received-workouts">Treinos recebidos do profissional</section> }))

let root, container
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  mocks.navigate.mockClear()
  useStore.setState({ S: {
    ...structuredClone(DEF), onboardingDone: true,
    assignedProgram: { versionId: 'professional-version' },
    routines: [{ id: 'professional-routine', name: 'Treino profissional', assigned: true, ex: [] }],
    week: { 1: 'professional-routine' },
  }, persistence: { state: 'saved', error: null } })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove() })

it.each(['weekly', 'daily'])('allows creating a personal workout below professional workouts in %s mode', async mode => {
  useStore.setState({ S: { ...useStore.getState().S, planMode: mode } })
  await act(async () => root.render(<Plan />))
  const received = container.querySelector('.received-workouts')
  const personal = container.querySelector('.created-workouts')
  expect(received.compareDocumentPosition(personal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const add = personal.querySelector('button')
  expect(add).not.toBeNull()
  await act(async () => add.click())
  const state = useStore.getState().S
  const created = state.routines.find(r => r.id !== 'professional-routine')
  expect(created).toMatchObject({ ex: [] })
  expect(created.assigned).toBeUndefined()
  expect(mocks.navigate).toHaveBeenCalledWith('/plan/r/' + created.id)
  expect(state.assignedProgram).toEqual({ versionId: 'professional-version' })
  expect(state.week).toEqual({ 1: 'professional-routine' })
  expect(state.routines[0]).toEqual({ id: 'professional-routine', name: 'Treino profissional', assigned: true, ex: [] })
})
