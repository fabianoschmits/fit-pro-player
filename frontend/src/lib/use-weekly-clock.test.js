// @vitest-environment happy-dom
import { createElement, act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useWeeklyClock } from './use-weekly-clock.js'
let root, container, value
function Probe() { value = useWeeklyClock('America/Sao_Paulo'); return null }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-23T02:59:59Z'))
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  act(() => root.render(createElement(Probe)))
})
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers() })
it('refreshes at the local midnight boundary without polling', () => {
  expect(value.now.toISOString()).toBe('2026-11-23T02:59:59.000Z')
  expect(vi.getTimerCount()).toBe(1)
  act(() => vi.advanceTimersByTime(1200))
  expect(value.now.toISOString()).toBe('2026-11-23T03:00:00.100Z')
  expect(vi.getTimerCount()).toBe(1)
})
it('refreshes on foreground and removes its boundary timer on unmount', () => {
  vi.setSystemTime(new Date('2026-11-30T12:00:00Z'))
  act(() => window.dispatchEvent(new Event('focus')))
  expect(value.now.toISOString()).toBe('2026-11-30T12:00:00.000Z')
  act(() => root.unmount()); expect(vi.getTimerCount()).toBe(0)
  root = createRoot(container)
})
