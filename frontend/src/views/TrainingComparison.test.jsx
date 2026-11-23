// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TrainingComparison from './TrainingComparison.jsx'

const mocks = vi.hoisted(() => ({ S: { workouts: [], body: 'male' }, sheet: null, openFocus: null, close: vi.fn(), maps: [] }))
vi.mock('../store/useStore.js', () => ({ useStore: selector => selector({ S: mocks.S }) }))
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ openSheet: render => { mocks.openFocus = document.activeElement; mocks.sheet = render; return { close: mocks.close } } }) } }))
vi.mock('../components/BodyMap.jsx', () => ({ default: props => {
  mocks.maps.push(props)
  return <button data-body-map={props.view} onClick={() => props.onMuscle('chest')}>Peitoral no mapa</button>
}, BodyMapLegend: () => null }))

const snapshot = count => [{ exerciseId: '0025', workSets: count, muscleWeights: { chest: 1, triceps: .4 } }]
const workout = (id = 'recent', count = 3) => ({ id, name: `Treino ${id}`, d: '2026-11-23', start: 100, end: 200,
  comparison: { version: 1, origin: 'personal', planned: snapshot(3), adjusted: snapshot(2), flexApplied: true },
  entries: [{ id: '0025', sets: Array.from({ length: count }, () => ({ done: true, reps: 10, weight: 20 })) }],
})
let root, container
const click = element => act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const button = text => [...container.querySelectorAll('button')].find(element => element.textContent.trim() === text)
const render = (search = '') => act(async () => root.render(<MemoryRouter key={search} initialEntries={[`/progress/training-map${search}`]}><TrainingComparison /></MemoryRouter>))

beforeEach(() => {
  mocks.S = { workouts: [workout()], body: 'male' }
  mocks.sheet = null; mocks.openFocus = null; mocks.maps = []
  container = document.createElement('div'); document.body.append(container)
  root = createRoot(container)
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllMocks() })

describe('training comparison', () => {
  it('shows the latest session with uncapped execution and all three counts', async () => {
    await render()
    expect(container.querySelector('h1').textContent).toBe('Planejado × Realizado')
    expect(container.textContent).toContain('Veja como o seu treino aconteceu.')
    expect(container.textContent).toContain('Treino recent')
    expect(container.querySelector('[data-comparison-execution]').textContent).toContain('150%')
    expect(container.querySelector('[data-comparison-execution]').textContent).toContain('Execução das séries')
    expect(container.querySelector('.tc-summary').textContent).toContain('FPP Flex aplicado')
    expect(container.querySelector('.tc-summary').textContent).toContain('3 de 2 séries ajustadas concluídas.')
    const rows = container.querySelectorAll('.tc-summary tbody tr')
    expect(rows[0].textContent).toContain('Exercícios111')
    expect(rows[1].textContent).toContain('Séries de trabalho323')
    expect(mocks.maps.every(map => JSON.stringify(map.thresholds) === JSON.stringify(mocks.maps[0].thresholds))).toBe(true)
  })
  it('keeps an invalid requested session unavailable instead of showing the latest', async () => {
    await render('?session=other-account')
    expect(container.textContent).toContain('Treino indisponível')
    expect(container.textContent).not.toContain('Treino recent')
    expect(container.querySelector('.tc-summary')).toBeNull()
  })
  it('chooses the latest dated history even when imported sessions have no clock', async () => {
    mocks.S.workouts = [
      { ...workout('old-clock'), d: '2025-01-01', start: 999, end: 1000 },
      { ...workout('latest-import'), d: '2026-11-23', start: undefined, end: undefined },
    ]
    await render()
    expect(container.querySelector('.tc-session-picker').textContent).toContain('Treino latest-import')
  })
  it('shows an empty state with a workout action when history is empty', async () => {
    mocks.S.workouts = []
    await render()
    expect(container.textContent).toContain('Seu primeiro comparativo começa com um treino.')
    expect(button('Começar treino')).toBeTruthy()
  })
  it('shows only actual training for legacy history', async () => {
    delete mocks.S.workouts[0].comparison
    await render()
    expect(container.textContent).toContain('Este treino foi registrado antes do novo comparativo. Você ainda pode visualizar os músculos trabalhados.')
    expect(container.querySelectorAll('.tc-map-panel')).toHaveLength(1)
    expect(container.querySelector('[data-comparison-execution]')).toBeNull()
    expect(container.querySelector('.tc-summary').textContent).toContain('Sem referência planejada')
    expect(container.querySelector('.tc-summary').textContent).toContain('—')
  })
  it('explains freestyle without creating a reference percentage', async () => {
    mocks.S.workouts[0].comparison = { version: 1, origin: 'freestyle', planned: [], adjusted: [], flexApplied: false }
    await render()
    expect(container.textContent).toContain('Este treino livre não tinha uma referência planejada.')
    expect(container.querySelector('[data-comparison-execution]')).toBeNull()
  })
  it('reveals the selected muscle values across all stages', async () => {
    await render()
    await click(container.querySelector('[data-body-map]'))
    const details = container.querySelector('.tc-muscle-detail')
    expect(details.textContent).toContain('Peito')
    expect(details.textContent).toContain('Original')
    expect(details.textContent).toContain('Ajustado')
    expect(details.textContent).toContain('Realizado')
    expect(details.textContent).toContain('Foram realizadas mais séries ponderadas para este músculo do que na referência ajustada.')
    expect(container.querySelector('.tc-map-legend').textContent).toContain('0,75')
  })
  it('limits the session sheet and progressively reveals older sessions', async () => {
    mocks.S.workouts = Array.from({ length: 25 }, (_, index) => ({ ...workout(`session-${index}`), end: index + 1 }))
    await render()
    await click(container.querySelector('[data-session-picker]'))
    await act(async () => root.render(mocks.sheet(mocks.close)))
    expect(container.querySelectorAll('[data-session-option]')).toHaveLength(8)
    expect(container.querySelector('[data-session-option]').textContent).toContain('FPP Flex')
    await click(button('Ver mais treinos'))
    expect(container.querySelectorAll('[data-session-option]')).toHaveLength(16)
  })
  it('gives the session sheet its trigger even when pointer activation did not focus the button', async () => {
    await render()
    const picker = container.querySelector('[data-session-picker]')
    expect(document.activeElement).not.toBe(picker)
    await click(picker)
    expect(mocks.openFocus).toBe(picker)
  })
  it('never reads a removed session after the account state changes', async () => {
    await render('?session=recent')
    mocks.S = { workouts: [], body: 'female' }
    await render('?session=recent')
    expect(container.textContent).toContain('Treino indisponível')
    expect(container.querySelector('.tc-summary')).toBeNull()
  })
})
