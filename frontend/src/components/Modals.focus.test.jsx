// @vitest-environment happy-dom
import { StrictMode, act, useRef, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Modals from './Modals.jsx'
import { useDialogFocus } from '../lib/dialog-focus.js'

const mocks = vi.hoisted(() => {
  const listeners = new Set()
  const state = { sheets: [], closeSheet: id => { state.sheets = state.sheets.filter(sheet => sheet.id !== id); listeners.forEach(listener => listener()) } }
  return { state, listeners, open: sheet => { state.sheets = [sheet]; listeners.forEach(listener => listener()) } }
})
vi.mock('../store/useUI.js', () => {
  const useUI = (selector = state => state) => useSyncExternalStore(listener => { mocks.listeners.add(listener); return () => mocks.listeners.delete(listener) }, () => selector(mocks.state))
  useUI.getState = () => mocks.state
  return { useUI }
})

let root, container
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mocks.state.sheets = []
  window.matchMedia = () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(history, 'pushState').mockImplementation(() => {})
  vi.spyOn(history, 'go').mockImplementation(() => {})
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })

function FocusSurface({ name, children = null }) {
  const ref = useRef(null)
  useDialogFocus(ref)
  return <section ref={ref} role="dialog" tabIndex={-1} aria-label={name}><input aria-label={name} />{children}</section>
}

it('returns focus after React commits the closing sheet in StrictMode', async () => {
  await act(async () => root.render(<StrictMode><button type="button" onClick={() => mocks.open({ id: 'picker', kind: 'sheet', className: '', render: () => <><h3>Escolher treino</h3><button type="button">Treino recente</button></> })}>Escolher treino</button><Modals /></StrictMode>))
  const trigger = container.querySelector('button')
  trigger.focus()
  await act(async () => trigger.click())
  expect(container.querySelector('[role="dialog"]')).not.toBeNull()
  expect(document.activeElement).not.toBe(trigger)
  await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await new Promise(resolve => setTimeout(resolve, 20)) })
  expect(container.querySelector('[role="dialog"]')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

it('keeps the new dialog input focused when one commit replaces the previous dialog', async () => {
  await act(async () => root.render(<button type="button">Abrir</button>))
  container.querySelector('button').focus()
  act(() => flushSync(() => root.render(<><button type="button">Abrir</button><FocusSurface key="a" name="Diálogo A" /></>)))
  act(() => flushSync(() => root.render(<><button type="button">Abrir</button><FocusSurface key="b" name="Diálogo B" /></>)))
  const input = container.querySelector('input')
  expect(document.activeElement).toBe(input)
  await act(async () => { await Promise.resolve() })
  expect(document.activeElement).toBe(input)
})

it('returns focus to the parent dialog trigger after a nested dialog closes', async () => {
  const render = nested => <FocusSurface name="Diálogo pai"><button type="button">Abrir detalhe</button>{nested && <FocusSurface name="Detalhe" />}</FocusSurface>
  await act(async () => root.render(render(false)))
  const trigger = container.querySelector('button')
  trigger.focus()
  await act(async () => root.render(render(true)))
  expect(document.activeElement).toBe(container.querySelector('input[aria-label="Detalhe"]'))
  await act(async () => root.render(render(false)))
  expect(document.activeElement).toBe(trigger)
  expect(trigger.closest('[inert]')).toBeNull()
})
