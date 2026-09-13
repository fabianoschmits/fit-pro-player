// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TabBar from './TabBar.jsx'

const mocks = vi.hoisted(() => ({
  state: {
    S: { onboardingDone: true, active: null, routines: [], week: {}, dayPlan: {} },
    user: null,
    isGuest: () => true,
  },
}))

vi.mock('../store/useStore.js', () => ({
  useStore: selector => selector(mocks.state),
}))

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

describe('TabBar scroll stability', () => {
  it('keeps the complete menu unchanged while the page scrolls', () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/stats']}>
          <TabBar onStart={vi.fn()} />
        </MemoryRouter>,
      )
    })

    const tabbar = container.querySelector('#tabbar')
    const before = tabbar.innerHTML
    expect(tabbar.className).toBe('')
    expect(container.querySelectorAll('.tab-label')).toHaveLength(5)

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 })
    act(() => window.dispatchEvent(new Event('scroll')))

    expect(tabbar.className).toBe('')
    expect(tabbar.innerHTML).toBe(before)
    expect(container.querySelectorAll('.tab-label')).toHaveLength(5)
  })
})
