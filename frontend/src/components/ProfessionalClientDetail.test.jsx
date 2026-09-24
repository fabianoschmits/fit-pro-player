// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProfessionalClientDetail from './ProfessionalClientDetail.jsx'

let dom
let root
let container

beforeEach(() => {
  dom = new Window({ url: 'https://app.example/#/professional' })
  globalThis.window = dom; globalThis.document = dom.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('professional client detail', () => {
  it('shows client history and only enables explicit assignment with a selected version', async () => {
    const onAssign = vi.fn()
    await act(async () => root.render(<ProfessionalClientDetail client={{ studentUserId: 'student-1', displayName: 'Ana', programTitle: 'Força' }} detail={{ assignments: [{ id: 'assignment-1', program_title: 'Força', version_number: 2 }], executions: [{ id: 'execution-1', status: 'completed', day_key: 'monday' }] }} versions={[{ id: 'version-2', version_number: 2 }]} onAssign={onAssign} onClose={vi.fn()} />))
    expect(container.textContent).toContain('Ana')
    expect(container.textContent).toContain('Histórico de treinos')
    expect(container.textContent).toContain('completed')
    const assign = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Enviar versão'))
    expect(assign.disabled).toBe(true)
    const select = container.querySelector('select')
    select.value = 'version-2'
    await act(async () => select.dispatchEvent(new dom.Event('change', { bubbles: true })))
    expect(assign.disabled).toBe(false)
    await act(async () => assign.click())
    expect(onAssign).toHaveBeenCalledWith('version-2')
  })
})
