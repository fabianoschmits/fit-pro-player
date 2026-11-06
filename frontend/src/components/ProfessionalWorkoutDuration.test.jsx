// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ProfessionalWorkoutDuration from './ProfessionalWorkoutDuration.jsx'
import { useUI } from '../store/useUI.js'

let root, container
const routine = { id: 'draft', name: 'Treino A', ex: [{ id: '0025', sets: 5, reps: 15, rest: 120, weight: 80 }, { id: '0043', sets: 5, reps: 15, rest: 120, weight: 20 }, { id: '0031', sets: 5, reps: 15, rest: 120, weight: 30 }] }
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); useUI.setState({ sheet: null }); container.remove(); vi.restoreAllMocks() })
it('previews all original occurrences and applies only after explicit confirmation without mutating the prescription', async () => {
  const onApply = vi.fn(), original = structuredClone(routine), close = vi.fn()
  let sheet
  vi.spyOn(useUI.getState(), 'openSheet').mockImplementation(render => { sheet = render(close) })
  await act(async () => root.render(<ProfessionalWorkoutDuration routine={routine} studentProfile={{ preferredWorkoutMinutes: 15 }} onApply={onApply} />))
  await act(async () => container.querySelector('button').click())
  expect(onApply).not.toHaveBeenCalled()
  await act(async () => root.render(sheet))
  expect(container.querySelectorAll('li')).toHaveLength(3)
  expect(container.textContent).toContain('Retirar do rascunho')
  await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Confirmar adequação').click())
  expect(onApply).toHaveBeenCalledOnce()
  expect(onApply.mock.calls[0][0].length).toBeGreaterThan(0)
  expect(onApply.mock.calls[0][0].length).toBeLessThan(3)
  expect(onApply.mock.calls[0][0].every(entry => original.ex.some(source => JSON.stringify(source) === JSON.stringify(entry)))).toBe(true)
  expect(routine).toEqual(original)
  expect(close).toHaveBeenCalledOnce()
})
it('does not offer student adaptation on a global template', async () => {
  await act(async () => root.render(<ProfessionalWorkoutDuration routine={routine} />))
  expect(container.textContent).toContain('duração estimada')
  expect(container.querySelector('button')).toBeNull()
})
