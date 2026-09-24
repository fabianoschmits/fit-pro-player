// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProfessionalProgramEditor from './ProfessionalProgramEditor.jsx'

let dom
let root
let container

beforeEach(() => {
  dom = new Window({ url: 'https://app.example/#/professional' })
  globalThis.window = dom; globalThis.document = dom.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('professional program editor', () => {
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
    await act(async () => [...container.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === 'Adicionar').click())
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
    expect(container.querySelector('[role="dialog"]')).toBeTruthy()
    expect(container.textContent).toContain('Barbell squat')
    expect(container.textContent).toContain('Cable row')
    const search = container.querySelector('input[aria-label="Pesquisar exercício"]')
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(search, 'cable'); search.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(container.textContent).not.toContain('Barbell squat')
    expect(container.textContent).toContain('Cable row')
    const animationToggle = container.querySelector('button[aria-label="Ver animação de Cable row"]')
    expect(animationToggle).toBeTruthy()
    await act(async () => animationToggle.click())
    expect(animationToggle.getAttribute('aria-expanded')).toBe('true')
  })

  it('removes a selected exercise from the current day', async () => {
    await act(async () => root.render(<ProfessionalProgramEditor exercises={[{ id: '9997', n: 'Agachamento' }]} initialPlan={{}} onPublish={vi.fn()} onCancel={vi.fn()} />))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Adicionar exercício')).click())
    await act(async () => [...container.querySelectorAll('[role="dialog"] button')].find(button => button.textContent === 'Adicionar').click())
    expect(container.textContent).toContain('Agachamento')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Remover').click())
    expect(container.textContent).toContain('Nenhum exercício neste dia.')
  })
})
