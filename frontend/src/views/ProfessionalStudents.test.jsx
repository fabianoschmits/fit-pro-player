// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: { status: 'authenticated', user: { id: 'pro-1' } }, repo: { studentPage: vi.fn().mockImplementation(async ({ search = '', status = 'all', offset = 0 }) => { const all = [{ studentUserId: 's1', displayName: 'Ana', programTitle: 'Força', currentProgram: { title: 'Força' } }, { studentUserId: 's2', displayName: 'Bruno', programTitle: null }]; const items = all.filter(item => (!search || item.displayName.toLowerCase().includes(search.toLowerCase())) && (status !== 'without_program' || !item.currentProgram)); return { items, total: items.length, offset, hasMore: false } }) } }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
vi.mock('../lib/professional-workflow.js', () => ({ createProfessionalWorkflowRepository: () => mocks.repo }))
vi.mock('../components/AppHeader.jsx', () => ({ default: ({ title, action }) => <header><h1>{title}</h1>{action}</header> }))
import ProfessionalStudents from './ProfessionalStudents.jsx'

let dom, root, container
beforeEach(() => { dom = new Window({ url: 'https://app.example/#/professional/students' }); globalThis.window = dom; globalThis.document = dom.document; globalThis.IS_REACT_ACT_ENVIRONMENT = true; container = document.createElement('div'); document.body.append(container); root = createRoot(container) })
afterEach(async () => { await act(async () => root.unmount()); dom.close() })

describe('professional students page', () => {
  it('searches names while retaining the selected version handoff', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/students?program=p1&version=v1']}><ProfessionalStudents /></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    const input = container.querySelector('input[type="search"]')
    await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'ana'); input.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(container.textContent).toContain('Ana')
    expect(container.textContent).not.toContain('Bruno')
    const href = container.querySelector('a[href^="/professional/students/s1?"]')?.getAttribute('href') || ''
    expect(href).toContain('program=p1'); expect(href).toContain('version=v1')
  })
  it('searches and filters real active students without mixing invites', async () => {
    await act(async () => root.render(<MemoryRouter initialEntries={['/professional/students']}><ProfessionalStudents /></MemoryRouter>))
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.textContent).toContain('Ana')
    expect(container.textContent).toContain('Bruno')
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Sem programa').click())
    expect(container.textContent).toContain('Bruno')
    expect(container.textContent).not.toContain('Ana')
  })
})
