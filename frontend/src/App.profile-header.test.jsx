// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_AVATAR_ID } from './lib/avatars.js'
import { ProfileHeader } from './App.jsx'

const stateAt = currentWeight => ({
  onboardingDone: true,
  unit: 'kg',
  targetW: 70,
  profile: {
    name: 'Fabiano',
    avatarId: DEFAULT_AVATAR_ID,
    birthDate: '1989-09-13',
    heightCm: 176,
    startWeight: 80,
  },
  bodyweight: [
    { d: '2026-01-01', w: 80, t: 1 },
    { d: '2026-09-13', w: currentWeight, t: 2 },
  ],
})

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-13T12:00:00'))
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
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
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ProfileHeader editorial hero', () => {
  it.each([
    [80, '0'],
    [75, '50'],
    [70, '100'],
  ])('keeps the existing weight-goal calculation at %s kg', (weight, percent) => {
    act(() => root.render(<ProfileHeader S={stateAt(weight)} />))

    const header = container.querySelector('header.profile-hero')
    const progress = container.querySelector('[role="progressbar"]')
    expect(header).toBeTruthy()
    expect(header.textContent).toContain('37 anos · 1,76 m')
    expect(header.textContent).toContain(`${weight} kg`)
    expect(progress.getAttribute('aria-label')).toBe('Meta de peso')
    expect(progress.getAttribute('aria-valuenow')).toBe(percent)
    expect(header.textContent).toContain(`${percent}%`)
    expect(container.querySelector('.profile-goal-ring')).toBeFalsy()
    expect(container.querySelector('.profile-stat-stack')).toBeFalsy()
    expect(container.querySelector('.profile-card-glow')).toBeFalsy()
  })

  it('keeps preview support and graceful placeholders for missing measurements and goal', () => {
    const S = {
      ...stateAt(75),
      targetW: null,
      profile: {
        ...stateAt(75).profile,
        birthDate: '',
        heightCm: null,
        startWeight: null,
      },
      bodyweight: [],
    }
    const preview = { name: 'Fabiano de Oliveira Schmits com Nome Muito Longo' }
    act(() => root.render(<ProfileHeader S={S} preview={preview} />))

    const header = container.querySelector('header.profile-hero')
    const progress = container.querySelector('[role="progressbar"]')
    expect(header.getAttribute('aria-label')).toBe(preview.name)
    expect(container.querySelector('.profile-hero-name').textContent).toBe(preview.name)
    expect(container.querySelector('.profile-hero-facts').textContent).toBe('-- anos · -- m · -- kg')
    expect(progress.hasAttribute('aria-valuenow')).toBe(false)
    expect(progress.getAttribute('aria-valuetext')).toBe('--')
  })

  it('continues rotating the motivational phrase', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    act(() => root.render(<ProfileHeader S={stateAt(75)} />))

    await act(async () => { await vi.advanceTimersByTimeAsync(7000) })

    expect(random).toHaveBeenCalled()
    expect(container.querySelector('.profile-hero-message-stage').getAttribute('aria-live')).toBe('polite')
  })
})
