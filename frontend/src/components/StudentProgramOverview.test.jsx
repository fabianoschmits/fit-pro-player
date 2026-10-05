// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StudentProgramOverview from './StudentProgramOverview.jsx'
import { MemoryRouter } from 'react-router-dom'

let dom
let root
let container

beforeEach(() => {
  dom = new Window({ url: 'https://app.example/#/connect' })
  globalThis.window = dom; globalThis.document = dom.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('student professional program overview', () => {
  it('uses a compact management summary with one next workout and a prescription destination', async () => {
    await act(async () => root.render(<MemoryRouter><StudentProgramOverview managementCompact trainingTo="/student/professionals/p1?section=training" overview={{ program: { title: 'Força' }, professional: { name: 'Ana' }, version: { versionNumber: 1, weeklyPlan: { monday: [{ exerciseId: '1254' }] } }, executions: [{ id: 'e1', day_key: 'monday', status: 'completed' }] }} /></MemoryRouter>))
    expect(container.querySelectorAll('.management-panel')).toHaveLength(2)
    expect([...container.querySelectorAll('button')].filter(x => x.textContent.includes('Iniciar'))).toHaveLength(1)
    expect(container.textContent).not.toContain('Histórico')
    expect(container.querySelector('a[href="/student/professionals/p1?section=training"]')).not.toBeNull()
  })
  it('shows current program, upcoming sessions and execution history', async () => {
    const onStart = vi.fn()
    await act(async () => root.render(<StudentProgramOverview overview={{ program: { title: 'Força' }, professional: { name: 'Prof. Ana' }, version: { versionNumber: 2, weeklyPlan: { monday: [{ exerciseId: '1254' }] } }, executions: [{ id: 'execution-1', status: 'completed', day_key: 'monday' }] }} onStart={onStart} />))
    expect(container.textContent).toContain('Força')
    expect(container.textContent).toContain('Prof. Ana')
    expect(container.textContent).toContain('Próximos treinos')
    expect(container.textContent).toContain('Histórico')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Iniciar')).click())
    expect(onStart).toHaveBeenCalled()
  })
})
