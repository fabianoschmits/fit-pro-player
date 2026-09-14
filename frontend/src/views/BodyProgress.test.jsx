// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BodyProgress from './BodyProgress.jsx'

const mocks = vi.hoisted(() => ({
  S: { body: 'female', bodyMeasurements: [], bodyMeasurementGoals: {} },
  update: vi.fn(),
  mapProps: null,
  navigate: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('../store/useStore.js', () => ({
  useStore: selector => selector({ S: mocks.S, update: mocks.update }),
}))
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: mocks.toast }) } }))
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('../sheets.jsx', () => ({ confirmSheet: vi.fn() }))
vi.mock('../components/MeasurementBodyMap.jsx', () => ({
  default: props => {
    mocks.mapProps = props
    return React.createElement('div', { 'data-map-view': props.view, 'data-map-body': props.body },
      React.createElement('button', { onClick: () => props.onSelect('right-arm') }, 'Braço direito no corpo'))
  },
}))
vi.mock('../components/LineChart.jsx', () => ({ default: props => React.createElement('div', { 'data-chart-points': props.points.length }) }))
vi.mock('../components/Icon.jsx', () => ({ default: ({ name }) => React.createElement('span', { 'data-icon': name }) }))

let root
let container

const click = async element => act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const button = text => [...container.querySelectorAll('button')].find(element => element.textContent.trim() === text)
const render = async () => act(async () => root.render(<BodyProgress />))
const inputValue = async (element, value) => act(async () => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 13, 12))
  window.matchMedia = () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  window.requestAnimationFrame = callback => callback()
  mocks.S = { body: 'female', bodyMeasurements: [], bodyMeasurementGoals: {} }
  mocks.update.mockImplementation(mutator => mutator(mocks.S))
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('body progress page', () => {
  it('starts empty and uses the configured real-body wrapper in both views', async () => {
    await render()
    expect(container.textContent).toContain('0 de 14 circunferências')
    expect(container.textContent).not.toContain('101 cm')
    expect(mocks.mapProps.body).toBe('female')
    expect(mocks.mapProps.view).toBe('front')

    await click(button('Costas'))
    expect(mocks.mapProps.view).toBe('back')
  })

  it('keeps map selection in sync and merges decimal measurements into the weekly check-in', async () => {
    await render()
    const input = container.querySelector('#body-measurement-value')
    await inputValue(input, '101,5')
    await click(button('Salvar medida'))
    expect(mocks.S.bodyMeasurements).toHaveLength(1)
    expect(mocks.S.bodyMeasurements[0].values.chest).toBe(101.5)

    await click(button('Braço direito no corpo'))
    await act(async () => vi.advanceTimersByTime(250))
    expect(container.textContent).toContain('Braço direito')
    const armInput = container.querySelector('#body-measurement-value')
    await inputValue(armInput, '36,2')
    await click(button('Salvar medida'))
    expect(mocks.S.bodyMeasurements).toHaveLength(1)
    expect(mocks.S.bodyMeasurements[0].values).toMatchObject({ chest: 101.5, 'right-arm': 36.2 })
  })

  it('shows comparison after two weekly check-ins', async () => {
    mocks.S.bodyMeasurements = [
      { date: '2026-08-31', values: { chest: 99, waist: 91 } },
      { date: '2026-09-07', values: { chest: 101, waist: 89 } },
    ]
    await render()
    await click(button('Comparar'))
    expect(container.textContent).toContain('Escolha dois momentos')
    expect(container.textContent).toContain('+2 cm')
    expect(container.textContent).toContain('-2 cm')
  })

  it('synchronizes the historical silhouette, date slider and exact chart series', async () => {
    mocks.S.bodyweight = [
      { d: '2026-08-31', w: 101 },
      { d: '2026-09-07', w: 98 },
    ]
    mocks.S.bodyMeasurements = [
      { date: '2026-08-31', values: { chest: 110, abdomen: 120 } },
      { date: '2026-09-07', values: { chest: 106, abdomen: 114 } },
    ]
    await render()
    await click(button('Evolução'))

    expect(container.textContent).toContain('Evolução no tempo')
    expect(container.querySelector('input[type="range"]')).not.toBeNull()
    expect(mocks.mapProps.baselineValues).toMatchObject({ chest: 110, abdomen: 120 })
    expect(mocks.mapProps.shapeValues).toMatchObject({ chest: 106, abdomen: 114 })
    expect(container.textContent).toContain('2 de 2')
    expect(container.textContent).toContain('2 registros')
  })
})
