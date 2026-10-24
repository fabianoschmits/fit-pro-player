// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkoutShareModal } from './WorkoutShareModal.jsx'
import { DEF, useStore } from '../store/useStore.js'

const mocks = vi.hoisted(() => ({ toPng: vi.fn(), share: vi.fn() }))
vi.mock('html-to-image', () => ({ toPng: mocks.toPng }))
vi.mock('../lib/workout-share.js', () => ({ shareWorkoutImage: mocks.share }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))
vi.mock('./WorkoutShareLayouts.jsx', () => ({
  WORKOUT_SHARE_LAYOUTS: [{ id: 'premium', name: 'Premium' }, { id: 'minimal', name: 'Minimal' }],
  LayoutDashboard: ({ innerRef }) => <div ref={innerRef}><div className="share-card-map"><svg><path /></svg></div></div>,
}))

let root, container, originalFonts
const buttons = () => [...container.querySelectorAll('.workout-share-actions .share-btn-action')]

beforeEach(() => {
  vi.useFakeTimers()
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useStore.setState({ S: structuredClone(DEF) })
  mocks.toPng.mockReset().mockResolvedValue('data:image/png;base64,eA==')
  mocks.share.mockReset().mockResolvedValue({ method: 'web' })
  originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
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
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('workout share action lifetime', () => {
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

  it('still creates the share image when the lion asset cannot be inlined', async () => {
    const lion = document.createElement('img')
    lion.className = 'share-card-logo'
    lion.setAttribute('src', '/brand-logo.png')
    container.querySelector('.share-card-map').parentElement.append(lion)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await act(async () => buttons()[0].click())

    expect(mocks.toPng).toHaveBeenCalledTimes(1)
    expect(lion.getAttribute('src')).toBe('/brand-logo.png')
  })
})
