// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import RoutineEdit from './RoutineEdit.jsx'
import { DEF, useStore } from '../store/useStore.js'

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'routine' }), useNavigate: () => mocks.navigate }))
vi.mock('../components/Media.jsx', () => ({ Thumb: () => null }))

let root, container
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  mocks.navigate.mockClear()
  useStore.setState({ S: { ...structuredClone(DEF), routines: [{ id: 'routine', name: 'Treino A', ex: [] }] }, persistence: { state: 'saved', error: null } })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<RoutineEdit />))
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

it('stays on the routine when local persistence fails and permits a successful save retry', async () => {
  const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
  const save = () => container.querySelector('.routine-builder > button.primary')
  await act(async () => save().click())
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(container.querySelector('[role="status"][data-state="error"]')).not.toBeNull()
  expect(save().disabled).toBe(false)

  write.mockRestore()
  await act(async () => save().click())
  expect(useStore.getState().persistence.state).toBe('saved')
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith('/plan')
})
