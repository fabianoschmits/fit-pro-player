// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const state = { S: { workouts: [] } }

vi.mock('../store/useStore.js', () => ({ useStore: selector => selector(state) }))
vi.mock('../lib/i18n.js', () => ({ t: value => value, dateLocale: () => 'pt-BR' }))
vi.mock('../components/AppHeader.jsx', () => ({ default: () => <header>Histórico</header> }))
vi.mock('../sheets.jsx', () => ({ WorkoutRow: () => null, workoutDetailSheet: vi.fn() }))

import History from './History.jsx'

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

it('renders the empty history state before any workout is recorded', async () => {
  await act(async () => root.render(<History />))
  expect(container.textContent).toContain('No workouts yet.')
  expect(container.querySelector('svg')).not.toBeNull()
})
