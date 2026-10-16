// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { confirmSheet, exConfigSheet, finishWorkout } from './sheets.jsx'

vi.mock('./components/Media.jsx', () => ({ default: () => null, Thumb: () => null }))
vi.mock('./lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn() }))

let root, container
const mountSheet = () => {
  const sheet = useUI.getState().sheets.at(-1)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return sheet.id
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  useStore.setState({ S: structuredClone(DEF), persistence: { state: 'saved', error: null } })
  useUI.setState({ sheets: [], toastMsg: '' })
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

describe('confirmed action feedback', () => {
  it('keeps a pointer confirmation visible through its successful feedback before closing', async () => {
    vi.useFakeTimers()
    let removals = 0
    confirmSheet({ danger: true, onConfirm: () => { removals++ } })
    const id = mountSheet()
    const button = container.querySelector('button.danger')
    await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })))
    await act(async () => vi.advanceTimersByTimeAsync(320))

    expect(removals).toBe(1)
    expect(button.getAttribute('data-state')).toBe('success')
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(true)
    await act(async () => vi.advanceTimersByTimeAsync(519))
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(true)
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(false)
  })

  it('keeps a cancelled or invalid confirmation neutral and available', async () => {
    confirmSheet({ danger: true, onConfirm: () => false })
    const id = mountSheet()
    await act(async () => container.querySelector('button.danger').click())
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(true)
    expect(container.querySelector('button.danger').disabled).toBe(false)
    expect(container.querySelector('[data-state="success"]')).toBeNull()
    expect(container.querySelector('[role="status"][data-state="error"]')).toBeNull()
  })

  it('keeps confirmation open and executes once until an asynchronous deletion settles', async () => {
    let resolve
    let removals = 0
    confirmSheet({ danger: true, confirmText: 'Remover', onConfirm: () => { removals++; return new Promise(done => { resolve = done }) } })
    const id = mountSheet()
    const button = container.querySelector('button.danger')
    await act(async () => { button.click(); button.click() })

    expect(removals).toBe(1)
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(true)
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('data-state')).toBe('loading')
    await act(async () => resolve())
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(false)
  })

  it('shows a failed confirmation in place and allows a successful retry', async () => {
    let reject
    let attempts = 0
    confirmSheet({ danger: true, confirmText: 'Remover', onConfirm: () => {
      attempts++
      return attempts === 1 ? new Promise((_, fail) => { reject = fail }) : Promise.resolve()
    } })
    const id = mountSheet()
    await act(async () => container.querySelector('button.danger').click())
    await act(async () => reject(new Error('offline')))

    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(true)
    expect(container.querySelector('[role="status"][data-state="error"]')).not.toBeNull()
    expect(container.querySelector('button.danger').disabled).toBe(false)
    await act(async () => container.querySelector('button.danger').click())
    expect(attempts).toBe(2)
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(false)
  })

  it('retries local durability without repeating a destructive index-based mutation', async () => {
    useStore.getState().update(s => { s.routines = [{ id: 'r', ex: [{ id: 'first' }, { id: 'second' }] }] })
    confirmSheet({ danger: true, onConfirm: () => useStore.getState().update(s => { s.routines[0].ex.splice(0, 1) }) })
    const id = mountSheet()
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
    await act(async () => container.querySelector('button.danger').click())
    expect(useStore.getState().S.routines[0].ex).toEqual([{ id: 'second' }])
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(true)
    write.mockRestore()
    await act(async () => container.querySelector('button.danger').click())
    expect(useStore.getState().S.routines[0].ex).toEqual([{ id: 'second' }])
    expect(useStore.getState().persistence.state).toBe('saved')
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(false)
  })
})

describe('local workout persistence feedback', () => {
  it('keeps a saved pointer exercise configuration open for the success confirmation', async () => {
    vi.useFakeTimers()
    useStore.getState().update(s => { s.routines = [{ id: 'r', ex: [] }] })
    exConfigSheet({ id: '0025', n: 'Agachamento' }, { sets: 3, reps: 8, weight: 0 }, cfg => useStore.getState().update(s => { s.routines[0].ex.push(cfg) }))
    const id = mountSheet()
    const button = container.querySelector('button.primary')
    await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })))
    await act(async () => vi.advanceTimersByTimeAsync(320))

    expect(useStore.getState().S.routines[0].ex).toHaveLength(1)
    expect(button.getAttribute('data-state')).toBe('success')
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(true)
    await act(async () => vi.advanceTimersByTimeAsync(520))
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(false)
  })

  it('keeps exercise configuration open when saving locally fails, then retries without cloud work', async () => {
    useStore.getState().update(s => { s.routines = [{ id: 'r', ex: [] }] })
    exConfigSheet({ id: '0025', n: 'Agachamento' }, { sets: 3, reps: 8, weight: 0 }, cfg => useStore.getState().update(s => { s.routines[0].ex.push(cfg) }))
    const id = mountSheet()
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
    await act(async () => container.querySelector('button.primary').click())
    expect(useStore.getState().persistence.state).toBe('error')
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(true)
    expect(container.querySelector('[role="status"][data-state="error"]')).not.toBeNull()
    expect(container.querySelector('fieldset').disabled).toBe(true)

    write.mockRestore()
    await act(async () => container.querySelector('button.primary').click())
    expect(useStore.getState().persistence.state).toBe('saved')
    expect(useStore.getState().S.routines[0].ex).toHaveLength(1)
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(false)
  })

  it('retries a completed workout disk write without finishing it a second time', async () => {
    useStore.getState().update(s => { s.active = { id: 'a', name: 'Treino', start: 1000, entries: [{ id: '0025', target: {}, sets: [{ w: 0, r: 8, done: true }] }] } })
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
    finishWorkout()
    mountSheet()
    expect(useStore.getState().S.active).toBeNull()
    expect(useStore.getState().S.workouts).toHaveLength(1)
    expect(container.querySelector('[role="status"][data-state="error"]')).not.toBeNull()
    expect([...container.querySelectorAll('button')].some(button => /Tentar novamente/.test(button.textContent))).toBe(true)
    expect(container.querySelector('[data-state="success"]')).toBeNull()
    write.mockRestore()
    await act(async () => [...container.querySelectorAll('button')].find(button => /Tentar novamente/.test(button.textContent)).click())
    expect(useStore.getState().S.workouts).toHaveLength(1)
    expect(useStore.getState().persistence.state).toBe('saved')
    expect(container.querySelector('[data-state="success"]')).not.toBeNull()
    expect(container.querySelector('[role="status"][data-state="error"]')).toBeNull()
  })
})
