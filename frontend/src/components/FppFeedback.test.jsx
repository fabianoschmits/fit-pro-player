// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { FppActionFeedback, FppProgress, FppSkeleton, FppSpinner, FppToast } from './FppFeedback.jsx'

let root, host
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

it('reports real determinate progress with clamped values and a transform fill', () => {
  act(() => root.render(<FppProgress value={30} max={60} label="Importação" />))
  const progress = host.querySelector('[role="progressbar"]')
  expect(progress.getAttribute('aria-label')).toBe('Importação')
  expect(progress.getAttribute('aria-valuenow')).toBe('30')
  expect(progress.getAttribute('aria-valuemax')).toBe('60')
  expect(progress.firstElementChild.style.transform).toBe('scaleX(0.5)')
  act(() => root.render(<FppProgress value={150} label="Importação" />))
  expect(progress.getAttribute('aria-valuenow')).toBe('100')
  act(() => root.render(<FppProgress value={-10} max={0} label="Importação" />))
  expect(progress.getAttribute('aria-valuenow')).toBe('0')
  expect(progress.getAttribute('aria-valuemax')).toBe('100')
})

it('does not invent percentages for indeterminate work', () => {
  act(() => root.render(<FppProgress label="Publicando" />))
  expect(host.querySelector('[role="progressbar"]').hasAttribute('aria-valuenow')).toBe(false)
  expect(host.querySelector('[role="progressbar"]').getAttribute('data-indeterminate')).toBe('true')
})

it('exposes structured loading once while hiding decorative skeleton rows', () => {
  act(() => root.render(<FppSkeleton label="Carregando alunos" rows={4} />))
  const skeleton = host.querySelector('[role="status"]')
  expect(skeleton.getAttribute('aria-busy')).toBe('true')
  expect(skeleton.getAttribute('aria-label')).toBe('Carregando alunos')
  expect(skeleton.children.length).toBe(4)
  expect([...skeleton.children].every(row => row.getAttribute('aria-hidden') === 'true')).toBe(true)
})

it('combines error text and a non-color signal in polite feedback', () => {
  act(() => root.render(<FppActionFeedback state="error">Não foi possível salvar. Tente novamente.</FppActionFeedback>))
  expect(host.querySelector('[role="status"]').getAttribute('aria-live')).toBe('polite')
  expect(host.textContent).toBe('Não foi possível salvar. Tente novamente.')
  expect(host.querySelector('.fpp-status-animation[data-state="error"] svg')).not.toBeNull()
})

it('keeps the toast live region mounted while messages change and leaves spinners opt-in', () => {
  act(() => root.render(<FppToast />))
  const toast = host.querySelector('#toast')
  expect(toast.getAttribute('aria-live')).toBe('polite')
  expect(toast.querySelector('.fpp-spinner')).toBeNull()
  act(() => root.render(<FppToast message="Salvo" tone="success" />))
  expect(host.querySelector('#toast')).toBe(toast)
  expect(toast.textContent).toBe('Salvo')
  expect(toast.classList.contains('show')).toBe(true)
  act(() => root.render(<FppSpinner label="Aguarde" />))
  expect(host.querySelector('[role="status"]').getAttribute('aria-label')).toBe('Aguarde')
})
