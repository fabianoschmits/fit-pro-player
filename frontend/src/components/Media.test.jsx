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
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
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
    expect(container.querySelector('.exercise-muscle-overlay')).toBeFalsy()
    expect(container.querySelector('.media-muscles')).toBeTruthy()
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

  it('portals the muscle map above the app, pauses playback, and restores both playback and focus', () => {
    act(() => root.render(<Media ex={EXERCISE} />))
    act(() => { vi.advanceTimersByTime(500) })
    const trigger = container.querySelector('.media-muscles')
    trigger.focus()
    act(() => trigger.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    const dialog = document.body.querySelector('.media-muscles-pop')
    const close = document.body.querySelector('.media-muscles-close')
    expect(dialog).toBeTruthy()
    expect(container.querySelector('.media-muscles-pop')).toBeFalsy()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    expect(document.activeElement).toBe(close)
    expect(document.body.style.overflow).toBe('hidden')
    expect(container.querySelector('[data-testid="sprite"]').dataset.playing).toBe('false')

    act(() => close.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(document.body.querySelector('.media-muscles-scrim').classList.contains('is-closing')).toBe(true)
    act(() => { vi.advanceTimersByTime(150) })
    expect(document.body.querySelector('.media-muscles-pop')).toBeFalsy()
    expect(container.querySelector('[data-testid="sprite"]').dataset.playing).toBe('true')
    expect(document.activeElement).toBe(trigger)
    expect(document.body.style.overflow).toBe('')
  })

  it('closes with Escape without resuming a sprite that was paused before opening', () => {
    act(() => root.render(<Media ex={EXERCISE} />))
    act(() => { vi.advanceTimersByTime(500) })
    const playback = container.querySelector('.media-playback')
    act(() => playback.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('[data-testid="sprite"]').dataset.playing).toBe('false')

    const trigger = container.querySelector('.media-muscles')
    act(() => trigger.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(document.body.querySelector('[role="dialog"]')).toBeTruthy()
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))

    expect(document.body.querySelector('[role="dialog"]')).toBeFalsy()
    expect(container.querySelector('[data-testid="sprite"]').dataset.playing).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })

  it('closes immediately when reduced motion is requested', () => {
    window.matchMedia.mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    act(() => root.render(<Media ex={EXERCISE} />))
    act(() => { vi.advanceTimersByTime(500) })
    act(() => container.querySelector('.media-muscles').dispatchEvent(new MouseEvent('click', { bubbles: true })))
    const close = document.body.querySelector('.media-muscles-close')
    act(() => close.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(document.body.querySelector('.media-muscles-pop')).toBeFalsy()
    expect(container.querySelector('[data-testid="sprite"]').dataset.playing).toBe('true')
  })
})
