// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { composeShareImageWithLogo, WorkoutShareModal } from './WorkoutShareModal.jsx'
import { DEF, useStore } from '../store/useStore.js'

const mocks = vi.hoisted(() => ({ toPng: vi.fn(), share: vi.fn() }))
vi.mock('html-to-image', () => ({ toPng: mocks.toPng }))
vi.mock('../lib/workout-share.js', () => ({ shareWorkoutImage: mocks.share }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))
vi.mock('./WorkoutShareLayouts.jsx', () => ({
  WORKOUT_SHARE_LAYOUTS: [{ id: 'premium', name: 'Premium' }, { id: 'minimal', name: 'Minimal' }],
  LayoutDashboard: ({ innerRef }) => <div ref={innerRef} className="workout-story-canvas"><div className="share-card-map"><svg><path /></svg></div></div>,
}))

let root, container, originalFonts, originalResizeObserver, resizeObservers
const buttons = () => [...container.querySelectorAll('.workout-share-actions .share-btn-action')]

beforeEach(() => {
  vi.useFakeTimers()
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useStore.setState({ S: structuredClone(DEF) })
  mocks.toPng.mockReset().mockResolvedValue('data:image/png;base64,eA==')
  mocks.share.mockReset().mockResolvedValue({ method: 'web' })
  originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
  originalResizeObserver = globalThis.ResizeObserver
  resizeObservers = []
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; resizeObservers.push(this) }
    observe() {}
    disconnect() {}
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<WorkoutShareModal w={{ id: 'w', entries: [] }} onClose={() => {}} />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts)
  else delete document.fonts
  globalThis.ResizeObserver = originalResizeObserver
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('workout share action lifetime', () => {
  it('draws the lion mark into the exported PNG at its card position', async () => {
    const draws = []
    const logo = { getBoundingClientRect: () => ({ left: 34, top: 56, width: 28, height: 14 }) }
    const card = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 180, height: 320 }) }
    const exportCanvas = {
      getContext: () => ({ drawImage: (...args) => draws.push(args) }),
      toDataURL: () => 'data:image/png;base64,with-lion',
    }

    const result = await composeShareImageWithLogo('data:image/png;base64,card', logo, card, {
      loadImage: async () => 'card-snapshot',
      createCanvas: () => exportCanvas,
    })

    expect(result).toBe('data:image/png;base64,with-lion')
    expect(draws).toEqual([
      ['card-snapshot', 0, 0, 1080, 1920],
      [logo, 144, 216, 168, 84],
    ])
  })

  it('preserves square sprite proportions and its screen blend in the exported image', async () => {
    const draws = []
    const context = { drawImage: (...args) => draws.push(args) }
    const sprite = {
      naturalWidth: 768, naturalHeight: 768,
      classList: { contains: name => name === 'share-highlight-sprite' },
      getBoundingClientRect: () => ({ left: 100, top: 200, width: 100, height: 80 }),
    }
    await composeShareImageWithLogo('png', [sprite], {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 270, height: 480 }),
    }, {
      loadImage: async () => 'snapshot',
      createCanvas: () => ({ getContext: () => context, toDataURL: () => 'composited' }),
    })
    expect(draws[1]).toEqual([sprite, 440, 800, 320, 320])
    expect(context.globalCompositeOperation).toBe('screen')
  })

  it('rescales the newly selected layout to the story preview frame', () => {
    container.querySelector('.workout-share-scaler-outer').getBoundingClientRect = () => ({ width: 180, height: 320 })
    act(() => resizeObservers[0].callback([{ contentRect: { width: 180, height: 320 } }]))
    expect(container.querySelector('.workout-story-canvas').style.transform).toBe('scale(0.16666666666666666)')

    act(() => container.querySelectorAll('[role="tab"]')[1].click())

    expect(container.querySelector('.workout-story-canvas').style.transform).toBe('scale(0.16666666666666666)')
  })

  it('reports a saved image when platform sharing falls back to a download', async () => {
    mocks.share.mockResolvedValue({ method: 'download' })
    await act(async () => buttons()[0].click())
    expect(buttons()[0].getAttribute('data-state')).toBe('success')
    expect(buttons()[0].textContent).toBe('Imagem salva')
  })

  it('starts ready image generation immediately and guards the full platform share operation', async () => {
    let resolve
    mocks.share.mockImplementation(() => new Promise(done => { resolve = done }))
    await act(async () => { buttons()[0].click(); buttons()[0].click() })
    expect(mocks.toPng).toHaveBeenCalledTimes(1)
    expect(mocks.share).toHaveBeenCalledTimes(1)
    expect(buttons().every(button => button.disabled)).toBe(true)
    expect(buttons()[0].getAttribute('data-state')).toBe('loading')
    await act(async () => resolve({ method: 'web' }))
    expect(buttons().every(button => !button.disabled)).toBe(true)
  })

  it('recovers and allows retry when resource readiness fails before image generation', async () => {
    let reject
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise((_, fail) => { reject = fail }) } })
    await act(async () => { buttons()[0].click(); await vi.advanceTimersByTimeAsync(400) })
    await act(async () => reject(new Error('font failed')))
    expect(container.querySelector('[role="status"][data-state="error"]')).not.toBeNull()
    expect(buttons().every(button => !button.disabled)).toBe(true)
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
    await act(async () => buttons()[0].click())
    expect(mocks.toPng).toHaveBeenCalledTimes(1)
    expect(mocks.share).toHaveBeenCalledTimes(1)
  })

  it('keeps a cancelled share neutral and immediately available', async () => {
    mocks.share.mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'AbortError' }))
    await act(async () => { buttons()[0].click(); await vi.advanceTimersByTimeAsync(400) })
    expect(container.querySelector('[role="status"][data-state="error"]')).toBeNull()
    expect(container.querySelector('[data-state="success"]')).toBeNull()
    expect(buttons().every(button => !button.disabled)).toBe(true)
  })

  it('still creates the share image when the lion cannot be composited', async () => {
    const lion = document.createElement('img')
    lion.className = 'share-card-logo'
    lion.setAttribute('src', '/brand-logo.png')
    container.querySelector('.share-card-map').parentElement.append(lion)
    await act(async () => buttons()[0].click())

    expect(mocks.toPng).toHaveBeenCalledTimes(1)
    expect(lion.getAttribute('src')).toBe('/brand-logo.png')
  })
})
