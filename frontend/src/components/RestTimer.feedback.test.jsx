// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RestTimer from './RestTimer.jsx'
import WorkSetOverlay from './WorkSetOverlay.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn() }))
let root, container
beforeEach(() => {
  vi.useFakeTimers()
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useStore.setState({ S: { ...structuredClone(DEF), sound: false, notifications: { rest: false, timedSet: false } } })
  useUI.getState().stopRest(false)
  useUI.getState().stopWork()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useUI.getState().stopRest(false)
  useUI.getState().stopWork()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('timer progress feedback', () => {
  it('exposes real remaining rest and keeps adjustments and skip synchronous', () => {
    let completions = 0
    useUI.getState().startRest(90, () => completions++)
    act(() => root.render(<RestTimer />))
    const progress = () => container.querySelector('[role="progressbar"]')
    expect(progress()?.getAttribute('aria-valuenow')).toBe('90')
    expect(progress()?.getAttribute('aria-valuemax')).toBe('90')
    expect(progress()?.getAttribute('aria-valuetext')).toBe('1:30')
    act(() => container.querySelector('button[aria-label$="15s"]').click())
    expect(progress()?.getAttribute('aria-valuenow')).toBe('75')
    act(() => vi.advanceTimersByTime(1000))
    expect(progress()?.getAttribute('aria-valuenow')).toBe('74')
    act(() => container.querySelector('button.skip').click())
    expect(container.querySelector('#timer')).toBeNull()
    expect(completions).toBe(1)
  })

  it('shows timed work progress and reports completion without an action loader', () => {
    let recorded
    useUI.getState().startWork(45, 'Prancha', elapsed => { recorded = elapsed }, { entryIdx: 0, setIdx: 0 })
    act(() => root.render(<WorkSetOverlay entryIdx={0} />))
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('45')
    act(() => vi.advanceTimersByTime(5000))
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('40')
    act(() => useUI.getState().finishWorkEarly())
    expect(recorded).toBe(5)
    expect(container.querySelector('.work-set-overlay.is-done')).not.toBeNull()
    expect(container.querySelector('[data-state="success"]')).not.toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
  })
})
