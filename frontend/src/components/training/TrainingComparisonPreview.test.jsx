// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it } from 'vitest'
import TrainingComparisonPreview, { trainingComparisonHref } from './TrainingComparisonPreview.jsx'

let root, container
function Location() { return <output>{useLocation().pathname}{useLocation().search}</output> }
const render = workout => act(async () => root.render(<MemoryRouter><TrainingComparisonPreview workout={workout} /><Location /></MemoryRouter>))
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

it('invites the first workout when no completed session exists', async () => {
  await render(null)
  expect(container.querySelector('h2').textContent).toBe('Mapa do treino')
  expect(container.textContent).toContain('Compare o planejado com o que você realizou.')
  expect(container.textContent).toContain('Conclua seu primeiro treino para visualizar seu mapa muscular.')
  const button = container.querySelector('button')
  expect(button.textContent).toContain('Começar treino')
  await act(async () => button.click())
  expect(container.querySelector('output').textContent).toBe('/workout')
})

it('describes a saved comparison and encodes the selected session destination', async () => {
  await render({ id: 'session /one', name: 'Treino recente', d: '2026-11-23', comparison: { version: 1, origin: 'personal', planned: [], adjusted: [] } })
  expect(container.textContent).toContain('Veja o planejamento, os ajustes e os músculos trabalhados.')
  await act(async () => container.querySelector('button').click())
  expect(container.querySelector('output').textContent).toBe('/progress/training-map?session=session%20%2Fone')
  expect(trainingComparisonHref()).toBe('/progress/training-map')
})

it('explains the unavailable original for legacy history', async () => {
  await render({ id: 'old', name: 'Treino antigo', d: '2026-01-01', entries: [] })
  expect(container.textContent).toContain('O planejamento original não foi registrado neste treino.')
})
