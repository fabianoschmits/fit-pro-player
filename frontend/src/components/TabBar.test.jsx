// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TabBar from './TabBar.jsx'

const mocks = vi.hoisted(() => ({ auth: { status: 'anonymous' }, state: {} }))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector(mocks.state) }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))

let container, root
const click = element => act(() => element.click())
// O botão de recolher foi removido — helper retorna null sempre (não utilizado em novos testes)
const toggle = () => container.querySelector('.corner-nav-toggle')
function Location() { return <output>{useLocation().pathname}</output> }
function render(path = '/home', onStart = vi.fn()) {
  act(() => root.render(<MemoryRouter initialEntries={[path]}><TabBar onStart={onStart} /><Location /></MemoryRouter>))
}
function pointer(type, x, y) {
  // Sem botão de toggle, não há alvo para drag — dispatcha no tabbar diretamente
  const tabbar = container.querySelector('#tabbar')
  act(() => tabbar.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y })))
}
function reopenApp() {
  act(() => root.unmount())
  root = createRoot(container)
  render()
}

beforeEach(() => {
  window.localStorage.clear()
  mocks.auth = { status: 'anonymous' }
  mocks.state = { S: { onboardingDone: true, active: null, routines: [], week: {}, dayPlan: {} }, user: null, isGuest: () => true }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
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

describe('TabBar folding navigation', () => {
  it('keeps the dumbbell when a workout becomes resumable and resumes the same entry point', () => {
    render()
    const start = () => container.querySelector('[data-tab-key="start"]')
    expect(start().querySelector('.nav-icon__dumbbell')).not.toBeNull()
    expect(start().querySelector('.nav-icon__play')).toBeNull()

    mocks.state.S = { ...mocks.state.S, active: { id: 'active-workout' } }
    render()
    expect(start().textContent).toContain('Retomar')
    expect(start().querySelector('.nav-icon__dumbbell')).not.toBeNull()
    expect(start().querySelector('.nav-icon__play')).not.toBeNull()
    click(start())
    expect(container.querySelector('output').textContent).toBe('/workout')

    mocks.state.S = { ...mocks.state.S, active: null }
    render()
    expect(start().querySelector('.nav-icon__dumbbell')).not.toBeNull()
    expect(start().querySelector('.nav-icon__play')).toBeNull()
  })

  it('keeps Retomar available from contextual screens while an active workout exists', () => {
    mocks.state.S = { ...mocks.state.S, active: { id: 'active-workout' } }
    render('/progress')
    const resume = container.querySelector('[data-tab-key="start"]')
    expect(resume.textContent).toContain('Retomar')
    expect(resume.querySelector('.nav-icon__dumbbell')).not.toBeNull()
    expect(resume.querySelector('.nav-icon__play')).not.toBeNull()
    click(resume)
    expect(container.querySelector('output').textContent).toBe('/workout')
  })

  it('starts with all destinations always visible (bar is always open)', () => {
    render('/progress')
    // A barra é sempre aberta — corner-nav-main não tem inert nem aria-hidden
    const main = container.querySelector('.corner-nav-main')
    expect(main).not.toBeNull()
    expect(main.hasAttribute('inert')).toBe(false)
    expect(container.querySelector('.corner-nav-more').hasAttribute('inert')).toBe(true)
  })

  it('keeps a restored mobile pivot on screen with the taller menu after a resize', () => {
    const viewport = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390)
    localStorage.setItem('fpp_navigation_layout_v1', JSON.stringify({ open: true, position: { x: 20, y: 9999 } }))
    render()
    const tabbar = container.querySelector('#tabbar')
    expect(Number.parseFloat(tabbar.style.top)).toBe(window.innerHeight - 68)
    viewport.mockReturnValue(1280)
    act(() => window.dispatchEvent(new Event('resize')))
    viewport.mockReturnValue(390)
    act(() => window.dispatchEvent(new Event('resize')))
    expect(Number.parseFloat(tabbar.style.top)).toBeLessThanOrEqual(window.innerHeight - 68)
  })

  it('keeps destinations always mounted and accessible (no collapsing)', () => {
    render()
    const sheet = container.querySelector('.corner-nav-main')
    expect(sheet.hasAttribute('inert')).toBe(false)
    expect(sheet.querySelectorAll('.corner-nav-tab')).toHaveLength(4)
  })

  it('does not move or detach for small pointer jitter', () => {
    render()
    // Drag via the tabbar element (toggle button foi removido)
    const tabbar = container.querySelector('#tabbar')
    act(() => tabbar.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 700 })))
    act(() => tabbar.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 22, clientY: 699 })))
    act(() => tabbar.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 22, clientY: 699 })))
    expect(container.querySelector('#tabbar').className).not.toContain('is-free')
    expect(container.querySelector('#tabbar').style.left).toBe('')
  })

  it('detaches after dragging when move mode is enabled and keeps the chosen position', () => {
    render()
    click(container.querySelector('.corner-nav-more-trigger'))
    click(container.querySelector('.corner-nav-drag-toggle'))
    const tabbar = container.querySelector('#tabbar')
    vi.spyOn(tabbar, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 680, width: 56, height: 52, right: 56, bottom: 732 })
    // Drag via o pivot interno (more-trigger que ainda existe no DOM)
    const trigger = container.querySelector('.corner-nav-more-trigger')
    act(() => trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 700 })))
    act(() => trigger.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 80, clientY: 600 })))
    act(() => trigger.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 80, clientY: 600 })))
    expect(tabbar.className).toContain('is-free')
    expect(tabbar.style.left).toBe('60px')
    expect(tabbar.style.top).toBe('580px')
  })

  it('snaps like a magnet to bottom footer when dragged near the bottom', () => {
    render()
    click(container.querySelector('.corner-nav-more-trigger'))
    click(container.querySelector('.corner-nav-drag-toggle'))
    const tabbar = container.querySelector('#tabbar')
    const trigger = container.querySelector('.corner-nav-more-trigger')
    vi.spyOn(tabbar, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 680, width: 56, height: 52, right: 56, bottom: 732 })
    act(() => trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 700 })))
    act(() => trigger.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 80, clientY: 500 })))
    act(() => trigger.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 80, clientY: 500 })))
    expect(tabbar.className).toContain('is-free')
    expect(tabbar.style.top).toBe('480px')

    vi.spyOn(tabbar, 'getBoundingClientRect').mockReturnValue({ left: 60, top: 480, width: 56, height: 52 })
    act(() => trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 60, clientY: 480 })))
    act(() => trigger.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 60, clientY: 700 })))
    act(() => trigger.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 60, clientY: 700 })))
    expect(tabbar.className).not.toContain('is-free')
    expect(tabbar.style.top).toBe('')
    expect(tabbar.style.left).toBe('')
  })

  it('opens more above the pivot, focuses its first entry and restores focus on Escape', () => {
    render()
    const trigger = container.querySelector('.corner-nav-more-trigger')
    click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.querySelector('path').getAttribute('d')).toBe('m5.6 14.6 6.4-6.2 6.4 6.2')
    expect(document.activeElement.textContent).toContain('Dados pessoais')
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
    expect(container.querySelector('.corner-nav-more').hasAttribute('inert')).toBe(true)
  })

  it('switches more menu to open downwards when moved into the upper half of the screen', () => {
    render()
    click(container.querySelector('.corner-nav-more-trigger'))
    click(container.querySelector('.corner-nav-drag-toggle'))
    const tabbar = container.querySelector('#tabbar')
    const trigger = container.querySelector('.corner-nav-more-trigger')
    vi.spyOn(tabbar, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 680, width: 56, height: 52 })
    act(() => trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 700 })))
    act(() => trigger.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 80, clientY: 200 })))
    act(() => trigger.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 80, clientY: 200 })))
    expect(tabbar.className).toContain('is-free')
    expect(tabbar.className).toContain('opens-down')
    const moreTrigger = container.querySelector('.corner-nav-more-trigger')
    expect(moreTrigger.querySelector('path').getAttribute('d')).toBe('m5.6 9.4 6.4 6.2 6.4-6.2')
  })

  it('only arms movement when its option is selected and reattaches on request after a drag', () => {
    render()
    click(container.querySelector('.corner-nav-more-trigger'))
    click(container.querySelector('.corner-nav-drag-toggle'))
    const tabbar = container.querySelector('#tabbar')
    expect(tabbar.className).not.toContain('is-free')
    const trigger = container.querySelector('.corner-nav-more-trigger')
    act(() => trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 700 })))
    act(() => trigger.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 80, clientY: 500 })))
    act(() => trigger.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 80, clientY: 500 })))
    expect(tabbar.className).toContain('is-free')
    click(container.querySelector('.corner-nav-more-trigger'))
    click(container.querySelector('.corner-nav-drag-toggle'))
    expect(tabbar.className).not.toContain('is-free')
    expect(tabbar.style.left).toBe('')
    expect(tabbar.style.top).toBe('')
  })

  it('keeps the bar always open while page scrolls', () => {
    render('/progress')
    const tabbar = container.querySelector('#tabbar')
    const before = tabbar.innerHTML
    act(() => window.dispatchEvent(new Event('scroll')))
    expect(tabbar.innerHTML).toBe(before)
    // A barra permanece sempre aberta — main não tem inert
    expect(container.querySelector('.corner-nav-main').hasAttribute('inert')).toBe(false)
  })

  it('keeps body progress active inside body progress under stats context', () => {
    render('/body-progress')
    expect(container.querySelector('[data-tab-key="progress"]').getAttribute('aria-current')).toBe('page')
  })

  it('preserves navigation and the workout entry point (tabs always visible)', () => {
    render()
    click(container.querySelector('[data-tab-key="start"]'))
    expect(container.querySelector('output').textContent).toBe('/plan')
  })

  it('also shows all tabs for an authenticated account', () => {
    mocks.state.isGuest = () => false
    mocks.auth = { status: 'authenticated' }
    render()
    expect(container.querySelectorAll('.corner-nav-tab')).toHaveLength(4)
  })

  it('restores the bottom bar after reopening the app while More starts closed', () => {
    render()
    click(container.querySelector('.corner-nav-more-trigger'))
    expect(container.querySelector('.corner-nav-more-trigger').getAttribute('aria-expanded')).toBe('true')
    reopenApp()
    expect(container.querySelector('.corner-nav-main').hasAttribute('inert')).toBe(false)
    expect(container.querySelector('.corner-nav-more-trigger').getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('.corner-nav-more').hasAttribute('inert')).toBe(true)
  })

  it('restores a moved position and persists returning the menu to the footer', () => {
    render()
    click(container.querySelector('.corner-nav-more-trigger'))
    click(container.querySelector('.corner-nav-drag-toggle'))
    const trigger = container.querySelector('.corner-nav-more-trigger')
    vi.spyOn(container.querySelector('#tabbar'), 'getBoundingClientRect').mockReturnValue({ left: 0, top: 680, width: 56, height: 52 })
    act(() => trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 700 })))
    act(() => trigger.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 80, clientY: 600 })))
    act(() => trigger.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 80, clientY: 600 })))
    reopenApp()
    const tabbar = container.querySelector('#tabbar')
    expect(tabbar.className).toContain('is-free')
    expect(tabbar.style.left).toBe('60px')
    expect(tabbar.style.top).toBe('580px')
    click(container.querySelector('.corner-nav-more-trigger'))
    click(container.querySelector('.corner-nav-drag-toggle'))
    reopenApp()
    expect(container.querySelector('#tabbar').className).not.toContain('is-free')
    expect(container.querySelector('#tabbar').style.top).toBe('')
  })

  it('fits a restored floating pivot to the current viewport', () => {
    window.localStorage.setItem('fpp_navigation_layout_v1', JSON.stringify({ open: true, position: { x: 5000, y: 5000 } }))
    render()
    const tabbar = container.querySelector('#tabbar')
    expect(tabbar.className).toContain('is-free')
    expect(Number.parseFloat(tabbar.style.left)).toBeLessThanOrEqual(window.innerWidth - 28)
    expect(Number.parseFloat(tabbar.style.top)).toBeLessThanOrEqual(window.innerHeight - 52)
  })

  it('handles unparseable stored preferences safely — falls back to open', () => {
    window.localStorage.setItem('fpp_navigation_layout_v1', '{broken')
    render()
    expect(container.querySelector('.corner-nav-main').hasAttribute('inert')).toBe(false)
    expect(container.querySelector('#tabbar').className).not.toContain('is-free')
  })

  it('handles stored preferences with invalid types safely — falls back to defaults', () => {
    window.localStorage.setItem('fpp_navigation_layout_v1', JSON.stringify({ open: 'true', position: { x: '20', y: 40 } }))
    render()
    // A barra permanece sempre visível independente do valor salvo
    expect(container.querySelector('.corner-nav-main').hasAttribute('inert')).toBe(false)
    expect(container.querySelector('#tabbar').className).not.toContain('is-free')
  })

  it('updates contextual items in-place when the user navigates via tab click (no remount)', () => {
    render('/home')

    // At /home: home | plan | start | stats
    expect(Array.from(container.querySelectorAll('.corner-nav-tab')).map(el => el.getAttribute('data-tab-key')))
      .toEqual(['home', 'plan', 'start', 'progress'])

    // Click "Plano" — navigates to /plan, keeping TabBar mounted
    click(container.querySelector('[data-tab-key="plan"]'))

    // At /plan (training context): home | plan | library | history
    expect(container.querySelector('output').textContent).toBe('/plan')
    expect(Array.from(container.querySelectorAll('.corner-nav-tab')).map(el => el.getAttribute('data-tab-key')))
      .toEqual(['home', 'plan', 'library', 'history'])
    expect(container.querySelector('[data-tab-key="plan"]').getAttribute('aria-current')).toBe('page')
  })

  it('renders dynamic contextual items and labels according to the current area', () => {
    const renderAndOpen = path => {
      act(() => root.unmount())
      root = createRoot(container)
      render(path)
    }

    // 1. Training context
    renderAndOpen('/plan')
    expect(Array.from(container.querySelectorAll('.corner-nav-tab')).map(el => el.getAttribute('data-tab-key'))).toEqual(['home', 'plan', 'library', 'history'])
    expect(container.querySelector('[data-tab-key="plan"]').getAttribute('aria-current')).toBe('page')

    // 2. Library
    renderAndOpen('/library')
    expect(Array.from(container.querySelectorAll('.corner-nav-tab')).map(el => el.getAttribute('data-tab-key'))).toEqual(['home', 'plan', 'library', 'history'])
    expect(container.querySelector('[data-tab-key="library"]').getAttribute('aria-current')).toBe('page')

    // 3. Stats context
    renderAndOpen('/progress')
    expect(Array.from(container.querySelectorAll('.corner-nav-tab')).map(el => el.getAttribute('data-tab-key'))).toEqual(['home', 'plan', 'start', 'progress'])
    expect(container.querySelector('[data-tab-key="progress"]').getAttribute('aria-current')).toBe('page')

    // 4. Support context
    renderAndOpen('/support')
    expect(Array.from(container.querySelectorAll('.corner-nav-tab')).map(el => el.getAttribute('data-tab-key'))).toEqual(['home', 'support', 'support-tickets', 'support-new'])
    expect(container.querySelector('[data-tab-key="support"]').getAttribute('aria-current')).toBe('page')

    // 5. Account context
    renderAndOpen('/settings')
    expect(Array.from(container.querySelectorAll('.corner-nav-tab')).map(el => el.getAttribute('data-tab-key'))).toEqual(['home', 'settings', 'personal-data', 'privacy-settings'])
    expect(container.querySelector('[data-tab-key="settings"]').getAttribute('aria-current')).toBe('page')

    // 6. Student professionals context
    renderAndOpen('/student/professionals')
    expect(Array.from(container.querySelectorAll('.corner-nav-tab')).map(el => el.getAttribute('data-tab-key'))).toEqual(['home', 'student-list', 'student-materials', 'student-add'])
    expect(container.querySelector('[data-tab-key="student-list"]').getAttribute('aria-current')).toBe('page')

    // 7. Professional context
    renderAndOpen('/professional')
    expect(Array.from(container.querySelectorAll('.corner-nav-tab')).map(el => el.getAttribute('data-tab-key'))).toEqual(['home', 'prof-students', 'prof-programs', 'prof-invites'])

    // 8. Professional profile context
    renderAndOpen('/professional/profile')
    expect(Array.from(container.querySelectorAll('.corner-nav-tab')).map(el => el.getAttribute('data-tab-key'))).toEqual(['home', 'prof-students', 'prof-programs', 'prof-invites'])
  })

  it('keeps the same dock slot button elements mounted while transitioning content from Home to Plan', () => {
    render('/home')

    const initialTabs = Array.from(container.querySelectorAll('.corner-nav-tab'))
    expect(initialTabs.length).toBe(4)
    const slot0 = initialTabs[0]
    const slot1 = initialTabs[1]
    const slot2 = initialTabs[2]
    const slot3 = initialTabs[3]

    // Click "Plano" at slot 1 to trigger contextual transition to /plan
    click(slot1)

    const updatedTabs = Array.from(container.querySelectorAll('.corner-nav-tab'))
    // Slot button instances must be preserved identically
    expect(updatedTabs[0]).toBe(slot0)
    expect(updatedTabs[1]).toBe(slot1)
    expect(updatedTabs[2]).toBe(slot2)
    expect(updatedTabs[3]).toBe(slot3)

    // Data-tab-key attributes update to reflect the new identity
    expect(updatedTabs[0].getAttribute('data-tab-key')).toBe('home')
    expect(updatedTabs[1].getAttribute('data-tab-key')).toBe('plan')
    expect(updatedTabs[2].getAttribute('data-tab-key')).toBe('library')
    expect(updatedTabs[3].getAttribute('data-tab-key')).toBe('history')

    // Rapid navigation to stats doesn't break the dock
    click(slot0) // back to home
    expect(Array.from(container.querySelectorAll('.corner-nav-tab')).map(el => el.getAttribute('data-tab-key'))).toEqual(['home', 'plan', 'start', 'progress'])
  })
})
