// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import RoutineEdit, { RoutineTemplatePicker } from './RoutineEdit.jsx'
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
  const save = () => container.querySelector('.routine-completion-actions button.primary')
  await act(async () => save().click())
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(container.querySelector('[role="status"][data-state="error"]')).not.toBeNull()
  expect(save().disabled).toBe(false)

  write.mockRestore()
  await act(async () => save().click())
  expect(useStore.getState().persistence.state).toBe('saved')
  expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith('/plan')
})

it('shows deletion for a user-created routine directly below the ready action', () => {
  const actions = container.querySelector('.routine-completion-actions')
  expect(actions).not.toBeNull()
  expect(actions.textContent).toContain('Pronto')
  expect(actions.textContent).toContain('Excluir treino')
})

it('shows deletion for a generated starter routine too', () => {
  useStore.setState({ S: { ...structuredClone(DEF), routines: [{ id: 'routine', name: 'Treino A', starterKey: 'starter-a', ex: [] }] }, persistence: { state: 'saved', error: null } })
  act(() => root.render(<RoutineEdit />))
  expect(container.querySelector('.routine-completion-actions').textContent).toContain('Excluir treino')
})

it('offers an understated picker for suggested or existing routines while creating an empty routine', () => {
  expect(container.textContent).toContain('Começar com um treino sugerido ou existente')
})

it('loads a copy of the selected suggested routine into the editable draft', async () => {
  const close = vi.fn()
  act(() => root.render(<RoutineTemplatePicker currentId="routine" close={close} />))
  const suggested = container.querySelector('.routine-template-option')
  await act(async () => {
    suggested.click()
    await new Promise(resolve => setTimeout(resolve, 350))
  })
  const draft = useStore.getState().S.routines.find(routine => routine.id === 'routine')
  expect(draft.ex.length).toBeGreaterThan(0)
  expect(draft.starterKey).toBeUndefined()
  expect(close).toHaveBeenCalledOnce()
})
