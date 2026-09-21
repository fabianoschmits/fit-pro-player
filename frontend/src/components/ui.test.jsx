import React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppHeader } from './AppHeader.jsx'

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('./Icon.jsx', () => ({ default: ({ name, ...props }) => React.createElement('span', { ...props, 'data-icon': name }) }))

let dom
let root
let container

beforeEach(() => {
  dom = new Window()
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  mocks.navigate.mockReset()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('AppHeader', () => {
  it('renders a contextual title and an accessible back action', () => {
    act(() => root.render(<AppHeader title="Histórico" subtitle="Treinos concluídos" backTo="/more" />))

    expect(container.querySelector('h1')?.textContent).toBe('Histórico')
    expect(container.querySelector('.app-header-back')?.getAttribute('aria-label')).toBeTruthy()
    expect(container.textContent).toContain('Treinos concluídos')

    act(() => container.querySelector('.app-header-back').click())
    expect(mocks.navigate).toHaveBeenCalledWith('/more')
  })
})
