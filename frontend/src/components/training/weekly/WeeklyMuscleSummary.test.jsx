// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import WeeklyMuscleSummary from './WeeklyMuscleSummary.jsx'
import { t } from '../../../lib/i18n.js'
vi.mock('../../BodyMap.jsx', () => ({ default: ({ onMuscle }) => <button onClick={() => onMuscle('abs')}>Select abs</button>, BodyMapLegend: () => null }))
let root, container
afterEach(() => { act(() => root?.unmount()); container?.remove() })
it('shows recorded zero activity when the anatomy selects an unworked muscle', () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  const muscles = { actualLoad: { abs: 0 }, directSets: { abs: 0 }, ranking: [], thresholds: [], unknownMuscleSets: 0 }
  act(() => root.render(<WeeklyMuscleSummary muscles={muscles} body="male" workouts={[]} onWorkout={vi.fn()} />))
  expect(container.querySelectorAll('select option:not([disabled])')).toHaveLength(18)
  act(() => [...container.querySelectorAll('button')].find(button => button.textContent === 'Select abs').click())
  expect(container.querySelector('.weekly-muscle-detail')?.textContent).toContain(t('Abs'))
  expect(container.querySelector('.weekly-muscle-detail')?.textContent).toContain(`${t('Weighted sets')}: 0`)
})
