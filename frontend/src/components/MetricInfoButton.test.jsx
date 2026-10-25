// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MetricInfoButton from './MetricInfoButton.jsx'

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => root.render(<MetricInfoButton label="RP" description="Seu recorde pessoal." />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('metric info button', () => {
  it('renders its explanation above the card instead of inside the trigger tree', () => {
    act(() => container.querySelector('button').click())

    expect(container.querySelector('.metric-info-popover')).toBeNull()
    expect(document.body.querySelector('.metric-info-popover')?.textContent).toBe('Seu recorde pessoal.')
  })

  it('closes its explanation when the user touches anywhere outside it', () => {
    act(() => container.querySelector('button').click())
    expect(document.body.querySelector('.metric-info-popover')).not.toBeNull()

    act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(document.body.querySelector('.metric-info-popover')).toBeNull()
  })

  it('keeps only the most recently clicked explanation open', () => {
    act(() => root.render(<><MetricInfoButton label="RP" description="Recorde pessoal." /><MetricInfoButton label="RIR" description="Repetições em reserva." /></>))
    const [rp, rir] = container.querySelectorAll('button')

    act(() => rp.click())
    act(() => rir.click())

    expect(document.body.querySelectorAll('.metric-info-popover')).toHaveLength(1)
    expect(document.body.querySelector('.metric-info-popover')?.textContent).toBe('Repetições em reserva.')
  })

  it('does not activate the surrounding exercise card when its label is clicked', () => {
    const openExercise = vi.fn()
    act(() => root.render(<div onClick={openExercise}><MetricInfoButton label="RIR 3" description="Repetições em reserva." /></div>))

    act(() => container.querySelector('button').click())

    expect(openExercise).not.toHaveBeenCalled()
    expect(document.body.querySelector('.metric-info-popover')?.textContent).toBe('Repetições em reserva.')
  })
})
