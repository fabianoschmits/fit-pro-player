// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BodyMapView } from './BodyMap.jsx'

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

describe('body-map shape rendering', () => {
  it('transforms the neck and each anatomical arm side independently', () => {
    const view = {
      vb: '0 0 100 200',
      p: {
        neck: ['M40 20h20v10H40z'],
        biceps: ['M10 50h10v20H10z', 'M80 50h10v20H80z'],
      },
    }
    act(() => root.render(<BodyMapView
      view={view}
      viewName="front"
      levels={{}}
      decorative
      shapeScales={{ neck: 1.2, biceps: { left: 1.3, right: .9 } }}
    />))

    const neck = container.querySelector('.bm-sil').parentElement
    const arms = [...container.querySelectorAll('.bm-shape-path')]
    expect(neck.classList.contains('bm-shape-group')).toBe(true)
    expect(neck.style.transform).toBe('scaleX(1.2)')
    expect(arms[0].style.transform).toBe('scaleX(0.9)')
    expect(arms[1].style.transform).toBe('scaleX(1.3)')
  })

  it('exposes one keyboard control per muscle instead of every SVG fragment', () => {
    const picked = []
    const view = {
      vb: '0 0 100 200',
      p: { biceps: ['M10 50h10v20H10z', 'M80 50h10v20H80z'] },
    }
    act(() => root.render(<BodyMapView
      view={view}
      viewName="front"
      levels={{}}
      selected="biceps"
      onMuscle={slug => picked.push(slug)}
    />))

    const paths = [...container.querySelectorAll('.bm-m')]
    expect(paths[0].getAttribute('role')).toBe('button')
    expect(paths[0].getAttribute('tabindex')).toBe('0')
    expect(paths[0].getAttribute('aria-pressed')).toBe('true')
    expect(paths[1].getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelectorAll('title')).toHaveLength(0)

    act(() => paths[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(picked).toEqual(['biceps'])
  })
})
