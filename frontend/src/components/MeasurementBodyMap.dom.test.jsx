// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./BodyMap.jsx', () => ({
  default: props => <div data-testid="body-map" data-shape-scales={JSON.stringify(props.shapeScales)} />,
}))

import MeasurementBodyMap from './MeasurementBodyMap.jsx'

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('measurement body-map data honesty', () => {
  it('uses a large fallback for geometry without presenting estimated centimetres', () => {
    act(() => root.render(<MeasurementBodyMap
      body="male"
      selected="abdomen"
      latestValues={{}}
      weekValues={{}}
      fallbackScales={{ abdomen: 1.34, waist: 1.3, 'left-arm': 1.13, 'right-arm': 1.13 }}
    />))

    const abdomen = [...container.querySelectorAll('.measurement-hotspot')]
      .find(element => element.getAttribute('aria-label').startsWith('Circunferência do abdômen'))
    const abdomenRing = container.querySelectorAll('.measurement-ring')[8]

    expect(abdomen.getAttribute('aria-label')).toContain('sem registro')
    expect(abdomen.getAttribute('aria-label')).not.toContain('centímetros')
    expect(abdomen.textContent).toBe('Abdômen')
    expect(abdomenRing.classList.contains('empty')).toBe(true)
    expect(JSON.parse(container.querySelector('[data-testid="body-map"]').dataset.shapeScales).abs).toBe(1.34)
  })
})
