// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TabBar from './TabBar.jsx'

const mocks = vi.hoisted(() => ({
  auth: { status: 'anonymous' },
  state: {
    S: { onboardingDone: true, active: null, routines: [], week: {}, dayPlan: {} },
    user: null,
    isGuest: () => true,
  },
}))

vi.mock('../store/useStore.js', () => ({
  useStore: selector => selector(mocks.state),
}))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))

let container
let root

beforeEach(() => {
  mocks.auth = { status: 'anonymous' }
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
  it('closes the expanded menu when the user taps Fechar', () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/home']}>
          <TabBar onStart={vi.fn()} />
        </MemoryRouter>,
      )
    })

    const toggle = container.querySelector('.corner-nav-toggle')
    act(() => toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(container.querySelector('#tabbar').className).not.toContain('is-open')
    expect(container.querySelector('.corner-nav-main')).toBeNull()
  })

  it('starts attached to the mobile edge and detaches only after being dragged', () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/home']}>
          <TabBar onStart={vi.fn()} />
        </MemoryRouter>,
      )
    })

    const tabbar = container.querySelector('#tabbar')
    const toggle = container.querySelector('.corner-nav-toggle')
    expect(tabbar.className).not.toContain('is-free')

    act(() => {
      toggle.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 700 }))
      toggle.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 80, clientY: 640 }))
      toggle.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 80, clientY: 640 }))
    })

    expect(tabbar.className).toContain('is-free')
  })

  it('keeps the toggle and every primary destination in one navigation card', () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/home']}>
          <TabBar onStart={vi.fn()} />
        </MemoryRouter>,
      )
    })

    const card = container.querySelector('.corner-nav-shell')
    expect(card.querySelector('.corner-nav-toggle')).not.toBeNull()
    expect(card.querySelectorAll('.corner-nav-tab')).toHaveLength(4)
  })

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
    expect(tabbar.className).toBe('corner-nav is-open')
    expect(container.querySelectorAll('.corner-nav-tab')).toHaveLength(4)
    expect(container.querySelector('[aria-label="Abrir mais opções"]')).not.toBeNull()

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 })
    act(() => window.dispatchEvent(new Event('scroll')))

    expect(tabbar.className).toBe('corner-nav is-open')
    expect(tabbar.innerHTML).toBe(before)
    expect(container.querySelectorAll('.corner-nav-tab')).toHaveLength(4)
  })

  it('keeps Stats selected inside body progress', () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/body-progress']}>
          <TabBar onStart={vi.fn()} />
        </MemoryRouter>,
      )
    })

    const stats = container.querySelector('[data-tab-key="stats"]')
    expect(stats.getAttribute('aria-current')).toBe('page')
  })

  it('shows the complete menu for an authenticated Supabase account', () => {
    mocks.state.isGuest = () => false
    mocks.auth = { status: 'authenticated' }
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/home']}>
          <TabBar onStart={vi.fn()} />
        </MemoryRouter>,
      )
    })

    expect(container.querySelectorAll('.corner-nav-tab')).toHaveLength(4)
  })
})
