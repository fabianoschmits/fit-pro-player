// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BodyProgress from './BodyProgress.jsx'
import { BODY_MEASUREMENT_PARTS } from '../lib/body-measurements.js'

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

  it('uses profile sex and weight as visual-only geometry when no tape measure exists', async () => {
    mocks.S = {
      body: 'female', unit: 'kg', bodyMeasurements: [], bodyMeasurementGoals: {},
      profile: { sex: 'male', heightCm: 178, startWeight: 110 },
      bodyweight: [{ d: '2026-09-13', w: 110, t: 1 }],
    }
    await render()

    expect(mocks.mapProps.body).toBe('male')
    expect(mocks.mapProps.latestValues).toEqual({})
    expect(mocks.mapProps.fallbackScales.abdomen).toBeGreaterThan(1.2)
    expect(mocks.mapProps.fallbackScales['left-arm']).toBeGreaterThan(1)
    expect(mocks.mapProps.fallbackScales['left-thigh']).toBeGreaterThan(1)
    expect(container.textContent).toContain('0 de 14 circunferências')
    expect(container.textContent).not.toContain('110 cm')
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

  it('compares the first check-in with the latest one by default', async () => {
    const firstValues = Object.fromEntries(BODY_MEASUREMENT_PARTS.map((part, index) => [part.id, 100 + index]))
    const middleValues = Object.fromEntries(BODY_MEASUREMENT_PARTS.map((part, index) => [part.id, 95 + index]))
    const lastValues = Object.fromEntries(BODY_MEASUREMENT_PARTS.map((part, index) => [part.id, 90 + index]))
    firstValues['left-arm'] = 37
    middleValues['left-arm'] = 39
    lastValues['left-arm'] = 40
    mocks.S.bodyMeasurements = [
      { date: '2026-08-24', values: firstValues },
      { date: '2026-08-31', values: middleValues },
      { date: '2026-09-07', values: lastValues },
    ]
    await render()
    await click(button('Comparar'))

    const selectors = [...container.querySelectorAll('.bp-date-selectors select')]
    expect(selectors[0].value).toBe('body-2026-08-24')
    expect(selectors[1].value).toBe('body-2026-09-07')
    expect(container.querySelectorAll('.bp-compare-row:not(.header)')).toHaveLength(BODY_MEASUREMENT_PARTS.length)
    expect(container.textContent).toContain('-10 cm')
    expect(container.textContent).toContain('+3 cm')
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

  it('renders a causal body timeline from weight alone and changes every fallback region', async () => {
    mocks.S = {
      body: 'male', unit: 'kg', bodyMeasurements: [], bodyMeasurementGoals: {},
      profile: { sex: 'male', heightCm: 178, startWeight: 71 },
      bodyweight: [
        { d: '2026-08-31', w: 110, t: 1 },
        { d: '2026-09-07', w: 71, t: 2 },
      ],
    }
    await render()
    await click(button('Evolução'))

    const slider = container.querySelector('input[type="range"]')
    expect(slider).not.toBeNull()
    expect(mocks.mapProps.latestValues).toEqual({})
    const finish = { ...mocks.mapProps.fallbackScales }
    expect(container.textContent).toContain('2 de 2')

    await inputValue(slider, slider.min)
    BODY_MEASUREMENT_PARTS.forEach(part => {
      expect(mocks.mapProps.fallbackScales[part.id]).toBeGreaterThan(finish[part.id])
    })
    expect(container.querySelector('.bp-history-metrics').textContent).toContain('Medições reais0')
    expect(container.textContent).toContain('1 de 2')
  })

  it('never exposes a circumference before its real measurement date', async () => {
    mocks.S = {
      body: 'male', unit: 'kg', bodyMeasurementGoals: {},
      profile: { sex: 'male', heightCm: 178, startWeight: 100 },
      bodyweight: [
        { d: '2026-01-01', w: 110, t: 1 },
        { d: '2026-01-15', w: 105, t: 2 },
        { d: '2026-02-01', w: 100, t: 3 },
      ],
      bodyMeasurements: [{ date: '2026-02-01', values: { waist: 105 } }],
    }
    await render()
    await click(button('Evolução'))

    const slider = container.querySelector('input[type="range"]')
    await inputValue(slider, String(new Date('2026-01-15T12:00:00').getTime()))
    expect(mocks.mapProps.latestValues.waist).toBeUndefined()
    expect(mocks.mapProps.shapeValues.waist).toBeUndefined()
    expect(mocks.mapProps.fallbackScales.waist).toBeGreaterThan(1)

    await inputValue(slider, slider.max)
    expect(mocks.mapProps.latestValues.waist).toBe(105)
    expect(mocks.mapProps.shapeValues.waist).toBe(105)
  })

  it('ignores weight-only records when choosing comparison dates', async () => {
    mocks.S.bodyMeasurements = [
      { date: '2026-08-17', weight: 110, values: {} },
      { date: '2026-08-24', values: { chest: 110 } },
      { date: '2026-08-31', weight: 104, values: {} },
      { date: '2026-09-07', values: { chest: 101 } },
    ]
    await render()
    await click(button('Comparar'))

    const selectors = [...container.querySelectorAll('.bp-date-selectors select')]
    expect(selectors[0].value).toBe('body-2026-08-24')
    expect(selectors[1].value).toBe('body-2026-09-07')
    expect(selectors[0].querySelectorAll('option')).toHaveLength(2)
  })

  it('keeps the current week out of the check-in archive and reveals only direct old measurements', async () => {
    mocks.S.bodyMeasurements = [
      { date: '2026-08-24', values: { chest: 105, abdomen: 121 } },
      { date: '2026-08-31', values: { chest: 100 } },
      { date: '2026-09-07', values: { chest: 98, abdomen: 114 } },
    ]
    await render()

    const archived = [...container.querySelectorAll('.bp-checkin-item')]
    expect(archived.map(item => item.dataset.checkinDate)).toEqual(['2026-08-31', '2026-08-24'])
    expect(container.querySelector('[data-checkin-date="2026-09-07"]')).toBeNull()

    const latestOld = container.querySelector('[data-checkin-date="2026-08-31"]')
    const summary = latestOld.querySelector('.bp-checkin-summary')
    expect(summary.getAttribute('aria-expanded')).toBe('false')
    await click(summary)

    expect(summary.getAttribute('aria-expanded')).toBe('true')
    expect(latestOld.querySelectorAll('.bp-checkin-value')).toHaveLength(BODY_MEASUREMENT_PARTS.length)
    expect(latestOld.textContent).toContain('-5 cm desde o registro anterior')
    expect(latestOld.textContent).toContain('Não registrada')
    expect(latestOld.textContent).not.toContain('121 cm')
  })

  it('loads more archived weeks without making the annual history unwieldy', async () => {
    mocks.S.bodyMeasurements = [
      ...['2026-07-20', '2026-07-27', '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31']
        .map((date, index) => ({ date, values: { chest: 107 - index } })),
      { date: '2026-09-07', values: { chest: 99 } },
    ]
    await render()

    expect(container.querySelectorAll('.bp-checkin-item')).toHaveLength(6)
    await click(button('Mostrar mais (1)'))
    expect(container.querySelectorAll('.bp-checkin-item')).toHaveLength(7)
    expect(button('Recolher histórico')).not.toBeUndefined()
  })

  it('opens an archived check-in at the matching point in body evolution', async () => {
    mocks.S.bodyMeasurements = [
      { date: '2026-08-24', values: { chest: 110, abdomen: 120 } },
      { date: '2026-08-31', values: { chest: 106, abdomen: 114 } },
      { date: '2026-09-07', values: { chest: 103, abdomen: 109 } },
    ]
    await render()

    const oldest = container.querySelector('[data-checkin-date="2026-08-24"]')
    await click(oldest.querySelector('.bp-checkin-summary'))
    await click(button('Abrir na evolução'))

    expect(container.textContent).toContain('Evolução no tempo')
    expect(mocks.mapProps.shapeValues).toMatchObject({ chest: 110, abdomen: 120 })
    expect(Number(container.querySelector('input[type="range"]').value)).toBe(new Date('2026-08-24T12:00:00').getTime())
    expect(document.activeElement?.id).toBe('bp-evolution-map')
  })
})
