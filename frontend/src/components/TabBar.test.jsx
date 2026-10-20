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
const toggle = () => container.querySelector('.corner-nav-toggle')
function Location() { return <output>{useLocation().pathname}</output> }
function render(path = '/home', onStart = vi.fn()) {
  act(() => root.render(<MemoryRouter initialEntries={[path]}><TabBar onStart={onStart} /><Location /></MemoryRouter>))
}
function pointer(type, x, y) {
  act(() => toggle().dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y })))
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
    click(toggle())
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
    expect(toggle().textContent).toContain('Retomar')
    expect(toggle().querySelector('.nav-icon__dumbbell')).not.toBeNull()
    expect(toggle().querySelector('.nav-icon__play')).not.toBeNull()

    mocks.state.S = { ...mocks.state.S, active: null }
    render()
    expect(start().querySelector('.nav-icon__dumbbell')).not.toBeNull()
    expect(start().querySelector('.nav-icon__play')).toBeNull()
    expect(toggle().querySelector('.nav-icon__play')).toBeNull()
  })

  it('keeps Retomar available from contextual screens while an active workout exists', () => {
    mocks.state.S = { ...mocks.state.S, active: { id: 'active-workout' } }
    render('/stats')
    click(toggle())
    const resume = container.querySelector('[data-tab-key="start"]')
    expect(resume.textContent).toContain('Retomar')
    expect(resume.querySelector('.nav-icon__dumbbell')).not.toBeNull()
    expect(resume.querySelector('.nav-icon__play')).not.toBeNull()
    click(resume)
    expect(container.querySelector('output').textContent).toBe('/workout')
  })

  it('starts collapsed with only the current destination available to assistive technology', () => {
    render('/stats')
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(toggle().getAttribute('aria-label')).toContain('Estatísticas')
    expect(container.querySelector('.corner-nav-main').hasAttribute('inert')).toBe(true)
    expect(container.querySelector('.corner-nav-main').getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.corner-nav-more').hasAttribute('inert')).toBe(true)
  })

  it('keeps destinations mounted during closing so the sheet can fold back', () => {
    render()
    click(toggle())
    const sheet = container.querySelector('.corner-nav-main')
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    expect(sheet.hasAttribute('inert')).toBe(false)
    expect(sheet.querySelectorAll('.corner-nav-tab')).toHaveLength(4)
    click(toggle())
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('.corner-nav-main')).toBe(sheet)
    expect(sheet.hasAttribute('inert')).toBe(true)
  })

  it('keeps the active secondary screen on the collapsed button', () => {
    render('/personal-data')
    expect(toggle().getAttribute('aria-label')).toContain('Dados pessoais')
  })

  it('does not move or detach for small pointer jitter', () => {
    render()
    pointer('pointerdown', 20, 700)
    pointer('pointermove', 22, 699)
    pointer('pointerup', 22, 699)
    expect(container.querySelector('#tabbar').className).not.toContain('is-free')
    expect(container.querySelector('#tabbar').style.left).toBe('')
  })

  it('detaches after dragging when move mode is enabled and keeps the chosen position after toggling', () => {
    render()
    click(toggle())
    click(container.querySelector('.corner-nav-more-trigger'))
    click(container.querySelector('.corner-nav-drag-toggle'))
    const tabbar = container.querySelector('#tabbar')
    vi.spyOn(tabbar, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 680, width: 56, height: 52, right: 56, bottom: 732 })
    pointer('pointerdown', 20, 700)
    pointer('pointermove', 80, 600)
    pointer('pointerup', 80, 600)
    expect(tabbar.className).toContain('is-free')
    expect(tabbar.style.left).toBe('60px')
    expect(tabbar.style.top).toBe('580px')
    const position = tabbar.getAttribute('style')
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 500)
    click(toggle())
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    click(toggle())
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    expect(tabbar.getAttribute('style')).toBe(position)
  })

  it('snaps like a magnet to bottom footer when dragged near the bottom', () => {
    render()
    click(toggle())
    click(container.querySelector('.corner-nav-more-trigger'))
    click(container.querySelector('.corner-nav-drag-toggle'))
    const tabbar = container.querySelector('#tabbar')
    // Drag upwards away from bottom
    vi.spyOn(tabbar, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 680, width: 56, height: 52, right: 56, bottom: 732 })
    pointer('pointerdown', 20, 700)
    pointer('pointermove', 80, 500)
    pointer('pointerup', 80, 500)
    expect(tabbar.className).toContain('is-free')
    expect(tabbar.style.top).toBe('480px')

    // Now drag downwards near the bottom, it should snap back to footer
    vi.spyOn(tabbar, 'getBoundingClientRect').mockReturnValue({ left: 60, top: 480, width: 56, height: 52 })
    pointer('pointerdown', 60, 480)
    // window.innerHeight in happy-dom is typically 768. 768 - 52 = 716. Dragging to near bottom:
    pointer('pointermove', 60, 700)
    pointer('pointerup', 60, 700)
    expect(tabbar.className).not.toContain('is-free')
    expect(tabbar.style.top).toBe('')
    expect(tabbar.style.left).toBe('')
  })

  it('opens more above the pivot, focuses its first entry and restores focus on Escape', () => {
    render()
    click(toggle())
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
    click(toggle())
    click(container.querySelector('.corner-nav-more-trigger'))
    click(container.querySelector('.corner-nav-drag-toggle'))
    const tabbar = container.querySelector('#tabbar')
    vi.spyOn(tabbar, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 680, width: 56, height: 52 })
    // Move to upper half (window.innerHeight is 768, midpoint is ~358, drag to y=200)
    pointer('pointerdown', 20, 700)
    pointer('pointermove', 80, 200)
    pointer('pointerup', 80, 200)
    expect(tabbar.className).toContain('is-free')
    expect(tabbar.className).toContain('opens-down')
    const trigger = container.querySelector('.corner-nav-more-trigger')
    // chevronDown path
    expect(trigger.querySelector('path').getAttribute('d')).toBe('m5.6 9.4 6.4 6.2 6.4-6.2')
  })

  it('only arms movement when its option is selected and reattaches on request after a drag', () => {
    render()
    click(toggle())
    click(container.querySelector('.corner-nav-more-trigger'))
    click(container.querySelector('.corner-nav-drag-toggle'))
    const tabbar = container.querySelector('#tabbar')
    expect(tabbar.className).not.toContain('is-free')
    pointer('pointerdown', 20, 700)
    pointer('pointermove', 80, 500)
    pointer('pointerup', 80, 500)
    expect(tabbar.className).toContain('is-free')
    click(container.querySelector('.corner-nav-more-trigger'))
    click(container.querySelector('.corner-nav-drag-toggle'))
    expect(tabbar.className).not.toContain('is-free')
    expect(tabbar.style.left).toBe('')
    expect(tabbar.style.top).toBe('')
  })

  it('keeps the expanded menu unchanged while the page scrolls', () => {
    render('/stats')
    click(toggle())
    const tabbar = container.querySelector('#tabbar')
    const before = tabbar.innerHTML
    act(() => window.dispatchEvent(new Event('scroll')))
    expect(tabbar.innerHTML).toBe(before)
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps body progress active inside body progress under stats context', () => {
    render('/body-progress')
    click(toggle())
    expect(container.querySelector('[data-tab-key="body-progress"]').getAttribute('aria-current')).toBe('page')
  })

  it('preserves navigation and the workout entry point after expanding', () => {
    render()
    click(toggle())
    click(container.querySelector('[data-tab-key="start"]'))
    expect(container.querySelector('output').textContent).toBe('/plan')
  })

  it('also starts collapsed for an authenticated account', () => {
    mocks.state.isGuest = () => false
    mocks.auth = { status: 'authenticated' }
    render()
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    click(toggle())
    expect(container.querySelectorAll('.corner-nav-tab')).toHaveLength(4)
  })

  it('restores the expanded bottom bar after reopening the app while More starts closed', () => {
    render()
    click(toggle())
    click(container.querySelector('.corner-nav-more-trigger'))
    expect(container.querySelector('.corner-nav-more-trigger').getAttribute('aria-expanded')).toBe('true')
    reopenApp()
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('.corner-nav-main').hasAttribute('inert')).toBe(false)
    expect(container.querySelector('.corner-nav-more-trigger').getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('.corner-nav-more').hasAttribute('inert')).toBe(true)
  })

  it('remembers a subsequent collapse instead of restoring an older expanded bar', () => {
    render()
    click(toggle())
    reopenApp()
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    click(toggle())
    reopenApp()
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
  })

  it('restores a moved position and persists returning the menu to the footer', () => {
    render()
    click(toggle())
    click(container.querySelector('.corner-nav-more-trigger'))
    click(container.querySelector('.corner-nav-drag-toggle'))
    vi.spyOn(container.querySelector('#tabbar'), 'getBoundingClientRect').mockReturnValue({ left: 0, top: 680, width: 56, height: 52 })
    pointer('pointerdown', 20, 700)
    pointer('pointermove', 80, 600)
    pointer('pointerup', 80, 600)
    reopenApp()
    const tabbar = container.querySelector('#tabbar')
    expect(tabbar.className).toContain('is-free')
    expect(tabbar.style.left).toBe('60px')
    expect(tabbar.style.top).toBe('580px')
    click(toggle())
    click(container.querySelector('.corner-nav-more-trigger'))
    click(container.querySelector('.corner-nav-drag-toggle'))
    reopenApp()
    expect(container.querySelector('#tabbar').className).not.toContain('is-free')
    expect(container.querySelector('#tabbar').style.top).toBe('')
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
  })

  it('fits a restored floating pivot to the current viewport', () => {
    window.localStorage.setItem('fpp_navigation_layout_v1', JSON.stringify({ open: true, position: { x: 5000, y: 5000 } }))
    render()
    const tabbar = container.querySelector('#tabbar')
    expect(tabbar.className).toContain('is-free')
    expect(Number.parseFloat(tabbar.style.left)).toBeLessThanOrEqual(window.innerWidth - 56)
    expect(Number.parseFloat(tabbar.style.top)).toBeLessThanOrEqual(window.innerHeight - 52)
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
  })

  it.each(['{broken', JSON.stringify({ open: 'true', position: { x: '20', y: 40 } })])('handles invalid stored preferences safely: %s', value => {
    window.localStorage.setItem('fpp_navigation_layout_v1', value)
    render()
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('#tabbar').className).not.toContain('is-free')
  })

  it('updates contextual items in-place when the user navigates via tab click (no remount)', () => {
    // Mount once at /home and keep TabBar mounted throughout — simulates real app navigation
    render('/home')
    click(toggle())

    // At /home: home | plan | start | stats
    expect(Array.from(container.querySelectorAll('.corner-nav-tab')).map(el => el.getAttribute('data-tab-key')))
      .toEqual(['home', 'plan', 'start', 'stats'])

    // Click "Plano" — navigates to /plan, keeping TabBar mounted
    click(container.querySelector('[data-tab-key="plan"]'))

    // Re-open the menu (go() doesn't close it, but let's ensure it's open)
    if (toggle().getAttribute('aria-expanded') !== 'true') click(toggle())

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
      if (toggle().getAttribute('aria-expanded') !== 'true') click(toggle())
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
    renderAndOpen('/stats')
    expect(Array.from(container.querySelectorAll('.corner-nav-tab')).map(el => el.getAttribute('data-tab-key'))).toEqual(['home', 'stats', 'body-progress', 'history'])
    expect(container.querySelector('[data-tab-key="stats"]').getAttribute('aria-current')).toBe('page')

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

    // 8. Professional context closed pivot & open menu
    act(() => root.unmount())
    root = createRoot(container)
    render('/professional')
    expect(toggle().getAttribute('aria-label')).toContain('Área profissional')
    expect(container.querySelector('.corner-nav-label')?.textContent).toBe('Área profissional')
    click(toggle())
    expect(Array.from(container.querySelectorAll('.corner-nav-tab')).map(el => el.getAttribute('data-tab-key'))).toEqual(['home', 'prof-students', 'prof-programs', 'prof-invites'])

    // 9. Professional profile closed pivot
    act(() => root.unmount())
    root = createRoot(container)
    render('/professional/profile')
    expect(toggle().getAttribute('aria-label')).toContain('Perfil profissional')
    expect(container.querySelector('.corner-nav-label')?.textContent).toBe('Perfil profissional')
    click(toggle())
    expect(Array.from(container.querySelectorAll('.corner-nav-tab')).map(el => el.getAttribute('data-tab-key'))).toEqual(['home', 'prof-students', 'prof-programs', 'prof-invites'])
  })

  it('keeps the same dock slot button elements mounted while transitioning content from Home to Plan', () => {
    // Mount at /home and open menu
    render('/home')
    click(toggle())

    const initialTabs = Array.from(container.querySelectorAll('.corner-nav-tab'))
    expect(initialTabs.length).toBe(4)
    const slot0 = initialTabs[0]
    const slot1 = initialTabs[1]
    const slot2 = initialTabs[2] // start / Começar ou Retomar
    const slot3 = initialTabs[3] // stats

    // Click "Plano" at slot 1 to trigger contextual transition to /plan
    click(slot1)
    if (toggle().getAttribute('aria-expanded') !== 'true') click(toggle())

    const updatedTabs = Array.from(container.querySelectorAll('.corner-nav-tab'))
    // Slot button instances must be preserved identically
    expect(updatedTabs[0]).toBe(slot0)
    expect(updatedTabs[1]).toBe(slot1)
    expect(updatedTabs[2]).toBe(slot2)
    expect(updatedTabs[3]).toBe(slot3)

    // Data-tab-key attributes update to reflect the new identity
    expect(updatedTabs[0].getAttribute('data-tab-key')).toBe('home')
    expect(updatedTabs[1].getAttribute('data-tab-key')).toBe('plan')
    expect(updatedTabs[2].getAttribute('data-tab-key')).toBe('library') // transformed from start to library
    expect(updatedTabs[3].getAttribute('data-tab-key')).toBe('history') // transformed from stats to history

    // Rapid navigation to stats doesn't break the dock
    click(slot0) // back to home
    if (toggle().getAttribute('aria-expanded') !== 'true') click(toggle())
    expect(Array.from(container.querySelectorAll('.corner-nav-tab')).map(el => el.getAttribute('data-tab-key'))).toEqual(['home', 'plan', 'start', 'stats'])
  })
})
