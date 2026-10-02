// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProfessionalProgramEditor from './ProfessionalProgramEditor.jsx'
import { useStore } from '../store/useStore.js'

let dom
let root
let container

beforeEach(() => {
  dom = new Window({ url: 'https://app.example/#/professional' })
  globalThis.window = dom; globalThis.document = dom.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  useStore.setState({ S: { ...useStore.getState().S, professionalProgramDrafts: {} } })
})
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('professional program editor', () => {
  it('saves program metadata without publishing a new prescription', async () => {
    const save = vi.fn(); const publish = vi.fn()
    await act(async () => root.render(<ProfessionalProgramEditor initialMetadata={{ title: 'Força', description: 'Base' }} initialPlan={{}} onSaveMetadata={save} onPublish={publish} onCancel={vi.fn()} />))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Salvar dados do programa').click())
    expect(save).toHaveBeenCalledWith({ title: 'Força', description: 'Base' })
    expect(publish).not.toHaveBeenCalled()
  })
  it('keeps a recoverable draft after publication fails and blocks duplicate submission while pending', async () => {
    let reject
    const publish = () => new Promise((_, fail) => { reject = fail })
    const props = { draftKey: 'program', exercises: [{ id: '9997', n: 'Agachamento' }], initialPlan: { monday: [{ exerciseId: '9997', sets: 3, reps: 8, rest: 75 }] }, onPublish: publish, onCancel: vi.fn() }
    await act(async () => root.render(<ProfessionalProgramEditor {...props} />))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Publicar')).click())
    expect([...container.querySelectorAll('button')].find(button => button.textContent.includes('Publicando')).disabled).toBe(true)
    await act(async () => reject(new Error('offline')))
    expect(container.querySelector('[role="alert"]').textContent).toContain('rascunho')
    expect(useStore.getState().S.professionalProgramDrafts.program.plan.monday[0].rest).toBe(75)
  })
  it('duplicates and reorders prescriptions without losing rest, notes and cardio duration', async () => {
    const publish = vi.fn()
    const initialPlan = { monday: [{ exerciseId: '9997', sets: 1, reps: 1, mode: 'cardio', min: 30, speed: 7, rest: 45, notes: 'Leve' }] }
    await act(async () => root.render(<ProfessionalProgramEditor exercises={[{ id: '9997', n: 'Corrida' }]} initialPlan={initialPlan} onPublish={publish} onCancel={vi.fn()} />))
    expect(container.textContent).toContain('Descanso (s)')
    await act(async () => container.querySelector('button[aria-label="Duplicar exercício 1"]').click())
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Publicar')).click())
    expect(publish).toHaveBeenCalledWith({ monday: [expect.objectContaining({ min: 30, notes: 'Leve' }), expect.objectContaining({ min: 30, rest: 45 })] })
  })
  it('requires an exercise before publishing', async () => {
    const onPublish = vi.fn()
    await act(async () => root.render(<ProfessionalProgramEditor exercises={[{ id: '9997', n: 'Agachamento' }]} initialPlan={{}} onPublish={onPublish} onCancel={vi.fn()} />))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Publicar')).click())
    expect(container.textContent).toContain('Adicione pelo menos um exercício')
    expect(onPublish).not.toHaveBeenCalled()
  })

  it('adds an exercise to a selected day and publishes the edited plan', async () => {
    const onPublish = vi.fn()
    await act(async () => root.render(<ProfessionalProgramEditor exercises={[{ id: '9997', n: 'Agachamento' }]} initialPlan={{}} onPublish={onPublish} onCancel={vi.fn()} />))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Adicionar exercício')).click())
    await act(async () => [...document.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === 'Adicionar').click())
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Publicar')).click())
    expect(onPublish).toHaveBeenCalledWith(expect.objectContaining({ monday: [expect.objectContaining({ exerciseId: '9997' })] }))
  })

  it('opens a searchable exercise modal with translated names and expandable animation controls', async () => {
    const onPublish = vi.fn()
    const exercises = [
      { id: '9998', n: 'barbell squat' },
      { id: '9999', n: 'cable row' },
    ]
    await act(async () => root.render(<ProfessionalProgramEditor exercises={exercises} initialPlan={{}} onPublish={onPublish} onCancel={vi.fn()} />))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Adicionar exercício')).click())
    expect(document.querySelector('[role="dialog"]')).toBeTruthy()
    expect(document.body.textContent).toContain('Barbell squat')
    expect(document.body.textContent).toContain('Cable row')
    const search = document.querySelector('input[aria-label="Pesquisar exercício"]')
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(search, 'cable'); search.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(document.body.textContent).not.toContain('Barbell squat')
    expect(document.body.textContent).toContain('Cable row')
    const animationToggle = document.querySelector('button[aria-label="Ver animação de Cable row"]')
    expect(animationToggle).toBeTruthy()
    await act(async () => animationToggle.click())
    expect(animationToggle.getAttribute('aria-expanded')).toBe('true')
  })

  it('removes a selected exercise from the current day', async () => {
    await act(async () => root.render(<ProfessionalProgramEditor exercises={[{ id: '9997', n: 'Agachamento' }]} initialPlan={{}} onPublish={vi.fn()} onCancel={vi.fn()} />))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Adicionar exercício')).click())
    await act(async () => [...document.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === 'Adicionar').click())
    expect(container.textContent).toContain('Agachamento')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Remover').click())
    expect(container.textContent).toContain('Nenhum exercício neste dia.')
  })
})
