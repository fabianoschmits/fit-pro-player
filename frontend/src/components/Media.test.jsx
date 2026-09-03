// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./ExerciseGuideAnimation.jsx', () => ({
  default: ({ playing }) => <div data-testid="sprite" data-playing={String(playing)} />,
}))

vi.mock('../lib/exercise-guide-assets.js', async importOriginal => ({
  ...(await importOriginal()),
  hasExerciseGuideAsset: () => true,
}))

import Media from './Media.jsx'

const EXERCISE = { id: '0001', name: 'Abdominal 3/4', name_pt: 'Abdominal 3/4' }
let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  vi.setSystemTime(1_000_000)
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

describe('Media SVG playback', () => {
  it('starts automatically even with reduced motion, and lets the user pause', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
    act(() => root.render(<Media ex={EXERCISE} />))

    const button = container.querySelector('.media-playback')
    expect(container.querySelector('[data-testid="sprite"]').dataset.playing).toBe('true')
    expect(container.querySelector('.exercise-muscle-overlay')).toBeTruthy()
    expect(button.getAttribute('aria-label')).toMatch(/pausar|pause/i)

    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('[data-testid="sprite"]').dataset.playing).toBe('true')

    act(() => { vi.advanceTimersByTime(500) })
    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('[data-testid="sprite"]').dataset.playing).toBe('false')
    expect(button.getAttribute('aria-label')).toMatch(/reproduzir|play/i)

    act(() => container.querySelector('.exmedia').dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('[data-testid="sprite"]').dataset.playing).toBe('true')
  })
})
