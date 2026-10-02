// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Row, Switch, Slider, Stepper } from './ui.jsx'
import Dialog from './Dialog.jsx'
import LineChart from './LineChart.jsx'

let root, host
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  window.scrollTo = vi.fn()
})
afterEach(() => { act(() => root.unmount()); host.remove() })

it('names switches from their containing row and numerical fields from their labels', () => {
  act(() => root.render(<><Row title="Lembretes"><Switch checked onChange={() => {}} /></Row><Stepper label="Carga" unit="kg" value={20} onChange={() => {}} /></>))
  expect(host.querySelector('[role="switch"]').getAttribute('aria-label')).toBe('Lembretes')
  expect(host.querySelector('input').getAttribute('aria-label')).toBe('Carga (kg)')
  expect(host.querySelector('.stp button').getAttribute('aria-label')).toContain('Carga')
})

it('names a slider and supports the Home/End keys', () => {
  const change = vi.fn()
  act(() => root.render(<Slider ariaLabel="Descanso" value={90} min={15} max={300} onChange={change} />))
  const slider = host.querySelector('[role="slider"]')
  expect(slider.getAttribute('aria-label')).toBe('Descanso')
  act(() => slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })))
  expect(change).toHaveBeenLastCalledWith(300)
  act(() => slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })))
  expect(change).toHaveBeenLastCalledWith(15)
})

it('isolates background, names dialogue, closes on Escape and restores trigger focus', () => {
  const trigger = document.createElement('button'); trigger.textContent = 'Abrir'; document.body.append(trigger); trigger.focus()
  const close = vi.fn()
  act(() => root.render(<Dialog title="Escolher exercício" onClose={close}><select aria-label="Equipamento"><option>Barra</option></select><button>Selecionar</button></Dialog>))
  const dialog = document.querySelector('[role="dialog"]')
  expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
  expect(document.getElementById(dialog.getAttribute('aria-labelledby')).textContent).toBe('Escolher exercício')
  expect(host.hasAttribute('inert')).toBe(true)
  expect(dialog.contains(document.activeElement)).toBe(true)
  act(() => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(close).toHaveBeenCalledTimes(1)
  act(() => root.render(null))
  expect(host.hasAttribute('inert')).toBe(false)
  expect(document.activeElement).toBe(trigger)
  trigger.remove()
})

it('moves through consecutive chart points by keyboard across rerenders', () => {
  const edit = vi.fn(), points = [1, 2, 3].map(day => ({ t: +new Date(`2026-10-0${day}T12:00:00`), d: `2026-10-0${day}`, y: day * 10 }))
  act(() => root.render(<LineChart points={points} onPointEdit={edit} />))
  const chart = host.querySelector('[role="group"]')
  act(() => chart.focus())
  for (const key of ['Home', 'ArrowRight', 'ArrowRight', 'Enter']) act(() => chart.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })))
  expect(edit).toHaveBeenLastCalledWith(expect.objectContaining({ iso: '2026-10-03', v: 30 }))
})
