// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ProfessionalWorkspaceNav from './ProfessionalWorkspaceNav.jsx'

let dom, root, container
beforeEach(() => { dom = new Window({ url: 'https://app.example/#/professional' }); globalThis.window = dom; globalThis.document = dom.document; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('professional workspace navigation', () => {
  it('exposes focused workspace destinations without changing the main tab bar', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/students']}><ProfessionalWorkspaceNav /></MemoryRouter>))
    expect(container.textContent).toContain('Visão geral')
    expect(container.textContent).toContain('Alunos')
    expect(container.textContent).toContain('Convites')
    expect(container.textContent).toContain('Programas')
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('Alunos')
  })
})
