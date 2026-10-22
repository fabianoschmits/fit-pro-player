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
  update: vi.fn(recipe => recipe(mocks.state.S)),
}))

vi.mock('../store/useStore.js', () => ({
  useStore: selector => selector({ S: mocks.state.S, update: mocks.update }),
}))
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
vi.mock('../components/Icon.jsx', () => ({ default: ({ name }) => React.createElement('span', { 'data-icon': name }) }))
vi.mock('../lib/i18n.js', () => ({ t: value => value, dateLocale: () => 'pt-BR' }))

import Home from './Home.jsx'

let root
let container

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
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
