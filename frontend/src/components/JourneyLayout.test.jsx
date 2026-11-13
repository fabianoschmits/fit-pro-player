// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('./BodyMap.jsx', () => ({ default: () => <span /> }))
import JourneyLayout from './JourneyLayout.jsx'
let root, container, scroll
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); scroll.mockRestore() })
it('announces each new stage by focusing its heading and returning to its start', async () => {
  await act(async () => root.render(<JourneyLayout title="Primeira etapa" />))
  expect(container.querySelector('h1,h2,h3')).toBe(container.querySelector('h1'))
  expect(document.activeElement).toBe(container.querySelector('h1'))
  await act(async () => root.render(<JourneyLayout title="Próxima etapa" />))
  expect(document.activeElement).toBe(container.querySelector('h1'))
  expect(document.activeElement.textContent).toBe('Próxima etapa')
  expect(scroll).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' })
})
