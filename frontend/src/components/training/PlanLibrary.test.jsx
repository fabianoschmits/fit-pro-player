// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../../store/useStore.js'
import PlanLibrary from './PlanLibrary.jsx'
const mocks = vi.hoisted(() => ({ page: vi.fn(), seen: vi.fn(), open: vi.fn() }))
vi.mock('../../auth/AuthProvider.jsx', () => ({ useAuth: () => ({ user: { id: 'student' } }) }))
vi.mock('../../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => ({ planLibrary: mocks.page, markLibraryWorkoutSeen: mocks.seen }) }))
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ openSheet: mocks.open }) } }))
const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const delivery = () => ({ id: 'delivery', source_type: 'professional', professional_name: 'Ana',
  workout_updates: { monday: 'changed-version' },
  version: { id: 'version', weekly_plan: Object.fromEntries(days.map(day => [day, [{ exerciseId: '0025', sets: 3, reps: 10, load: 20 }]])), workout_titles: Object.fromEntries(days.map(day => [day, day])) } })
let root, container
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mocks.page.mockReset().mockResolvedValue({ items: [delivery()], total: 1 })
  mocks.seen.mockReset().mockResolvedValue(null)
  mocks.open.mockReset()
  useStore.setState({ S: structuredClone(DEF) })
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove() })
it('shows five received workouts and reveals more on request', async () => {
  await act(async () => root.render(<PlanLibrary />))
  expect(container.querySelectorAll('.received-workout-card')).toHaveLength(5)
  const more = [...container.querySelectorAll('button')].find(button => button.textContent === 'Ver mais')
  expect(more).toBeDefined()
  await act(async () => more.click())
  expect(container.querySelectorAll('.received-workout-card')).toHaveLength(7)
})
it('marks only changed workouts and acknowledges opening their details', async () => {
  await act(async () => root.render(<PlanLibrary />))
  expect(container.querySelectorAll('.workout-update-badge')).toHaveLength(1)
  const updated = container.querySelector('.workout-update-badge').closest('button')
  await act(async () => updated.click())
  expect(mocks.open).toHaveBeenCalledTimes(1)
  expect(mocks.seen).toHaveBeenCalledWith('delivery', 'monday', 'changed-version')
  expect(container.querySelectorAll('.workout-update-badge')).toHaveLength(0)
})
it('keeps the badge if acknowledging the update fails', async () => {
  mocks.seen.mockRejectedValue(new Error('offline'))
  await act(async () => root.render(<PlanLibrary />))
  await act(async () => container.querySelector('.workout-update-badge').closest('button').click())
  expect(container.querySelectorAll('.workout-update-badge')).toHaveLength(1)
  expect(container.querySelector('[role="alert"]')).not.toBeNull()
})
