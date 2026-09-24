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
    await act(async () => root.render(<ProfessionalProgramEditor exercises={[{ id: '1254', n: 'Agachamento' }]} initialPlan={{}} onPublish={onPublish} onCancel={vi.fn()} />))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Publicar')).click())
    expect(container.textContent).toContain('Adicione pelo menos um exercício')
    expect(onPublish).not.toHaveBeenCalled()
  })

  it('adds an exercise to a selected day and publishes the edited plan', async () => {
    const onPublish = vi.fn()
    await act(async () => root.render(<ProfessionalProgramEditor exercises={[{ id: '1254', n: 'Agachamento' }]} initialPlan={{}} onPublish={onPublish} onCancel={vi.fn()} />))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Adicionar Agachamento')).click())
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent.includes('Publicar')).click())
    expect(onPublish).toHaveBeenCalledWith(expect.objectContaining({ monday: [expect.objectContaining({ exerciseId: '1254' })] }))
  })
})
