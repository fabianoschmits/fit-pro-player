// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  state: {
    S: {
      theme: 'dark',
      routines: [],
      week: {},
      dayPlan: {},
      workouts: [],
      bodyweight: [],
      active: null,
      planMode: 'weekly',
      onboardingDone: true,
      displayUnit: 'kg',
    },
  },
  ready: true,
  auth: null,
  scope: { kind: 'anonymous' },
  history: undefined,
  update: vi.fn(recipe => recipe(mocks.state.S)),
}))

vi.mock('../store/useStore.js', () => ({
  useStore: selector => selector({ S: mocks.state.S, ready: mocks.ready, accountHistory: mocks.history, getActiveLocalScope: () => mocks.scope, update: mocks.update }),
}))
vi.mock('../auth/auth-context.js', () => ({ useOptionalAuth: () => mocks.auth }))
vi.mock('../sheets.jsx', () => ({
  bwSheet: vi.fn(),
  goalSheet: vi.fn(),
  dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(),
  startFlow: vi.fn(),
  loadStarterPlan: vi.fn(),
  bwDeltaColor: () => 'var(--acc)',
  repeatWorkout: vi.fn(),
  WorkoutRow: () => null,
  workoutDetailSheet: vi.fn(),
}))
vi.mock('../components/LineChart.jsx', () => ({ default: () => null }))
vi.mock('../components/PlanProgress.jsx', () => ({ default: () => null }))
vi.mock('../components/PwaInstallPrompt.jsx', () => ({ maybeOpenPwaInstallPrompt: () => () => {} }))
vi.mock('../components/Icon.jsx', () => ({ default: ({ name }) => React.createElement('span', { 'data-icon': name }) }))
vi.mock('../lib/i18n.js', () => ({ t: value => value, dateLocale: () => 'pt-BR' }))

import Home from './Home.jsx'

let root
let container

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mocks.auth = null
  mocks.scope = { kind: 'anonymous' }
  mocks.history = undefined
  mocks.ready = true
  mocks.state.S.theme = 'dark'
  mocks.update.mockClear()
  mocks.update.mockImplementation(recipe => recipe(mocks.state.S))
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  container.remove()
})

describe('home theme toggle', () => {
  it('puts a theme control in the top-right titlebar and switches dark to light', async () => {
    await act(async () => {
      root.render(<MemoryRouter><Home /></MemoryRouter>)
    })

    const toggle = container.querySelector('.home-theme-toggle')
    expect(toggle).toBeTruthy()
    expect(toggle.compareDocumentPosition(container.querySelector('h1')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    expect(toggle.querySelector('[data-icon="sun"]')).toBeTruthy()

    await act(async () => { toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(mocks.update).toHaveBeenCalled()
    expect(mocks.state.S.theme).toBe('light')
  })

  it('shows the moon control in light theme and switches back to dark', async () => {
    mocks.state.S.theme = 'light'
    await act(async () => {
      root.render(<MemoryRouter><Home /></MemoryRouter>)
    })

    const toggle = container.querySelector('.home-theme-toggle')
    expect(toggle.querySelector('[data-icon="moon"]')).toBeTruthy()
    await act(async () => { toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(mocks.state.S.theme).toBe('dark')
  })
})

describe('home next action', () => {
  it('offers the comparison for a completed workout without an active session', async () => {
    mocks.state.S.active = null
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    mocks.state.S.workouts = [{ id: 'finished', d: date, name: 'Treino concluído', start: 1, end: 2, entries: [] }]
    await act(async () => root.render(<MemoryRouter><Home /></MemoryRouter>))
    expect(container.querySelector('.home-now--done')?.textContent).toContain('Ver músculos treinados')
    mocks.state.S.active = { name: 'Ativo', entries: [], start: 1 }
    await act(async () => root.render(<MemoryRouter><Home /></MemoryRouter>))
    expect(container.querySelector('.home-now')?.textContent).not.toContain('Ver músculos treinados')
    mocks.state.S.workouts = []
    mocks.state.S.active = null
  })
  it('marks the next action, weekly progress and secondary progress regions', async () => {
    await act(async () => root.render(<MemoryRouter><Home /></MemoryRouter>))
    expect(container.querySelector('[data-home-section="next-action"]')).toBeTruthy()
    expect(container.querySelector('[data-home-section="week-progress"]')).toBeTruthy()
    expect(container.querySelector('[data-home-section="secondary-progress"]')).toBeTruthy()
  })

  it('prioritizes resuming an active session', async () => {
    mocks.state.S.active = { name: 'Força', start: Date.now(), cur: 0, entries: [{ id: 'squat', sets: [] }] }
    await act(async () => root.render(<MemoryRouter><Home /></MemoryRouter>))
    expect(container.querySelector('[data-home-section="next-action"]')?.textContent).toContain('Resume')
  })
})

describe('integrated weekly calendar', () => {
  it('contains one summary link immediately after the existing calendar', async () => {
    await act(async () => { root.render(<MemoryRouter><Home /></MemoryRouter>) })
    expect(container.querySelector('[data-weekly-preview="home"]')).toBeNull()
    const section = container.querySelector('.home-week-block')
    const link = section.querySelector('.home-week-summary-link')
    expect(link).toBeTruthy()
    expect(link.previousElementSibling.classList.contains('home-week-strip')).toBe(true)
    expect(container.querySelectorAll('.home-week-summary-link')).toHaveLength(1)
  })
  it('opens the selected past week and hides the access in future weeks', async () => {
    await act(async () => { root.render(<MemoryRouter><Home /></MemoryRouter>) })
    const initial = container.querySelector('.home-week-summary-link')?.getAttribute('href')
    await act(async () => { container.querySelector('[aria-label="Previous week"]').click() })
    expect(container.querySelector('.home-week-summary-link')?.getAttribute('href')).not.toBe(initial)
    await act(async () => { container.querySelector('[aria-label="This week"]').click() })
    await act(async () => { container.querySelector('[aria-label="Next week"]').click() })
    expect(container.querySelector('.home-week-summary-link')).toBeNull()
    expect(container.querySelectorAll('.home-week-strip .wday')).toHaveLength(7)
  })
})


describe('weekly calendar history reliability', () => {
  it('keeps loading explicit without a false zero', async () => {
    mocks.ready = false
    await act(async () => { root.render(<MemoryRouter><Home /></MemoryRouter>) })
    expect(container.querySelector('[data-home-week-count]').textContent).toBe('Updating your history…')
    expect(container.querySelectorAll('.home-week-strip .done')).toHaveLength(0)
  })
  it('restores the selected calendar week from scoped return state', async () => {
    await act(async () => { root.render(<MemoryRouter initialEntries={[{ pathname: '/home', state: { homeWeek: { week: '2026-10-05', scopeKey: 'visitor' } } }]}><Home /></MemoryRouter>) })
    expect(container.querySelector('.home-week-summary-link').getAttribute('href')).toContain('week=2026-10-05')
    expect(container.querySelector('[data-home-week-count]').textContent).not.toContain('week streak')
  })
})


describe('selected week counts', () => {
  it('deduplicates valid sessions and never borrows the current goal for a past week', async () => {
    const saved = mocks.state.S.workouts
    mocks.state.S.workouts = [
      { id: 'one', d: '2026-10-05', entries: [] },
      { id: 'one', d: '2026-10-05', entries: [] },
      { id: 'two', d: '2026-10-06', entries: [] },
      { id: 'cancelled', d: '2026-10-06', status: 'cancelled', entries: [] },
    ]
    await act(async () => { root.render(<MemoryRouter initialEntries={[{ pathname: '/home', state: { homeWeek: { week: '2026-10-05', scopeKey: 'visitor' } } }]}><Home /></MemoryRouter>) })
    expect(container.querySelector('[data-home-week-count]').textContent.trim()).toBe('2 Completed workouts')
    expect(container.querySelectorAll('.home-week-strip .done')).toHaveLength(2)
    mocks.state.S.workouts = saved
  })
  it('withholds old account counts and completion marks during an account transition', async () => {
    mocks.auth = { status: 'authenticated', user: { id: 'new-account' } }
    mocks.scope = { kind: 'account', userId: 'old-account' }
    await act(async () => { root.render(<MemoryRouter><Home /></MemoryRouter>) })
    expect(container.querySelector('[data-home-week-count]').textContent).toBe('Updating your history…')
    expect(container.querySelectorAll('.home-week-strip .done')).toHaveLength(0)
    expect(container.querySelectorAll('.home-week-strip .plan')).toHaveLength(0)
  })
})


it('highlights today using the profile calendar near a timezone boundary', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-22T16:00:00Z'))
  const previous = mocks.state.S.profile
  mocks.state.S.profile = { timeZone: 'Asia/Tokyo' }
  try {
    await act(async () => { root.render(<MemoryRouter><Home /></MemoryRouter>) })
    expect(container.querySelector('.home-week-summary-link').getAttribute('href')).toContain('week=2026-11-23')
    expect(container.querySelector('.home-week-strip .today .num').textContent).toBe('23')
  } finally {
    mocks.state.S.profile = previous
    vi.useRealTimers()
  }
})
