// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { bwSheet, goalSheet, customExSheet, topWeightSheet, planToolsSheet, planImportSheet } from './sheets.jsx'
import { parsePlan } from './lib/plan-share.js'

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('./lib/nav.js', () => ({ nav: mocks.navigate }))
vi.mock('./components/Media.jsx', () => ({ default: () => null, Thumb: () => null }))
vi.mock('./lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn() }))

let root, container
const originalFlushPersistence = useStore.getState().flushPersistence
const mount = () => {
  const sheet = useUI.getState().sheets.at(-1)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return sheet.id
}
const primary = () => container.querySelector('button.primary')
const failWrites = () => vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
const hasError = () => !!container.querySelector('[role="status"][data-state="error"]')

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  mocks.navigate.mockClear()
  useStore.setState({ S: structuredClone(DEF), persistence: { state: 'saved', error: null } })
  useUI.setState({ sheets: [], toastMsg: '' })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  if (root) act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  useStore.setState({ flushPersistence: originalFlushPersistence })
})

describe('additional local sheet saves', () => {
  it.each(['mounted exit', 'unmounted'])('does not continue a plan import after cancel during a deferred retry (%s)', async dismissal => {
    const bundle = parsePlan({ fitproplayer_plan: 1, routines: [{ id: 'shared', name: 'Plano recebido', ex: [{ id: '0025', sets: 3, reps: 8 }] }] })
    planImportSheet(bundle)
    const id = mount()
    const write = failWrites()
    await act(async () => primary().click())
    write.mockRestore()
    let resolve
    useStore.setState({ flushPersistence: () => new Promise(done => { resolve = done }) })
    await act(async () => primary().click())
    act(() => container.querySelector('button.ghost').click())
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(false)
    if (dismissal === 'unmounted') { act(() => root.unmount()); root = null }
    await act(async () => resolve(true))
    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(useStore.getState().S.routines).toHaveLength(1)
  })

  it('does not start a workout when a deferred weigh-in retry resolves in another account', async () => {
    const started = []
    bwSheet({ required: true, onDone: value => started.push(value) })
    mount()
    const write = failWrites()
    await act(async () => primary().click())
    write.mockRestore()
    let resolve
    useStore.setState({ flushPersistence: () => new Promise(done => { resolve = done }) })
    await act(async () => primary().click())
    await act(async () => useStore.getState().activateLocalScope('00000000-0000-4000-8000-000000000002'))
    await act(async () => resolve(true))
    expect(started).toEqual([])
    expect(useStore.getState().S.bodyweight).toEqual([])
  })

  it('does not flush another account when a stale weigh-in is retried after switching scope', async () => {
    const started = []
    bwSheet({ required: true, onDone: value => started.push(value) })
    mount()
    const write = failWrites()
    await act(async () => primary().click())
    write.mockRestore()
    await act(async () => useStore.getState().activateLocalScope('00000000-0000-4000-8000-000000000003'))
    let writes = 0
    useStore.setState({ flushPersistence: async () => { writes++; return true } })
    await act(async () => primary().click())
    expect(writes).toBe(0)
    expect(started).toEqual([])
    expect(useStore.getState().S.bodyweight).toEqual([])
  })

  it('waits for weigh-in durability before starting a workout and does not log again on retry', async () => {
    const started = []
    bwSheet({ required: true, onDone: value => started.push(value) })
    const id = mount()
    const write = failWrites()
    await act(async () => primary().click())
    expect(started).toEqual([])
    expect(hasError()).toBe(true)
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(true)
    const timestamp = useStore.getState().S._ts
    write.mockRestore()
    await act(async () => primary().click())
    expect(started).toEqual([70])
    expect(useStore.getState().S.bodyweight).toHaveLength(1)
    expect(useStore.getState().S._ts).toBe(timestamp)
  })

  it('keeps goal failure local and retries only its persisted state', async () => {
    goalSheet()
    const id = mount()
    const write = failWrites()
    await act(async () => primary().click())
    expect(hasError()).toBe(true)
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(true)
    expect(useUI.getState().toastMsg).toBe('')
    const timestamp = useStore.getState().S._ts
    write.mockRestore()
    await act(async () => primary().click())
    expect(useStore.getState().S.targetW).toBe(70)
    expect(useStore.getState().S._ts).toBe(timestamp)
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(false)
  })

  it('retries creation of a custom exercise without a second exercise or duplicate-name failure', async () => {
    const selected = []
    customExSheet(null, value => selected.push(value.id), 'Movimento de teste exclusivo')
    mount()
    act(() => container.querySelector('.chips button').click())
    const write = failWrites()
    await act(async () => primary().click())
    expect(hasError()).toBe(true)
    expect(selected).toEqual([])
    expect(useStore.getState().S.customEx).toHaveLength(1)
    const id = useStore.getState().S.customEx[0].id
    write.mockRestore()
    await act(async () => primary().click())
    expect(useStore.getState().S.customEx).toHaveLength(1)
    expect(selected).toEqual([id])
  })

  it('advances from top weight only after local saving succeeds', async () => {
    useStore.getState().update(s => { s.active = { id: 'active', name: 'Treino', start: 1000, cur: 0, entries: [
      { id: '0025', target: { weight: 10 }, sets: [{ w: 10, r: 8, done: true }] },
      { id: '0026', target: {}, sets: [{ w: 10, r: 8, done: false }] },
    ] } })
    topWeightSheet(0)
    mount()
    const write = failWrites()
    await act(async () => primary().click())
    expect(useStore.getState().S.active.cur).toBe(0)
    expect(hasError()).toBe(true)
    write.mockRestore()
    await act(async () => primary().click())
    expect(useStore.getState().S.active.cur).toBe(1)
    expect(useStore.getState().S.active.entries[0].topW).toBe(10)
  })

  it('retains a failed plan import and retries its disk write without adding routines again', async () => {
    const bundle = parsePlan({ fitproplayer_plan: 1, routines: [{ id: 'shared', name: 'Plano recebido', ex: [{ id: '0025', sets: 3, reps: 8 }] }] })
    planImportSheet(bundle)
    const id = mount()
    const write = failWrites()
    await act(async () => primary().click())
    expect(useStore.getState().S.routines).toHaveLength(1)
    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(hasError()).toBe(true)
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(true)
    write.mockRestore()
    await act(async () => primary().click())
    expect(useStore.getState().S.routines).toHaveLength(1)
    expect(mocks.navigate).toHaveBeenCalledExactlyOnceWith('/plan')
  })
})

describe('plan file action feedback', () => {
  it('exports one file for duplicate activation in the same event turn', async () => {
    useStore.getState().update(s => { s.routines = [{ id: 'r', name: 'Plano', ex: [{ id: '0025', sets: 3 }] }] })
    planToolsSheet()
    mount()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await act(async () => { primary().click(); primary().click() })
    expect(download).toHaveBeenCalledTimes(1)
  })

  it('retains a failed export and permits a successful file download retry', async () => {
    useStore.getState().update(s => { s.routines = [{ id: 'r', name: 'Plano', ex: [{ id: '0025', sets: 3 }] }] })
    planToolsSheet()
    const id = mount()
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => { throw new Error('unavailable') })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await act(async () => primary().click())
    expect(hasError()).toBe(true)
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(true)
    expect(primary().disabled).toBe(false)
    expect(download).not.toHaveBeenCalled()
    create.mockReturnValue('blob:test')
    await act(async () => primary().click())
    expect(download).toHaveBeenCalledTimes(1)
    expect(useUI.getState().sheets.some(sheet => sheet.id === id)).toBe(false)
  })

  it('shows file read failure on the import control and permits another file selection', async () => {
    let reader
    vi.stubGlobal('FileReader', class { constructor() { reader = this } readAsText() {} })
    planToolsSheet()
    mount()
    const file = container.querySelector('input[type="file"]')
    Object.defineProperty(file, 'files', { configurable: true, value: [new File(['invalid'], 'plan.json')] })
    act(() => file.dispatchEvent(new Event('change', { bubbles: true })))
    const importButton = [...container.querySelectorAll('button')].find(button => button.querySelector('.icn') && button.classList.contains('ghost'))
    expect(importButton.getAttribute('aria-busy')).toBe('true')
    act(() => reader.onerror?.())
    expect(hasError()).toBe(true)
    expect(importButton.disabled).toBe(false)
    const failedReader = reader
    act(() => file.dispatchEvent(new Event('change', { bubbles: true })))
    expect(reader).not.toBe(failedReader)
    expect(importButton.getAttribute('aria-busy')).toBe('true')
  })

  it('does not open an imported plan after the file-picker sheet is dismissed during reading', () => {
    let reader
    vi.stubGlobal('FileReader', class { constructor() { reader = this } readAsText() {} abort() {} })
    planToolsSheet()
    const id = mount()
    const file = container.querySelector('input[type="file"]')
    Object.defineProperty(file, 'files', { configurable: true, value: [new File(['{}'], 'plan.json')] })
    act(() => file.dispatchEvent(new Event('change', { bubbles: true })))
    act(() => root.unmount())
    root = null
    reader.result = JSON.stringify({ fitproplayer_plan: 1, routines: [] })
    act(() => reader.onload?.())
    expect(useUI.getState().sheets.map(sheet => sheet.id)).toEqual([id])
  })
})
